import { useState } from 'react';

// Simplified API fetch for the landing page
async function fetchThreadPublic(url: string) {
    const response = await fetch('/api/fetch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, sort: 'confidence' }),
    });

    if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please wait or sign in for more.");
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch thread");
    }

    return response.json();
}

export function FetchDemo() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const data = await fetchThreadPublic(url);
            setResult(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Copied to clipboard!");
    };

    const generateMarkdown = () => {
        if (!result) return "";
        let md = `# ${result.post.title}\n\n`;
        md += `**Author:** ${result.post.author} | **Subreddit:** ${result.post.subreddit}\n\n`;
        md += `${result.post.selftext || ""}\n\n---\n\n`;
        result.comments.forEach((c: any) => {
            md += `### ${c.author}: ${c.body}\n\n`;
        });
        return md;
    };

    return (
        <div className="fetch-demo">
            <form onSubmit={handleSubmit} className="demo-form">
                <div className="input-group">
                    <input
                        type="url"
                        placeholder="Paste a Reddit URL to try it (e.g. reddit.com/r/technology/...)"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="demo-input"
                        required
                    />
                    <button type="submit" disabled={loading} className="btn btn-primary demo-btn">
                        {loading ? 'Fetching...' : 'Fetch Thread'}
                    </button>
                </div>
                <p className="demo-hint">Try it now — no sign-up required (Limited to 10 requests/min)</p>
            </form>

            {error && (
                <div className="demo-error">
                    <span className="error-icon">⚠️</span> {error}
                </div>
            )}

            {result && (
                <div className="demo-result">
                    <div className="result-header">
                        <span className="subreddit">{result.post.subreddit}</span>
                        <h3 className="post-title">{result.post.title}</h3>
                        <div className="meta">
                            <span>⬆️ {result.post.score}</span>
                            <span>💬 {result.metadata.commentsReturned} comments (Preview)</span>
                        </div>
                    </div>

                    <div className="result-actions">
                        <button onClick={() => copyToClipboard(generateMarkdown())} className="btn btn-sm btn-secondary">
                            📋 Copy Markdown
                        </button>
                        <button onClick={() => copyToClipboard(JSON.stringify(result, null, 2))} className="btn btn-sm btn-secondary">
                            { } Copy JSON
                        </button>
                    </div>

                    <div className="comments-preview">
                        {result.comments.slice(0, 50).map((comment: any) => (
                            <div key={comment.id} className="comment-item">
                                <span className="comment-author">{comment.author}</span>
                                <p className="comment-body">{comment.body}</p>
                            </div>
                        ))}
                    </div>

                    <div className="cta-overlay">
                        <div className="cta-content">
                            <p>Want to analyze more threads?</p>
                            <div className="cta-buttons">
                                <a href={import.meta.env.PUBLIC_DASHBOARD_URL || '/app'} className="btn btn-primary">Save Thread</a>
                                <a href={import.meta.env.PUBLIC_DASHBOARD_URL || '/app'} className="btn btn-secondary">Analyze Thread (AI)</a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
