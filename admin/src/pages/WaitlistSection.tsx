import { useEffect, useState } from 'react';
import { adminApi, type WaitlistEntry } from '../lib/api';
import { AdminTopBar } from '../components/layout/AdminTopBar';
import { Loader, ErrorMsg } from '../components/ui/Loader';

export function WaitlistSection() {
    const [entries, setEntries] = useState<WaitlistEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await adminApi.waitlist();
            setEntries(data);
            setLastRefreshed(new Date());
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const handleStatus = async (id: string, status: string) => {
        setUpdating(id);
        try {
            await adminApi.updateWaitlistStatus(id, status);
            setEntries(prev => prev.map(e => e.id === id ? { ...e, status: status as WaitlistEntry['status'] } : e));
        } catch (e: unknown) {
            alert(e instanceof Error ? e.message : 'Failed to update');
        } finally {
            setUpdating(null);
        }
    };

    const pending = entries.filter(e => e.status === 'pending').length;
    const invited = entries.filter(e => e.status === 'invited').length;

    return (
        <>
            <AdminTopBar title="Waitlist" onRefresh={load} lastRefreshed={lastRefreshed} />
            <div style={{ padding: '28px', overflowY: 'auto', flex: 1 }}>
                {error && <ErrorMsg msg={error} />}

                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                    {[
                        { label: 'Total', value: entries.length, color: '#8e92a4' },
                        { label: 'Pending', value: pending, color: '#eab308' },
                        { label: 'Invited', value: invited, color: '#22c55e' },
                    ].map(({ label, value, color }) => (
                        <div key={label} style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '12px',
                            padding: '16px 24px',
                        }}>
                            <p style={{ color: '#8e92a4', fontSize: '0.78rem', margin: '0 0 4px', fontWeight: '600', textTransform: 'uppercase' }}>{label}</p>
                            <h3 style={{ color, fontSize: '1.6rem', fontWeight: '800', margin: 0 }}>{value}</h3>
                        </div>
                    ))}
                </div>

                {loading && <Loader />}
                {!loading && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                    {['Email', 'Status', 'Joined', 'Action'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', color: '#8e92a4', fontWeight: '600', textAlign: 'left', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(entry => (
                                    <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ padding: '12px 16px', color: '#fff' }}>{entry.email}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{
                                                background: entry.status === 'invited' ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
                                                color: entry.status === 'invited' ? '#4ade80' : '#eab308',
                                                padding: '3px 10px',
                                                borderRadius: '20px',
                                                fontSize: '0.75rem',
                                                fontWeight: '600',
                                            }}>
                                                {entry.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px', color: '#8e92a4', fontSize: '0.8rem' }}>
                                            {new Date(entry.createdAt).toLocaleDateString()}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            {entry.status === 'pending' ? (
                                                <button
                                                    disabled={updating === entry.id}
                                                    onClick={() => void handleStatus(entry.id, 'invited')}
                                                    style={{
                                                        background: 'rgba(34,197,94,0.12)',
                                                        border: '1px solid rgba(34,197,94,0.2)',
                                                        borderRadius: '8px',
                                                        padding: '5px 12px',
                                                        color: '#4ade80',
                                                        fontSize: '0.8rem',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    {updating === entry.id ? '...' : 'Mark Invited'}
                                                </button>
                                            ) : (
                                                <span style={{ color: '#52526b', fontSize: '0.8rem' }}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}
