import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import './UsageProgress.css';

export const UsageProgress: React.FC = () => {
    const { usage, config, plan, openUpgradeModal } = useAuth();

    if (!usage || !config) return null;

    const items = [
        {
            label: 'Discovery Scans',
            current: usage.discoveryCount,
            limit: config.discoveryLimit,
            color: '#3b82f6' // blue
        },
        {
            label: 'AI Reports',
            current: usage.analysisCount,
            limit: config.analysisLimit,
            color: '#8b5cf6' // purple
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
                <span className="plan-badge">{plan?.toUpperCase() || 'FREE'} PLAN</span>
                {plan !== 'pro' && (
                    <button onClick={openUpgradeModal} className="upgrade-link-btn">Upgrade</button>
                )}
            </div>

            <div className="usage-items">
                {items.map((item) => {
                    const percentage = Math.min(100, (item.current / item.limit) * 100);
                    const isNearLimit = percentage > 80;

                    return (
                        <div key={item.label} className="usage-item">
                            <div className="usage-info">
                                <span className="label">{item.label}</span>
                                <span className="value">
                                    {item.current} / {item.limit === -1 ? '∞' : item.limit}
                                </span>
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
