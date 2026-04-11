import { useEffect, useState } from 'react';
import { adminApi, type FunnelKPI } from '../lib/api';
import { AdminTopBar } from '../components/layout/AdminTopBar';
import { FunnelChart } from '../components/ui/FunnelChart';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Loader, ErrorMsg } from '../components/ui/Loader';

export function FunnelSection() {
    const [data, setData] = useState<FunnelKPI | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const d = await adminApi.funnel();
            setData(d);
            setLastRefreshed(new Date());
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const stages = data ? [
        { label: 'Signed Up', value: data.signups, color: '#3b82f6' },
        { label: 'Created a Folder', value: data.hasFolder, color: '#6366f1' },
        { label: 'Saved a Thread', value: data.hasSavedThread, color: '#a855f7' },
        { label: 'Ran AI Analysis', value: data.hasAnalysis, color: '#ff4500' },
        { label: 'Set Up Monitor', value: data.hasMonitor, color: '#22c55e' },
    ] : [];

    const overallConversion = data && data.signups > 0
        ? Math.round((data.hasAnalysis / data.signups) * 100)
        : 0;

    return (
        <>
            <AdminTopBar title="Activation Funnel" onRefresh={load} lastRefreshed={lastRefreshed} />
            <div style={{ padding: '28px', overflowY: 'auto', flex: 1 }}>
                {loading && <Loader />}
                {error && <ErrorMsg msg={error} />}
                {data && !loading && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '32px', alignItems: 'start' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '28px' }}>
                                <SectionHeader title="User Activation Funnel" sub="Drop-off at each stage of the product journey" />
                                <FunnelChart stages={stages} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{
                                    background: 'rgba(255,69,0,0.08)',
                                    border: '1px solid rgba(255,69,0,0.2)',
                                    borderRadius: '16px',
                                    padding: '24px',
                                    textAlign: 'center',
                                }}>
                                    <p style={{ color: '#8e92a4', fontSize: '0.82rem', margin: '0 0 8px', fontWeight: '600', textTransform: 'uppercase' }}>
                                        Signup → Analysis
                                    </p>
                                    <h2 style={{ color: '#ff4500', fontSize: '3rem', fontWeight: '800', margin: 0, lineHeight: 1 }}>
                                        {overallConversion}%
                                    </h2>
                                    <p style={{ color: '#52526b', fontSize: '0.8rem', margin: '8px 0 0' }}>Overall conversion</p>
                                </div>

                                {stages.slice(1).map((stage, i) => {
                                    const prev = stages[i];
                                    const conv = prev.value > 0 ? Math.round((stage.value / prev.value) * 100) : 0;
                                    return (
                                        <div key={stage.label} style={{
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            borderRadius: '12px',
                                            padding: '16px',
                                        }}>
                                            <p style={{ color: '#52526b', fontSize: '0.78rem', margin: '0 0 4px' }}>
                                                {prev.label} → {stage.label}
                                            </p>
                                            <span style={{ color: conv >= 50 ? '#22c55e' : conv >= 25 ? '#eab308' : '#ef4444', fontWeight: '700', fontSize: '1.1rem' }}>
                                                {conv}%
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
