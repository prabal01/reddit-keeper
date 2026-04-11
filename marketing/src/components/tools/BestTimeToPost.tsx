import { useState, useEffect } from 'react';
import { ToolShell } from './ToolShell';
import { ToolSEO } from './ToolSEO';
import { Clock, TrendingUp, Calendar } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number): string {
    if (h === 0) return '12a';
    if (h < 12) return `${h}a`;
    if (h === 12) return '12p';
    return `${h - 12}p`;
}

function formatHourLong(h: number): string {
    if (h === 0) return '12:00 AM';
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return '12:00 PM';
    return `${h - 12}:00 PM`;
}

function getHeatColor(value: number, max: number): string {
    if (max === 0 || value === 0) return 'var(--bg-tertiary)';
    const ratio = value / max;
    if (ratio > 0.75) return '#22c55e';
    if (ratio > 0.5) return '#86efac';
    if (ratio > 0.25) return '#fde68a';
    return 'var(--bg-hover)';
}

function getTimezoneName(): string {
    try {
        // Try "shortGeneric" first — gives "India Time", "Pacific Time", etc.
        const generic = new Intl.DateTimeFormat('en-US', { timeZoneName: 'shortGeneric' as any })
            .formatToParts(new Date())
            .find(p => p.type === 'timeZoneName')?.value;
        if (generic && generic !== 'GMT' && !generic.startsWith('GMT')) return generic;
        // Try short abbreviation (e.g. "EST", "PST", "IST")
        const short = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
            .formatToParts(new Date())
            .find(p => p.type === 'timeZoneName')?.value || '';
        if (short && /^[A-Z]{2,5}$/.test(short)) return short;
        return 'your local time';
    } catch {
        return 'your local time';
    }
}

