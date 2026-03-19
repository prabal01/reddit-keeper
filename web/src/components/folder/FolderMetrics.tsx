import React from 'react';
import { ShieldAlert, Target, Lightbulb, CheckCircle2 } from 'lucide-react';

interface MetricProps {
    label: string;
    count: number | string;
    icon: React.ReactNode;
    color: string;
}

const MetricBox: React.FC<MetricProps> = ({ label, count, icon, color }) => (
    <div className="folder-metric-box">
        <div className="metric-label-wrapper">
            <div className="metric-icon" style={{ color }}>{icon}</div>
            <span className="metric-label">{label}</span>
        </div>
        <div className="metric-value">
            {count}
        </div>
    </div>
);

interface FolderMetricsProps {
    folder: any;
}

export const FolderMetrics: React.FC<FolderMetricsProps> = ({ folder }) => {
    if (!folder) return null;

    const metrics = [
        { label: 'Pain Points', count: folder.painPointCount || 0, icon: <ShieldAlert size={18} />, color: '#ef4444' },
        { label: 'Switch Triggers', count: folder.triggerCount || 0, icon: <Target size={18} />, color: '#3b82f6' },
        { label: 'Desired Outcomes', count: folder.outcomeCount || 0, icon: <Lightbulb size={18} />, color: '#10b981' }
    ];

    const total = folder.totalAnalysisCount || 0;
    const completed = folder.completedAnalysisCount || 0;

    if (total > 0) {
        metrics.push({
            label: 'Analysed',
            count: `${completed}/${total}`,
            icon: <CheckCircle2 size={18} />,
            color: completed === total ? '#10b981' : '#f59e0b'
        });
    }

    return (
        <div className="folder-metrics-bar glass-premium">
            {metrics.map((m, i) => (
                <MetricBox key={i} {...m} />
            ))}
        </div>
    );
};
