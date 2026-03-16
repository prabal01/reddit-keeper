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
            className={`group relative flex flex-col min-h-[160px] h-full overflow-hidden rounded-[18px] border transition-all duration-500 cursor-pointer backdrop-blur-xl ${isSelected
                ? 'border-[#FF4500] bg-[#FF4500]/10 shadow-[0_0_40px_rgba(255,69,0,0.15)] ring-1 ring-[#FF4500]/30'
                : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 hover:translate-y-[-4px] hover:shadow-2xl hover:shadow-black/40'
                } ${thread.isBulk ? 'border-dashed' : ''}`}
            onClick={() => onToggle(thread.id)}
        >
            {/* Background Accent */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FF4500]/10 to-transparent rounded-full -mr-16 -mt-16 blur-3xl transition-opacity duration-500 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

            {/* Safety Wrapper for Padding Integrity - Now using compact p-6 padding */}
            <div className="flex-1 flex flex-col p-6 relative z-10">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col gap-2">
                        {thread.source === 'reddit' ? (
                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5 text-[9px] font-black text-slate-300 uppercase tracking-widest w-fit">
                                <svg viewBox="0 0 24 24" className="w-3 h-3" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="12" fill="#FF4500" />
                                    <path d="M18.9 12.1c0-.8-.7-1.5-1.5-1.5-.4 0-.7.1-1 .4-1.3-.9-3-1.5-4.9-1.6l1.1-5.1 3.5.8c0 .6.5 1.1 1.1 1.1.6 0 1.1-.5 1.1-1.1S17.7 4 17.1 4c-.5 0-.9.3-1.1.7l-3.9-.9c-.2 0-.4.1-.4.3l-1.2 5.5c-1.9 0-3.6.6-4.9 1.6-.3-.3-.6-.4-1-.4-.8 0-1.5.7-1.5 1.5 0 .6.3 1.1.8 1.4-.1.2-.1.5-.1.7 0 2.4 2.8 4.3 6.3 4.3s6.3-1.9 6.3-4.3c0-.2 0-.5-.1-.7.5-.3.8-.8.8-1.4zM9.5 13.5c.6 0 1.1.5 1.1 1.1 0 .6-.5 1.1-1.1 1.1-.6 0-1.1-.5-1.1-1.1 0-.6.5-1.1 1.1-1.1zm5.8 4.1c-1.1 1.1-3.1 1.2-4.1.2 0-.1-.1-.3 0-.4s.3-.1.4 0c.8.8 2.4.8 3.3 0 .1-.1.3-.1.4 0s.1.3 0 .4zm-.4-1.9c-.6 0-1.1-.5-1.1-1.1s.5-1.1 1.1-1.1 1.1.5 1.1 1.1-.5 1.1-1.1 1.1z" fill="white" />
                                </svg>
                                <span>{thread.subreddit.toLowerCase().startsWith('r/') ? thread.subreddit : `r/${thread.subreddit}`}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5 text-[9px] font-black text-slate-300 uppercase tracking-widest w-fit">
                                <svg viewBox="0 0 24 24" className="w-3 h-3" xmlns="http://www.w3.org/2000/svg">
                                    <rect width="24" height="24" fill="#FF6600" rx="4" />
                                    <path d="M7 7h2l3 5 3-5h2l-4 7v6h-2v-6z" fill="white" />
                                </svg>
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
                            >
                                <RefreshCw size={12} />
                            </button>
                        )}
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-300 ${isSelected ? 'bg-gradient-to-br from-[#FF4500] to-[#FF8717] border-transparent text-white shadow-[0_0_12px_rgba(255,69,0,0.5)] scale-110' : 'bg-white/5 border-white/10 text-transparent'}`}>
                            <CheckCircle2 size={12} className={isSelected ? 'opacity-100' : 'opacity-0'} />
                        </div>
                    </div>
                </div>

                <h3 className="text-[17px] font-bold leading-[1.3] text-white/95 line-clamp-3 mb-4 tracking-tight group-hover:text-white transition-colors relative z-10 antialiased font-inter">
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
                                <span key={marker} className={`text-[8px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border transition-colors ${marker === 'frustration' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                                    marker === 'alternative' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                                        marker === 'question' ? 'bg-[#FF4500]/15 text-[#FF8717] border-[#FF4500]/30' :
                                            'bg-white/10 text-slate-300 border-white/10'
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
                            >
                                <ExternalLink size={14} />
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] to-transparent pointer-events-none" />
        </div >
    );
};
