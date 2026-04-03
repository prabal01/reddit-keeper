#!/usr/bin/env tsx

/**
 * Reddit Thread Downloader
 * A standalone tool to download Reddit threads and comments in Markdown format.
 *
 * Usage: npx tsx downloader.ts <reddit-url>
 */

import chalk from "chalk";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// --- Types ---

interface RedditUrlInfo {
    subreddit: string;
    postId: string;
    fullUrl: string;
}

interface Post {
    title: string;
    author: string;
    subreddit: string;
    selftext: string;
    url: string;
    score: number;
    numComments: number;
    permalink: string;
}

interface Comment {
    id: string;
    author: string;
    body: string;
    score: number;
    parentId: string;
    depth: number;
    replies: Comment[];
}

// --- Utilities ---

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 OpinionDeck/1.0";
const RATE_LIMIT_DELAY = 1000;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRedditUrl(input: string): RedditUrlInfo {
    const trimmed = input.trim().replace(/\/$/, ""); // Remove trailing slash
    
    // Pattern for full URL
    const urlPattern = /(?:https?:\/\/)?(?:(?:www|old|new)\.)?reddit\.com\/r\/([^/]+)\/comments\/([a-z0-9]+)/i;
    const match = trimmed.match(urlPattern);

    if (match) {
        return {
            subreddit: match[1],
            postId: match[2],
            fullUrl: `https://old.reddit.com/r/${match[1]}/comments/${match[2]}`,
        };
    }

    // Pattern for shorthand r/subreddit/comments/postId
    const shortPattern = /^r\/([^/]+)\/comments\/([a-z0-9]+)/i;
    const shortMatch = trimmed.match(shortPattern);
    if (shortMatch) {
        return {
            subreddit: shortMatch[1],
            postId: shortMatch[2],
            fullUrl: `https://old.reddit.com/r/${shortMatch[1]}/comments/${shortMatch[2]}`,
        };
    }

    // Pattern for raw postId
    const idPattern = /^[a-z0-9]{5,10}$/i;
    if (idPattern.test(trimmed)) {
        return {
            subreddit: "",
            postId: trimmed,
            fullUrl: `https://old.reddit.com/comments/${trimmed}`,
        };
    }

    throw new Error(`Invalid Reddit URL or post ID: "${trimmed}"`);
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<any> {
    const USER_AGENT = "reddit-dl/1.0.0";
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                headers: { 
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json",
                },
            });

            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get("retry-after") || "5");
                await sleep(retryAfter * 1000);
                continue;
            }

            if (!response.ok) throw new Error(`HTTP ${response.status} at ${url}`);
            return await response.json();
        } catch (error: any) {
            if (attempt === maxRetries) throw error;
            await sleep(Math.pow(2, (attempt - 1)) * 1000);
        }
    }
}

function transformComment(raw: any): Comment {
    return {
        id: raw.id,
        author: raw.author || "[deleted]",
        body: raw.body || "[deleted]",
        score: raw.score || 0,
        parentId: raw.parent_id,
        depth: raw.depth || 0,
        replies: [],
    };
}

function extractComments(listing: any): { comments: Comment[]; moreIds: string[] } {
    const comments: Comment[] = [];
    const moreIds: string[] = [];

    if (!listing?.data?.children) return { comments, moreIds };

    for (const child of listing.data.children) {
        if (child.kind === "t1") {
            const comment = transformComment(child.data);
            if (child.data.replies?.data) {
                const nested = extractComments(child.data.replies);
                comment.replies = nested.comments;
                moreIds.push(...nested.moreIds);
            }
            comments.push(comment);
        } else if (child.kind === "more") {
            moreIds.push(...(child.data.children || []));
        }
    }

    return { comments, moreIds };
}

