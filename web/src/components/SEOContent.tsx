export function SEOContent() {
    return (
        <div className="seo-content">
            <section className="seo-section">
                <h3>Why Reddit Keeper?</h3>
                <p>
                    Reddit is home to the most authentic human conversations on the internet.
                    Whether you're an AI researcher, a writer, or a data analyst, getting that
                    data in a structured, clean format is essential. **Reddit Keeper** makes this
                    process instant and seamless.
                </p>
            </section>

            <section className="seo-section grid">
                <div className="benefit-card">
                    <h4>🤖 AI-Ready Context</h4>
                    <p>
                        Large Language Models (LLMs) thrive on structured data. Export threads including all
                        replies, scores, and metadata to Markdown or JSON to give your AI models the perfect context.
                    </p>
                </div>
                <div className="benefit-card">
                    <h4>📊 Research & Analysis</h4>
                    <p>
                        Analyze sentiment, community trends, and public discourse. Our exports preserve the
                        exact thread hierarchy, making it easy to parse for academic or commercial research.
                    </p>
                </div>
                <div className="benefit-card">
                    <h4>📁 Offline Archives</h4>
                    <p>
                        Never lose a valuable conversation again. Keep personal backups of legendary AMA threads,
                        tutorials, and technical discussions in a human-readable format.
                    </p>
                </div>
            </section>

            <section className="seo-section faq">
                <h3>Frequently Asked Questions</h3>
                <div className="faq-item">
                    <p className="faq-q">Is Reddit Keeper free?</p>
                    <p className="faq-a">Yes! You can fetch any thread for free. We show up to 50 comments per thread for free users, which covers most discussions.</p>
                </div>
                <div className="faq-item">
                    <p className="faq-q">How do I export all comments?</p>
                    <p className="faq-a">For deeply nested or massive threads with hundreds of comments, our Pro plan allows you to "fetch more" and resolve the entire tree with one click.</p>
                </div>
                <div className="faq-item">
                    <p className="faq-q">What formats are supported?</p>
                    <p className="faq-a">We currently support Markdown (best for reading/LLMs), JSON (best for developers), and Plain Text.</p>
                </div>
            </section>
        </div>
    );
}
