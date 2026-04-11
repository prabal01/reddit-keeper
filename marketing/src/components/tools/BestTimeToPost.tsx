import { ToolShell } from './ToolShell';
import { ToolSEO } from './ToolSEO';
import { Clock, TrendingUp } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number): string {
    if (h === 0) return '12a';
    if (h < 12) return `${h}a`;
    if (h === 12) return '12p';
    return `${h - 12}p`;
}

function getHeatColor(value: number, max: number): string {
    if (max === 0 || value === 0) return 'var(--bg-tertiary)';
    const ratio = value / max;
    if (ratio > 0.75) return '#22c55e';
    if (ratio > 0.5) return '#86efac';
    if (ratio > 0.25) return '#fde68a';
    return 'var(--bg-hover)';
}

function ResultView({ data }: { data: any }) {
    const heatmap = data.heatmap || {};

    // Find max avg score for color scaling
    let maxAvg = 0;
    for (const d of Object.keys(heatmap)) {
        for (const h of Object.keys(heatmap[d])) {
            const cell = heatmap[d][h];
            if (cell.avgScore > maxAvg) maxAvg = cell.avgScore;
        }
    }

    return (
        <div>
            {/* Best Times Summary */}
            {data.bestTimes?.length > 0 && (
                <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24
                }}>
                    {data.bestTimes.slice(0, 5).map((bt: any, i: number) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 16px', background: i === 0 ? 'rgba(34,197,94,0.1)' : 'var(--bg-secondary)',
                            border: `1px solid ${i === 0 ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-md)', fontSize: '0.85rem'
                        }}>
                            {i === 0 && <TrendingUp size={14} color="#22c55e" />}
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{bt.day}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{formatHour(bt.hour)} UTC</span>
                            <span style={{
                                padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                background: i === 0 ? 'rgba(34,197,94,0.15)' : 'var(--bg-tertiary)',
                                fontSize: '0.75rem', fontWeight: 600, color: i === 0 ? '#22c55e' : 'var(--text-secondary)'
                            }}>avg {bt.avgScore}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Heatmap Grid */}
            <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)', padding: 20, overflowX: 'auto'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Clock size={16} color="var(--text-secondary)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Posting Activity Heatmap (UTC)
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                        Based on {data.sampleSize} posts
                    </span>
                </div>

                <div style={{ minWidth: 600 }}>
                    {/* Hour labels */}
                    <div style={{ display: 'flex', paddingLeft: 48 }}>
                        {HOURS.filter(h => h % 3 === 0).map(h => (
                            <div key={h} style={{
                                flex: '0 0 calc(100% / 8)', fontSize: '0.65rem',
                                color: 'var(--text-tertiary)', textAlign: 'left'
                            }}>{formatHour(h)}</div>
                        ))}
                    </div>

                    {/* Rows */}
                    {DAYS.map((dayName, d) => (
                        <div key={d} style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
                            <div style={{
                                width: 44, fontSize: '0.75rem', fontWeight: 500,
                                color: 'var(--text-secondary)', flexShrink: 0
                            }}>{dayName}</div>
                            <div style={{ display: 'flex', flex: 1, gap: 2 }}>
                                {HOURS.map(h => {
                                    const cell = heatmap[d]?.[h] || { avgScore: 0, postCount: 0 };
                                    return (
                                        <div key={h} title={`${dayName} ${formatHour(h)}: avg score ${cell.avgScore}, ${cell.postCount} posts`}
                                            style={{
                                                flex: 1, aspectRatio: '1', borderRadius: 3,
                                                background: getHeatColor(cell.avgScore, maxAvg),
                                                minHeight: 16, cursor: 'default',
                                                transition: 'transform 0.1s',
                                            }}
                                            onMouseEnter={e => (e.target as HTMLElement).style.transform = 'scale(1.3)'}
                                            onMouseLeave={e => (e.target as HTMLElement).style.transform = 'scale(1)'}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Legend */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        justifyContent: 'flex-end', marginTop: 12, fontSize: '0.7rem', color: 'var(--text-tertiary)'
                    }}>
                        <span>Less</span>
                        {['var(--bg-tertiary)', 'var(--bg-hover)', '#fde68a', '#86efac', '#22c55e'].map((c, i) => (
                            <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: c }} />
                        ))}
                        <span>More</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function BestTimeToPost() {
    return (
        <ToolShell
            title="Best Time to Post on Reddit"
            description="Find when posts get the most engagement in any subreddit."
            fields={[
                { name: 'subreddit', label: 'Subreddit', placeholder: 'e.g. startups', required: true }
            ]}
            apiEndpoint="/api/tools/best-time"
            renderResult={(data) => <ResultView data={data} />}
        >
            <ToolSEO
                heading="Find the Best Time to Post on Any Subreddit"
                introParagraphs={[
                    "Timing is everything on Reddit. A great post published at the wrong hour can die in /new with zero upvotes, while the same content posted at the right time can reach the front page. This free tool analyzes hundreds of recent posts from any subreddit to show you exactly when high-scoring content gets published.",
                    "The heatmap displays average post scores by day of the week and hour of the day (in UTC), giving you a visual guide to the community's engagement patterns. Green cells mean higher average scores — that's when you want to hit publish.",
                    "Reddit's algorithm heavily favors early upvotes. Posts that gain traction in the first 30-60 minutes are far more likely to climb the rankings. By posting during a window when your target subreddit is active but not oversaturated, you maximize your chances of getting those crucial early votes."
                ]}
                steps={[
                    { title: "Enter a subreddit name", description: "Type the name of any subreddit you want to analyze — no need to include the r/ prefix." },
                    { title: "We analyze recent posts", description: "Our system pulls up to 500 recent posts from the subreddit and examines when each one was published and how well it performed." },
                    { title: "See the heatmap", description: "Results are displayed as a 7-day × 24-hour heatmap, color-coded by average post score. Brighter green means higher engagement at that time slot." },
                    { title: "Find your posting window", description: "Look for the green cells — those are the time slots where posts historically perform best. The top 5 best times are highlighted above the heatmap for quick reference." }
                ]}
                useCases={[
                    { title: "Content Marketers", description: "Schedule your Reddit posts for maximum visibility instead of guessing. Time your product launches, blog shares, and announcements to hit peak engagement windows." },
                    { title: "Founders & Indie Hackers", description: "Launching on Reddit? Post your Show HN or product announcement when the community is most active and receptive to new content." },
                    { title: "Community Managers", description: "Understand when your subreddit's audience is online so you can schedule AMAs, pinned posts, and community events at optimal times." },
                    { title: "Social Media Managers", description: "Add data-driven Reddit posting schedules to your content calendar. Stop relying on generic 'best time to post' advice that doesn't account for individual communities." }
                ]}
                faqs={[
                    { question: "What timezone are the results in?", answer: "All times are displayed in UTC (Coordinated Universal Time). To convert to your local timezone, subtract or add the appropriate hours. For example, if you're in EST, subtract 5 hours from the UTC time shown." },
                    { question: "How many posts are analyzed?", answer: "We analyze up to 500 of the most recent posts from the subreddit. This gives a statistically meaningful sample while keeping results current. For very active subreddits, this may cover just a few weeks; for smaller ones, it could span several months." },
                    { question: "Does this work for any subreddit?", answer: "Yes, this tool works for any public subreddit. Private or quarantined subreddits may not return results. Very new subreddits with fewer than 50 posts may show incomplete heatmaps." },
                    { question: "How often is the data updated?", answer: "Results are cached for 24 hours. If you check the same subreddit again within that window, you'll see the cached results. After 24 hours, a fresh analysis is performed with the latest posts." },
                    { question: "Why are some cells empty in the heatmap?", answer: "Empty or very light cells mean few or no posts were published during that time slot in the sample period. This could indicate a time when the community is least active — or an untapped opportunity with less competition." },
                    { question: "Is this really free?", answer: "Yes, completely free with no signup required. You can analyze any subreddit as many times as you like. The tool is rate-limited to prevent abuse, but normal usage won't hit those limits." }
                ]}
                relatedTools={[
                    { slug: "subreddit-analyzer", title: "Subreddit Analyzer", description: "Get a full breakdown of any subreddit's engagement stats, top contributors, and score distribution." },
                    { slug: "subreddit-comparison", title: "Subreddit Comparison", description: "Compare 2-3 subreddits side by side to see which community has better engagement." },
                    { slug: "brand-mentions", title: "Brand Mention Tracker", description: "Track every mention of a brand or product across Reddit communities." }
                ]}
                closingParagraphs={[
                    "Reddit marketing works best when you combine great content with smart timing. This tool gives you the timing data — but remember, the content still needs to provide genuine value to the community. Posts that feel promotional or off-topic will get downvoted regardless of when you publish them.",
                    "For best results, cross-reference the heatmap with the subreddit's posting rules and culture. Some communities have specific days for self-promotion or certain types of content. Use our Subreddit Analyzer to understand the community's norms before posting."
                ]}
            />
        </ToolShell>
    );
}
