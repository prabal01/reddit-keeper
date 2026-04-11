import { ToolShell } from './ToolShell';
import { ToolSEO } from './ToolSEO';
import { Target, ExternalLink } from 'lucide-react';

const intentLabels: Record<string, { label: string; color: string }> = {
    asking_for_help: { label: 'Asking for Help', color: '#3b82f6' },
    comparing_options: { label: 'Comparing Options', color: '#8b5cf6' },
    sharing_frustration: { label: 'Frustrated', color: '#ef4444' },
    looking_for_alternatives: { label: 'Seeking Alternatives', color: '#f59e0b' },
    general_discussion: { label: 'Discussion', color: '#6b7280' },
};

function ScoreBar({ score }: { score: number }) {
    const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#6b7280';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
                flex: 1, height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden'
            }}>
                <div style={{
                    height: '100%', width: `${score}%`, background: color,
                    borderRadius: 3, transition: 'width 0.5s ease'
                }} />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color, minWidth: 28 }}>{score}%</span>
        </div>
    );
}

function ResultView({ data }: { data: any }) {
    const opportunities = data.opportunities || [];

    return (
        <div>
            {/* Summary */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
                padding: '12px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)'
            }}>
                <Target size={18} color="var(--bg-accent)" />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    Found <strong>{data.totalFound || opportunities.length}</strong> opportunities
                    for "<strong>{data.product}</strong>" in r/{data.subreddit}
                </span>
            </div>

            {/* Opportunity Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {opportunities.map((opp: any, i: number) => {
                    const intent = intentLabels[opp.intentType] || intentLabels.general_discussion;
                    return (
                        <div key={i} style={{
                            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-xl)', padding: 20,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                                <span style={{
                                    fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                                    background: `${intent.color}15`, color: intent.color
                                }}>{intent.label}</span>
                                <span style={{
                                    fontSize: '0.7rem', color: 'var(--text-tertiary)',
                                    padding: '2px 8px', background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-full)'
                                }}>r/{opp.subreddit}</span>
                            </div>

                            <h3 style={{
                                fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)',
                                margin: '0 0 8px', lineHeight: 1.4
                            }}>{opp.title}</h3>

                            <p style={{
                                fontSize: '0.85rem', color: 'var(--text-secondary)',
                                margin: '0 0 12px', lineHeight: 1.5
                            }}>{opp.snippet}</p>

                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>Relevance</div>
                                <ScoreBar score={opp.relevanceScore} />
                            </div>

                            {opp.url && (
                                <a href={opp.url} target="_blank" rel="noopener noreferrer" style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    fontSize: '0.75rem', color: 'var(--bg-accent)', textDecoration: 'none',
                                    fontWeight: 500
                                }}>
                                    View thread <ExternalLink size={12} />
                                </a>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function OpportunityFinder() {
    return (
        <ToolShell
            title="Reddit Opportunity Finder"
            description="Find threads where your product could genuinely help people."
            fields={[
                { name: 'product', label: 'Product or Service', placeholder: 'e.g. email marketing tool', required: true },
                { name: 'subreddit', label: 'Subreddit', placeholder: 'e.g. entrepreneur', required: true },
            ]}
            apiEndpoint="/api/tools/opportunities"
            renderResult={(data) => <ResultView data={data} />}
        >
            <ToolSEO
                heading="Find Reddit Threads Where Your Product Can Help"
                introParagraphs={[
                    "Reddit is full of people actively asking for solutions — comparing tools, seeking recommendations, and venting about problems your product could solve. The challenge is finding these threads before they go stale. This AI-powered tool does the searching for you.",
                    "Describe your product and choose a subreddit, and our AI will analyze recent discussions to surface the threads with the highest opportunity to provide genuine value. Each result is scored for relevance and tagged with the user's intent — whether they're asking for help, comparing options, sharing frustration, or looking for alternatives.",
                    "This isn't about spamming Reddit. It's about finding the conversations where your expertise and product are genuinely relevant, so you can participate authentically and help real people while growing your visibility."
                ]}
                steps={[
                    { title: "Describe your product", description: "Write a brief description of what your product does and who it helps. The more specific, the better the AI can match you to relevant threads." },
                    { title: "Choose a subreddit", description: "Pick a community where your target audience hangs out. Not sure which? Use our Subreddit Finder tool first." },
                    { title: "AI scans and scores", description: "Our AI analyzes recent discussions in the subreddit, scoring each thread based on how relevant it is to your product and what kind of intent the user is expressing." },
                    { title: "Review opportunities", description: "Browse scored opportunities with intent tags, relevance percentages, and snippets. Click through to engage in the most promising threads on Reddit." }
                ]}
                useCases={[
                    { title: "Founders Doing Manual Outreach", description: "The best early-stage marketing is helping people directly. Find threads where someone needs exactly what you built, then provide value with a thoughtful comment." },
                    { title: "Growth Marketers", description: "Scale your Reddit presence by focusing on high-intent threads. Instead of posting blindly, engage in discussions where people are already primed to hear about solutions." },
                    { title: "Developer Advocates", description: "Find developers asking questions your tool answers. Technical threads with genuine questions are perfect opportunities for helpful, non-promotional engagement." },
                    { title: "Sales Teams", description: "Identify potential leads who are actively comparing products in your category. These 'looking for alternatives' threads are bottom-of-funnel opportunities." }
                ]}
                faqs={[
                    { question: "How does the relevance score work?", answer: "The AI rates each thread from 1-100 based on how closely the discussion matches your product description. Scores above 70 indicate strong relevance. The score considers the user's intent, the topic alignment, and whether there's a clear opportunity to provide value." },
                    { question: "What do the intent tags mean?", answer: "Each opportunity is tagged with the user's intent: 'asking for help' (they have a problem), 'comparing options' (they're evaluating tools), 'sharing frustration' (they're unhappy with current solutions), 'looking for alternatives' (they want to switch), or 'general discussion' (relevant topic but no specific need)." },
                    { question: "How do I engage without getting banned?", answer: "Always provide genuine value first. Answer the user's question, share relevant experience, and only mention your product if it's directly relevant. Never make your first interaction purely promotional. Reddit communities quickly spot and ban self-promoters." },
                    { question: "How many opportunities will I see?", answer: "The free version shows 3 scored opportunities per search. OpinionDeck's full platform monitors subreddits continuously and alerts you to new opportunities as they appear, so you can engage while threads are still fresh." },
                    { question: "Can I search across multiple subreddits?", answer: "The free tool searches one subreddit at a time. For multi-subreddit monitoring, the full OpinionDeck platform can track multiple communities simultaneously and consolidate opportunities into a single feed." },
                    { question: "How fresh are the results?", answer: "Results are cached for 24 hours. The AI analyzes the most recent discussions in the subreddit, typically covering the past few weeks of activity. For time-sensitive outreach, the full platform offers real-time monitoring." }
                ]}
                relatedTools={[
                    { slug: "pain-point-finder", title: "Pain Point Finder", description: "Discover what frustrates people in any subreddit — perfect for understanding the problems your product solves." },
                    { slug: "subreddit-finder", title: "Subreddit Finder", description: "Not sure which subreddit to search? Find the best communities for your product." },
                    { slug: "brand-mentions", title: "Brand Mention Tracker", description: "Track mentions of your brand or competitors to find existing conversations to join." }
                ]}
                closingParagraphs={[
                    "The best Reddit marketing doesn't feel like marketing at all. It feels like a helpful community member sharing their expertise. This tool helps you find the right conversations to join — threads where your knowledge and product are genuinely relevant.",
                    "For maximum impact, combine the Opportunity Finder with the Pain Point Finder. Pain points tell you what problems exist; opportunities tell you where people are actively looking for solutions. Together, they give you a complete picture of where and how to engage on Reddit."
                ]}
            />
        </ToolShell>
    );
}
