import { useState } from 'react';
import {
    Search,
    AlertCircle,
    ArrowBigUp,
    MessageSquare,
    Copy,
    Code,
    ChevronRight,
    ExternalLink,
    BrainCircuit
} from 'lucide-react';

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
        // Using a basic browser alert for simplicity in this demo component
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
                    <Search size={20} className="text-tertiary ml-2" />
                    <input
                        type="url"
                        placeholder="Search 'YNAB', 'Notion', 'Superhuman'..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="demo-input"
                        required
                    />
                    <button type="submit" disabled={loading} className="btn btn-primary demo-btn">
                        {loading ? 'Analyzing...' : 'Analyze for Free'}
                    </button>
                </div>
                <p className="demo-hint">Try it now — no sign-up required (Limited to 10 requests/min)</p>
            </form>

            {error && (
                <div className="demo-error">
                    <AlertCircle size={18} className="text-negative inline-block mr-2" /> {error}
                </div>
            )}

            {result && (
                <div className="demo-result">
                    <div className="result-header">
                        <span className="subreddit text-accent font-bold text-sm tracking-wider uppercase mb-2 block">{result.post.subreddit}</span>
                        <h3 className="post-title text-xl font-bold mb-4">{result.post.title}</h3>
                        <div className="meta flex gap-4 text-sm text-secondary">
                            <span className="flex items-center gap-1"><ArrowBigUp size={16} className="text-accent" /> {result.post.score}</span>
                            <span className="flex items-center gap-1"><MessageSquare size={16} className="text-accent" /> {result.metadata.commentsReturned} comments (Preview)</span>
                        </div>
                    </div>

                    <div className="result-actions">
                        <button onClick={() => copyToClipboard(generateMarkdown())} className="btn btn-sm btn-secondary flex items-center gap-2">
                            <Copy size={14} /> Copy Markdown
                        </button>
                        <button onClick={() => copyToClipboard(JSON.stringify(result, null, 2))} className="btn btn-sm btn-secondary flex items-center gap-2">
                            <Code size={14} /> Copy JSON
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

                    <div className="cta-overlay border-t border-border pt-6 mt-6">
                        <div className="cta-content">
                            <p className="mb-4 font-semibold">Want to extract deep strategic insights from this thread?</p>
                            <div className="cta-buttons">
                                <a href={import.meta.env.PUBLIC_DASHBOARD_URL || '/app'} className="btn btn-primary flex items-center justify-center gap-2">
                                    <ExternalLink size={18} /> Save Thread
                                </a>
                                <a href={import.meta.env.PUBLIC_DASHBOARD_URL || '/app'} className="btn btn-secondary flex items-center justify-center gap-2">
                                    <BrainCircuit size={18} /> Analyze with OpinionDeck AI
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
