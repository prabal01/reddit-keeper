import { ToolShell } from './ToolShell';
import { ToolSEO } from './ToolSEO';
import { Compass } from 'lucide-react';

function ResultView({ data }: { data: any }) {
    const subreddits = data.subreddits || [];
    const maxCount = Math.max(...subreddits.map((s: any) => s.mentionCount), 1);

    return (
        <div>
            {/* Summary */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
                padding: '12px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)'
            }}>
                <Compass size={18} color="var(--bg-accent)" />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    Found <strong>{data.totalFound || subreddits.length}</strong> matching communities
                </span>
            </div>

            {/* Subreddit List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {subreddits.map((sub: any, i: number) => (
                    <div key={i} style={{
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-xl)', padding: 20,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <a
                                href={`https://reddit.com/r/${sub.name}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)',
                                    textDecoration: 'none'
                                }}
                            >r/{sub.name}</a>
                            <span style={{
                                fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                                padding: '3px 10px', borderRadius: 'var(--radius-full)',
                                background: sub.relevance === 'high' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                                color: sub.relevance === 'high' ? '#22c55e' : '#f59e0b'
                            }}>{sub.relevance} relevance</span>
                        </div>

                        {/* Relevance bar */}
                        <div style={{ marginBottom: 10 }}>
                            <div style={{
                                height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden'
                            }}>
                                <div style={{
                                    height: '100%',
                                    width: `${(sub.mentionCount / maxCount) * 100}%`,
                                    background: sub.relevance === 'high'
                                        ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                                        : 'linear-gradient(90deg, #f59e0b, #d97706)',
                                    borderRadius: 3, transition: 'width 0.5s ease'
                                }} />
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                                {sub.mentionCount} matching posts found
                            </div>
                        </div>

                        {/* Sample post */}
                        {sub.samplePost && (
                            <div style={{
                                fontSize: '0.82rem', color: 'var(--text-secondary)',
                                padding: '8px 12px', background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-sm)', lineHeight: 1.4,
                                borderLeft: '3px solid var(--border)'
                            }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>
                                    Sample post:
                                </span>
                                {sub.samplePost}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function SubredditFinder() {
    return (
        <ToolShell
            title="Subreddit Finder"
            description="Describe your product and we'll find the communities that match."
            fields={[
                {
                    name: 'description',
                    label: 'Describe your product or target audience',
                    placeholder: 'e.g. A project management tool for remote teams that integrates with Slack',
                    required: true
                },
            ]}
            apiEndpoint="/api/tools/find-subreddits"
            renderResult={(data) => <ResultView data={data} />}
        >
            <ToolSEO
                heading="Discover the Right Reddit Communities for Your Product"
                introParagraphs={[
                    "Reddit has over 100,000 active communities, and your target audience is in some of them. But which ones? Guessing wastes time. This AI-powered tool tells you exactly which subreddits are relevant to your product or service based on actual discussion data.",
                    "Simply describe your product in plain English, and our AI extracts the right search keywords, scans Reddit for matching discussions, and ranks the subreddits where those conversations happen most frequently. You'll discover communities you never knew existed — niche subreddits with highly engaged audiences that are perfect for your product.",
                    "This is the starting point for any Reddit marketing strategy. Before you can post, comment, or run ads, you need to know where your people are. This tool answers that question with data instead of guesswork."
                ]}
                steps={[
                    { title: "Describe your product", description: "Write a brief description of your product or service in plain English. For example: 'A project management tool for remote teams' or 'Organic dog treats for small breeds'." },
                    { title: "AI extracts keywords", description: "Our AI reads your description and generates 5 targeted search keywords that your audience would use in Reddit discussions." },
                    { title: "We scan Reddit globally", description: "Each keyword is searched across all of Reddit to find posts and discussions. Results are grouped by subreddit and ranked by how many matching posts each community has." },
                    { title: "Discover your communities", description: "Browse the ranked list of subreddits with relevance scores, post counts, and sample posts from each community. Use these to build your Reddit marketing playbook." }
                ]}
                useCases={[
                    { title: "Startup Founders", description: "Find the communities where your early adopters hang out. Engage in discussions, share your expertise, and build a presence before your launch." },
                    { title: "Marketing Teams", description: "Build a targeted subreddit list for content distribution, community engagement, and Reddit ad campaigns. Data-driven targeting beats guessing." },
                    { title: "Product Managers", description: "Discover where users discuss your product category. Monitor these communities for feature requests, competitor comparisons, and market trends." },
                    { title: "Content Strategists", description: "Find niche communities where your content can stand out. Smaller, engaged subreddits often deliver better results than massive ones where posts get buried." }
                ]}
                faqs={[
                    { question: "How does the AI pick search keywords?", answer: "The AI analyzes your product description to identify the terms your target audience would naturally use in Reddit discussions. It focuses on problem-oriented and solution-oriented keywords that match how people actually talk on Reddit, not marketing jargon." },
                    { question: "Will this find small, niche subreddits?", answer: "Yes! That's one of the main benefits. The tool often surfaces niche communities with highly relevant audiences that you'd never find through manual browsing or Reddit's search. These smaller subreddits frequently have better engagement rates than large ones." },
                    { question: "How are the results ranked?", answer: "Subreddits are ranked by the number of matching posts found across all search keywords. A subreddit with 50 matching posts is ranked higher than one with 5, because more matches mean more relevant ongoing discussion." },
                    { question: "What subreddits are filtered out?", answer: "Very generic subreddits like r/AskReddit, r/all, and r/popular are filtered from results since they cover all topics and don't represent a targeted audience. The tool focuses on communities with specific topic relevance." },
                    { question: "How many subreddits will I get?", answer: "The free version shows the top 5 most relevant subreddits. The full OpinionDeck platform provides the complete list with ongoing monitoring, so you can track community activity over time." },
                    { question: "Can I search for competitor audiences?", answer: "Absolutely. Describe your competitor's product instead of yours, and you'll see where their audience hangs out. This is a powerful technique for identifying communities to target." }
                ]}
                relatedTools={[
                    { slug: "subreddit-comparison", title: "Subreddit Comparison", description: "Found multiple relevant subreddits? Compare them side by side to see which has better engagement." },
                    { slug: "subreddit-analyzer", title: "Subreddit Analyzer", description: "Deep-dive into any subreddit from your results to understand its engagement patterns." },
                    { slug: "opportunity-finder", title: "Opportunity Finder", description: "Once you know the right subreddits, find specific threads where your product can help." }
                ]}
                closingParagraphs={[
                    "Finding the right subreddits is the foundation of Reddit marketing. The communities you engage with determine your audience quality, engagement rates, and ultimately your conversion potential. Invest time upfront to build a targeted list instead of posting in random subreddits and hoping for the best.",
                    "After finding your communities, use the Subreddit Analyzer to understand each one's culture and engagement patterns, then the Best Time to Post tool to optimize your timing. This three-tool workflow — find, analyze, time — is the most effective approach to Reddit marketing."
                ]}
            />
        </ToolShell>
    );
}
