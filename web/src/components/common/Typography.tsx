import React from 'react';

interface TypographyProps {
    children: React.ReactNode;
    className?: string;
    id?: string;
    style?: React.CSSProperties;
}

/**
 * H1: Primary Page Titles
 * Usage: "Global Opportunity Scanner", "Dashboard", etc.
 */
export const H1: React.FC<TypographyProps> = ({ children, className = "", id, style }) => (
    <h1 
        id={id}
        style={style}
        className={`text-[2.25rem] font-black text-(--text-primary) tracking-tight leading-[1.1] ${className}`}
    >
        {children}
    </h1>
);

/**
 * H2: Section Titles or Secondary Headers
 */
export const H2: React.FC<TypographyProps> = ({ children, className = "", id, style }) => (
    <h2 
        id={id}
        style={style}
        className={`text-[1.25rem] font-extrabold text-(--text-primary) tracking-tight leading-tight ${className}`}
    >
        {children}
    </h2>
);

/**
 * Subtitle: Descriptive text under headers
 */
export const Subtitle: React.FC<TypographyProps> = ({ children, className = "", id, style }) => (
    <p 
        id={id}
        style={style}
        className={`text-[1rem] font-medium text-(--text-secondary) leading-relaxed opacity-90 ${className}`}
    >
        {children}
    </p>
);

/**
 * Metadata: Small, secondary labels (uppercase tracked)
 */
export const Metadata: React.FC<TypographyProps> = ({ children, className = "", id, style }) => (
    <span 
        id={id}
        style={style}
        className={`text-[0.7rem] font-black text-(--text-tertiary) uppercase tracking-[0.2em] leading-none ${className}`}
    >
        {children}
    </span>
);

/**
 * Caption: Small descriptive text
 */
export const Caption: React.FC<TypographyProps> = ({ children, className = "", id, style }) => (
    <span 
        id={id}
        style={style}
        className={`text-[0.8rem] font-medium text-(--text-tertiary) leading-normal ${className}`}
    >
        {children}
    </span>
);
