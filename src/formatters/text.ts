import type { ThreadData, Comment } from "../reddit/types.js";

/**
 * Render a comment as plain text with indentation-based depth
 */
function renderComment(comment: Comment): string {
    const indent = "  ".repeat(comment.depth);
    const opTag = comment.isSubmitter ? " [OP]" : "";
    const header = `${indent}[${comment.depth}] u/${comment.author} (${comment.score} pts)${opTag}:`;

    const bodyIndent = indent + "  ";
    const body = comment.body
        .split("\n")
        .map((line) => `${bodyIndent}${line}`)
        .join("\n");

    let output = `${header}\n${body}\n`;

    for (const reply of comment.replies) {
        output += renderComment(reply);
    }

    return output;
}

/**
 * Format a complete thread as plain text (token-efficient)
 */
export function formatAsText(thread: ThreadData): string {
    const { post, comments, metadata } = thread;

    let text = "";

    text += `TITLE: ${post.title}\n`;
    text += `SUBREDDIT: r/${post.subreddit} | AUTHOR: u/${post.author} | SCORE: ${post.score} | COMMENTS: ${metadata.totalCommentsFetched}\n`;
    text += `DATE: ${new Date(post.createdUtc * 1000).toISOString().split("T")[0]}\n`;

    text += "\n---\n";

    if (post.isSelf && post.selftext) {
        text += post.selftext + "\n";
    } else if (!post.isSelf) {
        text += `LINK: ${post.url}\n`;
    }

    text += "---\n\n";

    for (const comment of comments) {
        text += renderComment(comment);
    }

    return text;
}
