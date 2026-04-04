import type {
    RedditThing,
    RedditListing,
    RedditPostData,
    RedditCommentData,
    RedditMoreData,
    Comment,
    ThreadData,
    RedditUrlInfo,
} from "./types.js";
import { buildJsonUrl } from "./parser.js";
import {
    transformPost,
    transformComment,
    extractCommentsFromListing,
    mergeIntoTree,
    countComments,
} from "./tree-builder.js";

import { sendAlert } from "../server/alerts.js";

const TOOL_VERSION = "1.0.1";
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const RATE_LIMIT_DELAY = 1000; // 1 second between requests

type ProgressCallback = (message: string) => void;

/**
 * Sleep for the given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make an HTTP request with retry logic and rate limiting
 */
async function fetchWithRetry(
    url: string,
    maxRetries: number = 3
): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Referer": "https://www.reddit.com/",
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-origin",
                    "DNT": "1",
                    "Upgrade-Insecure-Requests": "1"
                },
            });

            if (response.status === 429) {
                // Rate limited — alert the admin then wait and retry
                await sendAlert("REDDIT", `Rate Limit (429) detected! URL: ${url}`, { status: 429, attempt });
                
                const retryAfter = parseInt(response.headers.get("retry-after") || "5");
                const waitMs = retryAfter * 1000;
                await sleep(waitMs);
                continue;
            }

            if (response.status === 403) {
                // BLOCKED — immediate alert
                await sendAlert("REDDIT", `Access Forbidden (403)! Likely a block. URL: ${url}`, { status: 403, attempt });
                throw new Error(`HTTP 403: Access blocked by Reddit. Please check server IP reputation.`);
            }

            if (response.status === 503 || response.status === 500) {
                // Server error — exponential backoff
                const waitMs = Math.pow(2, attempt) * 1000;
                await sleep(waitMs);
                continue;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error: any) {
            if (attempt === maxRetries) {
                throw new Error(
                    `Failed after ${maxRetries} attempts: ${error.message}`
                );
            }
            const waitMs = Math.pow(2, attempt) * 1000;
            await sleep(waitMs);
        }
    }
}

/**
 * Fetch a Reddit thread: post + all comments (recursively resolving "more" comments)
 */
export async function fetchThread(
    urlInfo: RedditUrlInfo,
    sort: string = "confidence",
    onProgress?: ProgressCallback
): Promise<ThreadData> {
    // 1. Fetch the initial post + comments
    const jsonUrl = buildJsonUrl(urlInfo, sort);
    onProgress?.("Fetching post and comments...");
    const data = await fetchWithRetry(jsonUrl);

    if (!Array.isArray(data) || data.length < 2) {
        throw new Error(
            "Unexpected API response format. Make sure the URL points to a valid Reddit post."
        );
    }

    // 2. Parse the post
    const postListing = data[0] as RedditThing<RedditListing<RedditPostData>>;
    const rawPost = postListing.data.children[0].data;
    const post = transformPost(rawPost);

    // Update subreddit if it was missing (raw post ID was used)
    if (!urlInfo.subreddit) {
        urlInfo.subreddit = post.subreddit;
    }

    // 3. Parse initial comments and collect "more" IDs
    const commentListing = data[1] as RedditThing<
        RedditListing<RedditCommentData | RedditMoreData>
    >;
    const { comments, moreIds, linkId: _linkId } =
        extractCommentsFromListing(commentListing);

    const postFullname = rawPost.name; // e.g., t3_abc123
    let totalFetched = countComments(comments);
    onProgress?.(`Fetched ${totalFetched} comments...`);

    // 4. Resolve all "more comments" in batches
    if (moreIds.length > 0) {
        onProgress?.(
            `Resolving ${moreIds.length} additional comment threads...`
        );
        await resolveMoreComments(
            comments,
            moreIds,
            postFullname,
            (fetched) => {
                totalFetched += fetched;
                onProgress?.(`Fetched ${totalFetched} comments...`);
            }
        );
    }

    const finalCount = countComments(comments);

    return {
        post,
        comments,
        metadata: {
            fetchedAt: new Date().toISOString(),
            totalCommentsFetched: finalCount,
            toolVersion: TOOL_VERSION,
        },
    };
}

/**
 * Resolve "more comments" by calling /api/morechildren in batches
 */
async function resolveMoreComments(
    tree: Comment[],
    moreIds: string[],
    linkId: string,
    onBatch?: (fetched: number) => void
): Promise<void> {
    // Process in batches of 100 (Reddit API limit)
    const batchSize = 100;

    for (let i = 0; i < moreIds.length; i += batchSize) {
        const batch = moreIds.slice(i, i + batchSize);
        const childrenParam = batch.join(",");

        const url = `https://www.reddit.com/api/morechildren.json?api_type=json&link_id=${linkId}&children=${childrenParam}`;

        try {
            const response = await fetchWithRetry(url);

            if (response?.json?.data?.things) {
                const things = response.json.data.things;
                const newComments: Comment[] = [];

                for (const thing of things) {
                    if (thing.kind === "t1") {
                        const comment = transformComment(thing.data);
                        newComments.push(comment);
                    }
                }

                if (newComments.length > 0) {
                    mergeIntoTree(tree, newComments);
                    onBatch?.(newComments.length);
                }
            }
        } catch (error: any) {
            // Log but don't fail – we want as many comments as possible
            // Some "more" batches may fail for deleted threads etc.
        }

        // Rate limiting between batches
        if (i + batchSize < moreIds.length) {
            await sleep(RATE_LIMIT_DELAY);
        }
    }
}
