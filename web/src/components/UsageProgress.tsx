import { useAuth } from '../contexts/AuthContext';
import { Metadata, Caption } from './common/Typography';
import './UsageProgress.css';

export const UsageProgress: React.FC = () => {
    const { usage, config, plan } = useAuth();

    if (!usage || !config) return null;

    const items = [
        {
            label: 'Discovery Scans',
            current: usage.discoveryCount,
            limit: config.discoveryLimit,
            color: '#ff4500' // orange
        },
        {
            label: 'AI Reports',
            current: usage.analysisCount,
            limit: config.analysisLimit,
            color: '#94a3b8' // slate-400
        },
        {
            label: 'Saved Threads',
            current: usage.savedThreadCount,
            limit: config.savedThreadLimit,
            color: '#10b981' // emerald
        }
    ];

    return (
        <div className="usage-progress-container">
            <div className="usage-header">
                <Metadata className="plan-badge">{plan?.toUpperCase() || 'FREE'} PLAN</Metadata>
                {plan !== 'pro' && (
                    <a href="mailto:hello@opiniondeck.com" className="upgrade-link-btn" style={{ textDecoration: 'none' }}>
                        <Metadata className="text-(--bg-accent) font-black">Get More Credits</Metadata>
                    </a>
                )}
            </div>

            <div className="usage-items">
                {items.map((item) => {
                    const percentage = Math.min(100, (item.current / item.limit) * 100);
                    const isNearLimit = percentage > 80;

                    return (
                        <div key={item.label} className="usage-item">
                            <div className="usage-info">
                                <Metadata className="label">{item.label}</Metadata>
                                <Caption className="value">
                                    {item.current} / {item.limit === -1 ? '∞' : item.limit}
                                </Caption>
                            </div>
                            <div className="progress-track">
                                <div
                                    className={`progress-bar ${isNearLimit ? 'near-limit' : ''}`}
                                    style={{
                                        width: `${percentage}%`,
                                        backgroundColor: item.color
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
