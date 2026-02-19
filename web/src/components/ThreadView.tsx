
import { CommentNode } from "./CommentNode";
import { reconstructTree } from "../lib/reddit-utils";

interface ThreadViewProps {
    thread: any; // Allow for flexible content structure from saved data
}

function formatDate(utcTimestamp: number): string {
    return new Date(utcTimestamp * 1000).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

export function ThreadView({ thread }: ThreadViewProps) {
    const { post, content, metadata } = thread;

    // Support both direct extraction (nested) and saved extraction (flat)
    let displayComments = thread.comments || [];
    if (content?.flattenedComments) {
        displayComments = reconstructTree(content.flattenedComments);
    } else if (content?.comments && Array.isArray(content.comments)) {
        // Handle nested structure if it exists in content
        displayComments = content.comments;
    }

    const badges: { icon: string; label: string }[] = [];
    if (post.flair) badges.push({ icon: "🏷️", label: post.flair });
    if (post.isNsfw) badges.push({ icon: "🔞", label: "NSFW" });
    if (post.isSpoiler) badges.push({ icon: "⚠️", label: "Spoiler" });
    if (post.isLocked) badges.push({ icon: "🔒", label: "Locked" });
    if (post.isArchived) badges.push({ icon: "📦", label: "Archived" });

    return (
        <div className="thread-view" role="main" aria-label="Universal thread">
            {/* Post Header */}
            <article className="post-card" aria-label={`Post: ${post.title}`}>
                <h1 className="post-title">{post.title}</h1>
                <div className="post-meta">
                    <a
                        href={`https://www.reddit.com/r/${post.subreddit}`}
                        className="post-subreddit"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Community: ${post.subreddit}`}
                    >
                        {post.subreddit}
                    </a>
                    <span className="meta-sep" aria-hidden="true">•</span>
                    <span className="post-author">{post.author}</span>
                    <span className="meta-sep" aria-hidden="true">•</span>
                    <span className="post-score" aria-label={`${post.score || 0} points`}>
                        ↑ {post.score || 0}
                    </span>
                    <span className="post-ratio" aria-label={`${Math.round((post.upvoteRatio || 1) * 100)}% upvoted`}>
                        ({Math.round((post.upvoteRatio || 1) * 100)}%)
                    </span>
                    <span className="meta-sep" aria-hidden="true">•</span>
                    <time dateTime={new Date((post.createdUtc || 0) * 1000).toISOString()}>
                        {formatDate(post.createdUtc || 0)}
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
                        {post.selftext.split("\n\n").map((paragraph: string, i: number) => (
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
                    {(() => {
                        const metadataCount = metadata?.totalCommentsFetched || 0;
                        if (metadataCount > 0) return metadataCount;

                        // Recursive fallback if metadata is missing/wrong
                        const countAll = (nodes: any[]): number => {
                            let total = 0;
                            for (const n of nodes) {
                                total += 1 + countAll(n.replies || []);
                            }
                            return total;
                        };
                        return countAll(displayComments);
                    })()} Comments
                </h2>

                {displayComments.length === 0 ? (
                    <p className="no-comments">No comments match your filters.</p>
                ) : (
                    <>
                        <div className="comments-list" role="list">
                            {displayComments.map((comment: any) => (
                                <CommentNode
                                    key={comment.id}
                                    comment={comment}
                                    postAuthor={post.author}
                                />
                            ))}
                        </div>
                        {metadata?.truncated && (
                            <div className="truncation-banner" style={{
                                marginTop: '24px',
                                padding: '20px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-lg)',
                                textAlign: 'center',
                                color: 'var(--text-secondary)'
                            }}>
                                <p style={{ marginBottom: '12px' }}>
                                    🔒 <strong>Analysis Limited</strong><br />
                                    Showing {displayComments.length} of {metadata.originalCommentCount} comments.
                                </p>
                                <a href="/settings" className="btn btn-primary btn-sm">
                                    Upgrade to Pro to Analyze All
                                </a>
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* Footer */}
            <footer className="thread-footer">
                <p>
                    Fetched {metadata?.toolVersion ? `by OpinionDeck v${metadata.toolVersion}` : ''} at{" "}
                    {new Date(metadata?.fetchedAt || thread.extractedAt).toLocaleString()}
                </p>
                <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View original post"
                >
                    View Original ↗
                </a>
            </footer>
        </div>
    );
}
