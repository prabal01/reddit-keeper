import React from 'react';

interface ExtensionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ExtensionModal: React.FC<ExtensionModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="opinion-deck-loader-overlay" style={{ backdropFilter: 'blur(12px)', zIndex: 10001 }}>
            <div className="glass-card" style={{
                maxWidth: '450px',
                width: '90%',
                padding: '2.5rem',
                textAlign: 'center',
                animation: 'fadeIn 0.4s ease-out'
            }}>
                <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>🔌</div>
                <h2 style={{ marginBottom: '1rem', background: 'var(--bg-accent)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800 }}>
                    Unlock Instant Research
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
                    To keep your extractions <strong>Free</strong> and <strong>Private</strong>, this lab uses your browser as the data engine. You'll need our mini extension to bridge the gap.
                </p>

                <div style={{ textAlign: 'left', marginBottom: '2rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
                    <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>⚡</span> <span><strong>Instant bypass</strong> of server wait times.</span>
                    </div>
                    <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🔒</span> <span><strong>Zero-Knowledge</strong> extraction context.</span>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <button
                        className="btn-primary"
                        onClick={() => window.open('https://github.com/prabalsaxena/reddit-downloader', '_blank')}
                        style={{ padding: '1rem', fontSize: '1rem' }}
                    >
                        Install Extension →
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', fontSize: '0.85rem' }}
                    >
                        Maybe later
                    </button>
                </div>
            </div>
        </div>
    );
};
