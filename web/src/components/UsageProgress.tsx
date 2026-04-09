import { useAuth } from '../contexts/AuthContext';
import { Metadata, Caption } from './common/Typography';
import './UsageProgress.css';

export const UsageProgress: React.FC = () => {
    const { usage, config, plan } = useAuth();

    if (!usage || !config) return null;

    const items = [
        {
            label: 'Active Monitors',
            current: usage.monitorCount,
            limit: config.monitorLimit,
            color: '#ff4500'
        },
        {
            label: 'Leads Found',
            current: usage.leadsFound,
            limit: -1, // no hard cap on leads
            color: '#10b981'
        },
    ];

    const planLabel = (plan || 'free').toUpperCase().replace('PROFESSIONAL', 'PRO');

    return (
        <div className="usage-progress-container">
            <div className="usage-header">
                <Metadata className="plan-badge">{planLabel} PLAN</Metadata>
                {!['pro', 'professional', 'enterprise'].includes(plan || '') && (
                    <a href="/pricing" className="upgrade-link-btn" style={{ textDecoration: 'none' }}>
                        <Metadata className="text-(--bg-accent) font-black">Upgrade</Metadata>
                    </a>
                )}
            </div>

            <div className="usage-items">
                {items.map((item) => {
                    const isUnlimited = item.limit === -1;
                    const percentage = isUnlimited ? 0 : Math.min(100, (item.current / item.limit) * 100);
                    const isNearLimit = !isUnlimited && percentage > 80;

                    return (
                        <div key={item.label} className="usage-item">
                            <div className="usage-info">
                                <Metadata className="label">{item.label}</Metadata>
                                <Caption className="value">
                                    {item.current}{isUnlimited ? '' : ` / ${item.limit}`}
                                </Caption>
                            </div>
                            {!isUnlimited && (
                                <div className="progress-track">
                                    <div
                                        className={`progress-bar ${isNearLimit ? 'near-limit' : ''}`}
                                        style={{
                                            width: `${percentage}%`,
                                            backgroundColor: item.color
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
