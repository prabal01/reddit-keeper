import React from 'react';
import { Sparkles } from 'lucide-react';
import { H2, Metadata } from './Typography';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    showStatus?: boolean;
    statusText?: string;
    icon?: React.ReactNode;
    loading?: boolean;
    actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
    title, 
    subtitle, 
    showStatus = true, 
    statusText = "System Active",
    icon,
    loading = false,
    actions
}) => {
    if (loading) {
        return (
            <div className="flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                <div className="flex flex-col gap-2">
                    <div className="w-48 h-6 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="w-64 h-3 bg-slate-100 dark:bg-slate-900 rounded" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between gap-4 animate-in fade-in slide-in-from-left-4 duration-700">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-linear-to-br from-[#FF4500] to-[#FF8717] rounded-xl flex items-center justify-center shadow-xl shadow-[#FF4500]/20 transform hover:scale-110 transition-transform duration-500">
                    {icon || <Sparkles size={18} className="text-white" />}
                </div>
                <div className="flex flex-col">
                    <H2 className="mb-0">{title}</H2>
                    <div className="flex items-center gap-2 mt-0.5">
                        {subtitle && (
                            <>
                                <Metadata className="opacity-70">{subtitle}</Metadata>
                                {showStatus && <div className="w-1 h-1 rounded-full bg-slate-700 dark:bg-slate-500" />}
                            </>
                        )}
                        {showStatus && (
                            <Metadata className="text-[#FF4500] opacity-90">{statusText}</Metadata>
                        )}
                    </div>
                </div>
            </div>

            {actions && (
                <div className="flex items-center gap-3">
                    {actions}
                </div>
            )}
        </div>
    );
};
