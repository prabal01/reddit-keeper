import React, { useState } from 'react';
import { X, Crown, Check, Zap, ShieldCheck, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createRazorpayOrder } from '../lib/api';
import { loadRazorpay } from '../lib/razorpay';
import './UpgradeModal.css';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose }) => {
    const { user, refreshPlan } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleUpgrade = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await loadRazorpay();
            if (!res) {
                throw new Error("Failed to load Razorpay SDK");
            }

            const order = await createRazorpayOrder();

            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                amount: order.amount,
                currency: order.currency,
                name: "OpinionDeck",
                description: "Founding Access - Lifetime Pro",
                image: "/logo.svg",
                order_id: order.id,
                handler: async function (response: any) {
                    console.log("Payment Success:", response);
                    // Webhook will handle the plan upgrade, but we refresh anyway
                    setTimeout(() => {
                        refreshPlan();
                        onClose();
                    }, 2000);
                },
                prefill: {
                    name: user?.displayName || "",
                    email: user?.email || "",
                },
                theme: {
                    color: "#FF4500",
                },
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.open();
        } catch (err: any) {
            console.error("Upgrade failed:", err);
            setError(err.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay upgrade-modal-overlay" onClick={onClose}>
            <div className="upgrade-modal-content" onClick={e => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}><X size={20} /></button>

                <div className="upgrade-header">
                    <div className="crown-icon-container">
                        <Crown size={32} className="crown-icon" />
                    </div>
                    <h2>Scale Your Intelligence</h2>
                    <p className="subtitle">Join the elite circle of Founding Users</p>
                </div>

                <div className="upgrade-body">
                    <div className="pricing-card">
                        <div className="badge-founding">LIMITED TIME OFFER</div>
                        <div className="price-container">
                            <span className="currency">$</span>
                            <span className="amount">19</span>
                            <span className="term">/ one-time</span>
                        </div>
                        <p className="price-subtext">Lifetime Founding Access. Never pay monthly.</p>

                        <div className="features-list">
                            <div className="feature-item">
                                <Zap size={18} className="feature-icon" />
                                <div>
                                    <strong>Deep-Scan Discovery</strong>
                                    <p>Scan 3x more angles for every search idea.</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <ShieldCheck size={18} className="feature-icon" />
                                <div>
                                    <strong>Unrestricted Analysis</strong>
                                    <p>Unlock all 50+ clusters and PDF exports.</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <Star size={18} className="feature-icon" />
                                <div>
                                    <strong>Priority AI Queue</strong>
                                    <p>Get results 5x faster with dedicated capacity.</p>
                                </div>
                            </div>
                        </div>

                        {error && <div className="error-message">{error}</div>}

                        <button
                            className={`upgrade-submit-btn ${loading ? 'loading' : ''}`}
                            onClick={handleUpgrade}
                            disabled={loading}
                        >
                            {loading ? 'Initializing Checkout...' : 'Claim Founding Access'}
                        </button>
                        <p className="secure-text">Secure payment via Razorpay</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
