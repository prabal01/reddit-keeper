import { ToolShell } from './ToolShell';
import { ToolSEO } from './ToolSEO';
import { MessageSquare, TrendingUp, Activity, Zap } from 'lucide-react';

const TIER_LABELS: Record<string, { label: string; color: string }> = {
    '0-5': { label: 'Low', color: 'var(--text-tertiary)' },
    '6-25': { label: 'Moderate', color: '#fbbf24' },
    '26-100': { label: 'Strong', color: '#86efac' },
    '101-500': { label: 'Hot', color: '#22c55e' },
    '500+': { label: 'Viral', color: '#16a34a' },
};

function getEngagementLevel(avg: number): { label: string; color: string } {
    if (avg >= 100) return { label: 'Very High', color: '#16a34a' };
    if (avg >= 50) return { label: 'High', color: '#22c55e' };
    if (avg >= 15) return { label: 'Moderate', color: '#fbbf24' };
    if (avg >= 5) return { label: 'Low', color: '#fb923c' };
    return { label: 'Very Low', color: '#ef4444' };
}

function getActivityLevel(ppd: number): { label: string; description: string } {
    if (ppd >= 20) return { label: 'Very Active', description: 'Lots of competition — quality matters' };
    if (ppd >= 5) return { label: 'Active', description: 'Healthy posting pace' };
    if (ppd >= 1) return { label: 'Moderate', description: 'Room to stand out' };
    return { label: 'Quiet', description: 'Less competition, smaller audience' };
}

function getDiscussionLevel(avg: number): { label: string; description: string } {
    if (avg >= 50) return { label: 'Very Lively', description: 'Deep discussions happen here' };
    if (avg >= 20) return { label: 'Lively', description: 'Posts spark good conversations' };
    if (avg >= 8) return { label: 'Moderate', description: 'Some discussion on most posts' };
    return { label: 'Quiet', description: 'People read more than they reply' };
}

