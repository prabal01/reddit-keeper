import React, { useEffect, useState } from 'react';
import { API_BASE, getAuthToken } from '../../lib/api';
import { Loader2, Server } from 'lucide-react';
import toast from 'react-hot-toast';

export function AdminQueues() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
        // Optional: poll every 10 seconds
        const interval = setInterval(fetchStats, 10000);
        return () => clearInterval(interval);
    }, []);

    const fetchStats = async () => {
        try {
            const token = await getAuthToken();
            const res = await fetch(`${API_BASE}/admin/bullmq-stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to fetch queue stats");
            const data = await res.json();
            setStats(data);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !stats) return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 className="animate-spin" size={24} color="#8e92a4" /></div>;

    const renderQueueCard = (title: string, data: any) => {
        if (!data) return null;
        return (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <Server size={20} color="#ff4500" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>{title}</h3>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
                        <p style={{ color: '#8e92a4', fontSize: '0.8rem', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: '700' }}>Waiting</p>
                        <h4 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: 'white' }}>{data.waiting || 0}</h4>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
                        <p style={{ color: '#8e92a4', fontSize: '0.8rem', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: '700' }}>Active</p>
                        <h4 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: '#3b82f6' }}>{data.active || 0}</h4>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
                        <p style={{ color: '#8e92a4', fontSize: '0.8rem', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: '700' }}>Completed</p>
                        <h4 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: '#22c55e' }}>{data.completed || 0}</h4>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
                        <p style={{ color: '#8e92a4', fontSize: '0.8rem', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: '700' }}>Failed</p>
                        <h4 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: '#ef4444' }}>{data.failed || 0}</h4>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '700', margin: 0 }}>System Queues (BullMQ)</h2>
                {loading && <Loader2 className="animate-spin" size={16} color="#8e92a4" />}
            </div>

            {stats ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                    {renderQueueCard("Sync Queue (Reddit/HN Scrape)", stats.sync)}
                    {renderQueueCard("Granular Analysis (Comments)", stats.granular)}
                    {renderQueueCard("Folder Analysis (Gemini)", stats.analysis)}
                </div>
            ) : (
                <div style={{ color: '#8e92a4' }}>No data available</div>
            )}
        </div>
    );
}
