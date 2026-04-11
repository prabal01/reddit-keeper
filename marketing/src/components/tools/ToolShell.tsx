import { useState, useEffect, type ReactNode, type FormEvent } from 'react';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';

interface Field {
    name: string;
    label: string;
    placeholder: string;
    type?: 'text' | 'url';
    required?: boolean;
}

interface ToolShellProps {
    title: string;
    description: string;
    fields: Field[];
    apiEndpoint: string;
    renderResult: (data: any) => ReactNode;
    children?: ReactNode;
}

const dashboardUrl = (typeof window !== 'undefined' && (window as any).__PUBLIC_DASHBOARD_URL) || '/app';

export function ToolShell({ title, description, fields, apiEndpoint, renderResult, children }: ToolShellProps) {
    const [values, setValues] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
    const [result, setResult] = useState<any>(null);
    const [fromDashboard, setFromDashboard] = useState(false);

    // Check if user came from dashboard (authenticated)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('ref') === 'dashboard') setFromDashboard(true);
    }, []);

    // Restore inputs from URL params
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const restored: Record<string, string> = {};
        for (const field of fields) {
            const val = params.get(field.name);
            if (val) restored[field.name] = val;
        }
        if (Object.keys(restored).length > 0) setValues(restored);
    }, []);

    // Rate limit countdown
    useEffect(() => {
        if (rateLimitCountdown <= 0) return;
        const t = setInterval(() => setRateLimitCountdown(c => c - 1), 1000);
        return () => clearInterval(t);
    }, [rateLimitCountdown]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setResult(null);
        setLoading(true);

        // Persist inputs in URL
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(values)) {
            if (v) params.set(k, v);
        }
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);

        try {
            const resp = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
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

            const data = await resp.json();
            setResult(data);
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
                }}>{title}</h1>
                <p style={{
                    fontSize: '1.1rem', color: 'var(--text-secondary)', margin: 0, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto'
                }}>{description}</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)', padding: 24, marginBottom: 24
            }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                    {fields.map(f => (
                        <div key={f.name} style={{ flex: '1 1 200px', minWidth: 0 }}>
                            <label style={{
                                display: 'block', fontSize: '0.8rem', fontWeight: 600,
                                color: 'var(--text-secondary)', marginBottom: 6
                            }}>{f.label}</label>
                            <input
                                type={f.type || 'text'}
                                placeholder={f.placeholder}
                                required={f.required !== false}
                                value={values[f.name] || ''}
                                onChange={e => setValues(v => ({ ...v, [f.name]: e.target.value }))}
                                style={{
                                    width: '100%', padding: '10px 14px', fontSize: '0.95rem',
                                    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-input)', color: 'var(--text-primary)',
                                    outline: 'none', boxSizing: 'border-box',
                                    transition: 'border-color 0.15s',
                                }}
                                onFocus={e => e.target.style.borderColor = 'var(--bg-accent)'}
                                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                            />
                        </div>
                    ))}
                    {/* Honeypot */}
                    <input type="text" name="website_url" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

                    <button type="submit" disabled={loading || rateLimitCountdown > 0} style={{
                        padding: '10px 28px', fontSize: '0.95rem', fontWeight: 600,
                        background: loading ? 'var(--bg-tertiary)' : 'var(--bg-accent)',
                        color: loading ? 'var(--text-secondary)' : '#fff',
                        border: 'none', borderRadius: 'var(--radius-sm)', cursor: loading ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
                        transition: 'all 0.2s', opacity: (loading || rateLimitCountdown > 0) ? 0.6 : 1,
                    }}>
                        {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing...</>
                            : rateLimitCountdown > 0 ? `Wait ${rateLimitCountdown}s`
                            : 'Analyze'}
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
            {result && (
                <div style={{ marginBottom: 32 }}>
                    {renderResult(result)}
                </div>
            )}

            {/* Locked skeleton teasers (hidden for dashboard users) */}
            {result?.locked && !fromDashboard && (
                <div style={{ position: 'relative', marginBottom: 32 }}>
                    {/* Skeleton cards */}
                    <div style={{ opacity: 0.4, filter: 'blur(3px)', pointerEvents: 'none' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} style={{
                                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)', padding: 20, marginBottom: 12
                            }}>
                                <div style={{ height: 14, width: `${60 + Math.random() * 30}%`, background: 'var(--bg-tertiary)', borderRadius: 4, marginBottom: 10 }} />
                                <div style={{ height: 10, width: `${40 + Math.random() * 40}%`, background: 'var(--bg-tertiary)', borderRadius: 4, marginBottom: 8 }} />
                                <div style={{ height: 10, width: `${30 + Math.random() * 30}%`, background: 'var(--bg-tertiary)', borderRadius: 4 }} />
                            </div>
                        ))}
                    </div>
                    {/* Overlay CTA */}
                    <div style={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', textAlign: 'center'
                    }}>
                        <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                            {result.totalFound ? `${result.totalFound - (result.freeCount || 0)} more results found` : 'More results available'}
                        </p>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                            Sign up free to unlock everything
                        </p>
                        <a href={dashboardUrl} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '10px 24px', background: 'var(--bg-accent)', color: '#fff',
                            borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.95rem',
                            textDecoration: 'none', transition: 'transform 0.2s'
                        }}>
                            Sign Up Free <ArrowRight size={16} />
                        </a>
                    </div>
                </div>
            )}

            {/* SEO content slot */}
            {children}

            {/* Bottom CTA (hidden for dashboard users) */}
            {!result?.locked && result && !fromDashboard && (
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

            {/* Spinner animation */}
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
    );
}
