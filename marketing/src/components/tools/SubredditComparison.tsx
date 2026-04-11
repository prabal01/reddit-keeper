import { useState, useEffect, type FormEvent } from 'react';
import { Loader2, AlertCircle, ArrowRight, TrendingUp, Activity, MessageSquare } from 'lucide-react';
import { ToolSEO } from './ToolSEO';

const dashboardUrl = (typeof window !== 'undefined' && (window as any).__PUBLIC_DASHBOARD_URL) || '/app';

interface ComparisonEntry {
    subreddit: string;
    sampleSize: number;
    avgScore: number;
    avgComments: number;
    postsPerDay: number;
    topAuthors: { author: string; count: number }[];
    scoreDistribution: { range: string; count: number }[];
}

function getEngagementLevel(avg: number): { label: string; color: string } {
    if (avg >= 100) return { label: 'Very High', color: '#16a34a' };
    if (avg >= 50) return { label: 'High', color: '#22c55e' };
    if (avg >= 15) return { label: 'Moderate', color: '#fbbf24' };
    if (avg >= 5) return { label: 'Low', color: '#fb923c' };
    return { label: 'Very Low', color: '#ef4444' };
}

function getActivityLevel(ppd: number): { label: string; color: string } {
    if (ppd >= 20) return { label: 'Very Active', color: '#16a34a' };
    if (ppd >= 5) return { label: 'Active', color: '#22c55e' };
    if (ppd >= 1) return { label: 'Moderate', color: '#fbbf24' };
    return { label: 'Quiet', color: '#fb923c' };
}

function getDiscussionLevel(avg: number): { label: string; color: string } {
    if (avg >= 50) return { label: 'Very Lively', color: '#16a34a' };
    if (avg >= 20) return { label: 'Lively', color: '#22c55e' };
    if (avg >= 8) return { label: 'Moderate', color: '#fbbf24' };
    return { label: 'Quiet', color: '#fb923c' };
}

