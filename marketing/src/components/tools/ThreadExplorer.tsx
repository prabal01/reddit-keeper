import { ToolShell } from './ToolShell';
import { ToolSEO } from './ToolSEO';
import { MessageSquare, Users, TrendingUp, Hash, Layers, ArrowUp } from 'lucide-react';

function getThreadSize(total: number): { label: string; color: string; description: string } {
    if (total >= 500) return { label: 'Massive', color: '#16a34a', description: 'Major community event' };
    if (total >= 200) return { label: 'Large', color: '#22c55e', description: 'Significant discussion' };
    if (total >= 50) return { label: 'Medium', color: '#fbbf24', description: 'Solid discussion thread' };
    if (total >= 15) return { label: 'Small', color: '#fb923c', description: 'Niche conversation' };
    return { label: 'Tiny', color: '#ef4444', description: 'Brief exchange' };
}

function getCommentQuality(median: number): { label: string; color: string; description: string } {
    if (median >= 20) return { label: 'Excellent', color: '#16a34a', description: 'Comments are highly valued' };
    if (median >= 10) return { label: 'Good', color: '#22c55e', description: 'Quality contributions getting noticed' };
    if (median >= 3) return { label: 'Average', color: '#fbbf24', description: 'Typical comment engagement' };
    if (median >= 1) return { label: 'Low', color: '#fb923c', description: 'Comments aren\'t getting much traction' };
    return { label: 'Very Low', color: '#ef4444', description: 'Most comments go unnoticed' };
}

function getDiscussionDepth(dist: { depth: number; count: number }[]): { label: string; color: string; description: string; pct: number } {
    const total = dist.reduce((s, d) => s + d.count, 0);
    const nested = dist.filter(d => d.depth >= 2).reduce((s, d) => s + d.count, 0);
    const pct = total > 0 ? Math.round((nested / total) * 100) : 0;
    if (pct >= 40) return { label: 'Very Deep', color: '#16a34a', description: 'Lots of back-and-forth debate', pct };
    if (pct >= 25) return { label: 'Deep', color: '#22c55e', description: 'People are replying to each other', pct };
    if (pct >= 10) return { label: 'Moderate', color: '#fbbf24', description: 'Some threaded discussion', pct };
    return { label: 'Shallow', color: '#fb923c', description: 'Mostly top-level reactions', pct };
}

function getParticipation(unique: number, total: number): { label: string; color: string; description: string } {
    const ratio = total > 0 ? unique / total : 0;
    if (ratio >= 0.7) return { label: 'Diverse', color: '#16a34a', description: 'Many different voices' };
    if (ratio >= 0.4) return { label: 'Balanced', color: '#22c55e', description: 'Good mix of contributors' };
    if (ratio >= 0.2) return { label: 'Concentrated', color: '#fbbf24', description: 'A few users dominate' };
    return { label: 'Dominated', color: '#fb923c', description: 'Handful of users driving all discussion' };
}

function getPostReach(score: number): { label: string; color: string } {
    if (score >= 1000) return { label: 'Viral Post', color: '#16a34a' };
    if (score >= 500) return { label: 'Hot Post', color: '#22c55e' };
    if (score >= 100) return { label: 'Popular', color: '#fbbf24' };
    if (score >= 25) return { label: 'Above Average', color: '#86efac' };
    return { label: 'Typical Post', color: 'var(--text-tertiary)' };
}

