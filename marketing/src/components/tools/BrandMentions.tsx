import { ToolShell } from './ToolShell';
import { ToolSEO } from './ToolSEO';
import { ExternalLink, MessageSquare, Zap, Globe, TrendingUp } from 'lucide-react';

function formatDate(utc: number): string {
    return new Date(utc * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getBuzzLevel(total: number): { label: string; color: string; description: string } {
    if (total >= 80) return { label: 'Major Buzz', color: '#16a34a', description: 'widely discussed across Reddit' };
    if (total >= 40) return { label: 'High', color: '#22c55e', description: 'getting significant attention' };
    if (total >= 15) return { label: 'Moderate', color: '#fbbf24', description: 'getting noticed in some communities' };
    if (total >= 5) return { label: 'Low', color: '#fb923c', description: 'occasional mentions' };
    return { label: 'Minimal', color: '#ef4444', description: 'barely on Reddit\'s radar' };
}

function getSpread(breakdown: any[], total: number): { label: string; color: string; description: string } {
    const n = breakdown?.length || 0;
    const topShare = n > 0 ? (breakdown[0]?.count || 0) / Math.max(total, 1) : 0;
    if (n >= 10 && topShare < 0.3) return { label: 'Widespread', color: '#16a34a', description: 'talked about in many communities' };
    if (n >= 5) return { label: 'Broad', color: '#22c55e', description: 'present in several communities' };
    if (n >= 3) return { label: 'Focused', color: '#fbbf24', description: 'concentrated in a few places' };
    return { label: 'Niche', color: '#fb923c', description: 'limited to one or two communities' };
}

function getMomentum(timeline: any[]): { label: string; color: string; description: string } {
    if (!timeline || timeline.length < 4) return { label: 'New', color: 'var(--text-tertiary)', description: 'not enough data to show a trend' };
    const half = Math.floor(timeline.length / 2);
    const earlier = timeline.slice(0, half).reduce((s: number, t: any) => s + t.count, 0);
    const later = timeline.slice(half).reduce((s: number, t: any) => s + t.count, 0);
    if (earlier === 0) return later > 0
        ? { label: 'Emerging', color: '#22c55e', description: 'new and gaining attention' }
        : { label: 'Quiet', color: 'var(--text-tertiary)', description: 'no clear trend' };
    const change = (later - earlier) / earlier;
    if (change >= 0.5) return { label: 'Surging', color: '#16a34a', description: 'rapidly gaining attention' };
    if (change >= 0.1) return { label: 'Growing', color: '#22c55e', description: 'steadily gaining attention' };
    if (change >= -0.1) return { label: 'Stable', color: '#fbbf24', description: 'consistent mention volume' };
    if (change >= -0.5) return { label: 'Declining', color: '#fb923c', description: 'losing some buzz' };
    return { label: 'Fading', color: '#ef4444', description: 'significantly less discussion' };
}

function ResultView({ data }: { data: any }) {
    const maxSubCount = data.subredditBreakdown?.[0]?.count || 1;
    const maxTimeCount = Math.max(...(data.timeline?.map((t: any) => t.count) || [1]));

    const buzz = getBuzzLevel(data.totalMentions);
    const spread = getSpread(data.subredditBreakdown, data.totalMentions);
    const momentum = getMomentum(data.timeline);

    const topSub = data.subredditBreakdown?.[0]?.subreddit;
    const buzzDesc = buzz.label === 'Major Buzz' ? 'major buzz' : `${buzz.label.toLowerCase()} buzz`;
    const insight = topSub
        ? `"${data.brand}" has ${buzzDesc}, mainly in r/${topSub}${data.subredditBreakdown?.length > 1 ? ` and ${data.subredditBreakdown.length - 1} other ${data.subredditBreakdown.length === 2 ? 'community' : 'communities'}` : ''}.`
        : `"${data.brand}" has ${buzzDesc} on Reddit.`;

    return (
        <div>
            {/* Brand Presence */}
            <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)', padding: '24px 24px 20px', marginBottom: 20,
            }}>
                <div style={{
                    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)',
                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16,
                }}>Brand Presence</div>

                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 20,
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <Zap size={15} color={buzz.color} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Buzz Level</span>
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: buzz.color }}>{buzz.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                            {data.totalMentions} mentions — {buzz.description}
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <Globe size={15} color={spread.color} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Spread</span>
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: spread.color }}>{spread.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                            {data.subredditBreakdown?.length || 0} communities — {spread.description}
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <TrendingUp size={15} color={momentum.color} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Momentum</span>
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: momentum.color }}>{momentum.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                            {momentum.description}
                        </div>
                    </div>
                </div>

                <div style={{
                    fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 16,
                    padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                    lineHeight: 1.5,
                }}>{insight}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
                {/* Subreddit Breakdown */}
                <div style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xl)', padding: 20
                }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>
                        Where people mention "{data.brand}"
                    </h3>
                    {data.subredditBreakdown?.slice(0, 10).map((s: any, i: number) => (
                        <div key={i} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                    r/{s.subreddit}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                    {s.count} mentions
                                </span>
                            </div>
                            <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%', borderRadius: 3, background: 'var(--bg-accent)',
                                    width: `${(s.count / maxSubCount) * 100}%`
                                }} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Timeline */}
                <div style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xl)', padding: 20
                }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>
                        Mentions over time
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
                        {data.timeline?.slice(-12).map((t: any, i: number) => (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <div style={{
                                    width: '100%', borderRadius: '4px 4px 0 0',
                                    background: 'var(--bg-accent)', opacity: 0.3 + (t.count / maxTimeCount) * 0.7,
                                    height: `${Math.max(8, (t.count / maxTimeCount) * 100)}%`,
                                    transition: 'height 0.5s ease'
                                }} />
                                <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                    {new Date(t.month + '-01').toLocaleDateString('en-US', { month: 'short' })}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mention List */}
            <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)', padding: 20
            }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>
                    Recent mentions
                </h3>
                {data.posts?.map((p: any, i: number) => (
                    <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                        style={{
                            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0',
                            borderBottom: i < data.posts.length - 1 ? '1px solid var(--border)' : 'none',
                            textDecoration: 'none', color: 'inherit'
                        }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)',
                                marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>{p.title}</div>
                            <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                <span style={{
                                    padding: '1px 8px', background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-full)', fontWeight: 500
                                }}>r/{p.subreddit}</span>
                                <span>by u/{p.author}</span>
                                <span>{formatDate(p.created_utc)}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <MessageSquare size={11} /> {p.num_comments ?? 0}
                                </span>
                            </div>
                        </div>
                        <ExternalLink size={14} color="var(--text-tertiary)" style={{ flexShrink: 0, marginTop: 4 }} />
                    </a>
                ))}
            </div>
        </div>
    );
}

