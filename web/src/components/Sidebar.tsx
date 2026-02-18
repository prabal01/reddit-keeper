import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BRANDING } from '../constants/branding';
import { LayoutDashboard, Folder, RefreshCw, Settings, Globe } from 'lucide-react';

export const Sidebar: React.FC = () => {
    const { plan, userStats } = useAuth();
    const navigate = useNavigate();

    const handleLogoClick = () => {
        navigate('/');
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo" onClick={handleLogoClick}>
                    <img src="/logo.svg" className="logo-icon" alt="OpinionDeck Logo" style={{ width: '36px', height: '36px' }} />
                    <h1>{BRANDING.NAME}</h1>
                </div>
            </div>

            <nav className="sidebar-nav">
                <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <LayoutDashboard size={18} /> <span className="link-text">Dashboard</span>
                </NavLink>
                <NavLink to="/folders" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <Folder size={18} /> <span className="link-text">Folders</span>
                </NavLink>
                <NavLink to="/reports" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <RefreshCw size={18} /> <span className="link-text">AI Reports</span>
                </NavLink>
            </nav>

            <div className="sidebar-footer">
                <div className="credit-badge-sidebar">
                    <div className="label">Opinion Credits</div>
                    <div className="value">
                        {plan === 'pro'
                            ? `${Math.max(0, 50 - (userStats?.reportsGenerated || 0))} / 50`
                            : `${Math.max(0, 5 - (userStats?.reportsGenerated || 0))} / 5`}
                    </div>
                </div>
                <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} style={{ padding: '8px 0' }}>
                    <Settings size={18} /> <span className="link-text">Settings</span>
                </NavLink>
                <a href={BRANDING.LANDING_PAGE_URL} className="nav-link" style={{ padding: '8px 0', opacity: 0.7 }}>
                    <Globe size={18} /> <span className="link-text">Back to Home</span>
                </a>
            </div>
        </aside>
    );
};
