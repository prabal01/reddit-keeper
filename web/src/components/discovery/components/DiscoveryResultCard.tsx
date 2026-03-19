import React from 'react';
import { ExternalLink, CheckCircle2, MessageSquare, RefreshCw, Layers } from 'lucide-react';
import type { DiscoveryResult } from '../hooks/useDiscovery';

interface DiscoveryResultCardProps {
    thread: DiscoveryResult;
    isSelected: boolean;
    onToggle: (id: string) => void;
    onEnrich?: (id: string, url: string, source: string) => void;
}

export const DiscoveryResultCard: React.FC<DiscoveryResultCardProps> = ({ thread, isSelected, onToggle, onEnrich }) => {
    return (
        <div
            className={`group relative flex flex-col min-h-[140px] h-full overflow-hidden rounded-[20px] border transition-all duration-500 cursor-pointer backdrop-blur-xl ${isSelected
                ? 'border-[#FF4500] bg-[#FF4500]/10 shadow-[0_0_40px_rgba(255,69,0,0.15)] ring-1 ring-[#FF4500]/30'
                : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 hover:translate-y-[-2px] hover:shadow-xl hover:shadow-black/20'
                } ${thread.isBulk ? 'border-dashed' : ''}`}
            onClick={() => onToggle(thread.id)}
            role="checkbox"
            aria-checked={isSelected}
            aria-label={`Select thread: ${thread.title}`}
            tabIndex={0}
            onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), onToggle(thread.id))}
        >
            {/* Background Accent */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FF4500]/10 to-transparent rounded-full -mr-16 -mt-16 blur-3xl transition-opacity duration-500 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

            {/* Content Area - Using tighter p-5 padding */}
            <div className="flex-1 flex flex-col p-5 relative z-10">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col gap-2">
                        {thread.source === 'reddit' ? (
                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5 text-[9px] font-black text-slate-300 uppercase tracking-widest w-fit">
                                <span>{thread.subreddit.toLowerCase().startsWith('r/') ? thread.subreddit : `r/${thread.subreddit}`}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5 text-[9px] font-black text-slate-300 uppercase tracking-widest w-fit">
                                <span>Hacker News</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5">
                        {thread.isBulk && (
                            <button
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-[#FF4500] hover:bg-[#FF4500]/10 transition-all duration-300"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEnrich?.(thread.id, thread.url, thread.source);
                                }}
                                title="Sync Metadata"
                                aria-label="Sync metadata for this bulk thread"
                            >
                                <RefreshCw size={12} />
                            </button>
                        )}
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-300 ${isSelected ? 'bg-gradient-to-br from-[#FF4500] to-[#FF8717] border-transparent text-white shadow-[0_0_12px_rgba(255,69,0,0.5)] scale-110' : 'bg-white/5 border-white/10 text-transparent'}`}>
                            <CheckCircle2 size={12} className={isSelected ? 'opacity-100' : 'opacity-0'} />
                        </div>
                    </div>
                </div>

                <h3 className="text-[15px] font-bold leading-tight text-white/90 line-clamp-3 mb-3 tracking-tight group-hover:text-white transition-colors relative z-10 antialiased font-inter">
                    {thread.title}
                </h3>

                <div className="mt-auto flex flex-col gap-4 relative z-10 w-full">
                    <div className="flex flex-wrap gap-1.5">
                        {thread.isBulk ? (
                            <span className="text-[8px] font-black px-2.5 py-1 rounded-lg bg-white/5 text-slate-400 border border-dashed border-white/10 uppercase tracking-widest flex items-center gap-1.5">
                                <Layers size={10} />
                                Bulk
                            </span>
                        ) : (
                            thread.intentMarkers?.slice(0, 3).map(marker => (
                                <span key={marker} className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border transition-colors ${
                                    marker === 'frustration' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                    marker === 'alternative' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                    marker === 'question' ? 'bg-[#FF4500]/10 text-[#FF8717] border-[#FF4500]/20' :
                                    'bg-white/5 text-slate-400 border-white/10'
                                    }`}>
                                    {marker.replace('_', ' ')}
                                </span>
                            ))
                        )}
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-white/[0.08] min-h-[32px] bg-white/[0.01]">
                        {!thread.isBulk && (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <MessageSquare size={12} className="opacity-60" />
                                    <span>{thread.num_comments.toLocaleString()}</span>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-1 ml-auto">
                            <a
                                href={thread.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-[#FF4500] hover:bg-[#FF4500]/10 transition-all duration-300"
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Open original thread in new tab"
                            >
                                <ExternalLink size={14} />
                            </a>
                        </div>
                    </div>
                </div>
            </div>

        </div >
    );
};
