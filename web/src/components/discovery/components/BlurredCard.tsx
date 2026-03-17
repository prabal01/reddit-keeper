import { Lock, Crown } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import './BlurredCard.css';

export const BlurredCard: React.FC = () => {
    const { openUpgradeModal } = useAuth();
    return (
        <div className="blurred-card">
            <div className="blurred-content">
                <div className="skeleton-line title"></div>
                <div className="skeleton-line meta"></div>
                <div className="skeleton-line body"></div>
            </div>
            <div className="lock-overlay">
                <div className="lock-icon-container">
                    <Lock size={20} className="lock-icon" />
                </div>
                <h3>Founding Access Only</h3>
                <p>Unlock deep-scan results and AI insights</p>
                <button className="upgrade-btn-small" onClick={openUpgradeModal}>
                    <Crown size={14} />
                    Upgrade
                </button>
            </div>
        </div>
    );
};
