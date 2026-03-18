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
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo" onClick={handleLogoClick}>
                    <img src="/logo.svg" className="logo-icon" alt="OpinionDeck Logo" style={{ width: '36px', height: '36px' }} />
                    <h1>{BRANDING.NAME}</h1>
                </div>
            </div>

            <nav className="sidebar-nav">
                <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <Search size={18} /> <span className="link-text">Research</span>
                </NavLink>
                <NavLink to="/decks" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <LayoutDashboard size={18} /> <span className="link-text">Decks & Threads</span>
                </NavLink>
                <NavLink to="/reports" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <RefreshCw size={18} /> <span className="link-text">Analytics</span>
                </NavLink>
                <div className="sidebar-divider" style={{
                    height: '1px',
                    background: 'rgba(255,255,255,0.05)',
                    margin: '10px 20px'
                }} />

                <NavLink
                    to="/lab/discovery"
                    className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                >
                    <FlaskConical size={18} /> <span className="link-text">Discovery Lab</span>
                </NavLink>

                <NavLink
                    to="/pricing"
                    className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                    style={{ marginTop: 'auto' }}
                >
                    <Star size={18} color="#FFD700" /> <span className="link-text" style={{ fontWeight: 700, color: '#FFD700' }}>Upgrade to Pro</span>
                </NavLink>
            </nav>

            <div className="sidebar-footer">
                <div className="extension-connection-info-sidebar" style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    marginBottom: '16px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                }}>
                    <div className="label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        Extension Status
                        <button
                            onClick={(e) => { e.preventDefault(); pingExtension(); }}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex' }}
                            title="Refresh connection status"
                        >
                            <RefreshCw size={12} className={extensionConnected === null ? 'animate-spin' : ''} />
                        </button>
                    </div>
                    <div className="value">
                        {extensionConnected === null ? (
                            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Loader2 size={12} className="animate-spin" /> Checking...
                            </span>
                        ) : extensionConnected ? (
                            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></div> Connected
                            </span>
                        ) : (
                            <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }}></div> Not Connected
                            </span>
                        )}
                    </div>
                </div>
                <UsageProgress />
                <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} style={{ padding: '8px 0' }}>
                    <Settings size={18} /> <span className="link-text">Settings</span>
                </NavLink>
                <a href={BRANDING.LANDING_PAGE_URL} className="nav-link" style={{ padding: '8px 0', opacity: 0.7 }}>
                    <Globe size={18} /> <span className="link-text">Back to Home</span>
                </a>
            </div >
        </aside >
    );
};
