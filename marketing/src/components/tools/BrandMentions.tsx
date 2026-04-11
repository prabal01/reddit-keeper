import { ToolShell } from './ToolShell';
import { ToolSEO } from './ToolSEO';
import { ExternalLink, MessageSquare } from 'lucide-react';

function formatDate(utc: number): string {
    return new Date(utc * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ResultView({ data }: { data: any }) {
    const maxSubCount = data.subredditBreakdown?.[0]?.count || 1;
    const maxTimeCount = Math.max(...(data.timeline?.map((t: any) => t.count) || [1]));

    return (
        <div>
            {/* Summary */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24
            }}>
                <div style={{
                    padding: '14px 20px', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)'
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Total Mentions</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{data.totalMentions}</div>
                </div>
                <div style={{
                    padding: '14px 20px', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)'
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Communities</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{data.subredditBreakdown?.length || 0}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
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
                                    {t.month.slice(5)}
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
                                    <MessageSquare size={11} /> {p.score}
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