function ResultView({ data }: { data: { comparisons: ComparisonEntry[] } }) {
    const comps = data.comparisons;
    if (comps.length === 0) return null;

    const scores = comps.map(c => c.avgScore);
    const comments = comps.map(c => c.avgComments);
    const ppd = comps.map(c => c.postsPerDay);

    const bestScore = scores.indexOf(Math.max(...scores));
    const bestComments = comments.indexOf(Math.max(...comments));
    const bestPpd = ppd.indexOf(Math.max(...ppd));

    // Generate insight text
    const metrics = ['engagement', 'discussion', 'activity'];
    const bestIndices = [bestScore, bestComments, bestPpd];
    const winsByIdx: Record<number, string[]> = {};
    bestIndices.forEach((idx, mi) => {
        if (!winsByIdx[idx]) winsByIdx[idx] = [];
        winsByIdx[idx].push(metrics[mi]);
    });
    const insight = Object.entries(winsByIdx)
        .map(([idx, ms]) => `r/${comps[Number(idx)].subreddit} leads in ${ms.join(' and ')}`)
        .join('. ') + '.';

    return (
        <div>
            {/* Comparison Verdict */}
            <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)', padding: '24px 24px 20px', marginBottom: 20,
            }}>
                <div style={{
                    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)',
                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16,
                }}>Comparison Verdict</div>

                {/* Insight */}
                <div style={{
                    fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 20,
                    padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                    lineHeight: 1.5,
                }}>{insight}</div>

                {/* Per-subreddit cards */}
                <div style={{
                    display: 'grid', gridTemplateColumns: `repeat(${comps.length}, 1fr)`, gap: 16,
                }}>
                    {comps.map((c, i) => {
                        const eng = getEngagementLevel(c.avgScore);
                        const act = getActivityLevel(c.postsPerDay);
                        const disc = getDiscussionLevel(c.avgComments);
                        return (
                            <div key={i} style={{
                                padding: 16, background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-md)',
                            }}>
                                <div style={{
                                    fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)',
                                    marginBottom: 14,
                                }}>r/{c.subreddit}</div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                            <TrendingUp size={13} color={eng.color} />
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Engagement</span>
                                        </div>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: eng.color }}>
                                            {eng.label}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginLeft: 6 }}>
                                            ~{c.avgScore} upvotes
                                        </span>
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                            <MessageSquare size={13} color={disc.color} />
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Discussion</span>
                                        </div>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: disc.color }}>
                                            {disc.label}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginLeft: 6 }}>
                                            ~{c.avgComments} comments
                                        </span>
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                            <Activity size={13} color={act.color} />
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Activity</span>
                                        </div>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: act.color }}>
                                            {act.label}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginLeft: 6 }}>
                                            {c.postsPerDay} posts/day
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Top Authors per subreddit */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16
            }}>
                {comps.map((c, i) => (
                    <div key={i} style={{
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-xl)', padding: 20
                    }}>
                        <h3 style={{
                            fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)',
                            margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.05em'
                        }}>Top Contributors — r/{c.subreddit}</h3>
                        {c.topAuthors.map((a, j) => (
                            <div key={j} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '8px 0', borderBottom: j < c.topAuthors.length - 1 ? '1px solid var(--border)' : 'none'
                            }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>u/{a.author}</span>
                                <span style={{
                                    fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px',
                                    background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)',
                                    color: 'var(--text-secondary)'
                                }}>{a.count} posts</span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function SubredditComparison() {
    const [subs, setSubs] = useState(['', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
    const [result, setResult] = useState<any>(null);
    const [fromDashboard, setFromDashboard] = useState(false);

    // Check if user came from dashboard
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('ref') === 'dashboard') setFromDashboard(true);
    }, []);

    // Restore inputs from URL params
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const restored: string[] = [];
        for (let i = 0; i < 3; i++) {
            const val = params.get(`sub${i + 1}`);
            if (val) restored.push(val);
        }
        if (restored.length >= 2) setSubs(restored);
    }, []);

    // Rate limit countdown
    useEffect(() => {
        if (rateLimitCountdown <= 0) return;
        const t = setInterval(() => setRateLimitCountdown(c => c - 1), 1000);
        return () => clearInterval(t);
    }, [rateLimitCountdown]);

    const addSub = () => { if (subs.length < 3) setSubs([...subs, '']); };
    const removeSub = (idx: number) => { if (subs.length > 2) setSubs(subs.filter((_, i) => i !== idx)); };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setResult(null);
        setLoading(true);

        const cleaned = subs.map(s => s.trim().toLowerCase().replace(/^r\//, '')).filter(Boolean);
        if (cleaned.length < 2) {
            setError('Please enter at least 2 subreddit names.');
            setLoading(false);
            return;
        }

        // Persist inputs in URL
        const params = new URLSearchParams();
        cleaned.forEach((s, i) => params.set(`sub${i + 1}`, s));
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);

        try {
            const resp = await fetch('/api/tools/subreddit-compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subreddits: cleaned }),
            });

            if (resp.status === 429) {
                const data = await resp.json().catch(() => ({}));
                setRateLimitCountdown(data.retryAfter || 60);
                setError(data.error || "You've used this tool too many times. Please wait a moment.");
                return;
            }

            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}));
                setError(data.error || 'Something went wrong. Please try again.');
                return;
            }

            setResult(await resp.json());
        } catch {
            setError('Could not connect to the server. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
            {/* Hero */}
            <div style={{ textAlign: 'center', padding: '48px 0 32px' }}>
                <h1 style={{
                    fontSize: '2.25rem', fontWeight: 800, margin: '0 0 12px',
                    color: 'var(--text-primary)', lineHeight: 1.2, letterSpacing: '-0.02em'
                }}>Compare Subreddits</h1>
                <p style={{
                    fontSize: '1.1rem', color: 'var(--text-secondary)', margin: 0, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto'
                }}>Compare 2-3 communities side by side to find the best fit for your content.</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)', padding: 24, marginBottom: 24
            }}>
                <input type="text" name="website_url" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                    {subs.map((s, i) => (
                        <div key={i} style={{ flex: '1 1 160px', minWidth: 0, position: 'relative' }}>
                            <label style={{
                                display: 'block', fontSize: '0.8rem', fontWeight: 600,
                                color: 'var(--text-secondary)', marginBottom: 6
                            }}>Subreddit {i + 1}</label>
                            <input
                                type="text"
                                placeholder={i === 0 ? 'e.g. startups' : i === 1 ? 'e.g. entrepreneur' : 'e.g. smallbusiness'}
                                required={i < 2}
                                value={s}
                                onChange={e => {
                                    const next = [...subs];
                                    next[i] = e.target.value;
                                    setSubs(next);
                                }}
                                style={{
                                    width: '100%', padding: '10px 14px', fontSize: '0.95rem',
                                    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-input)', color: 'var(--text-primary)',
                                    outline: 'none', boxSizing: 'border-box',
                                }}
                                onFocus={e => e.target.style.borderColor = 'var(--bg-accent)'}
                                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                            />
                            {i >= 2 && (
                                <button type="button" onClick={() => removeSub(i)} style={{
                                    position: 'absolute', top: 0, right: 0, background: 'none',
                                    border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer',
                                    fontSize: '0.75rem', padding: '2px 4px'
                                }}>remove</button>
                            )}
                        </div>
                    ))}
                    {subs.length < 3 && (
                        <button type="button" onClick={addSub} style={{
                            padding: '10px 16px', fontSize: '0.85rem', fontWeight: 500,
                            background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                            border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer', whiteSpace: 'nowrap'
                        }}>+ Add Third</button>
                    )}
                    <button type="submit" disabled={loading || rateLimitCountdown > 0} style={{
                        padding: '10px 28px', fontSize: '0.95rem', fontWeight: 600,
                        background: loading ? 'var(--bg-tertiary)' : 'var(--bg-accent)',
                        color: loading ? 'var(--text-secondary)' : '#fff',
                        border: 'none', borderRadius: 'var(--radius-sm)', cursor: loading ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
                        opacity: (loading || rateLimitCountdown > 0) ? 0.6 : 1,
                    }}>
                        {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Comparing...</>
                            : rateLimitCountdown > 0 ? `Wait ${rateLimitCountdown}s`
                            : 'Compare'}
                    </button>
                </div>
            </form>

            {/* Error */}
            {error && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
                    background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: 'var(--radius-md)', marginBottom: 24, color: '#ef4444', fontSize: '0.9rem'
                }}>
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* Result */}
            {result && <ResultView data={result} />}

            {/* Bottom CTA */}
            {result && !fromDashboard && (
                <div style={{
                    textAlign: 'center', padding: '40px 24px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xl)', marginTop: 24
                }}>
                    <p style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                        Want deeper insights?
                    </p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 20px' }}>
                        OpinionDeck monitors Reddit 24/7 and finds opportunities automatically.
                    </p>
                    <a href={dashboardUrl} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '12px 28px', background: 'var(--bg-accent)', color: '#fff',
                        borderRadius: 'var(--radius-sm)', fontWeight: 600, textDecoration: 'none'
                    }}>
                        Try OpinionDeck Free <ArrowRight size={16} />
                    </a>
                </div>
            )}

            {/* SEO content */}
            <ToolSEO
                heading="Compare Subreddits to Find the Best Community for You"
                introParagraphs={[
                    "When you've identified several potential subreddits for your content or marketing, the next question is: which one deserves your time? This tool puts 2-3 subreddits side by side and compares them on the metrics that actually matter — engagement, activity level, and contributor base.",
                    "Instead of manually browsing each community and guessing at their health, get hard numbers. See which subreddit has higher average scores, more active discussion, and a more diverse contributor base. The green highlights and trophy icons make it instantly clear which community wins each metric.",
                    "This is the analytical step between finding your communities (with our Subreddit Finder) and optimizing your posting strategy (with Best Time to Post). Compare first, then invest your time where the data says you'll get the best return."
                ]}
                steps={[
                    { title: "Enter 2-3 subreddits", description: "Add the subreddit names you want to compare. Start with two and add a third if needed. No r/ prefix required." },
                    { title: "We analyze each community", description: "Our system pulls recent posts from each subreddit and calculates engagement metrics independently for each community." },
                    { title: "See the comparison", description: "Results are displayed in a head-to-head format with green highlights on the winning metrics. Each row shows which subreddit leads in that category." },
                    { title: "Pick your winner", description: "Use the comparison to decide where to focus your efforts. The best subreddit for you depends on your goals — high engagement, active discussion, or contributor diversity." }
                ]}
                useCases={[
                    { title: "Content Marketers", description: "Choosing between r/startups and r/SaaS for your next post? Compare them side by side to see which community will give your content more traction." },
                    { title: "Reddit Advertisers", description: "Allocate your Reddit ad budget to the subreddit with the highest engagement rates. Don't waste ad spend on communities where content barely gets noticed." },
                    { title: "Community Builders", description: "Benchmarking your subreddit against similar communities? See how your engagement metrics stack up and identify areas for improvement." },
                    { title: "Market Researchers", description: "Compare communities in related niches to understand where your target market is most active and engaged." }
                ]}
                faqs={[
                    { question: "How many subreddits can I compare at once?", answer: "You can compare 2 to 3 subreddits at a time. This keeps the comparison clear and readable. For analyzing a single subreddit in depth, use our Subreddit Analyzer instead." },
                    { question: "What metrics are compared?", answer: "The comparison includes: average post score, average comments per post, posts per day, sample size, top post details, and top contributors for each subreddit." },
                    { question: "What does the green highlight mean?", answer: "The green highlight and trophy icon indicate which subreddit has the best value for that particular metric. For example, if subreddit A has an average score of 50 and subreddit B has 30, subreddit A gets the green highlight on the score row." },
                    { question: "Is a higher score always better?", answer: "Not necessarily. A subreddit with very high average scores but only 1 post per day might be less useful than one with moderate scores and 20 posts daily. Consider your goals — if you want maximum engagement per post, go for higher scores. If you want more opportunities to participate, go for higher activity." },
                    { question: "Can I compare subreddits from different niches?", answer: "Yes, you can compare any public subreddits. However, the comparison is most useful when comparing communities in related niches, since cross-niche comparisons may have very different engagement patterns that aren't directly comparable." },
                    { question: "How current is the comparison data?", answer: "Each subreddit's data is cached individually for 24 hours. If you've already analyzed a subreddit with our Subreddit Analyzer, the comparison reuses that cached data for faster results." }
                ]}
                relatedTools={[
                    { slug: "subreddit-analyzer", title: "Subreddit Analyzer", description: "Want a deeper look at a single subreddit? Get full engagement stats, top contributors, and score distribution." },
                    { slug: "best-time-to-post", title: "Best Time to Post", description: "Found your winning subreddit? Now find the best time to post there." },
                    { slug: "subreddit-finder", title: "Subreddit Finder", description: "Not sure which subreddits to compare? Describe your product and we'll find them for you." }
                ]}
                closingParagraphs={[
                    "Subreddit comparison is a critical step that many Reddit marketers skip. They find a community that seems relevant and dive in without checking if there's a better option. Five minutes of comparison can save hours of wasted effort in the wrong community.",
                    "After choosing your target subreddit, use our Best Time to Post tool to find the optimal posting window, then our Subreddit Analyzer to understand the community's culture and top contributors. This research workflow sets you up for Reddit marketing success."
                ]}
            />

            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
    );
}
