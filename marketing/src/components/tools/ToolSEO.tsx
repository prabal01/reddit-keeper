import { useEffect, useState } from 'react';

interface Step {
    title: string;
    description: string;
}

interface UseCase {
    title: string;
    description: string;
}

interface FAQ {
    question: string;
    answer: string;
}

interface RelatedTool {
    slug: string;
    title: string;
    description: string;
}

interface ToolSEOProps {
    heading: string;
    introParagraphs: string[];
    steps: Step[];
    useCases: UseCase[];
    faqs: FAQ[];
    relatedTools: RelatedTool[];
    closingParagraphs?: string[];
}

const sectionHeading = {
    fontSize: '1.3rem', fontWeight: 700 as const, color: 'var(--text-primary)',
    margin: '0 0 16px', lineHeight: 1.3
};

const paragraph = {
    fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 14px'
};

export function ToolSEO({ heading, introParagraphs, steps, useCases, faqs, relatedTools, closingParagraphs }: ToolSEOProps) {
    const [fromDashboard, setFromDashboard] = useState(false);
    useEffect(() => {
        if (new URLSearchParams(window.location.search).get('ref') === 'dashboard') setFromDashboard(true);
    }, []);

    // Inject FAQ JSON-LD structured data
    useEffect(() => {
        if (faqs.length === 0) return;
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faqs.map(f => ({
                "@type": "Question",
                "name": f.question,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": f.answer
                }
            }))
        });
        document.head.appendChild(script);
        return () => { document.head.removeChild(script); };
    }, [faqs]);

    return (
        <div style={{ marginTop: 48, padding: '0 4px' }}>
            {/* Intro */}
            <h2 style={sectionHeading}>{heading}</h2>
            {introParagraphs.map((p, i) => (
                <p key={i} style={paragraph}>{p}</p>
            ))}

            {/* How It Works */}
            <h2 style={{ ...sectionHeading, marginTop: 36 }}>How It Works</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 8 }}>
                {steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'rgba(255, 69, 0, 0.08)', color: 'var(--bg-accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '0.85rem', flexShrink: 0
                        }}>{i + 1}</div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 4 }}>
                                {step.title}
                            </div>
                            <div style={paragraph}>{step.description}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Use Cases */}
            <h2 style={{ ...sectionHeading, marginTop: 36 }}>Who Is This For?</h2>
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 14, marginBottom: 8
            }}>
                {useCases.map((uc, i) => (
                    <div key={i} style={{
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)', padding: '18px 20px'
                    }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 6 }}>
                            {uc.title}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {uc.description}
                        </div>
                    </div>
                ))}
            </div>

            {/* FAQ */}
            <h2 style={{ ...sectionHeading, marginTop: 36 }}>Frequently Asked Questions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 8 }}>
                {faqs.map((faq, i) => (
                    <details key={i} style={{
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        borderRadius: i === 0 ? 'var(--radius-md) var(--radius-md) 0 0'
                            : i === faqs.length - 1 ? '0 0 var(--radius-md) var(--radius-md)' : '0',
                        borderTop: i > 0 ? 'none' : undefined,
                        padding: 0,
                    }}>
                        <summary style={{
                            padding: '16px 20px', cursor: 'pointer', fontWeight: 600,
                            fontSize: '0.9rem', color: 'var(--text-primary)', listStyle: 'none',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            userSelect: 'none'
                        }}>
                            {faq.question}
                            <span style={{ fontSize: '1.1rem', color: 'var(--text-tertiary)', marginLeft: 12, flexShrink: 0 }}>+</span>
                        </summary>
                        <div style={{
                            padding: '0 20px 16px', fontSize: '0.85rem',
                            color: 'var(--text-secondary)', lineHeight: 1.7
                        }}>{faq.answer}</div>
                    </details>
                ))}
            </div>

            {/* Closing SEO paragraphs (hidden for dashboard users) */}
            {!fromDashboard && closingParagraphs && closingParagraphs.length > 0 && (
                <div style={{ marginTop: 28 }}>
                    {closingParagraphs.map((p, i) => (
                        <p key={i} style={paragraph}>{p}</p>
                    ))}
                </div>
            )}

            {/* Related Tools */}
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 600, marginTop: 32, marginBottom: 14 }}>
                Related Free Tools
            </h3>
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 12, marginBottom: 8
            }}>
                {relatedTools.map((tool, i) => (
                    <a key={i} href={`/free-tools/${tool.slug}`} style={{
                        display: 'block', padding: '16px 18px',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)', textDecoration: 'none',
                        transition: 'border-color 0.15s'
                    }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--bg-accent)', marginBottom: 4 }}>
                            {tool.title}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {tool.description}
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}
