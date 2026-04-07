import React from 'react';
import { Activity, CircleDashed, AlertTriangle, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MonitoringAlert {
    id: string;
    folderId: string;
    uid: string;
    type: 'discovery';
    newLeadsCount: number;
    newPatternsCount: number;
    timestamp: string;
    status: 'success' | 'no_new' | 'failed';
    keyword?: string;
    errorMessage?: string;
}

interface MonitoringAlertsFeedProps {
    alerts: MonitoringAlert[];
}

export const MonitoringAlertsFeed: React.FC<MonitoringAlertsFeedProps> = ({ alerts }) => {
    if (alerts.length === 0) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center mt-6">
                <Activity className="text-gray-500 mx-auto mb-3" size={28} />
                <p className="text-sm text-gray-400">No monitoring activity yet.</p>
                <p className="text-xs text-gray-600 mt-1">The agent will appear here when it runs its first scan.</p>
            </div>
        );
    }

    const getStatusIcon = (status: MonitoringAlert['status']) => {
        switch (status) {
            case 'success':
                return <Zap size={16} className="text-green-400 fill-green-400" />;
            case 'no_new':
                return <CircleDashed size={16} className="text-gray-500" />;
            case 'failed':
                return <AlertTriangle size={16} className="text-red-400" />;
        }
    };

    const getStatusLabel = (alert: MonitoringAlert) => {
        if (alert.status === 'failed') return 'Scan failed';
        if (alert.status === 'no_new') return 'No new threads found';
        const parts: string[] = [];
        if (alert.newLeadsCount > 0) parts.push(`${alert.newLeadsCount} new lead${alert.newLeadsCount > 1 ? 's' : ''}`);
        if (alert.newPatternsCount > 0) parts.push(`${alert.newPatternsCount} new pattern${alert.newPatternsCount > 1 ? 's' : ''}`);
        return parts.length > 0 ? `Found ${parts.join(' and ')}` : 'Scan completed';
    };

    const getStatusColor = (status: MonitoringAlert['status']) => {
        switch (status) {
            case 'success': return 'border-green-500/20 bg-green-500/5';
            case 'no_new': return 'border-white/5 bg-white/2';
            case 'failed': return 'border-red-500/20 bg-red-500/5';
        }
    };

    return (
        <div className="mt-6">
            <div className="flex items-center gap-2 mb-4">
                <Activity className="text-purple-400" size={18} />
                <h3 className="text-sm font-semibold text-white">Agent Activity</h3>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                    {alerts.length} events
                </span>
            </div>

            <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[19px] top-0 bottom-0 w-px bg-white/5" />

                <div className="flex flex-col gap-2">
                    {alerts.map((alert) => (
                        <div 
                            key={alert.id} 
                            className={`relative flex items-start gap-4 p-3 rounded-lg border transition-colors ${getStatusColor(alert.status)}`}
                        >
                            {/* Timeline dot */}
                            <div className="relative z-10 mt-0.5 w-[22px] h-[22px] rounded-full bg-black/60 border border-white/10 flex items-center justify-center shrink-0">
                                {getStatusIcon(alert.status)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium text-white">
                                        {getStatusLabel(alert)}
                                    </p>
                                    <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                        {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                                    </span>
                                </div>
                                {alert.keyword && (
                                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                                        Keyword: <span className="text-gray-400">{alert.keyword}</span>
                                    </p>
                                )}
                                {alert.errorMessage && (
                                    <p className="text-xs text-red-400 mt-1">{alert.errorMessage}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
