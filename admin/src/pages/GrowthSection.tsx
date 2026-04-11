import { useEffect, useState } from 'react';
import { Users, UserPlus, Clock, Ticket } from 'lucide-react';
import { adminApi, type GrowthKPI } from '../lib/api';
import { AdminTopBar } from '../components/layout/AdminTopBar';
import { StatCard } from '../components/ui/StatCard';
import { TrendChart } from '../components/ui/TrendChart';
import { BarChartWidget } from '../components/ui/BarChartWidget';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Loader, ErrorMsg } from '../components/ui/Loader';

const PLAN_COLORS: Record<string, string> = {
    free: '#6b7280', trial: '#eab308', starter: '#3b82f6',
    pro: '#a855f7', professional: '#ff4500', beta: '#22c55e',
    enterprise: '#fbbf24', past_due: '#ef4444',
};

export function GrowthSection() {
    const [data, setData] = useState<GrowthKPI | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const d = await adminApi.growth();
            setData(d);
            setLastRefreshed(new Date());
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    // Compute signups for different windows from daily data
    const signups7d = data?.daily.slice(-7).reduce((s, d) => s + d.newUsers, 0) ?? 0;
    const signups30d = data?.daily.reduce((s, d) => s + d.newUsers, 0) ?? 0;
    const signupsToday = data?.daily[data.daily.length - 1]?.newUsers ?? 0;

    const planBarData = data
        ? Object.entries(data.planDist)
            .filter(([, v]) => v > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([name, value]) => ({ name, value, color: PLAN_COLORS[name] ?? '#8e92a4' }))
        : [];

    return (
        <>
            <AdminTopBar title="Growth" onRefresh={load} lastRefreshed={lastRefreshed} />
            <div style={{ padding: '28px', overflowY: 'auto', flex: 1 }}>
                {loading && <Loader />}
                {error && <ErrorMsg msg={error} />}
                {data && !loading && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                            <StatCard label="Total Users" value={data.metrics.totalUsers} icon={Users} color="#3b82f6" />
                            <StatCard label="New Today" value={signupsToday} icon={UserPlus} color="#22c55e"
                                delta={signupsToday > 0 ? `+${signupsToday}` : undefined} deltaPositive />
                            <StatCard label="New (7d)" value={signups7d} icon={UserPlus} color="#ff4500" />
                            <StatCard label="New (30d)" value={signups30d} icon={Clock} color="#a855f7" />
                            <StatCard label="Total Folders" value={data.metrics.totalFolders} icon={Ticket} color="#eab308" />
                            <StatCard label="Total Analyses" value={data.metrics.totalAnalyses} icon={Users} color="#ec4899" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
                                <SectionHeader title="Daily Signups (30d)" />
                                <TrendChart
                                    data={data.daily}
                                    dataKey="newUsers"
                                    color="#3b82f6"
                                    label="New Users"
                                />
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
                                <SectionHeader title="Daily Analyses (30d)" />
                                <TrendChart
                                    data={data.daily}
                                    dataKey="newAnalyses"
                                    color="#ff4500"
                                    label="Analyses"
                                />
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
                            <SectionHeader title="Plan Distribution" sub="Users per plan tier" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'center' }}>
                                <BarChartWidget data={planBarData} height={220} valueLabel="Users" />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {planBarData.map(({ name, value, color }) => (
                                        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'inline-block' }} />
                                                <span style={{ color: '#c8cad8', fontSize: '0.88rem', textTransform: 'capitalize' }}>{name}</span>
                                            </div>
                                            <span style={{ color: '#fff', fontWeight: '700', fontSize: '0.95rem' }}>{value.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
