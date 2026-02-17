import React from 'react';

interface LoaderProps {
    fullPage?: boolean;
    text?: string;
    size?: 'small' | 'medium' | 'large';
}

export const PremiumLoader: React.FC<LoaderProps> = ({
    fullPage = false,
    text = "Loading...",
    size = 'medium'
}) => {
    const loaderContent = (
        <div className="opinion-deck-loader-container">
            <div className={`spinner-premium ${size === 'small' ? 'spinner-small-premium' : ''}`} />
            {text && <p className="loader-text-premium">{text}</p>}
        </div>
    );

    if (fullPage) {
        return (
            <div className="opinion-deck-loader-overlay">
                {loaderContent}
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            {loaderContent}
        </div>
    );
};

export const ButtonLoader: React.FC = () => (
    <span className="spinner-small-premium" style={{ marginRight: '8px' }} />
);
