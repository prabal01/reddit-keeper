import { useEffect, useState } from 'react';
import { useAuth } from "../contexts/AuthContext";
import { useFolders } from "../contexts/FolderContext";
import { Activity, MessageSquare, FolderOpen, FileText, Clock, TrendingUp, BarChart3, PieChart } from 'lucide-react';
import { Skeleton } from "./Skeleton";
import { MetricCard } from "./common/MetricCard";
import { PageHeader } from './common/PageHeader';
import { H2, Subtitle } from './common/Typography';
import { Badge } from './common/Badge';
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
                <PageHeader title="" subtitle="" loading />

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
        { label: 'Intelligence Scanned', value: stats?.intelligenceScanned || 0, icon: <Activity size={20} />, color: 'var(--bg-accent)' },
        { label: 'Insights Found', value: stats?.commentsAnalyzed || 0, icon: <MessageSquare size={20} />, color: 'var(--bg-accent)' },
        { label: 'Strategy Folders', value: folders.length, icon: <FolderOpen size={20} />, color: 'var(--bg-accent)' },
        { label: 'Reports Generated', value: stats?.reportsGenerated || 0, icon: <FileText size={20} />, color: 'var(--bg-accent)' },
        { label: 'Hours Saved', value: `${(stats?.hoursSaved || 0).toFixed(1)}h`, icon: <Clock size={20} />, color: 'var(--bg-accent)' },
        { label: 'Avg Sentiment', value: '78%', icon: <TrendingUp size={20} />, color: 'var(--bg-accent)' },
    ];

    return (
        <div className="reports-container">
            <PageHeader 
                title="Intelligence Analytics" 
                subtitle="Comprehensive overview of your research impact and data coverage." 
            />

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
                <div className="visual-card bg-(--bg-secondary) border border-(--border-light) p-8 rounded-2xl relative overflow-hidden group">
                    <BarChart3 size={48} strokeWidth={1} className="text-(--text-tertiary) mb-6 opacity-40 group-hover:text-(--bg-accent) transition-colors" />
                    <H2 className="mb-2">Coverage Analytics</H2>
                    <Subtitle className="text-sm! mb-6">Historical analysis of your research depth and opportunity velocity.</Subtitle>
                    <Badge variant="premium" className="absolute top-6 right-6">Intelligence Alpha</Badge>
                </div>

                <div className="visual-card bg-(--bg-secondary) border border-(--border-light) p-8 rounded-2xl relative overflow-hidden group">
                    <PieChart size={48} strokeWidth={1} className="text-(--text-tertiary) mb-6 opacity-40 group-hover:text-(--bg-accent) transition-colors" />
                    <H2 className="mb-2">Platform Distribution</H2>
                    <Subtitle className="text-sm! mb-6">Visual breakdown of where your market signals are originating from.</Subtitle>
                    <Badge variant="neutral" className="absolute top-6 right-6">Coming Soon</Badge>
                </div>
            </div>
        </div>
    );
};
