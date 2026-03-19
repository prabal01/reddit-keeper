import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BRANDING } from '../constants/branding';
import { LayoutDashboard, RefreshCw, Settings, Globe, Search, FlaskConical, Star, History, ChevronDown, ChevronRight, X, MessageSquare } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { UsageProgress } from './UsageProgress';
import { useDiscoveryContext } from './discovery/contexts/DiscoveryContext';
import { useFolders } from '../contexts/FolderContext';

export const Sidebar: React.FC = () => {
    const navigate = useNavigate();
    const [extensionConnected, setExtensionConnected] = useState<boolean | null>(null);
    const { folders } = useFolders();
    const { 
        history = [], 
        deleteHistoryItem, 
        historyLoading = false
    } = useDiscoveryContext();
    
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);

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
        <aside className="sidebar" style={{ width: '280px', height: '100vh', position: 'sticky', top: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="sidebar-header" style={{ height: '64px', minHeight: '64px', display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ padding: '0 24px', width: '100%', display: 'flex', alignItems: 'center' }}>
                    <div 
                        className="sidebar-logo" 
                        onClick={handleLogoClick}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogoClick()}
                    >
                        <img src="/logo.svg" className="logo-icon" alt={`${BRANDING.NAME} Logo`} style={{ width: '32px', height: '32px' }} />
                        <h1 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>{BRANDING.NAME}</h1>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Search size={18} /> <span className="link-text">Discovery</span>
                </NavLink>
                
                {/* Discovery History - ChatGPT Style (Only show if history exists) */}
                {history.length > 0 && (
                    <div className="sidebar-section" style={{ marginTop: '12px' }}>
                        <button 
                            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                            style={{ 
                                width: '100%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                padding: '8px 32px',
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(255,255,255,0.4)',
                                cursor: 'pointer',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em'
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <History size={12} />
                                <span>Recent History</span>
                            </div>
                            {isHistoryExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                        
                        {isHistoryExpanded && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginTop: '4px' }}>
                                {historyLoading ? (
                                    <div style={{ padding: '12px 32px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.2)' }}>Loading history...</div>
                                ) : (
                                    history.slice(0, 8).map(entry => (
                                        <div 
                                            key={entry.id} 
                                            className="history-item group"
                                            style={{ 
                                                padding: '8px 32px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                transition: 'all 0.2s',
                                                position: 'relative'
                                            }}
                                            onClick={() => navigate('/', { state: { historyEntry: entry } })}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                                <MessageSquare size={14} style={{ opacity: 0.4 }} />
                                                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {entry.query}
                                                </span>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); deleteHistoryItem(entry.id); }}
                                                className="group-hover:opacity-100 opacity-0 p-1 bg-transparent border-none text-white/30 hover:text-red-400 cursor-pointer transition-all"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="sidebar-divider" style={{ margin: '16px 0', height: '1px', background: 'rgba(255,255,255,0.05)' }} />

                <NavLink to="/decks" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <LayoutDashboard size={18} /> <span className="link-text">Decks</span>
                </NavLink>
                <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <RefreshCw size={18} /> <span className="link-text">Analytics</span>
                </NavLink>

                <NavLink
                    to="/lab/discovery"
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                    <FlaskConical size={18} /> <span className="link-text">Lab</span>
                </NavLink>

                <NavLink
                    to="/pricing"
                    className={({ isActive }) => isActive ? 'nav-link active premium-link' : 'nav-link premium-link'}
                >
                    <Star size={20} className="premium-star" /> <span className="link-text">Upgrade to Pro</span>
                </NavLink>
            </nav>

            <div className="sidebar-footer" style={{ marginTop: 'auto' }}>
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
