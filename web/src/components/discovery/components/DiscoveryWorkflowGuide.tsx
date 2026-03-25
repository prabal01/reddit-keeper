import React from 'react';
import { Search, Filter, Cpu, Target, ArrowRight } from 'lucide-react';

export const DiscoveryWorkflowGuide: React.FC = () => {
    const steps = [
        {
            icon: <Search className="text-blue-400" size={20} />,
            title: 'Context Mapping',
            desc: 'Identify relevant discussions for your focus.',
            color: 'bg-blue-500/10 border-blue-500/20'
        },
        {
            icon: <Filter className="text-purple-400" size={20} />,
            title: 'Smart Filter',
            desc: 'Select high-intent threads for analysis.',
            color: 'bg-purple-500/10 border-purple-500/20'
        },
        {
            icon: <Cpu className="text-amber-400" size={20} />,
            title: 'AI Extraction',
            desc: 'OpinionDeck processes content for intelligence.',
            color: 'bg-amber-500/10 border-amber-500/20'
        },
        {
            icon: <Target className="text-[#FF4500]" size={20} />,
            title: 'Market Edge',
            desc: 'Uncover core pain points and hidden gaps.',
            color: 'bg-[#FF4500]/10 border-[#FF4500]/20'
        }
    ];

    return (
        <div className="mt-20 max-w-5xl mx-auto px-4 animate-in fade-in slide-in-from-top-12 duration-1000">
            <div className="flex items-center gap-4 mb-10 justify-center">
                <div className="h-px flex-1 bg-linear-to-r from-transparent to-white/10" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 whitespace-nowrap">How it works</h3>
                <div className="h-px flex-1 bg-linear-to-l from-transparent to-white/10" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                {steps.map((step, index) => (
                    <React.Fragment key={index}>
                        <div className="group relative flex flex-col items-center text-center p-6 rounded-[24px] bg-white/2 border border-white/5 hover:border-white/10 transition-all duration-500">
                            <div className={`w-12 h-12 rounded-xl ${step.color} border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500`}>
                                {step.icon}
                            </div>
                            <h4 className="text-[11px] font-black text-white uppercase tracking-wider mb-2">{step.title}</h4>
                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{step.desc}</p>
                            
                            {/* Step Number Badge */}
                            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black border border-white/10 flex items-center justify-center text-[8px] font-black text-white/40 group-hover:text-[#FF4500] group-hover:border-[#FF4500]/30 transition-colors">
                                0{index + 1}
                            </div>
                        </div>
                        {index < steps.length - 1 && (
                            <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 items-center justify-center text-white/5 pointer-events-none" style={{ left: `${(index + 1) * 25}%`, width: '0' }}>
                                <ArrowRight size={24} className="-ml-3" />
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};
