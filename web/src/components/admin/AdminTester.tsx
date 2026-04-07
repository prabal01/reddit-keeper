import { useState } from 'react';
import { Brain, Sparkles, Send, Loader2, Info } from 'lucide-react';
import { API_BASE, getAuthToken } from '../../lib/api';
import toast from 'react-hot-toast';

export function AdminTester() {
    const [title, setTitle] = useState('');
    const [selftext, setSelftext] = useState('');
    const [context, setContext] = useState('');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handleTest = async () => {
        if (!title || !context) {
            toast.error("Title and Context are required");
            return;
        }
        setLoading(true);
        try {
            const token = await getAuthToken();
            const res = await fetch(`${API_BASE}/admin/test-match`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, selftext, websiteContext: context })
            });
            if (!res.ok) throw new Error("Test failed");
            const data = await res.json();
            setResult(data);
            toast.success("Intelligence test complete!");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '800px' }}>
            <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '700', margin: 0 }}>Intelligence Sandbox</h2>
                <p style={{ color: '#8e92a4', fontSize: '0.8rem', marginTop: '4px' }}>Test Geminis signal detection logic with custom inputs.</p>
            </div>

            <div style={{ display: 'grid', gap: '20px' }}>
                <div>
                    <label style={{ display: 'block', color: '#8e92a4', fontSize: '0.75rem', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>1. Testing Product Context (Your 50 Words)</label>
                    <textarea 
                        value={context}
                        onChange={(e) => setContext(e.target.value)}
                        placeholder="e.g. OpinionDeck helps startup founders find high-signal marketing leads on Reddit..."
                        style={{ width: '100%', height: '80px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', color: 'white', resize: 'vertical' }}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', color: '#8e92a4', fontSize: '0.75rem', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>2. Reddit Post Title (Input)</label>
                        <input 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. How do I find users for my new SaaS?"
                            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', color: 'white' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', color: '#8e92a4', fontSize: '0.75rem', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>3. Reddit Post Body (Optional Context)</label>
                        <textarea 
                            value={selftext}
                            onChange={(e) => setSelftext(e.target.value)}
                            placeholder="Paste the post content here..."
                            style={{ width: '100%', height: '120px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', color: 'white', resize: 'vertical' }}
                        />
                    </div>
                </div>

                <button 
                    onClick={handleTest}
                    disabled={loading}
                    style={{ 
                        background: '#ff4500', 
                        color: 'white', 
                        padding: '16px', 
                        borderRadius: '12px', 
                        fontWeight: '700', 
                        border: 'none', 
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px'
                    }}
                >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Brain size={20} />}
                    {loading ? 'Consulting Gemini...' : 'Run Intelligence Test'}
                </button>

                {result && (
                    <div style={{ marginTop: '32px', background: 'rgba(255,69,0,0.05)', border: '1px solid rgba(255,69,0,0.2)', borderRadius: '16px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Sparkles size={20} color="#ff4500" />
                                <h3 style={{ margin: 0, fontWeight: '700' }}>AI Decision Analysis</h3>
                            </div>
                            <div style={{ background: result.relevanceScore >= 50 ? '#22c55e' : '#ef4444', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '800', color: 'white' }}>
                                SCORE: {result.relevanceScore}%
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <p style={{ color: '#8e92a4', fontSize: '0.75rem', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Info size={12} /> Match Reasoning (Internal Thought)
                            </p>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', color: 'white', lineHeight: '1.6', fontSize: '0.9rem', fontStyle: 'italic' }}>
                                "{result.matchReason}"
                            </div>
                        </div>

                        {result.suggestedReply && (
                            <div>
                                <p style={{ color: '#8e92a4', fontSize: '0.75rem', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Send size={12} /> Proposed Marketing Hook
                                </p>
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', color: '#3b82f6', lineHeight: '1.6', fontSize: '0.9rem', fontWeight: '500' }}>
                                    {result.suggestedReply}
                                </div>
                            </div>
                        )}
                        
                        <div style={{ marginTop: '20px', padding: '12px', background: result.relevanceScore >= 50 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: '10px', fontSize: '0.8rem', color: result.relevanceScore >= 50 ? '#22c55e' : '#ef4444', textAlign: 'center', fontWeight: '600' }}>
                            {result.relevanceScore >= 50 ? "RESULT: WOULD BE SAVED TO DASHBOARD" : "RESULT: WOULD BE DISCARDED AS NOISE"}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
