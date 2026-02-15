import { useState } from "react";
import type { Comment } from "@core/reddit/types.js";

interface CommentNodeProps {
    comment: Comment;
    postAuthor: string;
}

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

export function CommentNode({ comment, postAuthor }: CommentNodeProps) {
    const [collapsed, setCollapsed] = useState(false);
    const isDeleted =
        comment.author === "[deleted]" || comment.body === "[deleted]";

    return (
        <div
            className={`comment-node depth-${Math.min(comment.depth, 8)}`}
            role="article"
            aria-label={`Comment by ${comment.author}`}
        >
            <div className="comment-header">
                <button
                    className="collapse-btn"
                    onClick={() => setCollapsed(!collapsed)}
                    aria-label={collapsed ? "Expand comment" : "Collapse comment"}
                    aria-expanded={!collapsed}
                >
                    {collapsed ? "▸" : "▾"}
                </button>
                <span
                    className={`comment-author ${comment.isSubmitter ? "is-op" : ""
                        } ${comment.distinguished === "moderator" ? "is-mod" : ""} ${isDeleted ? "is-deleted" : ""
                        }`}
                >
                    u/{comment.author}
                </span>
                {comment.isSubmitter && (
                    <span className="badge badge-op\" aria-label="Original poster">OP</span>
                )}
                {comment.distinguished === "moderator" && (
                    <span className="badge badge-mod" aria-label="Moderator">MOD</span>
                )}
                {comment.stickied && (
                    <span className="badge badge-sticky" aria-label="Pinned comment">📌</span>
                )}
                <span className="comment-score" aria-label={`${comment.score} points`}>
                    ↑ {comment.score}
                </span>
                <span className="comment-time" aria-label={new Date(comment.createdUtc * 1000).toLocaleString()}>
                    {relativeTime(comment.createdUtc)}
                </span>
            </div>
            {!collapsed && (
                <>
                    <div
                        className={`comment-body ${isDeleted ? "deleted" : ""}`}
                        dangerouslySetInnerHTML={{ __html: formatBody(comment.body) }}
                    />
                    {comment.replies.length > 0 && (
                        <div className="comment-replies" role="list" aria-label="Replies">
                            {comment.replies.map((reply) => (
                                <CommentNode
                                    key={reply.id}
                                    comment={reply}
                                    postAuthor={postAuthor}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function formatBody(text: string): string {
    // Basic markdown-ish formatting for display
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n\n/g, "</p><p>")
        .replace(/\n/g, "<br/>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(
            /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
        )
        .replace(
            /(^|[^"'])(https?:\/\/[^\s<]+)/g,
            '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>'
        );
}
