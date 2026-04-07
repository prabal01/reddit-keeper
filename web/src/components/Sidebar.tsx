import React, { useState } from 'react';
import { useLocation, NavLink, useNavigate } from 'react-router-dom';
import { BRANDING } from '../constants/branding';
import { Globe, Search, Star, History as HistoryIcon, ChevronDown, ChevronRight, X, Shield, Settings } from 'lucide-react';
import { UsageProgress } from './UsageProgress';
import { useDiscoveryContext } from './discovery/contexts/DiscoveryContext';
import { H1, Metadata } from './common/Typography';
import { useAuth } from '../contexts/AuthContext';
import "./Sidebar.css";

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

    const isDiscoveryPage = location.pathname === '/discovery';

    const handleLogoClick = () => {
        navigate('/');
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="w-full flex items-center">
                    <div 
                        className="sidebar-logo" 
                        onClick={handleLogoClick}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogoClick()}
                    >
                        <img src="/logo.svg" className="logo-icon h-8 w-8" alt={`${BRANDING.NAME} Logo`} />
                        <H1 className="text-[1.1rem]! m-0">{BRANDING.NAME}</H1>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                    <div className="relative">
                        <Globe size={18} />
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border-2 border-(--sidebar-bg)" />
                    </div>
                    <span className="link-text">Monitoring</span>
                </NavLink>

                {/* Discovery and Decks hidden for MVP - uncomment to show */}
                {/*
                <NavLink to="/discovery" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Search size={18} /> <span className="link-text">Discovery</span>
                </NavLink>

                {isDiscoveryPage && history.length > 0 && (
                    <div className="sidebar-section">
                        <button
                            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                            className="history-toggle-btn"
                        >
                            <div className="flex items-center gap-2">
                                <HistoryIcon size={12} />
                                <Metadata className="text-inherit!">Recent History</Metadata>
                            </div>
                            {isHistoryExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>

                        {isHistoryExpanded && (
                            <div className="history-list-container custom-scrollbar">
                                {historyLoading ? (
                                    <div className="px-8 py-3 text-[0.8rem] text-(--sidebar-text) opacity-40">Loading history...</div>
                                ) : (
                                    history.map(entry => (
                                        <div
                                            key={entry.id}
                                            className="history-item group"
                                            onClick={() => navigate('/', { state: { historyEntry: entry } })}
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="history-item-dot" />
                                                <span className="history-item-text">
                                                    {entry.query}
                                                </span>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteHistoryItem(entry.id); }}
                                                className="history-delete-btn"
                                                aria-label="Delete history path"
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

                <div className="sidebar-divider" />

                <NavLink to="/decks" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Search size={18} /> <span className="link-text">Decks</span>
                </NavLink>
                */}

                <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Globe size={18} /> <span className="link-text">Reports</span>
                </NavLink>

                <NavLink
                    to="/pricing"
                    className={({ isActive }) => isActive ? 'nav-link active premium-link' : 'nav-link premium-link'}
                >
                    <Star size={20} className="premium-star" /> <span className="link-text">Beta Program</span>
                </NavLink>

                {user && user.email && import.meta.env.VITE_ADMIN_EMAILS?.includes(user.email) && (
                    <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{ marginTop: 'auto' }}>
                        <Shield size={18} /> <span className="link-text font-bold!">Admin</span>
                    </NavLink>
                )}
            </nav>

            <div className="sidebar-footer">
                <UsageProgress />
                <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Settings size={20} /> <span className="link-text">Settings</span>
                </NavLink>
                <a href={BRANDING.LANDING_PAGE_URL} className="nav-link external" target="_blank" rel="noopener noreferrer">
                    <Globe size={20} /> <span className="link-text">Back to Home</span>
                </a>
            </div>
        </aside >
    );
};
