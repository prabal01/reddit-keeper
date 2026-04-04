import { useEffect, useState } from 'react';
import { useAuth } from "../contexts/AuthContext";
import { useFolders } from "../contexts/FolderContext";
import { Activity, MessageSquare, FolderOpen, FileText, Clock, TrendingUp, BarChart3, PieChart } from 'lucide-react';
import { Skeleton } from "./Skeleton";
import { MetricCard } from "./common/MetricCard";
import "./Reports.css";

export const ReportsView: React.FC = () => {
    const { userStats: stats } = useAuth();
    const { folders } = useFolders();
    const [loading, setLoading] = useState(!stats);

    useEffect(() => {
        if (stats) {
            setLoading(false);
        }
    }, [stats]);

    if (loading) {
        return (
            <div className="reports-container">
                <header className="reports-header">
                    <Skeleton width="400px" height="48px" style={{ marginBottom: '12px' }} />
                    <Skeleton width="100%" height="24px" />
                </header>

                <div className="analytics-grid">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <MetricCard key={i} label="" value="" icon={<div />} loading />
                    ))}
                </div>

                <div className="analytics-visuals">
                    <Skeleton width="100%" height="300px" style={{ borderRadius: '24px' }} />
                    <Skeleton width="100%" height="300px" style={{ borderRadius: '24px' }} />
                </div>
            </div>
        );
    }

    const analyticsCards = [
        { label: 'Intelligence Scanned', value: stats?.intelligenceScanned || 0, icon: <Activity size={20} />, color: '#FF4500' },
        { label: 'Insights Found', value: stats?.commentsAnalyzed || 0, icon: <MessageSquare size={20} />, color: '#00D1FF' },
        { label: 'Strategy Folders', value: folders.length, icon: <FolderOpen size={20} />, color: '#A855F7' },
        { label: 'Reports Generated', value: stats?.reportsGenerated || 0, icon: <FileText size={20} />, color: '#10B981' },
        { label: 'Hours Saved', value: `${(stats?.hoursSaved || 0).toFixed(1)}h`, icon: <Clock size={20} />, color: '#F59E0B' },
        { label: 'Avg Sentiment', value: '78%', icon: <TrendingUp size={20} />, color: '#EC4899' },
    ];

    return (
        <div className="reports-container">
            <header className="reports-header">
                <h1>Intelligence Analytics</h1>
                <p className="subtitle">Comprehensive overview of your research impact and data coverage.</p>
            </header>

            <div className="analytics-grid">
                {analyticsCards.map((card, i) => (
                    <MetricCard 
                        key={i} 
                        label={card.label} 
                        value={card.value} 
                        icon={card.icon} 
                        color={card.color} 
                    />
                ))}
            </div>

            <div className="analytics-visuals">
                <div className="visual-card">
                    <BarChart3 size={48} strokeWidth={1} style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <h3>Coverage Trend</h3>
                    <p>Analysis of your research depth over time.</p>
                    <div className="coming-soon-badge">Coming Soon</div>
                </div>

                <div className="visual-card">
                    <PieChart size={48} strokeWidth={1} style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <h3>Platform Distribution</h3>
                    <p>Where your market intelligence comes from.</p>
                    <div className="coming-soon-badge">Coming Soon</div>
                </div>
            </div>
        </div>
    );
};
