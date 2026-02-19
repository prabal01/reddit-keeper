import React from 'react';
import './Folders.css';

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    circle?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    width,
    height,
    circle,
    className = '',
    style
}) => {
    const combinedStyle: React.CSSProperties = {
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style
    };

    return (
        <div
            className={`skeleton ${circle ? 'skeleton-circle' : ''} ${className}`}
            style={combinedStyle}
        />
    );
};
