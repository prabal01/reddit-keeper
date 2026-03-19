import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BRANDING } from '../constants/branding';
import { LayoutDashboard, RefreshCw, Settings, Globe, Search, Loader2, FlaskConical, Star } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { UsageProgress } from './UsageProgress';

export const Sidebar: React.FC = () => {
    const navigate = useNavigate();
    const [extensionConnected, setExtensionConnected] = useState<boolean | null>(null);

    const pingExtension = useCallback(() => {
        setExtensionConnected(null);
        const requestId = "sidebar-ping-" + Math.random().toString(36).substring(7);

        const handlePingResponse = (event: MessageEvent) => {
            if (event.data.type === "OPINION_DECK_PING_RESPONSE" && event.data.id === requestId) {
                setExtensionConnected(true);
                window.removeEventListener('message', handlePingResponse);
            }
        };
        window.addEventListener('message', handlePingResponse);

        window.postMessage({
            type: "OPINION_DECK_PING_REQUEST",
            id: requestId
        }, window.location.origin);

        // If no response in 2s, assume not connected
        const timeout = setTimeout(() => {
            setExtensionConnected(current => current === null ? false : current);
            window.removeEventListener('message', handlePingResponse);
        }, 2000);

        return () => {
            clearTimeout(timeout);
            window.removeEventListener('message', handlePingResponse);
        };
    }, []);

    useEffect(() => {
        return pingExtension();
    }, [pingExtension]);

    const handleLogoClick = () => {
        navigate('/');
    };

    return (
        <aside className="sidebar" style={{ width: '260px', height: '100vh', position: 'sticky', top: 0 }}>
            <div className="sidebar-header" style={{ height: '64px', minHeight: '64px', display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ padding: '8px 32px', width: '100%', display: 'flex', alignItems: 'center' }}>
                    <div 
                        className="sidebar-logo" 
                        onClick={handleLogoClick}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogoClick()}
                        aria-label="Navigate to Home"
                    >
                        <img src="/logo.svg" className="logo-icon" alt={`${BRANDING.NAME} Logo`} style={{ width: '36px', height: '36px' }} />
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{BRANDING.NAME}</h1>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav" style={{ flex: 1, padding: '15px 0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 32px', textDecoration: 'none' }}>
                    <Search size={20} /> <span className="link-text">Research</span>
                </NavLink>
                <NavLink to="/decks" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 32px', textDecoration: 'none' }}>
                    <LayoutDashboard size={20} /> <span className="link-text">Decks & Threads</span>
                </NavLink>
                <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 32px', textDecoration: 'none' }}>
                    <RefreshCw size={20} /> <span className="link-text">Analytics</span>
                </NavLink>
                <div className="sidebar-divider" />

                <NavLink
                    to="/lab/discovery"
                    className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                >
                    <FlaskConical size={20} /> <span className="link-text">Discovery Lab</span>
                </NavLink>

                <NavLink
                    to="/pricing"
                    className={({ isActive }) => isActive ? 'nav-link active premium-link' : 'nav-link premium-link'}
                >
                    <Star size={20} className="premium-star" /> <span className="link-text">Upgrade to Pro</span>
                </NavLink>
            </nav>

            <div className="sidebar-footer">
                <div className="extension-info-card">
                    <div className="info-header">
                        <span className="info-label">Extension Status</span>
                        <button
                            onClick={(e) => { e.preventDefault(); pingExtension(); }}
                            className="btn-icon-sm"
                            title="Refresh connection status"
                            aria-label="Refresh connection status"
                        >
                            <RefreshCw size={14} className={extensionConnected === null ? 'animate-spin' : ''} />
                        </button>
                    </div>
                    <div className="info-value">
                        {extensionConnected === null ? (
                            <span className="status-checking">
                                <Loader2 size={12} className="animate-spin" /> Checking...
                            </span>
                        ) : extensionConnected ? (
                            <span className="status-connected">
                                <div className="status-dot success"></div> Connected
                            </span>
                        ) : (
                            <span className="status-disconnected">
                                <div className="status-dot error"></div> Not Connected
                            </span>
                        )}
                    </div>
                </div>
                <UsageProgress />
                <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 32px', textDecoration: 'none' }}>
                    <Settings size={20} /> <span className="link-text">Settings</span>
                </NavLink>
                <a href={BRANDING.LANDING_PAGE_URL} className="nav-link external" target="_blank" rel="noopener noreferrer">
                    <Globe size={20} /> <span className="link-text">Back to Home</span>
                </a>
            </div>
        </aside >
    );
};
