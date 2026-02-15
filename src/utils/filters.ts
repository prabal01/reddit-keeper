import type { Comment, CLIOptions } from "../reddit/types.js";

/**
 * Apply filters to a comment tree based on CLI options.
 * Returns a new array with filters applied (non-destructive).
 */
export function applyFilters(
    comments: Comment[],
    options: CLIOptions
): Comment[] {
    let filtered = comments;

    // Filter by minimum score
    if (options.minScore !== undefined) {
        filtered = filterTree(filtered, (c) => c.score >= options.minScore!);
    }

    // Skip deleted/removed comments
    if (options.skipDeleted) {
        filtered = filterTree(
            filtered,
            (c) =>
                c.author !== "[deleted]" &&
                c.body !== "[deleted]" &&
                c.body !== "[removed]"
        );
    }

    // OP only
    if (options.opOnly) {
        filtered = filterTree(filtered, (c) => c.isSubmitter);
    }

    // Max depth
    if (options.maxDepth !== undefined) {
        filtered = trimDepth(filtered, options.maxDepth);
    }

    // Top N root comments
    if (options.top !== undefined) {
        filtered = filtered.slice(0, options.top);
    }

    return filtered;
}

/**
 * Filter a comment tree, keeping only comments that match the predicate.
 * If a parent doesn't match but children do, the parent is still removed.
 */
function filterTree(
    comments: Comment[],
    predicate: (c: Comment) => boolean
): Comment[] {
    const result: Comment[] = [];

    for (const comment of comments) {
        if (predicate(comment)) {
            const filteredReplies = filterTree(comment.replies, predicate);
            result.push({ ...comment, replies: filteredReplies });
        }
    }

    return result;
}

/**
 * Trim the comment tree to a maximum depth
 */
function trimDepth(comments: Comment[], maxDepth: number): Comment[] {
    return comments.map((comment) => {
        if (comment.depth >= maxDepth) {
            return { ...comment, replies: [] };
        }
        return { ...comment, replies: trimDepth(comment.replies, maxDepth) };
    });
}

/**
 * Estimate token count for a string (rough approximation: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}
