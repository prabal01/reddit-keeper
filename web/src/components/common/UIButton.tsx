import React from 'react';
import { ButtonLoader } from '../PremiumLoader';

interface UIButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: React.ReactNode;
    fullWidth?: boolean;
}

export const UIButton: React.FC<UIButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    fullWidth = false,
    className = "",
    disabled,
    ...props
}) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 font-black uppercase tracking-widest transition-all duration-300 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";
    
    const variants = {
        primary: "bg-linear-to-br from-[#FF4500] to-[#FF8717] text-white shadow-lg shadow-[#FF4500]/20 hover:shadow-[#FF4500]/40 hover:-translate-y-0.5",
        secondary: "bg-white/5 border border-white/10 text-(--text-secondary) hover:bg-white/10 hover:border-white/20 hover:text-(--text-primary)",
        ghost: "bg-transparent text-(--text-tertiary) hover:bg-white/5 hover:text-(--text-primary)",
        danger: "bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
    };

    const sizes = {
        sm: "px-4 py-2 text-[9px]",
        md: "px-6 py-3 text-[10px]",
        lg: "px-8 py-4 text-[11px]"
    };

    const widthStyle = fullWidth ? "w-full" : "";

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthStyle} ${className}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? <ButtonLoader /> : (
                <>
                    {icon && <span className="shrink-0">{icon}</span>}
                    {children}
                </>
            )}
        </button>
    );
};
