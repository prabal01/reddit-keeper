import { useEffect, useState } from 'react';
import { DollarSign, AlertTriangle, Users, TrendingUp } from 'lucide-react';
import { adminApi, type GrowthKPI, type CohortRow } from '../lib/api';
import { AdminTopBar } from '../components/layout/AdminTopBar';
import { StatCard } from '../components/ui/StatCard';
import { BarChartWidget } from '../components/ui/BarChartWidget';
import { PlanBadge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Loader, ErrorMsg } from '../components/ui/Loader';

// Estimated monthly prices per plan (update to match actual pricing)
const PLAN_MRR: Record<string, number> = {
    starter: 29,
    pro: 79,
    professional: 149,
    enterprise: 499,
};

const PLAN_COLORS: Record<string, string> = {
    free: '#6b7280', trial: '#eab308', starter: '#3b82f6',
    pro: '#a855f7', professional: '#ff4500', beta: '#22c55e',
    enterprise: '#fbbf24', past_due: '#ef4444',
};

const ALL_PLANS = ['free', 'trial', 'starter', 'pro', 'professional', 'beta', 'enterprise', 'past_due'];

export function MonetizationSection() {
    const [growth, setGrowth] = useState<GrowthKPI | null>(null);
    const [cohorts, setCohorts] = useState<CohortRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const [g, c] = await Promise.all([adminApi.growth(), adminApi.cohorts()]);
            setGrowth(g);
            setCohorts(c);
            setLastRefreshed(new Date());
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const planDist = growth?.planDist ?? {};
    const totalUsers = Object.values(planDist).reduce((s, v) => s + v, 0);
    const payingUsers = ['starter', 'pro', 'professional', 'enterprise'].reduce((s, p) => s + (planDist[p] ?? 0), 0);
    const pastDue = planDist['past_due'] ?? 0;
    const estimatedMRR = Object.entries(PLAN_MRR).reduce((s, [plan, price]) => s + (planDist[plan] ?? 0) * price, 0);

    const barData = Object.entries(planDist)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([name, value]) => ({ name, value, color: PLAN_COLORS[name] ?? '#8e92a4' }));

    // Plans present in cohorts
    const cohortPlans = ALL_PLANS.filter(p => cohorts.some(c => (c.plans[p] ?? 0) > 0));

    return (
        <>
            <AdminTopBar title="Monetization" onRefresh={load} lastRefreshed={lastRefreshed} />
            <div style={{ padding: '28px', overflowY: 'auto', flex: 1 }}>
                {loading && <Loader />}
                {error && <ErrorMsg msg={error} />}
                {growth && !loading && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                            <StatCard label="Est. MRR" value={`$${estimatedMRR.toLocaleString()}`} icon={DollarSign} color="#22c55e" />
                            <StatCard label="Paying Users" value={payingUsers} icon={Users} color="#ff4500"
                                sub={totalUsers > 0 ? `${Math.round((payingUsers / totalUsers) * 100)}% conversion` : undefined} />
                            <StatCard label="Past Due" value={pastDue} icon={AlertTriangle} color="#ef4444"
                                delta={pastDue > 0 ? `${pastDue} at risk` : undefined} deltaPositive={false} />
                            <StatCard label="Free Users" value={planDist['free'] ?? 0} icon={TrendingUp} color="#6b7280" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
                                <SectionHeader title="Plan Distribution" />
                                <BarChartWidget data={barData} height={220} valueLabel="Users" />
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
                                <SectionHeader title="MRR Breakdown" sub="Estimated from plan pricing" />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {Object.entries(PLAN_MRR).map(([plan, price]) => {
                                        const count = planDist[plan] ?? 0;
                                        if (count === 0) return null;
                                        const mrr = count * price;
                                        return (
                                            <div key={plan} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <PlanBadge plan={plan} />
                                                    <span style={{ color: '#8e92a4', fontSize: '0.82rem' }}>{count} × ${price}</span>
                                                </div>
                                                <span style={{ color: '#22c55e', fontWeight: '700' }}>${mrr.toLocaleString()}</span>
                                            </div>
                                        );
                                    })}
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#8e92a4', fontWeight: '600' }}>Total Est. MRR</span>
                                        <span style={{ color: '#22c55e', fontWeight: '800', fontSize: '1.1rem' }}>${estimatedMRR.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {cohorts.length > 0 && (
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px', overflowX: 'auto' }}>
                                <SectionHeader title="Weekly Cohorts" sub="Signups per week by plan tier" />
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '500px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                            <th style={{ padding: '10px 12px', color: '#8e92a4', textAlign: 'left', fontWeight: '600' }}>Week</th>
                                            <th style={{ padding: '10px 12px', color: '#8e92a4', textAlign: 'right', fontWeight: '600' }}>Total</th>
                                            {cohortPlans.map(p => (
                                                <th key={p} style={{ padding: '10px 12px', textAlign: 'right' }}>
                                                    <PlanBadge plan={p} />
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cohorts.map((row) => (
                                            <tr key={row.week} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <td style={{ padding: '10px 12px', color: '#c8cad8', fontFamily: 'monospace', fontSize: '0.82rem' }}>{row.week}</td>
                                                <td style={{ padding: '10px 12px', color: '#fff', fontWeight: '700', textAlign: 'right' }}>{row.total}</td>
                                                {cohortPlans.map(p => (
                                                    <td key={p} style={{ padding: '10px 12px', color: (row.plans[p] ?? 0) > 0 ? '#c8cad8' : '#52526b', textAlign: 'right' }}>
                                                        {row.plans[p] ?? 0}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}
