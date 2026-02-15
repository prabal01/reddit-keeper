import type { ThreadData, Comment } from "../reddit/types.js";

/**
 * Format relative time from a UTC timestamp
 */
function relativeTime(utcTimestamp: number): string {
    const now = Date.now() / 1000;
    const diff = now - utcTimestamp;

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
    return `${Math.floor(diff / 31536000)}y ago`;
}

/**
 * Format a date from UTC timestamp
 */
function formatDate(utcTimestamp: number): string {
    return new Date(utcTimestamp * 1000).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

/**
 * Render a single comment and its replies as markdown
 */
function renderComment(comment: Comment, indent: number = 0): string {
    const prefix = "  ".repeat(indent) + "- ";
    const opBadge = comment.isSubmitter ? " **[OP]**" : "";
    const modBadge = comment.distinguished === "moderator" ? " **[MOD]**" : "";
    const stickyBadge = comment.stickied ? " 📌" : "";

    const header = `${prefix}**u/${comment.author}** (↑ ${comment.score}) — *${relativeTime(comment.createdUtc)}*${opBadge}${modBadge}${stickyBadge}`;

    // Indent the body to align with the list item
    const bodyIndent = "  ".repeat(indent) + "  ";
    const body = comment.body
        .split("\n")
        .map((line) => `${bodyIndent}${line}`)
        .join("\n");

    let output = `${header}\n${body}\n\n`;

    // Render replies
    for (const reply of comment.replies) {
        output += renderComment(reply, indent + 1);
    }

    return output;
}

/**
 * Format a complete thread as Markdown
 */
export function formatAsMarkdown(thread: ThreadData): string {
    const { post, comments, metadata } = thread;

    let md = "";

    // Post header
    md += `# ${post.title}\n\n`;
    md += `**r/${post.subreddit}** • Posted by u/${post.author} • ${post.score} points (${Math.round(post.upvoteRatio * 100)}% upvoted) • ${formatDate(post.createdUtc)}\n\n`;

    // Flair / badges
    const badges: string[] = [];
    if (post.flair) badges.push(`🏷️ ${post.flair}`);
    if (post.isNsfw) badges.push("🔞 NSFW");
    if (post.isSpoiler) badges.push("⚠️ Spoiler");
    if (post.isLocked) badges.push("🔒 Locked");
    if (post.isArchived) badges.push("📦 Archived");
    if (badges.length > 0) {
        md += badges.join(" • ") + "\n\n";
    }

    md += "---\n\n";

    // Post body
    if (post.isSelf && post.selftext) {
        md += post.selftext + "\n\n";
    } else if (!post.isSelf) {
        md += `🔗 **Link:** ${post.url}\n\n`;
    }

    md += "---\n\n";

    // Comments section
    md += `## Comments (${metadata.totalCommentsFetched} fetched)\n\n`;

    if (comments.length === 0) {
        md += "*No comments*\n";
    } else {
        for (const comment of comments) {
            md += renderComment(comment);
        }
    }

    // Footer
    md += "\n---\n\n";
    md += `*Fetched by reddit-dl v${metadata.toolVersion} at ${metadata.fetchedAt}*\n`;
    md += `*Source: ${post.permalink}*\n`;

    return md;
}
