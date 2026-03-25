import { ExternalLink, CheckCircle2, MessageSquare } from 'lucide-react';
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
            className={`group relative flex items-center h-16 overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer backdrop-blur-xl px-6 ${isSelected
                ? 'border-[#FF4500]/40 bg-[#FF4500]/5 shadow-[0_10px_30px_rgba(255,69,0,0.05)]'
                : 'border-white/5 bg-white/1 hover:bg-white/3 hover:border-white/10'
                } ${thread.isBulk ? 'border-dashed opacity-60' : ''}`}
            onClick={() => onToggle(thread.id)}
            role="checkbox"
            aria-checked={isSelected}
            aria-label={`Select thread: ${thread.title}`}
            tabIndex={0}
            onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), onToggle(thread.id))}
        >
            {/* Background Accent */}
            <div className={`absolute top-0 right-0 w-48 h-48 bg-linear-to-br from-[#FF4500]/10 to-transparent rounded-full -mr-24 -mt-24 blur-[80px] transition-opacity duration-700 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

            {/* Content Area - Horizontal Flex */}
            <div className="flex-1 flex items-center justify-between gap-6 relative z-10 w-full overflow-hidden">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Platform/Source Indicator */}
                    <div className="shrink-0">
                        {thread.source === 'reddit' ? (
                            <div className="w-8 h-8 rounded-lg bg-[#FF4500]/10 border border-[#FF4500]/20 flex items-center justify-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#FF4500]" />
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col min-w-0">
                        <h3 className="text-[13px] font-bold text-white/90 truncate tracking-tight group-hover:text-white transition-colors antialiased">
                            {thread.title}
                        </h3>
                        {thread.source === 'reddit' && (
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mt-1 opacity-60">
                                {thread.subreddit.toLowerCase()}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    <div className="hidden md:flex flex-wrap gap-1.5">
                        {thread.isBulk ? (
                            <span className="text-[8px] font-black px-2 py-0.5 rounded bg-white/5 text-slate-500 border border-dashed border-white/10 uppercase tracking-widest">Bulk</span>
                        ) : (
                            thread.intentMarkers?.slice(0, 1).map(marker => (
                                <span key={marker} className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest border transition-colors ${
                                    marker === 'frustration' ? 'bg-red-500/5 text-red-500/40 border-red-500/10' :
                                    marker === 'alternative' ? 'bg-emerald-500/5 text-emerald-500/40 border-emerald-500/10' :
                                    marker === 'question' ? 'bg-[#FF4500]/5 text-[#FF8717]/60 border-[#FF4500]/10' :
                                    'bg-white/5 text-slate-600 border-white/10'
                                    }`}>
                                    {marker.replace('_', ' ')}
                                </span>
                            ))
                        )}
                    </div>

                    {!thread.isBulk && (
                        <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-black text-slate-600 tabular-nums">
                            <MessageSquare size={12} className="opacity-40" />
                            <span>{thread.num_comments}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <a
                            href={thread.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-700 hover:text-white hover:bg-white/5 transition-all"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ExternalLink size={14} />
                        </a>
                        <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all duration-300 ${isSelected ? 'bg-[#FF4500] border-transparent text-white shadow-lg shadow-[#FF4500]/20' : 'bg-white/1 border-white/5 text-transparent'}`}>
                            <CheckCircle2 size={12} className={isSelected ? 'opacity-100' : 'opacity-0'} />
                        </div>
                    </div>
                </div>
            </div>

        </div >
    );
};
