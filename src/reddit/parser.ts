import type { RedditUrlInfo } from "./types.js";

/**
 * Parse a Reddit URL or post ID into structured info.
 *
 * Accepted formats:
 *   - https://www.reddit.com/r/subreddit/comments/postid/slug/
 *   - https://old.reddit.com/r/subreddit/comments/postid/slug/
 *   - https://reddit.com/r/subreddit/comments/postid/
 *   - r/subreddit/comments/postid
 *   - Just a post ID (e.g., "1abcdef")
 */
export function parseRedditUrl(input: string): RedditUrlInfo {
    const trimmed = input.trim();

    // Try matching a full or partial Reddit URL
    const urlPattern =
        /(?:https?:\/\/)?(?:(?:www|old|new)\.)?reddit\.com\/r\/([^/]+)\/comments\/([a-z0-9]+)/i;
    const match = trimmed.match(urlPattern);

    if (match) {
        const subreddit = match[1];
        const postId = match[2];
        return {
            subreddit,
            postId,
            fullUrl: `https://www.reddit.com/r/${subreddit}/comments/${postId}`,
        };
    }

    // Try matching shorthand: r/subreddit/comments/postid
    const shortPattern = /^r\/([^/]+)\/comments\/([a-z0-9]+)/i;
    const shortMatch = trimmed.match(shortPattern);

    if (shortMatch) {
        const subreddit = shortMatch[1];
        const postId = shortMatch[2];
        return {
            subreddit,
            postId,
            fullUrl: `https://www.reddit.com/r/${subreddit}/comments/${postId}`,
        };
    }

    // Try as a raw post ID (alphanumeric, 5-10 chars)
    const idPattern = /^[a-z0-9]{5,10}$/i;
    if (idPattern.test(trimmed)) {
        return {
            subreddit: "", // will be resolved after fetching
            postId: trimmed,
            fullUrl: `https://www.reddit.com/comments/${trimmed}`,
        };
    }

    throw new Error(
        `Invalid Reddit URL or post ID: "${trimmed}"\n` +
        `Expected formats:\n` +
        `  - https://www.reddit.com/r/subreddit/comments/postid/\n` +
        `  - r/subreddit/comments/postid\n` +
        `  - A post ID like "1abcdef"`
    );
}

/**
 * Build the JSON API URL for a Reddit post
 */
export function buildJsonUrl(info: RedditUrlInfo, sort: string = "confidence"): string {
    const sortParam = sort ? `?sort=${sort}` : "";
    return `${info.fullUrl}.json${sortParam}`;
}

/**
 * Build the /api/morechildren URL
 */
export function buildMoreChildrenUrl(): string {
    return `https://www.reddit.com/api/morechildren.json`;
}
