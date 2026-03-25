import React from 'react';
import { Search, Lightbulb, Layers, Clock, ArrowRight, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { type DiscoveryHistoryEntry } from '../hooks/useDiscovery';

interface DiscoveryRecentHistoryProps {
    history: DiscoveryHistoryEntry[];
    onSelect: (entry: DiscoveryHistoryEntry) => void;
    onDelete: (id: string) => void;
    isLoading?: boolean;
}

export const DiscoveryRecentHistory: React.FC<DiscoveryRecentHistoryProps> = ({ 
    history = [], 
    onSelect, 
    onDelete,
    isLoading = false 
}) => {
    // Ultra-defensive check
    if (!history || !Array.isArray(history) || (history.length === 0 && !isLoading)) return null;

    const getIcon = (type: string) => {
        switch (type) {
            case 'competitor': return <Search size={14} className="text-[#FF4500]" />;
            case 'idea': return <Lightbulb size={14} className="text-amber-400" />;
            case 'bulk': return <Layers size={14} className="text-teal-400" />;
            default: return <Clock size={14} className="text-slate-500" />;
        }
    };

    return (
        <div className="w-full max-w-[800px] mx-auto mt-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="flex items-center justify-between mb-6 px-4">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-4 bg-[#FF4500] rounded-full" />
                    <h3 className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em]">Recent Research</h3>
                </div>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {isLoading ? (
                    [...Array(10)].map((_, i) => (
                        <div key={i} className="h-14 w-full bg-white/1 border border-white/5 rounded-2xl animate-pulse" />
                    ))
                ) : (
                    history.map((entry) => (
                        <div 
                            key={entry.id}
                            className="group flex items-center justify-between p-4 bg-white/2 border border-white/5 rounded-2xl hover:bg-white/4 hover:border-white/10 transition-all cursor-pointer"
                            onClick={() => onSelect(entry)}
                        >
                            <div className="flex items-center gap-5 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    {getIcon(entry.type)}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[13px] font-bold text-white/80 group-hover:text-white transition-colors truncate">
                                        {entry.query}
                                    </span>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none">
                                            {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                                        </span>
                                        <div className="w-1 h-1 rounded-full bg-slate-800" />
                                        <span className="text-[9px] font-black text-[#FF4500]/60 uppercase tracking-widest leading-none">
                                            {entry.resultsCount} Results
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <button 
                                    className="p-2 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(entry.id);
                                    }}
                                >
                                    <Trash2 size={14} />
                                </button>
                                <ArrowRight size={16} className="text-slate-700 group-hover:text-[#FF4500] transform group-hover:translate-x-1 transition-all" />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
