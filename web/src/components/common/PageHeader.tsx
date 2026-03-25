import React from 'react';
import { Sparkles } from 'lucide-react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    showStatus?: boolean;
    statusText?: string;
    icon?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
    title, 
    subtitle, 
    showStatus = true, 
    statusText = "System Active",
    icon 
}) => {
    return (
        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-4 duration-700">
            <div className="w-9 h-9 bg-linear-to-br from-[#FF4500] to-[#FF8717] rounded-xl flex items-center justify-center shadow-xl shadow-[#FF4500]/20 transform hover:scale-110 transition-transform duration-500">
                {icon || <Sparkles size={18} className="text-white" />}
            </div>
            <div className="flex flex-col">
                <h2 className="text-base font-black text-white tracking-widest uppercase leading-none mb-1 pt-0.5">{title}</h2>
                <div className="flex items-center gap-2">
                    {subtitle && (
                        <>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] leading-none opacity-60">{subtitle}</span>
                            {showStatus && <div className="w-1 h-1 rounded-full bg-slate-700" />}
                        </>
                    )}
                    {showStatus && (
                        <span className="text-[9px] font-black text-[#FF4500]/70 uppercase tracking-[0.3em] leading-none">{statusText}</span>
                    )}
                </div>
            </div>
        </div>
    );
};
