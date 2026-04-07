import React from 'react';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'premium';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    className?: string;
    icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
    neutral: 'bg-slate-500/10 text-slate-500',
    success: 'bg-green-500/10 text-green-400',
    warning: 'bg-amber-500/10 text-amber-400',
    error: 'bg-red-500/10 text-red-400',
    info: 'bg-blue-500/10 text-blue-400',
    premium: 'bg-linear-to-br from-[#FF4500] to-[#FF8717] text-white shadow-xs shadow-[#FF4500]/20',
};

export const Badge: React.FC<BadgeProps> = ({ 
    children, 
    variant = 'neutral', 
    className = "",
    icon 
}) => {
    return (
        <div className={`
            inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full 
            text-[0.65rem] font-black uppercase tracking-[0.08em]
            whitespace-nowrap transition-all duration-300
            ${variantStyles[variant]}
            ${className}
        `}>
            {icon && <span className="shrink-0">{icon}</span>}
            <span>{children}</span>
        </div>
    );
};
