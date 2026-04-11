import { useEffect, useState } from 'react';
import { adminApi, type AdminUser } from '../lib/api';
import { AdminTopBar } from '../components/layout/AdminTopBar';
import { PlanBadge } from '../components/ui/Badge';
import { Loader, ErrorMsg } from '../components/ui/Loader';

const VALID_PLANS = ["free", "trial", "starter", "pro", "professional", "beta", "enterprise", "past_due"];

export function UsersSection() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [updatingUid, setUpdatingUid] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const u = await adminApi.users();
            setUsers(u);
            setLastRefreshed(new Date());
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const handlePlanChange = async (uid: string, plan: string) => {
        setUpdatingUid(uid);
        try {
            await adminApi.updateUserPlan(uid, plan);
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, plan } : u));
        } catch (e: unknown) {
            alert(e instanceof Error ? e.message : 'Failed to update plan');
        } finally {
            setUpdatingUid(null);
        }
    };

    const filtered = users.filter(u =>
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.uid?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <>
            <AdminTopBar title="Users" onRefresh={load} lastRefreshed={lastRefreshed} />
            <div style={{ padding: '28px', overflowY: 'auto', flex: 1 }}>
                {error && <ErrorMsg msg={error} />}
                <div style={{ marginBottom: '16px' }}>
                    <input
                        type="text"
                        placeholder="Search by email or UID..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '10px',
                            padding: '10px 16px',
                            color: '#fff',
                            fontSize: '0.88rem',
                            width: '320px',
                            outline: 'none',
                        }}
                    />
                    <span style={{ color: '#52526b', fontSize: '0.82rem', marginLeft: '16px' }}>
                        {filtered.length} of {users.length} users
                    </span>
                </div>

                {loading && <Loader />}

                {!loading && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                    {['Email', 'Plan', 'Analyses', 'Discoveries', 'Threads', 'Joined', 'Actions'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', color: '#8e92a4', fontWeight: '600', textAlign: 'left', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(user => (
                                    <tr key={user.uid} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ color: '#fff', fontWeight: '500' }}>{user.email || '—'}</div>
                                            <div style={{ color: '#52526b', fontSize: '0.75rem', fontFamily: 'monospace' }}>{user.uid}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <PlanBadge plan={user.plan || 'free'} />
                                        </td>
                                        <td style={{ padding: '12px 16px', color: (user.analysisCount ?? 0) > 0 ? '#ff6530' : '#52526b' }}>
                                            {user.analysisCount ?? 0}
                                        </td>
                                        <td style={{ padding: '12px 16px', color: (user.discoveryCount ?? 0) > 0 ? '#60a5fa' : '#52526b' }}>
                                            {user.discoveryCount ?? 0}
                                        </td>
                                        <td style={{ padding: '12px 16px', color: '#8e92a4' }}>
                                            {user.savedThreadCount ?? 0}
                                        </td>
                                        <td style={{ padding: '12px 16px', color: '#8e92a4', fontSize: '0.8rem' }}>
                                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <select
                                                value={user.plan || 'free'}
                                                disabled={updatingUid === user.uid}
                                                onChange={e => void handlePlanChange(user.uid, e.target.value)}
                                                style={{
                                                    background: 'rgba(255,255,255,0.07)',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '8px',
                                                    padding: '6px 10px',
                                                    color: '#fff',
                                                    fontSize: '0.82rem',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {VALID_PLANS.map(p => (
                                                    <option key={p} value={p}>{p}</option>
                                                ))}
                                            </select>
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
