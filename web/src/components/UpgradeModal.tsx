import React from 'react';
import { X, Crown, Zap, ShieldCheck, Star } from 'lucide-react';
import './UpgradeModal.css';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const handleUpgrade = (plan: string) => {
        window.location.href = `mailto:hello@opiniondeck.com?subject=Upgrade to ${plan}&body=Hi, I would like to upgrade to the ${plan} plan!`;
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
                    <h2>Upgrade Your Plan</h2>
                    <p className="subtitle">Get more monitors and team collaboration</p>
                </div>

                <div className="upgrade-body">
                    <div className="pricing-card">
                        <div className="badge-founding">STARTER PLAN</div>
                        <div className="price-container">
                            <span className="amount">$19</span>
                            <span className="term">/ month</span>
                        </div>
                        <p className="price-subtext">Perfect for indie founders and makers</p>

                        <div className="features-list">
                            <div className="feature-item">
                                <Zap size={18} className="feature-icon" />
                                <div>
                                    <strong>3 Monitors</strong>
                                    <p>Track up to 3 market niches simultaneously</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <ShieldCheck size={18} className="feature-icon" />
                                <div>
                                    <strong>10 Subreddits per Monitor</strong>
                                    <p>Deep coverage of your market space</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <Star size={18} className="feature-icon" />
                                <div>
                                    <strong>Full Analytics</strong>
                                    <p>Pain points, triggers, and desired outcomes extraction</p>
                                </div>
                            </div>
                        </div>

                        <button
                            className={`upgrade-submit-btn`}
                            onClick={() => handleUpgrade('Starter')}
                        >
                            Upgrade to Starter
                        </button>
                    </div>

                    <div className="pricing-card featured">
                        <div className="badge-founding">PROFESSIONAL PLAN</div>
                        <div className="price-container">
                            <span className="amount">$59</span>
                            <span className="term">/ month</span>
                        </div>
                        <p className="price-subtext">For product and growth teams</p>

                        <div className="features-list">
                            <div className="feature-item">
                                <Zap size={18} className="feature-icon" />
                                <div>
                                    <strong>10 Monitors</strong>
                                    <p>Expand your market research scope</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <ShieldCheck size={18} className="feature-icon" />
                                <div>
                                    <strong>20 Subreddits per Monitor</strong>
                                    <p>Comprehensive market coverage</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <Star size={18} className="feature-icon" />
                                <div>
                                    <strong>3 Team Seats</strong>
                                    <p>Collaborate with your entire team</p>
                                </div>
                            </div>
                        </div>

                        <button
                            className={`upgrade-submit-btn`}
                            onClick={() => handleUpgrade('Professional')}
                        >
                            Upgrade to Professional
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
