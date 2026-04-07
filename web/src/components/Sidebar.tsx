import React, { useState } from 'react';
import { useLocation, NavLink, useNavigate } from 'react-router-dom';
import { BRANDING } from '../constants/branding';
import { LayoutDashboard, RefreshCw, Settings, Globe, Search, Star, History as HistoryIcon, ChevronDown, ChevronRight, X, Shield } from 'lucide-react';
import { UsageProgress } from './UsageProgress';
import { useDiscoveryContext } from './discovery/contexts/DiscoveryContext';

import { useAuth } from '../contexts/AuthContext';

export const Sidebar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { 
        history = [], 
        deleteHistoryItem, 
        historyLoading = false
    } = useDiscoveryContext();
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

    const isDiscoveryPage = location.pathname === '/';

    // Remove extension ping for now as it's not being used in this view

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

                <NavLink to="/monitoring" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <div style={{ position: 'relative' }}>
                        <Globe size={18} />
                        <div style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, background: '#ff4500', borderRadius: '50%', border: '2px solid #0f172a' }} />
                    </div>
                    <span className="link-text">Monitoring</span>
                </NavLink>
                
                {/* Discovery History - ChatGPT Style (Only show if history exists and on Discovery page) */}
                {isDiscoveryPage && history.length > 0 && (
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
                                <HistoryIcon size={12} />
                                <span>Recent History</span>
                            </div>
                            {isHistoryExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                        
                        {isHistoryExpanded && (
                            <div 
                                className="custom-scrollbar"
                                style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '1px', 
                                    marginTop: '4px',
                                    maxHeight: '130px',
                                    overflowY: 'auto'
                                }}
                            >
                                {historyLoading ? (
                                    <div style={{ padding: '12px 32px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.2)' }}>Loading history...</div>
                                ) : (
                                    history.map(entry => (
                                        <div 
                                            key={entry.id} 
                                            className="history-item group"
                                            style={{ 
                                                padding: '10px 32px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                position: 'relative'
                                            }}
                                            onClick={() => navigate('/', { state: { historyEntry: entry } })}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#FF4500]/40 group-hover:bg-[#FF4500] transition-colors shadow-[0_0_8px_rgba(255,69,0,0)] group-hover:shadow-[0_0_8px_rgba(255,69,0,0.6)]" />
                                                <span style={{ 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: 600,
                                                    color: 'rgba(255,255,255,0.5)', 
                                                    whiteSpace: 'nowrap', 
                                                    overflow: 'hidden', 
                                                    textOverflow: 'ellipsis',
                                                    transition: 'color 0.3s'
                                                }} className="group-hover:text-white">
                                                    {entry.query}
                                                </span>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); deleteHistoryItem(entry.id); }}
                                                className="group-hover:opacity-100 opacity-0 p-1.5 bg-white/5 hover:bg-red-500/10 border border-white/10 rounded-lg text-white/30 hover:text-red-400 cursor-pointer transition-all scale-75 group-hover:scale-100"
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
                    to="/pricing"
                    className={({ isActive }) => isActive ? 'nav-link active premium-link' : 'nav-link premium-link'}
                >
                    <Star size={20} className="premium-star" /> <span className="link-text">Beta Program</span>
                </NavLink>

                {user && user.email && import.meta.env.VITE_ADMIN_EMAILS?.includes(user.email) && (
                    <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{ marginTop: 'auto' }}>
                        <Shield size={18} color="#ff4500" /> <span className="link-text" style={{ color: '#ff4500', fontWeight: 'bold' }}>Admin</span>
                    </NavLink>
                )}
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