function ResultView({ data }: { data: any }) {
    const [isMobile, setIsMobile] = useState(false);
    const tzName = getTimezoneName();

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 600);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const heatmap = data.heatmap || {};

    // Find max avg score for color scaling + count cells with data
    let maxAvg = 0;
    let cellsWithData = 0;
    for (const d of Object.keys(heatmap)) {
        for (const h of Object.keys(heatmap[d])) {
            const cell = heatmap[d][h];
            if (cell.avgScore > maxAvg) maxAvg = cell.avgScore;
            if (cell.postCount > 0) cellsWithData++;
        }
    }
    const isSparse = cellsWithData < 20; // Less than ~12% of 168 slots have data

    // Build ranked list of all slots for mobile view
    const allSlots: { day: number; hour: number; avgScore: number; postCount: number }[] = [];
    for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
            const cell = heatmap[d]?.[h];
            if (cell && cell.postCount > 0) {
                allSlots.push({ day: d, hour: h, avgScore: cell.avgScore, postCount: cell.postCount });
            }
        }
    }
    const topSlots = allSlots
        .filter(s => s.postCount >= 3)
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 10);

    return (
        <div>
            {/* Today's Best Time Callout */}
            {data.todayBest && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '16px 20px', marginBottom: 20,
                    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
                    borderRadius: 'var(--radius-xl)',
                }}>
                    <Calendar size={20} color="#22c55e" />
                    <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Best time to post today
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                            <strong style={{ color: '#22c55e' }}>{formatHourLong(data.todayBest.hour)}</strong>
                        </div>
                    </div>
                </div>
            )}

            {/* Best Times Summary — group consecutive same-day hours into ranges */}
            {data.bestTimes?.length > 0 && (() => {
                const raw = data.bestTimes.slice(0, 5);
                const topScore = raw[0]?.avgScore || 1;
                // Group consecutive same-day entries into ranges
                const groups: { day: string; startHour: number; endHour: number; avgScore: number }[] = [];
                for (const bt of raw) {
                    const last = groups[groups.length - 1];
                    if (last && last.day === bt.day && bt.hour === last.endHour + 1 && bt.avgScore === last.avgScore) {
                        last.endHour = bt.hour;
                    } else {
                        groups.push({ day: bt.day, startHour: bt.hour, endHour: bt.hour, avgScore: bt.avgScore });
                    }
                }
                return (
                    <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24
                    }}>
                        {groups.map((g, i) => {
                            const ratio = g.avgScore / topScore;
                            const barColor = ratio > 0.7 ? '#22c55e' : ratio > 0.4 ? '#86efac' : '#fde68a';
                            return (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '10px 16px', background: i === 0 ? 'rgba(34,197,94,0.1)' : 'var(--bg-secondary)',
                                    border: `1px solid ${i === 0 ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                                    borderRadius: 'var(--radius-md)', fontSize: '0.85rem'
                                }}>
                                    {i === 0 && <TrendingUp size={14} color="#22c55e" />}
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{g.day}</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>
                                        {g.startHour === g.endHour
                                            ? formatHourLong(g.startHour)
                                            : `${formatHourLong(g.startHour)} – ${formatHourLong(g.endHour)}`}
                                    </span>
                                    <div style={{
                                        width: 48, height: 6, borderRadius: 3,
                                        background: 'var(--bg-tertiary)', overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            width: `${Math.round(ratio * 100)}%`, height: '100%',
                                            borderRadius: 3, background: barColor
                                        }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })()}

            {/* Heatmap Grid (desktop) or Ranked List (mobile) */}
            <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)', padding: 20
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Clock size={16} color="var(--text-secondary)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {isMobile ? 'Top Posting Times' : 'Posting Activity Heatmap'}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', padding: '2px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)' }}>
                        {tzName}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                        Based on {data.sampleSize} posts
                    </span>
                </div>

                {/* Sparse data warning */}
                {isSparse && (
                    <div style={{
                        fontSize: '0.8rem', color: 'var(--text-tertiary)', padding: '10px 14px',
                        background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: 16,
                        lineHeight: 1.5
                    }}>
                        Limited data for this subreddit — most time slots have no posts. Results are more reliable for active communities with frequent posting.
                    </div>
                )}

                {isMobile ? (
                    /* Mobile: Ranked list of top time slots */
                    <div>
                        {topSlots.length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Not enough data to rank time slots.</p>
                        ) : topSlots.map((slot, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '12px 0',
                                borderBottom: i < topSlots.length - 1 ? '1px solid var(--border)' : 'none'
                            }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: '50%',
                                    background: i === 0 ? '#22c55e' : i < 3 ? '#86efac' : 'var(--bg-tertiary)',
                                    color: i < 3 ? '#fff' : 'var(--text-secondary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.75rem', fontWeight: 700, flexShrink: 0
                                }}>{i + 1}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {DAYS[slot.day]} {formatHourLong(slot.hour)}
                                    </div>
                                </div>
                                <div style={{
                                    width: 48, height: 8, borderRadius: 4,
                                    background: 'var(--bg-tertiary)', overflow: 'hidden',
                                }}>
                                    <div style={{
                                        width: `${maxAvg > 0 ? Math.round((slot.avgScore / maxAvg) * 100) : 0}%`,
                                        height: '100%', borderRadius: 4,
                                        background: getHeatColor(slot.avgScore, maxAvg),
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Desktop: Full heatmap grid */
                    <div>
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
                                        const hasData = cell.postCount > 0;
                                        return (
                                            <div key={h} title={`${dayName} ${formatHour(h)}: ${hasData ? `engagement ${cell.avgScore}, ${cell.postCount} posts` : 'no posts'}`}
                                                style={{
                                                    flex: 1, aspectRatio: '1', borderRadius: 3,
                                                    background: hasData ? getHeatColor(cell.avgScore, maxAvg) : 'transparent',
                                                    border: hasData ? 'none' : '1px solid var(--border)',
                                                    minHeight: 16, cursor: 'default',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.5rem', fontWeight: 600,
                                                    color: cell.avgScore / maxAvg > 0.5 ? '#fff' : 'var(--text-tertiary)',
                                                    transition: 'transform 0.1s',
                                                    opacity: hasData ? 1 : 0.3,
                                                }}
                                                onMouseEnter={e => { if (hasData) (e.target as HTMLElement).style.transform = 'scale(1.4)'; }}
                                                onMouseLeave={e => (e.target as HTMLElement).style.transform = 'scale(1)'}
                                            >
                                                {hasData && cell.avgScore > 0 ? cell.avgScore : ''}
                                            </div>
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
                            <div style={{ width: 14, height: 14, borderRadius: 3, border: '1px solid var(--border)', opacity: 0.3 }} />
                            <span>No data</span>
                            <span style={{ marginLeft: 8 }}>Low</span>
                            {['var(--bg-hover)', '#fde68a', '#86efac', '#22c55e'].map((c, i) => (
                                <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: c }} />
                            ))}
                            <span>High</span>
                        </div>
                    </div>
                )}
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
            submitLabel="Find Best Times"
            loadingLabel="Crunching data..."
            extraBody={{ timezoneOffset: typeof window !== 'undefined' ? new Date().getTimezoneOffset() : 0 }}
            ctaHeading="Ready to post at the perfect time?"
            ctaDescription="OpinionDeck can schedule and track your Reddit posts for maximum engagement."
            nextTools={[
                { slug: 'subreddit-analyzer', label: 'Analyze this subreddit', paramMap: { subreddit: 'subreddit' } },
                { slug: 'opportunity-finder', label: 'Find opportunities here', paramMap: { subreddit: 'subreddit' } },
            ]}
            renderResult={(data) => <ResultView data={data} />}
        >
            <ToolSEO
                heading="Find the Best Time to Post on Any Subreddit"
                introParagraphs={[
                    "Timing is everything on Reddit. A great post published at the wrong hour can die in /new with zero upvotes, while the same content posted at the right time can reach the front page. This free tool analyzes hundreds of recent posts from any subreddit to show you exactly when high-scoring content gets published.",
                    "The heatmap displays average post scores by day of the week and hour of the day in your local timezone, giving you a visual guide to the community's engagement patterns. Green cells mean higher average scores — that's when you want to hit publish.",
                    "Reddit's algorithm heavily favors early upvotes. Posts that gain traction in the first 30-60 minutes are far more likely to climb the rankings. By posting during a window when your target subreddit is active but not oversaturated, you maximize your chances of getting those crucial early votes."
                ]}
                steps={[
                    { title: "Enter a subreddit name", description: "Type the name of any subreddit you want to analyze — no need to include the r/ prefix." },
                    { title: "We analyze recent posts", description: "Our system pulls up to 1,000 recent posts from the subreddit spanning months of activity, examining when each one was published and how well it performed." },
                    { title: "See the heatmap", description: "Results are displayed as a 7-day × 24-hour heatmap in your local timezone, color-coded by average post score. Brighter green means higher engagement at that time slot." },
                    { title: "Find your posting window", description: "Look for the green cells — those are the time slots where posts historically perform best. The top 5 best times are highlighted above the heatmap for quick reference." }
                ]}
                useCases={[
                    { title: "Content Marketers", description: "Schedule your Reddit posts for maximum visibility instead of guessing. Time your product launches, blog shares, and announcements to hit peak engagement windows." },
                    { title: "Founders & Indie Hackers", description: "Launching on Reddit? Post your Show HN or product announcement when the community is most active and receptive to new content." },
                    { title: "Community Managers", description: "Understand when your subreddit's audience is online so you can schedule AMAs, pinned posts, and community events at optimal times." },
                    { title: "Social Media Managers", description: "Add data-driven Reddit posting schedules to your content calendar. Stop relying on generic 'best time to post' advice that doesn't account for individual communities." }
                ]}
                faqs={[
                    { question: "What timezone are the results in?", answer: "Results are automatically displayed in your browser's local timezone. The timezone abbreviation is shown in the heatmap header." },
                    { question: "How many posts are analyzed?", answer: "We analyze up to 1,000 posts spanning several months of activity. This gives a statistically meaningful sample across all days and hours, producing reliable recommendations." },
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
