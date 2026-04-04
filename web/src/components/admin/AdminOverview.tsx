import { useEffect, useState } from 'react';
import { API_BASE, getAuthToken } from '../../lib/api';
import { Loader2, Users, FolderOpen, Zap } from 'lucide-react';

export function AdminOverview() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = await getAuthToken();
                const res = await fetch(`${API_BASE}/admin/metrics`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error("Failed to fetch metrics");
                const data = await res.json();
                setStats(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const testAlert = async () => {
        try {
            const token = await getAuthToken();
            const res = await fetch(`${API_BASE}/admin/test-alert`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to trigger alert");
            await res.json();
            alert("✅ Alert sent to Telegram!");
        } catch (err: any) {
            alert("❌ Error: " + err.message);
        }
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 className="animate-spin" size={24} color="#8e92a4" /></div>;
    if (error) return <div style={{ color: '#ef4444', padding: '20px' }}>Error: {error}</div>;

    const cards = [
        { title: 'Total Users', value: stats?.counts?.totalUsers || 0, icon: Users, color: '#3b82f6' },
        { title: 'Total Folders', value: stats?.counts?.totalFolders || 0, icon: FolderOpen, color: '#eab308' },
        { title: 'Total Analyses', value: stats?.counts?.totalAnalyses || 0, icon: Zap, color: '#ff4500' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '700', margin: 0 }}>Platform Metrics</h2>
                <button 
                    onClick={testAlert}
                    style={{ 
                        background: 'rgba(255,255,255,0.05)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        color: '#8e92a4', 
                        padding: '8px 16px', 
                        borderRadius: '10px', 
                        fontSize: '0.85rem', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                    <Zap size={14} /> Trigger Test Alert
                </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                {cards.map((c, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ background: `${c.color}15`, padding: '16px', borderRadius: '14px' }}>
                            <c.icon size={28} color={c.color} />
                        </div>
                        <div>
                            <p style={{ color: '#8e92a4', fontSize: '0.9rem', margin: '0 0 6px 0', fontWeight: '600' }}>{c.title}</p>
                            <h3 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0, color: 'white' }}>{c.value.toLocaleString()}</h3>
                        </div>
                    </div>
                ))}
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '20px' }}>Recent Activity (Last 30 Days)</h3>
            <div className="custom-scrollbar" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', overflowY: 'auto', overflowX: 'auto', maxHeight: '500px' }}>
                 {/* Simple custom bar chart or table for daily stats */}
                 {stats?.daily?.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)', color: '#8e92a4', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', position: 'sticky', top: 0 }}>
                                <th style={{ padding: '12px' }}>Date</th>
                                <th style={{ padding: '12px' }}>New Users</th>
                                <th style={{ padding: '12px' }}>Analyses Generated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.daily.map((d: any, i: number) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                    <td style={{ padding: '12px', color: 'white' }}>{d.date}</td>
                                    <td style={{ padding: '12px', color: d.newUsers > 0 ? '#22c55e' : '#52526b' }}>{d.newUsers}</td>
                                    <td style={{ padding: '12px', color: d.newAnalyses > 0 ? '#ff4500' : '#52526b' }}>{d.newAnalyses}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 ) : (
                    <p style={{ color: '#8e92a4' }}>No recent activity data.</p>
                 )}
            </div>
        </div>
    );
}
