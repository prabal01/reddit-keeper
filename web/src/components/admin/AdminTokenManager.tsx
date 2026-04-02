import React, { useEffect, useState } from 'react';
import { API_BASE, getAuthToken } from '../../lib/api';
import { Loader2, Ticket, Plus, CheckCircle2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

export function AdminTokenManager() {
    const [tokens, setTokens] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    
    const [newCode, setNewCode] = useState('');
    const [maxUses, setMaxUses] = useState(1);

    useEffect(() => {
        fetchTokens();
    }, []);

    const fetchTokens = async () => {
        setLoading(true);
        try {
            const authToken = await getAuthToken();
            const res = await fetch(`${API_BASE}/admin/tokens`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!res.ok) throw new Error("Failed to fetch beta tokens");
            const data = await res.json();
            setTokens(data);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCode.trim()) return;
        setGenerating(true);
        try {
            const authToken = await getAuthToken();
            const res = await fetch(`${API_BASE}/admin/tokens`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code: newCode.trim().toUpperCase(), maxUses })
            });
            if (!res.ok) throw new Error("Failed to create token");
            toast.success("Beta Token created successfully!");
            setNewCode('');
            setMaxUses(1);
            await fetchTokens(); // Refresh
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '32px' }}>
                {/* Generator Form */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px', height: 'fit-content' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <div style={{ background: 'rgba(255,69,0,0.1)', padding: '8px', borderRadius: '10px' }}>
                            <Plus size={20} color="#ff4500" />
                        </div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>Generate Token</h3>
                    </div>
                    
                    <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#8e92a4', marginBottom: '8px', fontWeight: '600' }}>Token Code</label>
                            <input 
                                type="text" 
                                value={newCode}
                                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                                placeholder="e.g. DECK-BETA-VIP"
                                required
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '10px',
                                    color: 'white',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#8e92a4', marginBottom: '8px', fontWeight: '600' }}>Max Uses</label>
                            <input 
                                type="number" 
                                min={1}
                                value={maxUses}
                                onChange={(e) => setMaxUses(parseInt(e.target.value) || 1)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '10px',
                                    color: 'white',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={generating || !newCode.trim()}
                            style={{
                                width: '100%',
                                padding: '14px',
                                background: '#ff4500',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: '700',
                                fontSize: '1rem',
                                cursor: (generating || !newCode.trim()) ? 'not-allowed' : 'pointer',
                                opacity: (generating || !newCode.trim()) ? 0.7 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                marginTop: '8px'
                            }}
                        >
                            {generating ? <Loader2 className="animate-spin" size={18} /> : 'Create Beta Token'}
                        </button>
                    </form>
                </div>

                {/* Tokens List */}
                <div className="custom-scrollbar" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', overflowY: 'auto', overflowX: 'auto', maxHeight: '600px' }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Ticket size={24} color="white" />
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>Active Tokens</h3>
                    </div>
                    {loading ? (
                        <div style={{ padding: '60px', textAlign: 'center' }}><Loader2 className="animate-spin" size={24} color="#8e92a4" style={{ margin: '0 auto' }} /></div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', color: '#8e92a4', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, zIndex: 10 }}>
                                    <th style={{ padding: '16px 24px', fontWeight: '600' }}>Code</th>
                                    <th style={{ padding: '16px 24px', fontWeight: '600' }}>Created</th>
                                    <th style={{ padding: '16px 24px', fontWeight: '600' }}>Usage</th>
                                    <th style={{ padding: '16px 24px', fontWeight: '600' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tokens.length === 0 ? (
                                    <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#8e92a4' }}>No tokens found.</td></tr>
                                ) : tokens.map(token => {
                                    const isExhausted = token.currentUses >= token.maxUses;
                                    return (
                                        <tr key={token.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '16px 24px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: '700', color: 'white', letterSpacing: '1px' }}>{token.id}</span>
                                                    <button onClick={() => copyToClipboard(token.id)} style={{ background: 'none', border: 'none', color: '#8e92a4', cursor: 'pointer', display: 'flex' }} title="Copy">
                                                        <Copy size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 24px', color: '#8e92a4' }}>
                                                {token.createdAt ? new Date(token.createdAt).toLocaleDateString() : 'Unknown'}
                                            </td>
                                            <td style={{ padding: '16px 24px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ color: 'white', fontWeight: '600' }}>{token.currentUses || 0}</span>
                                                    <span style={{ color: '#52526b' }}>/</span>
                                                    <span style={{ color: '#8e92a4' }}>{token.maxUses || 1}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 24px' }}>
                                                {isExhausted ? (
                                                    <span style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>
                                                        Exhausted
                                                    </span>
                                                ) : (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>
                                                        <CheckCircle2 size={12} /> Active
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