function ResultView({ data }: { data: any }) {
    const post = data.post || {};
    const stats = data.stats || {};
    const maxDepthCount = Math.max(...(data.commentDepthDistribution?.map((d: any) => d.count) || [1]));

    const threadSize = getThreadSize(stats.totalComments || 0);
    const commentQuality = getCommentQuality(stats.medianScore || 0);
    const depth = data.commentDepthDistribution?.length > 0
        ? getDiscussionDepth(data.commentDepthDistribution)
        : { label: 'Unknown', color: 'var(--text-tertiary)', description: 'No depth data', pct: 0 };
    const participation = getParticipation(stats.uniqueCommenters || 0, stats.totalComments || 0);
    const postReach = getPostReach(post.score || 0);

    return (
        <div>
            {/* Post Header */}
            <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)', padding: 24, marginBottom: 20
            }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{
                        padding: '3px 10px', background: 'rgba(255, 69, 0, 0.08)',
                        borderRadius: 'var(--radius-full)', fontSize: '0.75rem',
                        fontWeight: 600, color: 'var(--bg-accent)'
                    }}>r/{post.subreddit}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        by u/{post.author}
                    </span>
                    {post.created_utc > 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                            {new Date(post.created_utc * 1000).toLocaleDateString()}
                        </span>
                    )}
                    {/* Post reach badge */}
                    <span style={{
                        padding: '3px 10px', borderRadius: 'var(--radius-full)',
                        fontSize: '0.7rem', fontWeight: 600, color: postReach.color,
                        background: postReach.color === 'var(--text-tertiary)' ? 'var(--bg-tertiary)' : `${postReach.color}18`,
                        marginLeft: 'auto',
                    }}>
                        {postReach.label} — {post.score} upvotes
                    </span>
                </div>
                <h2 style={{
                    fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)',
                    margin: '0 0 10px', lineHeight: 1.4
                }}>{post.title}</h2>
                {post.selftext && (
                    <p style={{
                        fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6,
                        margin: 0, whiteSpace: 'pre-wrap',
                        maxHeight: 200, overflow: 'hidden',
                        maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
                    }}>{post.selftext}</p>
                )}
            </div>

            {/* Thread Snapshot */}
            <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)', padding: '24px 24px 20px', marginBottom: 20,
            }}>
                <div style={{
                    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)',
                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16,
                }}>Thread Snapshot</div>

                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 20,
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <MessageSquare size={15} color={threadSize.color} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Thread Size</span>
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: threadSize.color }}>
                            {threadSize.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                            {stats.totalComments} comments — {threadSize.description.toLowerCase()}
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <TrendingUp size={15} color={commentQuality.color} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Comment Quality</span>
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: commentQuality.color }}>
                            {commentQuality.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                            median {stats.medianScore} upvotes — {commentQuality.description.toLowerCase()}
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <Layers size={15} color={depth.color} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Discussion Depth</span>
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: depth.color }}>
                            {depth.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                            {depth.pct}% nested replies — {depth.description.toLowerCase()}
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <Users size={15} color={participation.color} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Participation</span>
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: participation.color }}>
                            {participation.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                            {stats.uniqueCommenters} unique voices — {participation.description.toLowerCase()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Comment Depth Distribution */}
            {data.commentDepthDistribution?.length > 0 && (
                <div style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xl)', padding: 20, marginBottom: 24
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <Hash size={14} color="var(--text-secondary)" />
                        <span style={{
                            fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)',
                            textTransform: 'uppercase', letterSpacing: '0.05em'
                        }}>Conversation Depth</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
                        {data.commentDepthDistribution.map((d: any, i: number) => {
                            const height = maxDepthCount > 0 ? (d.count / maxDepthCount) * 100 : 0;
                            return (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div
                                        title={`Depth ${d.depth}: ${d.count} comments`}
                                        style={{
                                            width: '100%', maxWidth: 40, borderRadius: '4px 4px 0 0',
                                            height: `${Math.max(height, 4)}%`,
                                            background: `rgba(255, 69, 0, ${0.3 + (i * 0.1)})`,
                                            cursor: 'default', transition: 'height 0.3s ease'
                                        }}
                                    />
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                                        {d.depth === 0 ? 'Top' : `Lv${d.depth}`}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: '8px 0 0' }}>
                        Deeper threads indicate more engaged discussions
                    </p>
                </div>
            )}

            {/* Top Comments */}
            {data.topComments?.length > 0 && (
                <div style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xl)', padding: 20
                }}>
                    <h3 style={{
                        fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)',
                        margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>Most Engaging Comments</h3>
                    {(() => { const topCommentScore = data.topComments[0]?.score || 1; return data.topComments.map((c: any, i: number) => {
                        const ratio = topCommentScore > 0 ? c.score / topCommentScore : 0;
                        const barColor = ratio > 0.7 ? '#22c55e' : ratio > 0.4 ? '#86efac' : '#fde68a';
                        return (
                        <div key={i} style={{
                            padding: '14px 0',
                            borderBottom: i < data.topComments.length - 1 ? '1px solid var(--border)' : 'none'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <div style={{
                                    width: 40, height: 6, borderRadius: 3,
                                    background: 'var(--bg-tertiary)', overflow: 'hidden', flexShrink: 0
                                }}>
                                    <div style={{
                                        width: `${Math.round(ratio * 100)}%`, height: '100%',
                                        borderRadius: 3, background: barColor
                                    }} />
                                </div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                    u/{c.author}
                                </span>
                                {c.depth > 0 && (
                                    <span style={{
                                        fontSize: '0.65rem', color: 'var(--text-tertiary)',
                                        padding: '1px 6px', background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-full)'
                                    }}>depth {c.depth}</span>
                                )}
                            </div>
                            <p style={{
                                fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.6,
                                margin: 0, whiteSpace: 'pre-wrap'
                            }}>{c.body}</p>
                        </div>
                    ); }); })()}
                </div>
            )}
        </div>
    );
}

