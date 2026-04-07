import React from 'react';
import { Target, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MonitoringSplitViewProps {
    patterns: any[];
    leads: any[];
    onUpdateLeadStatus: (leadId: string, status: 'new' | 'contacted' | 'ignored') => Promise<void>;
}

export const MonitoringSplitView: React.FC<MonitoringSplitViewProps> = ({ patterns, leads, onUpdateLeadStatus }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Patterns (Left Side) */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="text-orange-500" size={20} />
                    <h3 className="text-lg font-semibold text-white">Extracted Patterns</h3>
                </div>
                
                {patterns.length === 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                        <p className="text-gray-400">No patterns discovered yet.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {patterns.map((p, idx) => (
                            <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <h4 className="text-md font-medium text-orange-400">{p.title}</h4>
                                    <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded-full">{p.count} mentions</span>
                                </div>
                                <p className="text-sm text-gray-300 mb-4 line-clamp-2">"{p.quote}"</p>
                                <div className="text-xs text-gray-500 flex justify-between">
                                    <span>Found {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Opportunities/Leads (Right Side) */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-2">
                    <Target className="text-green-500" size={20} />
                    <h3 className="text-lg font-semibold text-white">High-Intent Opportunities</h3>
                </div>
                
                {leads.length === 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                        <p className="text-gray-400">No leads discovered yet.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {leads.map((l, idx) => (
                            <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-colors flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="text-md font-medium text-green-400">Lead Match</h4>
                                        <span className={`text-xs px-2 py-1 rounded-full ${
                                            l.status === 'new' ? 'bg-blue-500/20 text-blue-300' :
                                            l.status === 'contacted' ? 'bg-green-500/20 text-green-300' :
                                            'bg-gray-500/20 text-gray-300'
                                        }`}>
                                            {l.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mb-4 truncate" title={l.thread_title}>
                                        {l.thread_title}
                                    </p>
                                </div>
                                <div className="flex justify-between items-center mt-auto">
                                    <div className="flex gap-2">
                                        {l.status === 'new' && (
                                            <>
                                                <button 
                                                    className="text-xs bg-green-500/20 hover:bg-green-500/30 text-green-300 px-3 py-1.5 rounded transition-colors"
                                                    onClick={() => onUpdateLeadStatus(l.id, 'contacted')}
                                                >
                                                    Mark Contacted
                                                </button>
                                                <button 
                                                    className="text-xs bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 px-3 py-1.5 rounded transition-colors"
                                                    onClick={() => onUpdateLeadStatus(l.id, 'ignored')}
                                                >
                                                    Ignore
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    <a 
                                        href={l.thread_url || `https://reddit.com/${l.thread_id}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded transition-colors"
                                    >
                                        View Thread
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