async function resolveMoreComments(tree: Comment[], moreIds: string[], linkId: string): Promise<number> {
    let fetched = 0;
    const batchSize = 100;

    for (let i = 0; i < moreIds.length; i += batchSize) {
        const batch = moreIds.slice(i, i + batchSize);
        const url = `https://www.reddit.com/api/morechildren.json?api_type=json&link_id=${linkId}&children=${batch.join(",")}`;

        try {
            const response = await fetchWithRetry(url);
            const things = response?.json?.data?.things || [];
            const newComments: Comment[] = [];

            for (const thing of things) {
                if (thing.kind === "t1") newComments.push(transformComment(thing.data));
            }

            if (newComments.length > 0) {
                const indexTree = (nodes: Comment[], lookup: Map<string, Comment>) => {
                    for (const n of nodes) {
                        lookup.set(`t1_${n.id}`, n);
                        indexTree(n.replies, lookup);
                    }
                };

                const lookup = new Map<string, Comment>();
                indexTree(tree, lookup);

                for (const nc of newComments) {
                    const parent = lookup.get(nc.parentId);
                    if (parent) parent.replies.push(nc);
                    else tree.push(nc);
                    lookup.set(`t1_${nc.id}`, nc);
                }
                fetched += newComments.length;
            }
        } catch (e) { /* ignore single batch failures */ }

        if (i + batchSize < moreIds.length) await sleep(RATE_LIMIT_DELAY);
    }
    return fetched;
}

// --- Formatting ---

function formatThreadToMarkdown(post: Post, comments: Comment[]): string {
    let md = `# ${post.title}\n\n`;
    md += `**Author:** u/${post.author} | **Subreddit:** r/${post.subreddit} | **Score:** ${post.score} | **Comments:** ${post.numComments}\n`;
    md += `**Link:** ${post.permalink}\n\n`;
    
    if (post.selftext) {
        md += `## Original Post\n\n${post.selftext}\n\n`;
    }

    md += `---\n## Comments\n\n`;

    const renderComments = (nodes: Comment[], depth = 0) => {
        for (const c of nodes) {
            const indent = "  ".repeat(depth);
            md += `${indent}### u/${c.author} (${c.score} points)\n`;
            md += `${c.body.split("\n").map(line => `${indent}${line}`).join("\n")}\n\n`;
            if (c.replies.length > 0) renderComments(c.replies, depth + 1);
        }
    };

    renderComments(comments);
    return md;
}

// --- Main ---

async function main() {
    let urlInput = process.argv[2];
    
    if (!urlInput) {
        const rl = readline.createInterface({ input, output });
        try {
            urlInput = await rl.question(chalk.cyan("Enter Reddit Thread URL: "));
        } finally {
            rl.close();
        }
    }

    if (!urlInput || !urlInput.trim()) {
        console.log(chalk.yellow("No URL provided. Usage: npx tsx downloader.ts <reddit-url>"));
        process.exit(1);
    }

    try {
        const info = parseRedditUrl(urlInput);
        console.log(chalk.blue(`[1/3] Fetching thread: ${info.postId}...`));
        
        // Try multiple URL patterns for the JSON API
        const patterns = [
            `${info.fullUrl}/.json`,
            `${info.fullUrl}.json`,
            `https://www.reddit.com/comments/${info.postId}/.json`,
            `https://old.reddit.com/comments/${info.postId}/.json`
        ];

        let data: any = null;
        let lastError: any = null;

        for (const url of patterns) {
            try {
                data = await fetchWithRetry(url, 2);
                if (data) break;
            } catch (e) {
                lastError = e;
                continue;
            }
        }

        if (!data) throw lastError || new Error("Failed to fetch thread data after trying all URL patterns");
        if (!Array.isArray(data) || data.length < 2) throw new Error("Invalid Reddit API response format");

        const postData = data[0].data.children[0].data;
        const post: Post = {
            title: postData.title,
            author: postData.author,
            subreddit: postData.subreddit,
            selftext: postData.selftext,
            url: postData.url,
            score: postData.score,
            numComments: postData.num_comments,
            permalink: `https://www.reddit.com${postData.permalink}`,
        };

        console.log(chalk.blue(`[2/3] Parsing comments...`));
        const { comments, moreIds } = extractComments(data[1]);
        
        if (moreIds.length > 0) {
            console.log(chalk.blue(`[3/3] Resolving ${moreIds.length} deep comments (this may take a moment)...`));
            await resolveMoreComments(comments, moreIds, postData.name);
        }

        const markdown = formatThreadToMarkdown(post, comments);
        
        console.log(chalk.green("\n--- THREAD START ---"));
        console.log(markdown);
        console.log(chalk.green("--- THREAD END ---\n"));
        
        console.log(chalk.cyan("Done! You can copy the text above."));
    } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
    }
}

main();
