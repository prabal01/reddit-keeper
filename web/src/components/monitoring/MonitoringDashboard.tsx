import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useFolders } from '../../contexts/FolderContext';
import { MonitorCard } from './MonitorCard';
import { Radar, Sparkles, Plus, Link as LinkIcon, Search, Globe, Zap, X, CheckCircle2 } from 'lucide-react';
import { H1, H2, Subtitle, Metadata } from '../common/Typography';
import { UIButton } from '../common/UIButton';
import { PageHeader } from '../common/PageHeader';
import { Badge } from '../common/Badge';
import './MonitoringDashboard.css';

export const MonitoringDashboard: React.FC = () => {
    const { user, config, openUpgradeModal } = useAuth();
    const { folders, loading: foldersLoading, getFolderAlerts, getFolderPatterns, getFolderLeads, fetchFolders } = useFolders();
    const navigate = useNavigate();

    const [query, setQuery] = useState('');
    const [monitorStats, setMonitorStats] = useState<Record<string, { leads: number; patterns: number; lastScan: string | null }>>({});
    const [searchingStep, setSearchingStep] = useState(0);

    // Propose & Confirm State
    const [confirmStep, setConfirmStep] = useState<'input' | 'proposing' | 'review' | 'starting' | 'success'>('input');
    const [limitError, setLimitError] = useState<string | null>(null);
    const [proposedContext, setProposedContext] = useState<{
        isUrl: boolean;
        niche: string;
        description: string;
        suggested_keywords: string[];
        target_audience: string;
    } | null>(null);

    // URL Detection
    const isUrl = useMemo(() => {
        const trimmed = query.trim();
        return trimmed.startsWith('http') || trimmed.includes('.com') || trimmed.includes('.io') || trimmed.includes('.ai');
    }, [query]);

    // Filter to only active monitors
    const activeMonitors = useMemo(
        () => folders.filter(f => f.is_monitoring_active),
        [folders]
    );

    // Cycle through searching steps during loading
    useEffect(() => {
        if (confirmStep !== 'proposing' && confirmStep !== 'starting') {
            setSearchingStep(0);
            return;
        }

        const interval = setInterval(() => {
            setSearchingStep(s => (s + 1) % 3);
        }, 3000);

        return () => clearInterval(interval);
    }, [confirmStep]);

    // Load stats for each active monitor
    useEffect(() => {
        if (activeMonitors.length === 0) return;

        const loadStats = async () => {
            const stats: typeof monitorStats = {};
            await Promise.all(
                activeMonitors.map(async (folder) => {
                    try {
                        const [leads, patterns, alerts] = await Promise.all([
                            getFolderLeads(folder.id),
                            getFolderPatterns(folder.id),
                            getFolderAlerts(folder.id)
                        ]);
                        const latestAlert = alerts?.[0];
                        stats[folder.id] = {
                            leads: leads?.length || 0,
                            patterns: patterns?.length || 0,
                            lastScan: latestAlert?.timestamp || null
                        };
                    } catch {
                        stats[folder.id] = { leads: 0, patterns: 0, lastScan: null };
                    }
                })
            );
            setMonitorStats(stats);
        };

        loadStats();
    }, [activeMonitors.length]);

    const handleGetProposals = async () => {
        const trimmed = query.trim();
        if (!trimmed) return;
        setLimitError(null);

        // Pre-check monitor limit before any API call
        if (config && activeMonitors.length >= config.monitorLimit) {
            setLimitError(`You've reached your limit of ${config.monitorLimit} active monitor${config.monitorLimit === 1 ? '' : 's'}.`);
            return;
        }

        setConfirmStep('proposing');
        
        try {
            const { getAuth } = await import('firebase/auth');
            const token = await getAuth().currentUser?.getIdToken();
            const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3001/api' : '/api';

            const response = await fetch(`${API_BASE}/discovery/propose`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ query: trimmed })
            });

            if (!response.ok) throw new Error('Failed to fetch proposals');
            const data = await response.json();
            setProposedContext(data);
            setConfirmStep('review');
        } catch (err) {
            console.error(err);
            setConfirmStep('input');
        }
    };

    const handleDeployAgent = async () => {
        if (!proposedContext) return;
        setConfirmStep('starting');
        try {
            const { getAuth } = await import('firebase/auth');
            const token = await getAuth().currentUser?.getIdToken();
            const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3001/api' : '/api';

            const response = await fetch(`${API_BASE}/discovery/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    query,
                    niche: proposedContext.niche,
                    suggested_keywords: proposedContext.suggested_keywords
                })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                if (data.code === 'MONITOR_LIMIT_REACHED') {
                    setLimitError(data.error);
                    setConfirmStep('input');
                    return;
                }
                throw new Error('Failed to start monitor');
            }
            const data = await response.json();
            
            if (data.folderId) {
                setConfirmStep('success');
                // Refresh folders so FolderDetail can find the new folder immediately
                await fetchFolders();
                // Give the user a moment of 'Zen' before redirecting
                setTimeout(() => {
                    navigate(`/folders/${data.folderId}`);
                }, 2500);
            }
        } catch (err) {
            console.error(err);
            setConfirmStep('review');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleGetProposals();
    };

    const isLoading = confirmStep === 'proposing' || confirmStep === 'starting';

    return (
        <div className="monitoring-dashboard">
            {/* Standardized Header Navigation Area */}
            <div className="md-hero-header">
                <PageHeader 
                    title={user?.displayName ? `${user.displayName}'s Intelligence Hub` : 'Global Opportunity Scanner'}
                    subtitle="OpinionDeck Monitoring Agent v2.0"
                    icon={<Radar size={18} className="text-white" />}
                />
            </div>

            <section className="md-hero mt-8">
                <Subtitle className="md-hero-subtitle text-center max-w-2xl mx-auto mb-12">
                    Drop a URL or product idea to deploy high-velocity AI agents across Reddit & HN.
                </Subtitle>

                {/* Main Input Bar */}
                {limitError && confirmStep === 'input' && (
                    <div className="md-limit-error fadeInUp text-center mb-4 flex flex-col items-center gap-2">
                        <span className="text-red-400 text-sm">{limitError}</span>
                        <button
                            className="text-xs px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
                            onClick={openUpgradeModal}
                        >
                            Upgrade plan to add more monitors
                        </button>
                    </div>
                )}
                {confirmStep === 'input' && (
                    <div className="md-input-bar fadeInUp">
                        <div className="md-input-wrapper">
                            {isUrl ? (
                                <LinkIcon size={18} className="md-input-icon text-blue-400" />
                            ) : (
                                <Sparkles size={18} className="md-input-icon" />
                            )}
                            <input
                                type="text"
                                className="md-input border-none!"
                                placeholder={isUrl ? "Analyze this website context..." : "Enter product, niche, or website URL..."}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                                autoFocus
                            />
                            <UIButton
                                className="md-start-btn"
                                onClick={handleGetProposals}
                                disabled={isLoading || !query.trim()}
                                icon={<Plus size={16} />}
                            >
                                Start Intelligence
                            </UIButton>
                        </div>
                    </div>
                )}
            </section>

            {isLoading ? (
                /* Searching State (RedShip Style) */
                <div className="md-searching-state fadeInUp">
                    <div className="md-searching-icon-wrapper">
                        <Radar size={24} />
                    </div>
                    <h3 className="md-searching-title">
                        {confirmStep === 'proposing' ? 'Extracting Market Context...' : 'Deploying Your Agent...'}
                    </h3>
                    
                    <div className="md-searching-steps">
                        <div className={`md-step ${searchingStep === 0 ? 'active' : ''}`}>
                            <div className="md-step-icon"><Globe size={16} /></div>
                            <div className="md-step-info">
                                <div className="md-step-name">Analyzing Source</div>
                                <div className="md-step-desc">Parsing context from {query}...</div>
                            </div>
                        </div>

                        <div className={`md-step ${searchingStep === 1 ? 'active' : ''}`}>
                            <div className="md-step-icon"><Search size={16} /></div>
                            <div className="md-step-info">
                                <div className="md-step-name">Mapping Communities</div>
                                <div className="md-step-desc">Identifying high-signal subreddits...</div>
                            </div>
                        </div>

                        <div className={`md-step ${searchingStep === 2 ? 'active' : ''}`}>
                            <div className="md-step-icon"><Zap size={16} /></div>
                            <div className="md-step-info">
                                <div className="md-step-name">Global Matching</div>
                                <div className="md-step-desc">Connecting niche to real-time opportunities...</div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : confirmStep === 'review' && proposedContext ? (
                /* Review Mission Step (NEW) */
                <div className="md-review-mission fadeInUp">
                    <div className="md-review-card premium-card">
                        <div className="md-review-header">
                            <div className="md-review-badge">Review Mission</div>
                            <h2>Initialize Monitoring Agent</h2>
                            <p>AI has generated a target profile based on your query. Refine it below to focus your search.</p>
                        </div>

                        <div className="md-review-field">
                            <label>Target Niche</label>
                            <input
                                value={proposedContext.niche}
                                onChange={(e) => setProposedContext({...proposedContext, niche: e.target.value})}
                                className="md-review-input"
                            />
                        </div>

                        <div className="md-review-field">
                            <label>Seed Keywords & Indicators</label>
                            <div className="md-keyword-grid">
                                {proposedContext.suggested_keywords.map((kw, i) => (
                                    <div key={i} className="md-keyword-pill">
                                        <span>{kw}</span>
                                        <button onClick={() => {
                                            const updated = proposedContext.suggested_keywords.filter((_, idx) => idx !== i);
                                            setProposedContext({...proposedContext, suggested_keywords: updated});
                                        }}><X size={12} /></button>
                                    </div>
                                ))}
                                <button className="md-add-kw" onClick={() => {
                                    const nextKw = prompt("Add new search keyword:");
                                    if (nextKw) setProposedContext({...proposedContext, suggested_keywords: [...proposedContext.suggested_keywords, nextKw]});
                                }}>+ Add</button>
                            </div>
                        </div>

                        <div className="md-review-actions">
                            <button className="btn-secondary" onClick={() => setConfirmStep('input')}>Go Back</button>
                            <button className="md-deploy-btn" onClick={handleDeployAgent}>
                                <Zap size={16} />
                                <span>Deploy Agent</span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : confirmStep === 'success' ? (
                /* Zen Success Step (NEW) */
                <div className="md-success-state fadeInUp">
                    <div className="md-success-icon-wrapper zen-pulse">
                        <CheckCircle2 size={32} />
                    </div>
                    <div className="md-success-content">
                        <h3 className="md-success-title">Mission Launched Successfully</h3>
                        <p className="md-success-text">
                            Your monitoring agent is now active in the background. 
                            We are currently seeding your research folder with the first batch of results.
                        </p>
                        <div className="md-redirect-timer">Redirecting to project folder...</div>
                    </div>
                </div>
            ) : foldersLoading ? (
                /* Loading state — prevents empty flash on first load */
                <section className="md-monitors-section">
                    <div className="md-monitors-grid">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="w-full p-6 rounded-2xl bg-(--bg-secondary) border border-(--border-light) animate-pulse">
                                <div className="flex justify-between mb-6">
                                    <div className="h-3 w-24 rounded bg-(--border-light)" />
                                    <div className="h-5 w-10 rounded-full bg-(--border-light)" />
                                </div>
                                <div className="h-5 w-40 rounded bg-(--border-light) mb-6" />
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="h-8 rounded bg-(--border-light)" />
                                    <div className="h-8 rounded bg-(--border-light)" />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ) : activeMonitors.length > 0 ? (
                /* Active Monitors Grid */
                <section className="md-monitors-section">
                    <div className="md-section-header flex items-center justify-between mb-8">
                        <H2 className="md-section-title mb-0">Active Intelligence Monitors</H2>
                        <Badge variant="premium">{activeMonitors.length} RUNNING</Badge>
                    </div>
                    <div className="md-monitors-grid">
                        {activeMonitors.map(folder => (
                            <MonitorCard
                                key={folder.id}
                                folder={folder}
                                leadCount={monitorStats[folder.id]?.leads}
                                patternCount={monitorStats[folder.id]?.patterns}
                                lastScanTime={monitorStats[folder.id]?.lastScan}
                            />
                        ))}
                    </div>
                </section>
            ) : (
                /* Empty State */
                <section className="md-empty-state">
                    <div className="md-empty-icon mx-auto mb-6">
                        <Search size={32} />
                    </div>
                    <h3 className="md-empty-title">No active monitors</h3>
                    <p className="md-empty-desc mx-auto">
                        Deploy your first agent to start scanning Reddit.
                    </p>
                </section>
            )}
        </div>
    );
};
