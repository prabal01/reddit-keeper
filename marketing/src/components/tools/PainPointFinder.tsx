import { ToolShell } from './ToolShell';
import { ToolSEO } from './ToolSEO';
import { AlertTriangle, ExternalLink } from 'lucide-react';

const severityColors: Record<string, { bg: string; color: string; label: string }> = {
    high: { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', label: 'High Severity' },
    medium: { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', label: 'Medium' },
    low: { bg: 'rgba(107, 114, 128, 0.1)', color: '#6b7280', label: 'Low' },
};

function ResultView({ data }: { data: any }) {
    const painPoints = data.painPoints || [];

    return (
        <div>
            {/* Summary */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
                padding: '12px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)'
            }}>
                <AlertTriangle size={18} color="var(--bg-accent)" />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    Found <strong>{data.totalFound || painPoints.length}</strong> pain points
                    for "<strong>{data.keyword}</strong>" in r/{data.subreddit}
                </span>
            </div>

            {/* Pain Point Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {painPoints.map((pp: any, i: number) => {
                    const sev = severityColors[pp.severity] || severityColors.medium;
                    return (
                        <div key={i} style={{
                            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-xl)', padding: 20,
                            borderLeft: `4px solid ${sev.color}`,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                <span style={{
                                    fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                                    background: sev.bg, color: sev.color
                                }}>{sev.label}</span>
                            </div>
                            <h3 style={{
                                fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)',
                                margin: '0 0 8px', lineHeight: 1.4
                            }}>{pp.title}</h3>
                            <blockquote style={{
                                margin: '0 0 12px', padding: '10px 14px',
                                borderLeft: '3px solid var(--border)', background: 'var(--bg-tertiary)',
                                borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                                fontSize: '0.85rem', color: 'var(--text-secondary)',
                                fontStyle: 'italic', lineHeight: 1.5
                            }}>"{pp.quote}"</blockquote>
                            {pp.postUrl && (
                                <a href={pp.postUrl} target="_blank" rel="noopener noreferrer" style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    fontSize: '0.75rem', color: 'var(--bg-accent)', textDecoration: 'none',
                                    fontWeight: 500
                                }}>
                                    View original post <ExternalLink size={12} />
                                </a>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function PainPointFinder() {
    return (
        <ToolShell
            title="Reddit Pain Point Finder"
            description="Discover what frustrates people in any community. Powered by AI."
            fields={[
                { name: 'keyword', label: 'Topic or Keyword', placeholder: 'e.g. project management', required: true },
                { name: 'subreddit', label: 'Subreddit', placeholder: 'e.g. startups', required: true },
            ]}
            apiEndpoint="/api/tools/pain-points"
            submitLabel="Find Pain Points"
            loadingLabel="Analyzing..."
            ctaHeading="Turn pain points into product opportunities?"
            ctaDescription="OpinionDeck continuously monitors Reddit for fresh pain points and scores them by market potential."
            nextTools={[
                { slug: 'opportunity-finder', label: 'Find opportunities in this subreddit', paramMap: { subreddit: 'subreddit' } },
                { slug: 'subreddit-analyzer', label: 'Analyze this subreddit', paramMap: { subreddit: 'subreddit' } },
            ]}
            renderResult={(data) => <ResultView data={data} />}
        >
            <ToolSEO
                heading="Find Real Pain Points Your Audience Cares About"
                introParagraphs={[
                    "The best products solve real problems. But how do you find out what problems people actually have? Surveys are biased. Customer interviews are expensive. Reddit, on the other hand, is where people share their genuine frustrations every single day — unprompted, unfiltered, and with brutal honesty.",
                    "This AI-powered tool searches Reddit for discussions matching your keyword in any subreddit, then uses natural language processing to extract the specific pain points people are expressing. Each result includes the frustration itself, a severity rating, and a direct quote from the original post so you can verify the context.",
                    "Whether you're validating a startup idea, writing marketing copy, or planning product features, these pain points are gold. They're real problems from real people — not hypothetical user stories."
                ]}
                steps={[
                    { title: "Enter a keyword and subreddit", description: "Type a topic keyword (e.g., 'invoicing', 'project management') and the subreddit where your target audience hangs out." },
                    { title: "We search and analyze", description: "Our system finds the top-scoring posts matching your keyword, then sends them through an AI model that extracts specific frustrations and pain points." },
                    { title: "AI rates severity", description: "Each pain point is classified as high, medium, or low severity based on the language, emotion, and urgency expressed in the original post." },
                    { title: "Read the results", description: "Browse pain points with direct quotes, severity badges, and links to the original Reddit posts. Use these insights to inform your product and marketing decisions." }
                ]}
                useCases={[
                    { title: "Startup Founders", description: "Validate your idea before building. If people are complaining about the problem you're solving, you're on the right track. If not, pivot early." },
                    { title: "Product Managers", description: "Prioritize your feature roadmap based on real user pain. High-severity pain points should move to the top of your backlog." },
                    { title: "Copywriters & Marketers", description: "Use the exact language your audience uses to describe their frustrations. Pain-point-based copy converts better because it shows you understand their world." },
                    { title: "Content Marketers", description: "Create content that addresses real problems. Blog posts, guides, and videos that solve specific pain points attract qualified traffic and build trust." }
                ]}
                faqs={[
                    { question: "How does the AI identify pain points?", answer: "The AI model reads the content of top-scoring Reddit posts and identifies passages where users express frustration, dissatisfaction, complaints, or unmet needs. It then extracts these into structured pain points with quotes and severity ratings." },
                    { question: "What does the severity rating mean?", answer: "High severity means the user is expressing strong frustration, urgency, or has been significantly impacted. Medium means notable dissatisfaction. Low means mild annoyance or a minor inconvenience. Severity is inferred from the language and context of the post." },
                    { question: "How many pain points will I get?", answer: "The free version shows up to 3 pain points per search. The full OpinionDeck platform provides unlimited results with additional AI analysis including clustering similar pain points and tracking them over time." },
                    { question: "Can I use this for competitive research?", answer: "Absolutely. Search for a competitor's product name in relevant subreddits to find what people complain about. These pain points are opportunities for your product to differentiate." },
                    { question: "Are the quotes taken directly from Reddit?", answer: "Yes, every quote is pulled directly from the original Reddit post. We don't paraphrase or modify the text. Links to the source posts are included so you can read the full context." },
                    { question: "What's the difference between this and the Opportunity Finder?", answer: "The Pain Point Finder focuses on extracting problems and frustrations from discussions. The Opportunity Finder identifies threads where someone is actively looking for a solution — asking for help, comparing options, or seeking recommendations. They complement each other." }
                ]}
                relatedTools={[
                    { slug: "opportunity-finder", title: "Opportunity Finder", description: "Find threads where people are actively looking for solutions your product provides." },
                    { slug: "subreddit-finder", title: "Subreddit Finder", description: "Discover which Reddit communities your target audience participates in." },
                    { slug: "brand-mentions", title: "Brand Mention Tracker", description: "Track what people say about any brand or product across Reddit." }
                ]}
                closingParagraphs={[
                    "Pain point research on Reddit is one of the highest-ROI activities a founder or marketer can do. In 5 minutes, you can learn what real people struggle with — information that would take weeks of customer interviews to uncover. The key is to search specific communities where your target audience hangs out, not broad terms.",
                    "Pro tip: Run this tool for 3-5 different subreddits related to your market. Compare the pain points across communities. Patterns that appear in multiple subreddits represent systemic problems — these are the strongest product opportunities."
                ]}
            />
        </ToolShell>
    );
}
