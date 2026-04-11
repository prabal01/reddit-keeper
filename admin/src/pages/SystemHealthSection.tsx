import { useEffect, useState } from 'react';
import { Shield, CheckCircle, XCircle, Clock, Cpu } from 'lucide-react';
import { adminApi, type HealthKPI, type BullmqStats } from '../lib/api';
import { AdminTopBar } from '../components/layout/AdminTopBar';
import { StatCard } from '../components/ui/StatCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Loader, ErrorMsg } from '../components/ui/Loader';

function QueueCard({ name, stats }: { name: string; stats: Record<string, number> }) {
    const active = stats['active'] ?? 0;
    const waiting = stats['waiting'] ?? 0;
    const completed = stats['completed'] ?? 0;
    const failed = stats['failed'] ?? 0;
    const isHealthy = failed === 0 && active < 50;

    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${isHealthy ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.2)'}`,
            borderRadius: '14px',
            padding: '20px',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ color: '#c8cad8', fontWeight: '600', fontSize: '0.88rem', fontFamily: 'monospace' }}>{name}</span>
                <span style={{ color: isHealthy ? '#22c55e' : '#ef4444', fontSize: '0.75rem', fontWeight: '700' }}>
                    {isHealthy ? '● HEALTHY' : '● ISSUES'}
                </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                    { label: 'Active', value: active, color: '#eab308' },
                    { label: 'Waiting', value: waiting, color: '#3b82f6' },
                    { label: 'Completed', value: completed, color: '#22c55e' },
                    { label: 'Failed', value: failed, color: '#ef4444' },
                ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 12px' }}>
                        <p style={{ color: '#52526b', fontSize: '0.72rem', margin: '0 0 4px', fontWeight: '600' }}>{label}</p>
                        <span style={{ color: value > 0 ? color : '#52526b', fontWeight: '700', fontSize: '1rem' }}>{value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function SystemHealthSection() {
    const [health, setHealth] = useState<HealthKPI | null>(null);
    const [bullmq, setBullmq] = useState<BullmqStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const [h, b] = await Promise.all([adminApi.health(), adminApi.bullmq()]);
            setHealth(h);
            setBullmq(b);
            setLastRefreshed(new Date());
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    return (
        <>
            <AdminTopBar title="System Health" onRefresh={load} lastRefreshed={lastRefreshed} />
            <div style={{ padding: '28px', overflowY: 'auto', flex: 1 }}>
                {loading && <Loader />}
                {error && <ErrorMsg msg={error} />}
                {health && bullmq && !loading && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                            <StatCard label="Analysis Success Rate" value={`${health.successRate}%`} icon={CheckCircle}
                                color={health.successRate >= 90 ? '#22c55e' : '#ef4444'} />
                            <StatCard label="Completed Folders" value={health.completedFolders} icon={Shield} color="#22c55e" />
                            <StatCard label="Failed Folders" value={health.failedFolders} icon={XCircle} color="#ef4444" />
                            <StatCard label="Processing Now" value={health.processingFolders} icon={Clock} color="#eab308" />
                            <StatCard label="Total Folders" value={health.totalFolders} icon={Cpu} color="#3b82f6" />
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
                            <SectionHeader title="BullMQ Queue Health" sub="Job counts per queue" />
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                                <QueueCard name="sync" stats={bullmq.sync} />
                                <QueueCard name="granular-analysis" stats={bullmq.granular} />
                                <QueueCard name="analysis" stats={bullmq.analysis as Record<string, number>} />
                                <QueueCard name="monitoring-scraper" stats={bullmq.monitoring_scraper} />
                                <QueueCard name="monitoring-matcher" stats={bullmq.monitoring_matcher} />
                            </div>
                        </div>

                        {health.failedFolders > 0 && (
                            <div style={{
                                background: 'rgba(239,68,68,0.06)',
                                border: '1px solid rgba(239,68,68,0.15)',
                                borderRadius: '12px',
                                padding: '16px 20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                            }}>
                                <XCircle size={18} color="#ef4444" />
                                <span style={{ color: '#f87171', fontSize: '0.88rem' }}>
                                    <strong>{health.failedFolders}</strong> folders have failed analysis. Check the queue and logs.
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}
