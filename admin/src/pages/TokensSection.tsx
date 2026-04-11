import { useEffect, useState } from 'react';
import { adminApi, type InviteToken } from '../lib/api';
import { AdminTopBar } from '../components/layout/AdminTopBar';
import { Loader, ErrorMsg } from '../components/ui/Loader';

export function TokensSection() {
    const [tokens, setTokens] = useState<InviteToken[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [newCode, setNewCode] = useState('');
    const [newMax, setNewMax] = useState(1);
    const [creating, setCreating] = useState(false);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const t = await adminApi.tokens();
            setTokens(t);
            setLastRefreshed(new Date());
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const handleCreate = async () => {
        if (!newCode.trim()) return;
        setCreating(true);
        try {
            await adminApi.createToken(newCode.trim(), newMax);
            setNewCode('');
            setNewMax(1);
            await load();
        } catch (e: unknown) {
            alert(e instanceof Error ? e.message : 'Failed to create token');
        } finally {
            setCreating(false);
        }
    };

    return (
        <>
            <AdminTopBar title="Beta Tokens" onRefresh={load} lastRefreshed={lastRefreshed} />
            <div style={{ padding: '28px', overflowY: 'auto', flex: 1 }}>
                {error && <ErrorMsg msg={error} />}

                <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '16px',
                    padding: '24px',
                    marginBottom: '24px',
                }}>
                    <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', margin: '0 0 16px' }}>Create Token</h3>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="Token code (e.g. LAUNCH-2024)"
                            value={newCode}
                            onChange={e => setNewCode(e.target.value)}
                            style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '10px',
                                padding: '10px 14px',
                                color: '#fff',
                                fontSize: '0.88rem',
                                width: '260px',
                                outline: 'none',
                                fontFamily: 'monospace',
                            }}
                        />
                        <input
                            type="number"
                            min={1}
                            max={1000}
                            value={newMax}
                            onChange={e => setNewMax(parseInt(e.target.value) || 1)}
                            style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '10px',
                                padding: '10px 14px',
                                color: '#fff',
                                fontSize: '0.88rem',
                                width: '100px',
                                outline: 'none',
                            }}
                            title="Max uses"
                        />
                        <span style={{ color: '#52526b', fontSize: '0.82rem' }}>max uses</span>
                        <button
                            onClick={() => void handleCreate()}
                            disabled={creating || !newCode.trim()}
                            style={{
                                background: creating ? 'rgba(255,255,255,0.05)' : '#ff4500',
                                border: 'none',
                                borderRadius: '10px',
                                padding: '10px 20px',
                                color: '#fff',
                                fontSize: '0.88rem',
                                fontWeight: '600',
                                cursor: creating ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {creating ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </div>

                {loading && <Loader />}
                {!loading && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                    {['Code', 'Uses / Max', 'Created', 'Status'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', color: '#8e92a4', fontWeight: '600', textAlign: 'left', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tokens.map(token => {
                                    const exhausted = token.uses >= token.maxUses;
                                    return (
                                        <tr key={token.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <td style={{ padding: '12px 16px', color: '#fff', fontFamily: 'monospace', fontWeight: '600' }}>
                                                {token.code}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{ color: exhausted ? '#ef4444' : '#22c55e', fontWeight: '700' }}>{token.uses}</span>
                                                <span style={{ color: '#52526b' }}> / {token.maxUses}</span>
                                            </td>
                                            <td style={{ padding: '12px 16px', color: '#8e92a4', fontSize: '0.8rem' }}>
                                                {new Date(token.createdAt).toLocaleDateString()}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{
                                                    background: exhausted ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                                                    color: exhausted ? '#f87171' : '#4ade80',
                                                    padding: '3px 10px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '600',
                                                }}>
                                                    {exhausted ? 'Exhausted' : 'Active'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}
