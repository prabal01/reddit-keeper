import { ToolShell } from './ToolShell';
import { ToolSEO } from './ToolSEO';
import { MessageSquare, Users, TrendingUp, Hash, ArrowUp } from 'lucide-react';

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
    return (
        <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)', padding: 16, textAlign: 'center'
        }}>
            <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 69, 0, 0.08)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--bg-accent)', margin: '0 auto 10px'
            }}>{icon}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
        </div>
    );
}

function ResultView({ data }: { data: any }) {
    const post = data.post || {};
    const stats = data.stats || {};
    const maxDepthCount = Math.max(...(data.commentDepthDistribution?.map((d: any) => d.count) || [1]));

    return (
        <div>
            {/* Post Header */}
            <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)', padding: 24, marginBottom: 20
            }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
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

            {/* Stats Cards */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 12, marginBottom: 24
            }}>
                <StatCard icon={<MessageSquare size={16} />} label="Total Comments" value={stats.totalComments} />
                <StatCard icon={<TrendingUp size={16} />} label="Avg Comment Score" value={stats.avgCommentScore} />
                <StatCard icon={<Users size={16} />} label="Unique Commenters" value={stats.uniqueCommenters} />
                <StatCard icon={<ArrowUp size={16} />} label="Post Score" value={post.score} />
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
                    }}>Top Comments by Score</h3>
                    {data.topComments.map((c: any, i: number) => (
                        <div key={i} style={{
                            padding: '14px 0',
                            borderBottom: i < data.topComments.length - 1 ? '1px solid var(--border)' : 'none'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <span style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    fontSize: '0.75rem', fontWeight: 600, color: '#22c55e',
                                    padding: '2px 8px', background: 'rgba(34,197,94,0.08)',
                                    borderRadius: 'var(--radius-full)'
                                }}>
                                    <ArrowUp size={12} /> {c.score}
                                </span>
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
                    ))}
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