export function BrandMentions() {
    return (
        <ToolShell
            title="Reddit Brand Mention Tracker"
            description="See where and how often people talk about any brand or product on Reddit."
            fields={[
                { name: 'brand', label: 'Brand or Product', placeholder: 'e.g. Notion', required: true },
                { name: 'subreddit', label: 'Subreddit (optional)', placeholder: 'e.g. productivity', required: false }
            ]}
            apiEndpoint="/api/tools/brand-mentions"
            submitLabel="Track Mentions"
            loadingLabel="Searching..."
            ctaHeading="Want real-time brand alerts?"
            ctaDescription="OpinionDeck monitors brand mentions 24/7 and sends alerts when new conversations appear."
            nextTools={[
                { slug: 'pain-point-finder', label: 'Find pain points about this brand', paramMap: { brand: 'keyword' } },
                { slug: 'opportunity-finder', label: 'Find marketing opportunities', paramMap: { brand: 'product' } },
            ]}
            renderResult={(data) => <ResultView data={data} />}
        >
            <ToolSEO
                heading="Track Brand Mentions Across Reddit"
                introParagraphs={[
                    "People talk about brands on Reddit every day — sharing honest reviews, asking for alternatives, recommending products, and venting frustrations. This tool lets you see every public mention of any brand, product, or company name across Reddit's millions of communities.",
                    "Unlike social media monitoring tools that cost hundreds per month, this free brand mention tracker searches Reddit's archives to show you where the conversations are happening, how sentiment trends over time, and which communities are talking about you (or your competitors) the most.",
                    "Reddit is one of the most honest platforms online. Users don't hold back their opinions, which makes it an invaluable source of unfiltered feedback. Whether you're monitoring your own brand or researching competitors, the insights you find here are raw and real."
                ]}
                steps={[
                    { title: "Enter a brand or product name", description: "Type the name of any brand, product, company, or even a feature name. Keep it specific — 'Notion' will work better than 'productivity app'." },
                    { title: "Optionally filter by subreddit", description: "Want to narrow results to a specific community? Enter a subreddit name to only see mentions in that community." },
                    { title: "We search Reddit's archives", description: "Our system searches millions of Reddit posts to find every public mention of your search term, then aggregates the results by community and time period." },
                    { title: "Explore the results", description: "Browse mentions sorted by community, see the timeline trend, and click through to read the full discussions on Reddit." }
                ]}
                useCases={[
                    { title: "Brand Managers", description: "Monitor how your brand is perceived on Reddit. Catch negative sentiment early, identify advocates, and understand which communities drive the most discussion about you." },
                    { title: "Competitive Intelligence", description: "Track competitor mentions to understand their strengths and weaknesses from real user perspectives. Find gaps in their offering that your product can fill." },
                    { title: "Product Marketers", description: "Discover which features people love or hate about your product. Use direct quotes from Reddit discussions to inform your messaging and positioning." },
                    { title: "PR & Communications", description: "Stay on top of brand conversations before they spiral. Identify potential PR crises early and understand the communities driving the discussion." }
                ]}
                faqs={[
                    { question: "How far back do mentions go?", answer: "The search covers Reddit's public archive, which includes posts from the past several years. The exact range depends on the search term — popular brands may have thousands of mentions spanning years, while niche products may show more recent results." },
                    { question: "Does this track comments or just posts?", answer: "Currently, the tool searches post titles and content. Comment-level mentions are not included in this free version but are available in the full OpinionDeck platform." },
                    { question: "Can I track mentions of my competitors?", answer: "Absolutely. Enter any brand name — yours or a competitor's. There are no restrictions on what terms you can search for. Many users run searches for their own brand and 2-3 competitors to get a comparative view." },
                    { question: "What's the difference between this and Google Alerts?", answer: "Google Alerts monitors the open web for new mentions, but Reddit content is often poorly indexed by Google. This tool searches Reddit's archives directly, catching mentions that Google Alerts would miss. Plus, you get community-level breakdowns and trend data." },
                    { question: "How is the timeline breakdown calculated?", answer: "Mentions are grouped by month and displayed as a bar chart showing volume over time. This helps you spot trends — like a spike after a product launch or a negative event." },
                    { question: "Can I filter by sentiment?", answer: "The free version shows all mentions without sentiment filtering. The full OpinionDeck platform includes AI-powered sentiment analysis that categorizes mentions as positive, negative, or neutral." }
                ]}
                relatedTools={[
                    { slug: "pain-point-finder", title: "Pain Point Finder", description: "Discover the specific frustrations people express about any topic in a subreddit." },
                    { slug: "subreddit-analyzer", title: "Subreddit Analyzer", description: "Get a full engagement breakdown of any community where your brand is mentioned." },
                    { slug: "opportunity-finder", title: "Opportunity Finder", description: "Find Reddit threads where people are actively looking for products like yours." }
                ]}
                closingParagraphs={[
                    "Brand monitoring on Reddit gives you access to the most honest, unfiltered customer feedback available online. Reddit users don't curate their opinions the way they might on Twitter or LinkedIn — they share exactly what they think, good and bad.",
                    "For the most complete picture, combine brand mention tracking with our Pain Point Finder to understand not just where people mention your brand, but what specific problems they associate with it. This combination is powerful for product development and marketing strategy."
                ]}
            />
        </ToolShell>
    );
}
