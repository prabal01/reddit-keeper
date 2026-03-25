import React, { useState, useEffect } from 'react';
import { Loader2, Sparkles, Database, Search, ShieldCheck, Zap } from 'lucide-react';

export const DiscoveryLoadingState: React.FC = () => {
    const messages = [
        "Searching through Reddit & HN...",
        "Scanning thread titles for relevance...",
        "Analyzing message sentiment...",
        "Rejecting low-quality content...",
        "Synthesizing market painpoints...",
        "Identifying specific user triggers...",
        "Preparing your intelligence briefing..."
    ];

    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % messages.length);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-700">
            {/* Animated Sphere/Orbit Visual */}
            <div className="relative w-32 h-32 mb-12">
                <div className="absolute inset-0 rounded-full border-2 border-[#FF4500]/10 animate-[spin_10s_linear_infinite]" />
                <div className="absolute inset-4 rounded-full border border-white/5 animate-[spin_15s_linear_infinite_reverse]" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                        <Loader2 className="animate-spin text-[#FF4500]" size={48} strokeWidth={1} />
                        <Sparkles className="absolute -top-2 -right-2 text-amber-500 animate-pulse" size={20} />
                    </div>
                </div>
                
                {/* Floating Orbiting Icons */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-black border border-white/10 rounded-lg flex items-center justify-center text-blue-400 shadow-2xl animate-bounce">
                    <Search size={14} />
                </div>
                <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-8 h-8 bg-black border border-white/10 rounded-lg flex items-center justify-center text-purple-400 shadow-2xl">
                    <Database size={14} />
                </div>
                <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-black border border-white/10 rounded-lg flex items-center justify-center text-emerald-400 shadow-2xl">
                    <ShieldCheck size={14} />
                </div>
            </div>

            {/* Dynamic Status Text */}
            <div className="text-center">
                <div className="flex items-center gap-3 justify-center mb-3">
                    <div className="flex -space-x-1">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#FF4500] animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                        ))}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#FF4500]">System Active</span>
                </div>

                <div className="h-8 flex items-center justify-center">
                    <p key={messageIndex} className="text-lg font-black text-white tracking-tight animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {messages[messageIndex]}
                    </p>
                </div>
                
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-4">
                    Our AI is currently scouring the web for your edge
                </p>
            </div>

            {/* Hint Box */}
            <div className="mt-16 flex items-center gap-3 px-6 py-3 bg-white/2 border border-white/5 rounded-2xl max-w-xs">
                <Zap size={14} className="text-[#FF4500]" />
                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                    <span className="text-white font-bold">Pro-tip:</span> Select threads with the most emotional language for better insights.
                </p>
            </div>
        </div>
    );
};
