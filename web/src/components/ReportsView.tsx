import React, { useEffect, useState } from 'react';
import { fetchUserStats } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useFolders } from "../contexts/FolderContext";
import { Activity, MessageSquare, FolderOpen, FileText, Clock, TrendingUp, BarChart3, PieChart } from 'lucide-react';
import { Skeleton } from "./Skeleton";

export const ReportsView: React.FC = () => {
    const { user } = useAuth();
    const { folders, fetchFolders } = useFolders();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            Promise.all([
                fetchUserStats(),
                fetchFolders()
            ]).then(([statsData]) => {
                setStats(statsData);
                setLoading(false);
            }).catch(err => {
                console.error(err);
                setLoading(false);
            });
        }
    }, [user, fetchFolders]);

    if (loading) {
        return (
            <div className="dashboard-home">
                <header className="dashboard-header" style={{ marginBottom: '40px' }}>
                    <Skeleton width="400px" height="48px" style={{ marginBottom: '12px' }} />
                    <Skeleton width="100%" height="24px" />
                </header>

                <div className="analytics-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '20px',
                    marginBottom: '40px'
                }}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="metric-card" style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            backdropFilter: 'blur(12px)',
                            padding: '24px',
                            borderRadius: '20px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            <Skeleton width="20px" height="20px" circle />
                            <Skeleton width="120px" height="16px" />
                            <Skeleton width="80px" height="32px" />
                        </div>
                    ))}
                </div>

                <div className="analytics-visuals" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                    gap: '24px'
                }}>
                    <Skeleton width="100%" height="300px" style={{ borderRadius: '24px' }} />
                    <Skeleton width="100%" height="300px" style={{ borderRadius: '24px' }} />
                </div>
            </div>
        );
    }

    const analyticsCards = [
        { label: 'Intelligence Scanned', value: stats?.intelligenceScanned || 0, icon: <Activity size={20} />, color: '#FF4500' },
        { label: 'Comments Analyzed', value: stats?.commentsAnalyzed || 0, icon: <MessageSquare size={20} />, color: '#00D1FF' },
        { label: 'Strategy Folders', value: folders.length, icon: <FolderOpen size={20} />, color: '#A855F7' },
        { label: 'Reports Generated', value: stats?.reportsGenerated || 0, icon: <FileText size={20} />, color: '#10B981' },
        { label: 'Hours Saved', value: `${(stats?.hoursSaved || 0).toFixed(1)}h`, icon: <Clock size={20} />, color: '#F59E0B' },
        { label: 'Avg Sentiment', value: '78%', icon: <TrendingUp size={20} />, color: '#EC4899' },
    ];

    return (
        <div className="dashboard-home">
            <header className="dashboard-header" style={{ marginBottom: '40px' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '900', letterSpacing: '-0.04em' }}>Intelligence Analytics</h1>
                <p className="subtitle">Comprehensive overview of your research impact and data coverage.</p>
            </header>

            <div className="analytics-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '20px',
                marginBottom: '40px'
            }}>
                {analyticsCards.map((card, i) => (
                    <div key={i} className="metric-card" style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        backdropFilter: 'blur(12px)',
                        padding: '24px',
                        borderRadius: '20px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                    }}>
                        <div style={{ color: card.color }}>{card.icon}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>{card.label}</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white' }}>{card.value}</div>
                    </div>
                ))}
            </div>

            <div className="analytics-visuals" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '24px'
            }}>
                <div className="visual-card" style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    backdropFilter: 'blur(12px)',
                    padding: '32px',
                    borderRadius: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    minHeight: '300px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                }}>
                    <BarChart3 size={48} strokeWidth={1} style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <h3>Coverage Trend</h3>
                    <p>Analysis of your research depth over time.</p>
                    <div style={{ marginTop: '20px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: 'full' }}>Coming Soon</div>
                </div>

                <div className="visual-card" style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    backdropFilter: 'blur(12px)',
                    padding: '32px',
                    borderRadius: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    minHeight: '300px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                }}>
                    <PieChart size={48} strokeWidth={1} style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <h3>Platform Distribution</h3>
                    <p>Where your market intelligence comes from.</p>
                    <div style={{ marginTop: '20px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: 'full' }}>Coming Soon</div>
                </div>
            </div>
        </div>
    );
};
