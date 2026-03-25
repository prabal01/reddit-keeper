import React from 'react';
import { X, Crown, Zap, ShieldCheck, Star } from 'lucide-react';
import './UpgradeModal.css';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const handleUpgrade = () => {
        window.location.href = "mailto:hello@opiniondeck.com?subject=Founding Access Request&body=Hi, I would like to request extra discovery credits for the Opinion Deck Beta!";
        onClose();
    };

    return (
        <div className="modal-overlay upgrade-modal-overlay" onClick={onClose}>
            <div className="upgrade-modal-content" onClick={e => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}><X size={20} /></button>

                <div className="upgrade-header">
                    <div className="crown-icon-container">
                        <Crown size={32} className="crown-icon" />
                    </div>
                    <h2>Beta Access & Limits</h2>
                    <p className="subtitle">Opinion Deck is currently in Private Beta</p>
                </div>

                <div className="upgrade-body">
                    <div className="pricing-card">
                        <div className="badge-founding">FREE EXTRA CREDITS</div>
                        <div className="price-container">
                            <span className="amount">BETA</span>
                            <span className="term">/ program</span>
                        </div>
                        <p className="price-subtext">We are rewarding early adopters with extra discovery credits.</p>

                        <div className="features-list">
                            <div className="feature-item">
                                <Zap size={18} className="feature-icon" />
                                <div>
                                    <strong>Deep-Scan Discovery</strong>
                                    <p>Get more scans to find deeper niche insights.</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <ShieldCheck size={18} className="feature-icon" />
                                <div>
                                    <strong>Unrestricted Analysis</strong>
                                    <p>Test all AI report clusters during the beta phase.</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <Star size={18} className="feature-icon" />
                                <div>
                                    <strong>Priority Feedback</strong>
                                    <p>Talk directly to the founders and shape the product.</p>
                                </div>
                            </div>
                        </div>

                        <button
                            className={`upgrade-submit-btn`}
                            onClick={handleUpgrade}
                        >
                            Claim Extra Credits (Email)
                        </button>
                        <p className="secure-text text-slate-400 mt-4">Contact: hello@opiniondeck.com</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
