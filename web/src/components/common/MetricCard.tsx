import { Metadata, Caption } from './Typography';
import './MetricCard.css';

interface MetricCardProps {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color?: string;
    trend?: string;
    description?: string;
    loading?: boolean;
    variant?: 'standard' | 'minimal';
}

export const MetricCard: React.FC<MetricCardProps> = ({ 
    label, 
    value, 
    icon, 
    color = 'var(--primary-color)', 
    trend,
    description,
    loading,
    variant = 'standard'
}) => {
    if (loading) {
        return (
            <div className={`premium-card metric-card loading ${variant}`}>
                <div className="metric-icon-skeleton" />
                <div className="metric-value-skeleton" />
            </div>
        );
    }

    if (variant === 'minimal') {
        return (
            <div className="metric-item-minimal" style={{ '--accent-color': color } as React.CSSProperties}>
                <div className="metric-icon-mini" style={{ color }}>
                    {icon}
                </div>
                <div className="metric-data-mini">
                    <span className="metric-value-mini">{value}</span>
                    <Metadata className="metric-label-mini" style={{ opacity: 0.7 }}>{label}</Metadata>
                </div>
            </div>
        );
    }

    return (
        <div className="premium-card metric-card" style={{ '--accent-color': color } as React.CSSProperties}>
            <div className="metric-header">
                <div className="metric-icon" style={{ color }}>
                    {icon}
                </div>
                {trend && (
                    <div className="metric-trend">
                        {trend}
                    </div>
                )}
            </div>
            <div className="metric-content">
                <Metadata className="metric-label">{label}</Metadata>
                <div className="metric-value">{value}</div>
                {description && <Caption className="metric-description">{description}</Caption>}
            </div>
        </div>
    );
};
