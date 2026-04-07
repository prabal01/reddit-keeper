import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface MarketMapTabProps {
    patterns: any[];
    folder?: any;
}

export const MarketMapTab: React.FC<MarketMapTabProps> = ({ patterns }) => {
    return (
        <div className="animate-fade-in">
            <div className="tab-actions-bar mb-8 flex justify-between items-center">
                <div className="tab-description">
                    <h3 className="text-xl font-bold text-white">Pain Map</h3>
                    <p className="text-sm text-gray-500">Recurring complaints and pain signals across Reddit.</p>
                </div>
            </div>

            {patterns.length === 0 ? (
                <div className="empty-tab-state">
                    <AlertTriangle size={48} className="text-gray-700 mb-4" />
                    <h3>No patterns found yet</h3>
                    <p>The agent will group recurring complaints as it scans more threads.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {patterns.map((p, i) => (
                        <div key={i} className="pattern-card">
                            <div className="pattern-header">
                                <h4>{p.title}</h4>
                                <span className="pattern-count">{p.count} mention{p.count !== 1 ? 's' : ''}</span>
                            </div>
                            {p.quote && (
                                <p className="pattern-quote">"{p.quote}"</p>
                            )}
                            {p.thread_ids?.length > 0 && (
                                <div className="pattern-threads">
                                    {p.thread_ids.slice(0, 3).map((url: string, j: number) => (
                                        <a key={j} href={url} target="_blank" rel="noopener noreferrer">
                                            Thread {j + 1} ↗
                                        </a>
                                    ))}
                                    {p.thread_ids.length > 3 && (
                                        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)', padding: '2px 8px' }}>
                                            +{p.thread_ids.length - 3} more
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
