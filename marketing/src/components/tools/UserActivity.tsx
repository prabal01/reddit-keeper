import { ToolShell } from './ToolShell';
import { ToolSEO } from './ToolSEO';
import { User, BarChart3, MessageSquare, FileText } from 'lucide-react';

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
    return (
        <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)', padding: 20, textAlign: 'center'
        }}>
            <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 69, 0, 0.08)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--bg-accent)', margin: '0 auto 12px'
            }}>{icon}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
        </div>
    );
}

function ResultView({ data }: { data: any }) {
    const maxSubCount = Math.max(...(data.topSubreddits?.map((s: any) => s.count) || [1]));
    const maxMonthActivity = Math.max(
        ...(data.activityByMonth?.map((m: any) => m.posts + m.comments) || [1])
    );

    return (
        <div>
            {/* Stats Cards */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12, marginBottom: 24
            }}>
                <StatCard icon={<FileText size={18} />} label="Posts" value={data.postCount} />
                <StatCard icon={<MessageSquare size={18} />} label="Comments" value={data.commentCount} />
                <StatCard icon={<BarChart3 size={18} />} label="Active Communities" value={data.topSubreddits?.length || 0} />
            </div>

            {/* Top Subreddits */}
            {data.topSubreddits?.length > 0 && (
                <div style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xl)', padding: 20, marginBottom: 24
                }}>
                    <h3 style={{
                        fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)',
                        margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>Most Active Communities</h3>
                    {data.topSubreddits.slice(0, 10).map((s: any, i: number) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10
                        }}>
                            <span style={{
                                flex: '0 0 140px', fontSize: '0.85rem', fontWeight: 500,
                                color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}>r/{s.subreddit}</span>
                            <div style={{ flex: 1, height: 20, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%', width: `${(s.count / maxSubCount) * 100}%`,
                                    background: 'linear-gradient(90deg, var(--bg-accent), #ff6b35)',
                                    borderRadius: 4, transition: 'width 0.5s ease'
                                }} />
                            </div>
                            <span style={{
                                flex: '0 0 50px', fontSize: '0.75rem', fontWeight: 600,
                                color: 'var(--text-secondary)', textAlign: 'right'
                            }}>{s.count}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Activity Timeline */}
            {data.activityByMonth?.length > 0 && (
                <div style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xl)', padding: 20, marginBottom: 24
                }}>
                    <h3 style={{
                        fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)',
                        margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>Activity Over Time</h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
                        {data.activityByMonth.map((m: any, i: number) => {
                            const total = m.posts + m.comments;
                            const height = maxMonthActivity > 0 ? (total / maxMonthActivity) * 100 : 0;
                            const postPct = total > 0 ? (m.posts / total) * 100 : 0;
                            return (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div
                                        title={`${m.month}: ${m.posts} posts, ${m.comments} comments`}
                                        style={{
                                            width: '100%', maxWidth: 32, borderRadius: '4px 4px 0 0',
                                            height: `${Math.max(height, 4)}%`,
                                            background: `linear-gradient(to top, var(--bg-accent) ${postPct}%, #ff6b35 ${postPct}%)`,
                                            cursor: 'default', transition: 'height 0.3s ease'
                                        }}
                                    />
                                    <span style={{
                                        fontSize: '0.55rem', color: 'var(--text-tertiary)',
                                        marginTop: 4, whiteSpace: 'nowrap',
                                        transform: 'rotate(-45deg)', transformOrigin: 'center'
                                    }}>{m.month.slice(5)}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{
                        display: 'flex', gap: 16, marginTop: 12, fontSize: '0.7rem', color: 'var(--text-tertiary)'
                    }}>
                        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--bg-accent)', borderRadius: 2, marginRight: 4 }} />Posts</span>
                        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#ff6b35', borderRadius: 2, marginRight: 4 }} />Comments</span>
                    </div>
                </div>
            )}

            {/* Recent Posts */}
            {data.recentPosts?.length > 0 && (
                <div style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xl)', padding: 20
                }}>
                    <h3 style={{
                        fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)',
                        margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>Recent Posts</h3>
                    {data.recentPosts.map((p: any, i: number) => (
                        <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" style={{
                            display: 'block', padding: '12px 0',
                            borderBottom: i < data.recentPosts.length - 1 ? '1px solid var(--border)' : 'none',
                            textDecoration: 'none', color: 'inherit'
                        }}>
                            <div style={{
                                fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)',
                                marginBottom: 4, lineHeight: 1.4
                            }}>{p.title}</div>
                            <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                <span style={{
                                    padding: '1px 8px', background: 'rgba(255, 69, 0, 0.08)',
                                    borderRadius: 'var(--radius-full)', color: 'var(--bg-accent)', fontWeight: 600
                                }}>r/{p.subreddit}</span>
                                <span>{p.score} points</span>
                                {p.created_utc && <span>{new Date(p.created_utc * 1000).toLocaleDateString()}</span>}
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}

