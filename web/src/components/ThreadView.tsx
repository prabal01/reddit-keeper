import type { ThreadData } from "@core/reddit/types.js";
import { CommentNode } from "./CommentNode";

interface ThreadViewProps {
    thread: ThreadData;
}

function formatDate(utcTimestamp: number): string {
    return new Date(utcTimestamp * 1000).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

export function ThreadView({ thread }: ThreadViewProps) {
    const { post, comments, metadata } = thread;

    const badges: { icon: string; label: string }[] = [];
    if (post.flair) badges.push({ icon: "🏷️", label: post.flair });
    if (post.isNsfw) badges.push({ icon: "🔞", label: "NSFW" });
    if (post.isSpoiler) badges.push({ icon: "⚠️", label: "Spoiler" });
    if (post.isLocked) badges.push({ icon: "🔒", label: "Locked" });
    if (post.isArchived) badges.push({ icon: "📦", label: "Archived" });

    return (
        <div className="thread-view" role="main" aria-label="Reddit thread">
            {/* Post Header */}
            <article className="post-card" aria-label={`Post: ${post.title}`}>
                <h1 className="post-title">{post.title}</h1>
                <div className="post-meta">
                    <a
                        href={`https://www.reddit.com/r/${post.subreddit}`}
                        className="post-subreddit"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Subreddit r/${post.subreddit}`}
                    >
                        r/{post.subreddit}
                    </a>
                    <span className="meta-sep" aria-hidden="true">•</span>
                    <span className="post-author">u/{post.author}</span>
                    <span className="meta-sep" aria-hidden="true">•</span>
                    <span className="post-score" aria-label={`${post.score} points`}>
                        ↑ {post.score}
                    </span>
                    <span className="post-ratio" aria-label={`${Math.round(post.upvoteRatio * 100)}% upvoted`}>
                        ({Math.round(post.upvoteRatio * 100)}%)
                    </span>
                    <span className="meta-sep" aria-hidden="true">•</span>
                    <time dateTime={new Date(post.createdUtc * 1000).toISOString()}>
                        {formatDate(post.createdUtc)}
                    </time>
                </div>

                {badges.length > 0 && (
                    <div className="post-badges" aria-label="Post badges">
                        {badges.map((b, i) => (
                            <span key={i} className="post-badge" aria-label={b.label}>
                                {b.icon} {b.label}
                            </span>
                        ))}
                    </div>
                )}

                {post.isSelf && post.selftext && (
                    <div className="post-body">
                        {post.selftext.split("\n\n").map((paragraph, i) => (
                            <p key={i}>{paragraph}</p>
                        ))}
                    </div>
                )}

                {!post.isSelf && (
                    <a
                        href={post.url}
                        className="post-link"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`External link: ${post.url}`}
                    >
                        🔗 {post.url}
                    </a>
                )}
            </article>

            {/* Comments Section */}
            <section className="comments-section" aria-label="Comments">
                <h2 className="comments-heading">
                    {metadata.totalCommentsFetched} Comments
                </h2>

                {comments.length === 0 ? (
                    <p className="no-comments">No comments match your filters.</p>
                ) : (
                    <div className="comments-list" role="list">
                        {comments.map((comment) => (
                            <CommentNode
                                key={comment.id}
                                comment={comment}
                                postAuthor={post.author}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* Footer */}
            <footer className="thread-footer">
                <p>
                    Fetched by reddit-dl v{metadata.toolVersion} at{" "}
                    {new Date(metadata.fetchedAt).toLocaleString()}
                </p>
                <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View original post on Reddit"
                >
                    View on Reddit ↗
                </a>
            </footer>
        </div>
    );
}
