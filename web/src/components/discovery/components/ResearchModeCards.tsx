import React from 'react';
import { Sparkles, Users, Link as LinkIcon, ArrowRight } from 'lucide-react';

interface ResearchModeCardsProps {
    onSelect: (mode: 'idea' | 'competitor' | 'bulk') => void;
}

export const ResearchModeCards: React.FC<ResearchModeCardsProps> = ({ onSelect }) => {
    const modes = [
        {
            id: 'idea',
            title: 'Idea Discovery',
            subtitle: 'IDEA TO THREADS',
            description: 'Turn your idea into insights by finding relevant threads discussing your problem space.',
            icon: <Sparkles className="text-[#FF4500]" size={18} />,
            color: 'from-[#FF4500]/20 to-[#FF8717]/10'
        },
        {
            id: 'competitor',
            title: 'Analyze Rivals',
            subtitle: 'COMPETITIVE EDGE',
            description: 'See what people love and hate about your competitors.',
            icon: <Users className="text-blue-400" size={18} />,
            color: 'from-blue-500/20 to-cyan-500/10'
        },
        {
            id: 'bulk',
            title: 'Direct Links',
            subtitle: 'DEEP DIVE',
            description: 'Paste specific links to extract targeted insights.',
            icon: <LinkIcon className="text-purple-400" size={18} />,
            color: 'from-purple-500/20 to-pink-500/10'
        }
    ];

    return (
        <div className="flex flex-row gap-4 mt-12 px-2 w-full max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {modes.map((mode) => (
                <button
                    key={mode.id}
                    onClick={() => onSelect(mode.id as any)}
                    className="group relative flex-1 flex flex-col p-5 rounded-[20px] bg-white/2 border border-white/5 hover:border-[#FF4500]/30 transition-all duration-500 text-left hover:scale-[1.02] hover:-translate-y-1 hover:shadow-2xl overflow-hidden min-h-[180px]"
                >
                    {/* Hover Glow */}
                    <div className={`absolute inset-0 bg-linear-to-br ${mode.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                    
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500 border border-white/5">
                            {mode.icon}
                        </div>
                        
                        <h3 className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30 mb-1.5 group-hover:text-[#FF4500] transition-colors duration-500">
                            {mode.subtitle}
                        </h3>
                        
                        <h2 className="text-base font-black text-white tracking-tight mb-1.5">
                            {mode.title}
                        </h2>
                        
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed mb-4 group-hover:text-slate-300 transition-colors duration-500 line-clamp-3">
                            {mode.description}
                        </p>
                        
                        <div className="mt-auto flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[#FF4500]/60 group-hover:text-[#FF4500] group-hover:translate-x-1 transition-all duration-500">
                            <span>Execute</span>
                            <ArrowRight size={12} />
                        </div>
                    </div>
                </button>
            ))}
        </div>
    );
};