export function UserActivity() {
    return (
        <ToolShell
            title="Reddit User Activity Lookup"
            description="See anyone's posting history, top subreddits, and activity patterns."
            fields={[
                { name: 'username', label: 'Username', placeholder: 'e.g. spez', required: true }
            ]}
            apiEndpoint="/api/tools/user-activity"
            renderResult={(data) => <ResultView data={data} />}
        >
            <ToolSEO
                heading="Look Up Any Reddit User's Activity and History"
                introParagraphs={[
                    "Every Reddit user leaves a trail of public activity — posts, comments, and community participation that tells a story about their interests and expertise. This tool compiles that activity into a clear, easy-to-read profile so you can understand any user at a glance.",
                    "Whether you're researching a potential influencer for a collaboration, scoping out a competitor's founder, or vetting someone before a business discussion, this free tool pulls together the data you need. See their most active subreddits, posting frequency over time, and recent content — all from publicly available data.",
                    "Reddit profiles can be notoriously hard to browse on the platform itself. This tool organizes the data in a way that makes it easy to quickly understand someone's Reddit presence and focus areas."
                ]}
                steps={[
                    { title: "Enter a Reddit username", description: "Type any public Reddit username — no u/ prefix needed. Works with any account that has public posting history." },
                    { title: "We fetch their activity", description: "Our system pulls the user's recent posts and comments from Reddit's public archives, covering up to 100 posts and 100 comments." },
                    { title: "See the overview", description: "Get a snapshot with total post count, comment count, top subreddits, and monthly activity breakdown in one dashboard view." },
                    { title: "Dig into the details", description: "Browse their recent posts with scores and subreddit tags. See how their activity is distributed across different communities and time periods." }
                ]}
                useCases={[
                    { title: "Influencer Research", description: "Evaluate potential Reddit influencers for partnerships. See which communities they're active in, how engaged their content is, and whether their audience aligns with yours." },
                    { title: "Competitive Intelligence", description: "Look up competitor founders, team members, or advocates to understand their Reddit strategy and which communities they're investing time in." },
                    { title: "Collaboration Vetting", description: "Before partnering with someone who reached out on Reddit, check their posting history to verify they're a genuine community member and not a spam account." },
                    { title: "Community Research", description: "Identify the top contributors in any subreddit using our Subreddit Analyzer, then look up each contributor here to understand their broader interests and expertise." }
                ]}
                faqs={[
                    { question: "Can I look up any Reddit user?", answer: "You can look up any user with a public posting history. Deleted accounts, shadowbanned users, and accounts with no public activity will return empty or limited results." },
                    { question: "Does this show deleted posts or comments?", answer: "No. This tool only shows publicly available content. If a user deleted a post or comment, it won't appear in the results." },
                    { question: "How far back does the activity history go?", answer: "We pull up to 100 recent posts and 100 recent comments. For very active users, this may only cover a few weeks. For less active users, it could span months or years." },
                    { question: "Is this tool legal to use?", answer: "Yes. All data shown is publicly available information from Reddit's platform. We don't access any private messages, private subreddits, or non-public data." },
                    { question: "What does the activity chart show?", answer: "The activity chart breaks down the user's posting and commenting frequency by month, displayed as a stacked bar chart. This helps you understand whether someone is consistently active or has periods of high and low engagement." },
                    { question: "Can I see what a user has upvoted or downvoted?", answer: "No. Reddit voting activity is private and not accessible through any public API. This tool only shows posts and comments — content the user has actively created." }
                ]}
                relatedTools={[
                    { slug: "brand-mentions", title: "Brand Mention Tracker", description: "Track every mention of a brand or product across Reddit communities." },
                    { slug: "thread-explorer", title: "Thread Explorer", description: "Break down any Reddit thread to see top comments, engagement, and conversation depth." },
                    { slug: "subreddit-analyzer", title: "Subreddit Analyzer", description: "Analyze any subreddit's engagement stats and top contributors." }
                ]}
                closingParagraphs={[
                    "User activity research is a powerful but underused tool in the Reddit marketer's toolkit. By understanding who the key voices are in a community, you can identify potential advocates, avoid antagonizing power users, and find the right people to engage with.",
                    "Combine user activity lookups with our Subreddit Analyzer to build a complete picture of any Reddit community — from the macro engagement metrics down to the individual contributors who drive the conversation."
                ]}
            />
        </ToolShell>
    );
}