export function ThreadExplorer() {
    return (
        <ToolShell
            title="Reddit Thread Explorer"
            description="Break down any Reddit thread — top comments, engagement stats, and conversation depth."
            fields={[
                { name: 'url', label: 'Thread URL', placeholder: 'https://reddit.com/r/subreddit/comments/...', type: 'url', required: true }
            ]}
            apiEndpoint="/api/tools/thread-explorer"
            submitLabel="Explore Thread"
            loadingLabel="Exploring..."
            ctaHeading="Want to monitor threads like this?"
            ctaDescription="OpinionDeck finds and analyzes high-opportunity Reddit threads automatically."
            renderResult={(data) => <ResultView data={data} />}
        >
            <ToolSEO
                heading="Break Down Any Reddit Thread's Engagement"
                introParagraphs={[
                    "Reddit threads can contain hundreds or thousands of comments nested multiple levels deep. Reading through all of that manually is impractical. This tool does the heavy lifting — paste any Reddit thread URL and instantly get the engagement stats, top comments, and conversation structure that matter.",
                    "Understanding what makes a thread tick is essential for Reddit marketing. Which comments get the most upvotes? How deep does the discussion go? Who are the most active participants? This analysis gives you the answers in seconds instead of hours of scrolling.",
                    "Use this tool to study successful threads before creating your own content. By understanding the patterns that drive engagement in specific communities, you can craft posts and comments that resonate with the audience."
                ]}
                steps={[
                    { title: "Paste a Reddit thread URL", description: "Copy the full URL of any Reddit post (e.g., https://reddit.com/r/startups/comments/...). We accept both old and new Reddit URL formats." },
                    { title: "We fetch the full discussion", description: "Our system downloads the original post and all its comments, including nested replies, then processes the entire conversation tree." },
                    { title: "See the stats", description: "Get a quick overview: total comments, average comment score, top commenter, response rate, and the original post details." },
                    { title: "Explore the breakdown", description: "View top comments ranked by score, see conversation depth distribution, and understand how engagement flows through the thread." }
                ]}
                useCases={[
                    { title: "Content Strategists", description: "Study high-performing threads to understand what kinds of comments and discussions get traction in specific communities. Use these patterns to inform your own content strategy." },
                    { title: "Product Researchers", description: "Analyze threads where people discuss your product category. The top comments often contain the most valued opinions and feature requests." },
                    { title: "Community Managers", description: "Evaluate the health of discussions in your community. Are conversations going deep? Are a few users dominating, or is participation distributed?" },
                    { title: "PR & Crisis Response", description: "When a thread about your brand goes viral, quickly understand the conversation landscape. See the top sentiments, how far the discussion has spread, and who the key commenters are." }
                ]}
                faqs={[
                    { question: "What Reddit URL formats are supported?", answer: "We support standard Reddit URLs including old.reddit.com, new.reddit.com, and shortened redd.it links. The URL should point to a specific post — not a comment permalink or a subreddit homepage." },
                    { question: "Does this show all comments in the thread?", answer: "We fetch and analyze the full comment tree. The top comments section shows the 10-15 highest-scored comments, but the statistics (total count, depth distribution, etc.) are calculated from the entire thread." },
                    { question: "What is 'conversation depth'?", answer: "Conversation depth measures how many levels of nested replies a thread has. A depth of 1 means top-level comments only. A depth of 5+ means people are having extended back-and-forth discussions. Higher average depth usually indicates more engaging content." },
                    { question: "Can I analyze threads from private subreddits?", answer: "No. The tool can only access threads from public subreddits. Private, restricted, or quarantined subreddit content is not available." },
                    { question: "Why are some threads showing fewer comments than expected?", answer: "Reddit sometimes removes or hides comments (moderator actions, AutoModerator, spam filters). Our tool shows the comments that are publicly accessible at the time of analysis. The count may differ slightly from what Reddit displays." },
                    { question: "What does 'response rate' mean?", answer: "Response rate is the percentage of top-level comments that received at least one reply. A high response rate means the topic is generating conversation, not just one-off reactions." }
                ]}
                relatedTools={[
                    { slug: "subreddit-analyzer", title: "Subreddit Analyzer", description: "Get the big picture on any community's engagement levels and top contributors." },
                    { slug: "user-activity", title: "User Activity Lookup", description: "Research any commenter's full Reddit profile and activity history." },
                    { slug: "best-time-to-post", title: "Best Time to Post", description: "Find the optimal time to post in any subreddit for maximum engagement." }
                ]}
                closingParagraphs={[
                    "Thread analysis is one of the most underrated research techniques for Reddit marketers. Before posting in any community, study 3-5 successful threads to understand the tone, format, and topics that resonate. Look at what the top comments have in common — is it humor, expertise, or personal stories?",
                    "Use thread insights to craft both your posts and your comments. A well-timed, valuable comment on a popular thread can drive more traffic than a standalone post. Our analysis helps you identify which threads are generating the most engagement and what kinds of contributions get noticed."
                ]}
            />
        </ToolShell>
    );
}