function ResultView({ data }: { data: any }) {
    const maxAuthorCount = data.topAuthors?.[0]?.count || 1;
    const totalDist = data.scoreDistribution?.reduce((s: number, d: any) => s + d.count, 0) || 1;
    const maxDistCount = Math.max(...(data.scoreDistribution?.map((d: any) => d.count) || [1]));

    const engagement = getEngagementLevel(data.avgScore);
    const activity = getActivityLevel(data.postsPerDay);
    const discussion = getDiscussionLevel(data.avgComments);

    // Find the dominant tier for the insight
    const strongPlus = data.scoreDistribution
        ?.filter((d: any) => !['0-5', '6-25'].includes(d.range))
        .reduce((s: number, d: any) => s + d.count, 0) || 0;
    const strongPct = Math.round((strongPlus / totalDist) * 100);

    return (
        <div>
            {/* Community Snapshot — the key takeaway */}
            <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)', padding: '24px 24px 20px', marginBottom: 20,
            }}>
                <div style={{
                    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)',
                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16,
                }}>Community Snapshot</div>

                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 20,
                }}>
                    {/* Engagement */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <TrendingUp size={15} color={engagement.color} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Engagement</span>
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: engagement.color }}>
                            {engagement.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                            ~{data.avgScore} upvotes per post
                        </div>
                    </div>

                    {/* Activity */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <Activity size={15} color="var(--text-secondary)" />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Activity</span>
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {activity.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                            {data.postsPerDay} posts/day — {activity.description.toLowerCase()}
                        </div>
                    </div>

                    {/* Discussion */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <MessageSquare size={15} color="var(--text-secondary)" />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Discussion</span>
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {discussion.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                            ~{data.avgComments} comments per post
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {/* Top Authors */}
                <div style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xl)', padding: 20
                }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>
                        Top Contributors
                    </h3>
                    {data.topAuthors?.slice(0, 8).map((a: any, i: number) => (
                        <div key={i} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                    u/{a.author}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                    {a.count} posts
                                </span>
                            </div>
                            <div style={{
                                height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden'
                            }}>
                                <div style={{
                                    height: '100%', borderRadius: 3,
                                    background: i === 0 ? 'var(--bg-accent)' : 'var(--text-tertiary)',
                                    width: `${(a.count / maxAuthorCount) * 100}%`,
                                    transition: 'width 0.5s ease'
                                }} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Post Performance */}
                <div style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xl)', padding: 20
                }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                        Post Performance
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: '0 0 16px', lineHeight: 1.4 }}>
                        {strongPct > 0
                            ? `${strongPct}% of posts break out with strong engagement`
                            : 'Most posts stay in the low-to-moderate range'}
                    </p>
                    {data.scoreDistribution?.map((d: any, i: number) => {
                        const tier = TIER_LABELS[d.range] || { label: d.range, color: 'var(--text-tertiary)' };
                        const pct = Math.round((d.count / totalDist) * 100);
                        return (
                            <div key={i} style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {tier.label === 'Hot' || tier.label === 'Viral' ? (
                                            <Zap size={12} color={tier.color} />
                                        ) : null}
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                            {tier.label}
                                        </span>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                                            {d.range} upvotes
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                        {pct}%
                                    </span>
                                </div>
                                <div style={{
                                    height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden'
                                }}>
                                    <div style={{
                                        height: '100%', borderRadius: 3, background: tier.color,
                                        width: `${(d.count / maxDistCount) * 100}%`,
                                        transition: 'width 0.5s ease'
                                    }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footnote */}
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 12, textAlign: 'right' }}>
                Based on {data.sampleSize} posts analyzed
            </div>
        </div>
    );
}

export function SubredditAnalyzer() {
    return (
        <ToolShell
            title="Subreddit Activity Analyzer"
            description="Get a quick snapshot of any subreddit's engagement, top contributors, and posting patterns."
            fields={[
                { name: 'subreddit', label: 'Subreddit', placeholder: 'e.g. saas', required: true }
            ]}
            apiEndpoint="/api/tools/subreddit-stats"
            ctaHeading="Track this subreddit automatically?"
            ctaDescription="OpinionDeck monitors subreddits 24/7 and alerts you to new opportunities."
            nextTools={[
                { slug: 'best-time-to-post', label: 'Find best time to post here', paramMap: { subreddit: 'subreddit' } },
                { slug: 'subreddit-comparison', label: 'Compare with another', paramMap: { subreddit: 'sub1' } },
                { slug: 'pain-point-finder', label: 'Find pain points', paramMap: { subreddit: 'subreddit' } },
            ]}
            renderResult={(data) => <ResultView data={data} />}
        >
            <ToolSEO
                heading="Analyze Any Subreddit's Engagement and Activity"
                introParagraphs={[
                    "Not all subreddits are created equal. Some communities have thousands of members but almost no engagement, while smaller subreddits can drive hundreds of upvotes on every post. This tool gives you the hard data to evaluate any subreddit before you invest time creating content for it.",
                    "By analyzing up to 500 recent posts, we calculate key engagement metrics including average score, average comments per post, daily posting frequency, top contributors, and how scores are distributed across the community. This tells you whether a subreddit is worth your time — and what kind of content performs best there.",
                    "Whether you're a marketer scoping out communities for promotion, a founder researching where your audience hangs out, or a content creator looking for the right niche, this analysis gives you everything you need to make informed decisions."
                ]}
                steps={[
                    { title: "Enter a subreddit name", description: "Type any subreddit name — no r/ prefix needed. Works with any public subreddit on Reddit." },
                    { title: "We pull recent activity", description: "Our system fetches up to 500 recent posts from the subreddit and calculates engagement metrics across the entire dataset." },
                    { title: "Review the stats", description: "See average post score, average comments, posts per day, top contributors, and how scores are distributed from low to high." },
                    { title: "Make a decision", description: "Use the data to evaluate whether this community is worth targeting. High average scores and active contributors signal a healthy, engaged subreddit." }
                ]}
                useCases={[
                    { title: "Content Marketers", description: "Evaluate subreddits before creating content. Know the engagement levels, competition, and what kind of posts succeed in each community." },
                    { title: "Startup Founders", description: "Research which communities your target customers are active in. Find subreddits with high engagement where your product would resonate." },
                    { title: "Community Researchers", description: "Understand the health of any Reddit community. Track contributor diversity, posting frequency, and engagement trends." },
                    { title: "SEO & PR Professionals", description: "Identify active subreddits for link building, brand awareness campaigns, and reputation monitoring. Focus on communities with real engagement, not dead ones." }
                ]}
                faqs={[
                    { question: "What metrics are included in the analysis?", answer: "The analysis includes: average post score, average number of comments per post, estimated posts per day, top 10 most active contributors with post counts, and a score distribution chart showing how many posts fall into different score ranges." },
                    { question: "How is 'posts per day' calculated?", answer: "We look at the date range spanned by the sample posts and divide the total number of posts by the number of days covered. This gives you a reliable average even if some days are more active than others." },
                    { question: "Can I analyze private subreddits?", answer: "No, this tool only works with public subreddits. Private, restricted, or quarantined subreddits are not accessible through Reddit's public data archives." },
                    { question: "How current is the data?", answer: "Results are cached for 24 hours. The analysis is based on the most recent posts available in the archive, which typically includes posts from the past few weeks to months depending on how active the subreddit is." },
                    { question: "What does the score distribution chart tell me?", answer: "The score distribution shows how post scores are spread across the community. If most posts cluster at low scores with a few outliers, it means viral hits are rare but possible. An even distribution suggests more consistent engagement across all content." },
                    { question: "Is there a limit on how many subreddits I can analyze?", answer: "There's no hard limit per se, but the tool is rate-limited to prevent abuse. Under normal usage, you can analyze as many subreddits as you need without hitting the limit." }
                ]}
                relatedTools={[
                    { slug: "best-time-to-post", title: "Best Time to Post", description: "Find the optimal day and hour to post on any subreddit for maximum engagement." },
                    { slug: "subreddit-comparison", title: "Subreddit Comparison", description: "Compare 2-3 subreddits head-to-head on engagement metrics." },
                    { slug: "brand-mentions", title: "Brand Mention Tracker", description: "See where any brand or product is being discussed across Reddit." }
                ]}
                closingParagraphs={[
                    "Understanding a subreddit's dynamics is the first step in any successful Reddit marketing strategy. High engagement numbers mean more eyeballs on your content, but they also mean more competition. Use this tool alongside our Best Time to Post tool to find the sweet spot: the right community at the right time.",
                    "Remember that Reddit communities reward authenticity. Even the most engaged subreddit won't respond well to purely promotional content. Study the top contributors, understand what types of posts get upvoted, and craft content that provides genuine value to the community."
                ]}
            />
        </ToolShell>
    );
}
