import { useEffect, useState } from 'react';
import { Activity, Zap, Search, Radio } from 'lucide-react';
import { adminApi, type EngagementKPI, type DauPoint } from '../lib/api';
import { AdminTopBar } from '../components/layout/AdminTopBar';
import { StatCard } from '../components/ui/StatCard';
import { TrendChart } from '../components/ui/TrendChart';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Loader, ErrorMsg } from '../components/ui/Loader';

function AdoptionBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#c8cad8', fontSize: '0.88rem' }}>{label}</span>
                <span style={{ color: '#fff', fontWeight: '700', fontSize: '0.88rem' }}>{pct}% <span style={{ color: '#52526b', fontWeight: '400' }}>({value.toLocaleString()})</span></span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
            </div>
        </div>
    );
}

export function EngagementSection() {
    const [engagement, setEngagement] = useState<EngagementKPI | null>(null);
    const [dau, setDau] = useState<DauPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const [e, d] = await Promise.all([adminApi.engagement(), adminApi.dau(30)]);
            setEngagement(e);
            setDau(d);
            setLastRefreshed(new Date());
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const totalUsers = engagement
        ? Math.max(engagement.usersWithAnalysis, engagement.usersWithDiscovery, engagement.usersWithMonitor, 1)
        : 1;

    // DAU/WAU from last entries
    const dau1d = dau[dau.length - 1]?.dau ?? 0;
    const wauSet = dau.slice(-7).reduce((s, d) => s + d.dau, 0);

    return (
        <>
            <AdminTopBar title="Engagement" onRefresh={load} lastRefreshed={lastRefreshed} />
            <div style={{ padding: '28px', overflowY: 'auto', flex: 1 }}>
                {loading && <Loader />}
                {error && <ErrorMsg msg={error} />}
                {engagement && !loading && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                            <StatCard label="DAU (yesterday)" value={dau1d} icon={Activity} color="#22c55e" />
                            <StatCard label="WAU (7d)" value={wauSet} icon={Activity} color="#3b82f6" />
                            <StatCard label="Avg Analyses / User" value={engagement.avgAnalysesPerUser} icon={Zap} color="#ff4500" />
                            <StatCard label="Avg Discoveries / User" value={engagement.avgDiscoveriesPerUser} icon={Search} color="#a855f7" />
                            <StatCard label="Total Monitors" value={engagement.totalMonitors} icon={Radio} color="#eab308" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
                                <SectionHeader title="Daily Active Users (30d)" sub="Distinct users with activity per day" />
                                <TrendChart data={dau} dataKey="dau" color="#22c55e" label="DAU" />
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
                                <SectionHeader title="Feature Adoption" sub="% of users who have used each feature" />
                                <AdoptionBar label="AI Analysis" value={engagement.usersWithAnalysis} total={totalUsers} color="#ff4500" />
                                <AdoptionBar label="Discovery Search" value={engagement.usersWithDiscovery} total={totalUsers} color="#3b82f6" />
                                <AdoptionBar label="Monitoring" value={engagement.usersWithMonitor} total={totalUsers} color="#22c55e" />
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
                            <SectionHeader title="Platform Totals" />
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                {[
                                    { label: 'Total Analyses Run', value: engagement.totalAnalyses, color: '#ff4500' },
                                    { label: 'Total Discoveries Run', value: engagement.totalDiscoveries, color: '#3b82f6' },
                                    { label: 'Active Monitors', value: engagement.totalMonitors, color: '#22c55e' },
                                ].map(({ label, value, color }) => (
                                    <div key={label} style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: '12px',
                                        padding: '20px',
                                        borderLeft: `3px solid ${color}`,
                                    }}>
                                        <p style={{ color: '#8e92a4', fontSize: '0.8rem', margin: '0 0 8px', fontWeight: '600' }}>{label}</p>
                                        <h3 style={{ color: '#fff', fontSize: '1.6rem', fontWeight: '800', margin: 0 }}>{value.toLocaleString()}</h3>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
