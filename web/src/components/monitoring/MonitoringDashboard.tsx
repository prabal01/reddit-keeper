import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useFolders } from '../../contexts/FolderContext';
import { MonitorCard } from './MonitorCard';
import { Radar, Sparkles, Plus, Link as LinkIcon, Search, Globe, Zap, X, CheckCircle2, MessageSquare, Loader2, AlertCircle } from 'lucide-react';
import { Subtitle } from '../common/Typography';
import { UIButton } from '../common/UIButton';
import { PageHeader } from '../common/PageHeader';
import { Badge } from '../common/Badge';
import './MonitoringDashboard.css';

interface SubredditSuggestion {
    name: string;
    members: string;
    signal: string;
    reason: string;
}

interface SubredditMonitor {
    uid: string;
    monitorId: string;
    name: string;
    websiteContext: string;
    subreddits: string[];
    createdAt: string;
    lastMatchAt: string | null;
}

export const MonitoringDashboard: React.FC = () => {
    const { user, config, openUpgradeModal } = useAuth();
    const { folders, loading: foldersLoading, getFolderAlerts, getFolderPatterns, getFolderLeads, fetchFolders } = useFolders();
    const navigate = useNavigate();

    const [query, setQuery] = useState('');
    const [monitorStats, setMonitorStats] = useState<Record<string, { leads: number; patterns: number; lastScan: string | null }>>({});

    // Propose & Confirm State
    const [confirmStep, setConfirmStep] = useState<'input' | 'proposing' | 'review' | 'starting' | 'success'>('input');
    const [limitError, setLimitError] = useState<string | null>(null);
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const [activeStep, setActiveStep] = useState(0);
    const [showBrowseBanner, setShowBrowseBanner] = useState(false);
    const [proposedContext, setProposedContext] = useState<{
        isUrl: boolean;
        niche: string;
        description: string;
        suggested_keywords: string[];
        target_audience: string;
    } | null>(null);

    // Subreddit state
    const [subredditSuggestions, setSubredditSuggestions] = useState<SubredditSuggestion[]>([]);
    const [selectedSubreddits, setSelectedSubreddits] = useState<string[]>([]);
    const [newSubInput, setNewSubInput] = useState('');
    const [subredditError, setSubredditError] = useState(false);
    const [addingKeyword, setAddingKeyword] = useState(false);
    const [newKeywordInput, setNewKeywordInput] = useState('');

    // Subreddit monitors (separate from folders)
    const [subredditMonitors, setSubredditMonitors] = useState<SubredditMonitor[]>([]);

    // URL Detection
    const isUrl = useMemo(() => {
        const trimmed = query.trim();
        return trimmed.startsWith('http') || trimmed.includes('.com') || trimmed.includes('.io') || trimmed.includes('.ai');
    }, [query]);

    // Filter to only active SEO monitors (folder-based)
    const activeMonitors = useMemo(
        () => folders.filter(f => f.is_monitoring_active),
        [folders]
    );

    // Dynamic deploy summary
    const deploySummary = useMemo(() => {
        const parts: string[] = [];
        if (proposedContext?.suggested_keywords?.length) parts.push(`${proposedContext.suggested_keywords.length} SEO keywords`);
        if (selectedSubreddits.length > 0) parts.push(`${selectedSubreddits.length} subreddit${selectedSubreddits.length > 1 ? 's' : ''}`);
        return parts.length > 0 ? parts.join(' + ') : '';
    }, [selectedSubreddits.length, proposedContext?.suggested_keywords?.length]);

    // Background-friendly timeout — show browse banner after 15s
    useEffect(() => {
        if (confirmStep !== 'proposing') {
            setShowBrowseBanner(false);
            return;
        }
        const timer = setTimeout(() => setShowBrowseBanner(true), 15000);
        return () => clearTimeout(timer);
    }, [confirmStep]);

    // Load stats for each active SEO monitor
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
    }, [activeMonitors.length, user]);

    // Fetch subreddit monitors
    useEffect(() => {
        if (!user) return;
        const fetchSubredditMonitors = async () => {
            try {
                const { getAuth } = await import('firebase/auth');
                const token = await getAuth().currentUser?.getIdToken();
                const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3001/api' : '/api';
                const res = await fetch(`${API_BASE}/monitoring/monitors`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setSubredditMonitors(Array.isArray(data) ? data : []);
                }
            } catch {
                // Non-critical — silently fail
            }
        };
        fetchSubredditMonitors();
    }, [user]);

    const getApiBase = () =>
        window.location.origin.includes('localhost') ? 'http://localhost:3001/api' : '/api';

    const handleGetProposals = async () => {
        const trimmed = query.trim();
        if (!trimmed) return;
        setLimitError(null);
        setLoadingError(null);

        // Pre-check monitor limit before any API call
        if (config && activeMonitors.length >= config.monitorLimit) {
            setLimitError(`You've reached your limit of ${config.monitorLimit} active monitor${config.monitorLimit === 1 ? '' : 's'}.`);
            return;
        }

        setConfirmStep('proposing');
        setCompletedSteps(new Set());
        setActiveStep(0);
        setSubredditSuggestions([]);
        setSelectedSubreddits([]);
        setSubredditError(false);

        try {
            const { getAuth } = await import('firebase/auth');
            const token = await getAuth().currentUser?.getIdToken();
            const API_BASE = getApiBase();
            const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

            // Run both API calls in parallel but track progress independently
            const proposePromise = fetch(`${API_BASE}/discovery/propose`, {
                method: 'POST', headers, body: JSON.stringify({ query: trimmed })
            });
            const suggestPromise = fetch(`${API_BASE}/monitoring/suggestions`, {
                method: 'POST', headers, body: JSON.stringify({ context: trimmed })
            }).catch(() => null);

            // Step 0 completes when propose resolves
            const proposeRes = await proposePromise;
            if (!proposeRes.ok) throw new Error('Failed to analyze your input. Please try again.');
            const proposeData = await proposeRes.json();
            setProposedContext(proposeData);
            setCompletedSteps(prev => new Set([...prev, 0]));
            setActiveStep(1);

            // Step 1 completes when suggestions resolve
            const suggestRes = await suggestPromise;
            if (suggestRes?.ok) {
                const suggestData = await suggestRes.json();
                const suggestions: SubredditSuggestion[] = suggestData.suggestions || [];
                setSubredditSuggestions(suggestions);
                setSelectedSubreddits(suggestions.slice(0, 3).map(s => s.name));
            } else {
                setSubredditError(true);
            }
            setCompletedSteps(prev => new Set([...prev, 1]));

            setConfirmStep('review');
        } catch (err: any) {
            console.error(err);
            setLoadingError(err?.message || 'Something went wrong. Please try again.');
            setConfirmStep('input');
        }
    };

    const handleDeployAgent = async () => {
        if (!proposedContext) return;
        setConfirmStep('starting');
        setLoadingError(null);
        setCompletedSteps(new Set());
        setActiveStep(0);
        try {
            const { getAuth } = await import('firebase/auth');
            const token = await getAuth().currentUser?.getIdToken();
            const API_BASE = getApiBase();
            const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

            const response = await fetch(`${API_BASE}/discovery/start`, {
                method: 'POST', headers,
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

            setCompletedSteps(prev => new Set([...prev, 0]));
            setActiveStep(1);

            // Also create subreddit monitor if subreddits selected (non-critical)
            if (selectedSubreddits.length > 0) {
                await fetch(`${API_BASE}/monitoring/monitors`, {
                    method: 'POST', headers,
                    body: JSON.stringify({
                        name: proposedContext.niche || query.slice(0, 50),
                        websiteContext: proposedContext.description || query,
                        subreddits: selectedSubreddits
                    })
                }).catch(err => console.warn('Subreddit monitor creation failed:', err));
            }
            setCompletedSteps(prev => new Set([...prev, 1]));

            if (data.folderId) {
                setConfirmStep('success');
                await fetchFolders();
                setTimeout(() => {
                    navigate(`/folders/${data.folderId}`);
                }, 2500);
            }
        } catch (err: any) {
            console.error(err);
            setLoadingError(err?.message || 'Failed to deploy monitor. Please try again.');
            setConfirmStep('review');
        }
    };

    const toggleSubreddit = (name: string) => {
        setSelectedSubreddits(prev =>
            prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
        );
    };

    const handleAddSubreddit = (e?: React.FormEvent) => {
        e?.preventDefault();
        const clean = newSubInput.replace(/^r\//, '').trim().toLowerCase();
        if (clean && !selectedSubreddits.includes(clean)) {
            setSelectedSubreddits(prev => [...prev, clean]);
        }
        setNewSubInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleGetProposals();
    };

    const isLoading = confirmStep === 'proposing' || confirmStep === 'starting';
    const hasAnyMonitors = activeMonitors.length > 0 || subredditMonitors.length > 0;

    return (
        <div className="monitoring-dashboard">
            {/* Header */}
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

                {/* Error Messages */}
                {confirmStep === 'input' && (limitError || loadingError) && (
                    <div className="md-limit-error fadeInUp text-center mb-4 flex flex-col items-center gap-2">
                        {loadingError && (
                            <div className="flex items-center gap-2 text-red-400 text-sm">
                                <AlertCircle size={14} />
                                <span>{loadingError}</span>
                            </div>
                        )}
                        {limitError && (
                            <>
                                <span className="text-red-400 text-sm">{limitError}</span>
                                <button
                                    className="text-xs px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
                                    onClick={openUpgradeModal}
                                >
                                    Upgrade plan to add more monitors
                                </button>
                            </>
                        )}
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
                /* Loading State */
                <div className="md-searching-state fadeInUp">
                    <div className="md-searching-progress">
                        <Loader2 size={20} className="md-searching-spinner" />
                        <h3 className="md-searching-title">
                            {confirmStep === 'proposing' ? 'Analyzing your input...' : 'Setting up your monitor...'}
                        </h3>
                    </div>

                    <div className="md-searching-steps">
                        {confirmStep === 'proposing' ? (
                            <>
                                <div className={`md-step ${completedSteps.has(0) ? 'completed' : activeStep === 0 ? 'active' : ''}`}>
                                    <div className="md-step-icon">
                                        {completedSteps.has(0) ? <CheckCircle2 size={16} /> : <Globe size={16} />}
                                    </div>
                                    <div className="md-step-info">
                                        <div className="md-step-name">Scanning URL & extracting context</div>
                                    </div>
                                </div>
                                <div className={`md-step ${completedSteps.has(1) ? 'completed' : activeStep === 1 ? 'active' : ''}`}>
                                    <div className="md-step-icon">
                                        {completedSteps.has(1) ? <CheckCircle2 size={16} /> : <Search size={16} />}
                                    </div>
                                    <div className="md-step-info">
                                        <div className="md-step-name">Finding relevant communities</div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className={`md-step ${completedSteps.has(0) ? 'completed' : activeStep === 0 ? 'active' : ''}`}>
                                    <div className="md-step-icon">
                                        {completedSteps.has(0) ? <CheckCircle2 size={16} /> : <Zap size={16} />}
                                    </div>
                                    <div className="md-step-info">
                                        <div className="md-step-name">Creating monitor</div>
                                    </div>
                                </div>
                                <div className={`md-step ${completedSteps.has(1) ? 'completed' : activeStep === 1 ? 'active' : ''}`}>
                                    <div className="md-step-icon">
                                        {completedSteps.has(1) ? <CheckCircle2 size={16} /> : <Radar size={16} />}
                                    </div>
                                    <div className="md-step-info">
                                        <div className="md-step-name">Deploying agents</div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {showBrowseBanner && (
                        <div className="md-browse-banner fadeInUp">
                            <p>We're finding the best threads for you. Feel free to browse — we'll notify you when ready.</p>
                            <button onClick={() => { setShowBrowseBanner(false); setConfirmStep('input'); }}>
                                Continue browsing
                            </button>
                        </div>
                    )}
                </div>
            ) : confirmStep === 'review' && proposedContext ? (
                /* Review Step */
                <div className="md-review-mission fadeInUp">
                    {loadingError && (
                        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            <AlertCircle size={14} />
                            <span>{loadingError}</span>
                        </div>
                    )}
                    <div className="md-review-card premium-card">
                        <div className="md-review-header">
                            <div className="md-review-badge">Review Mission</div>
                            <h2>Initialize Monitoring Agents</h2>
                            <p>AI has generated a target profile. Refine keywords and select communities to watch.</p>
                        </div>

                        <div className="md-review-field">
                            <label>Target Niche</label>
                            <input
                                value={proposedContext.niche}
                                onChange={(e) => setProposedContext({...proposedContext, niche: e.target.value})}
                                className="md-review-input"
                            />
                        </div>

                        {/* SEO Keywords Section */}
                        <div className="md-review-field">
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <label className="block">SEO Keywords</label>
                                    <p className="text-[11px] text-zinc-500 mt-0.5">We search Google for Reddit posts ranking for these terms</p>
                                </div>
                                <Badge variant="info">SEO Monitor</Badge>
                            </div>
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
                                {addingKeyword ? (
                                    <input
                                        type="text"
                                        className="md-add-kw-input"
                                        placeholder="Type keyword..."
                                        value={newKeywordInput}
                                        onChange={(e) => setNewKeywordInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && newKeywordInput.trim()) {
                                                const kw = newKeywordInput.trim();
                                                if (!proposedContext.suggested_keywords.includes(kw)) {
                                                    setProposedContext({...proposedContext, suggested_keywords: [...proposedContext.suggested_keywords, kw]});
                                                }
                                                setNewKeywordInput('');
                                                setAddingKeyword(false);
                                            } else if (e.key === 'Escape') {
                                                setAddingKeyword(false);
                                                setNewKeywordInput('');
                                            }
                                        }}
                                        onBlur={() => {
                                            if (newKeywordInput.trim()) {
                                                const kw = newKeywordInput.trim();
                                                if (!proposedContext.suggested_keywords.includes(kw)) {
                                                    setProposedContext({...proposedContext, suggested_keywords: [...proposedContext.suggested_keywords, kw]});
                                                }
                                            }
                                            setNewKeywordInput('');
                                            setAddingKeyword(false);
                                        }}
                                        autoFocus
                                    />
                                ) : (
                                    <button className="md-add-kw" onClick={() => setAddingKeyword(true)}>+ Add</button>
                                )}
                            </div>
                        </div>

                        {/* Communities to Watch Section */}
                        <div className="md-review-field">
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <label className="block">Communities to Watch</label>
                                    <p className="text-[11px] text-zinc-500 mt-0.5">We scan these subreddits 24/7 and surface relevant threads</p>
                                </div>
                                <Badge variant="warning">Subreddit Monitor</Badge>
                            </div>

                            {subredditError ? (
                                <p className="text-xs text-zinc-500 italic mb-3">Couldn't load suggestions — add subreddits manually below</p>
                            ) : subredditSuggestions.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                                    {subredditSuggestions.map(s => (
                                        <div
                                            key={s.name}
                                            onClick={() => toggleSubreddit(s.name)}
                                            title={s.reason}
                                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${
                                                selectedSubreddits.includes(s.name)
                                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                                                    <MessageSquare size={13} className={selectedSubreddits.includes(s.name) ? 'text-amber-400' : 'text-zinc-500'} />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold">r/{s.name}</div>
                                                    <div className="text-[10px] opacity-60">{s.members} members · {s.signal} signal</div>
                                                </div>
                                            </div>
                                            <div className={`w-4 h-4 rounded-full border transition-colors ${
                                                selectedSubreddits.includes(s.name)
                                                ? 'bg-amber-500 border-amber-500'
                                                : 'border-zinc-700'
                                            }`} />
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            {/* Manual add */}
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-bold">r/</span>
                                    <input
                                        type="text"
                                        value={newSubInput}
                                        onChange={(e) => setNewSubInput(e.target.value.toLowerCase().replace(/^r\//, ''))}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubreddit())}
                                        placeholder="add-subreddit"
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-7 pr-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 placeholder:text-zinc-600"
                                    />
                                </div>
                                <button
                                    onClick={() => handleAddSubreddit()}
                                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-colors"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>

                            {/* Selected subreddits not in suggestions */}
                            {selectedSubreddits.filter(s => !subredditSuggestions.find(sg => sg.name === s)).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {selectedSubreddits
                                        .filter(s => !subredditSuggestions.find(sg => sg.name === s))
                                        .map(s => (
                                            <div key={s} className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-[10px] text-amber-400 font-bold">
                                                r/{s}
                                                <button onClick={() => toggleSubreddit(s)}>
                                                    <X size={9} />
                                                </button>
                                            </div>
                                        ))
                                    }
                                </div>
                            )}

                            {selectedSubreddits.length === 0 && (
                                <p className="text-[10px] text-zinc-600 mt-2">No subreddits selected — only SEO monitor will be deployed</p>
                            )}
                        </div>

                        <div className="md-review-actions">
                            <button className="btn-secondary" onClick={() => setConfirmStep('input')}>Go Back</button>
                            <div className="md-deploy-wrapper">
                                <button className="md-deploy-btn" onClick={handleDeployAgent}>
                                    <Zap size={16} />
                                    <span>Launch Monitor</span>
                                </button>
                                {deploySummary && (
                                    <p className="md-deploy-summary">{deploySummary}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : confirmStep === 'success' ? (
                /* Success Step */
                <div className="md-success-state fadeInUp">
                    <div className="md-success-icon-wrapper zen-pulse">
                        <CheckCircle2 size={32} />
                    </div>
                    <div className="md-success-content">
                        <h3 className="md-success-title">Mission Launched Successfully</h3>
                        <div className="flex flex-col gap-1 mt-3 text-sm">
                            <p className="text-blue-400">✓ SEO Monitor scanning for "{proposedContext?.niche}"</p>
                            {selectedSubreddits.length > 0 && (
                                <p className="text-amber-400">✓ Watching {selectedSubreddits.map(s => `r/${s}`).join(' · ')}</p>
                            )}
                        </div>
                        <div className="md-redirect-timer mt-3">Redirecting to project folder...</div>
                    </div>
                </div>
            ) : (
                <>
                    {foldersLoading ? (
                        /* Skeleton loading */
                        <section className="md-monitors-section">
                            <div className="md-monitors-grid">
                                {[1, 2].map(i => (
                                    <div key={i} className="w-full p-6 rounded-2xl bg-(--bg-secondary) border border-(--border-light) animate-pulse">
                                        <div className="flex justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-3 w-3 rounded bg-(--border-light)" />
                                                <div className="h-3 w-20 rounded bg-(--border-light)" />
                                            </div>
                                            <div className="flex gap-1.5">
                                                <div className="h-5 w-10 rounded-full bg-(--border-light)" />
                                                <div className="h-5 w-10 rounded-full bg-(--border-light)" />
                                            </div>
                                        </div>
                                        <div className="h-5 w-48 rounded bg-(--border-light) mb-6" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="h-3 w-12 rounded bg-(--border-light) mb-2" />
                                                <div className="h-6 w-8 rounded bg-(--border-light)" />
                                            </div>
                                            <div>
                                                <div className="h-3 w-12 rounded bg-(--border-light) mb-2" />
                                                <div className="h-6 w-8 rounded bg-(--border-light)" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : hasAnyMonitors ? (
                        /* Active Monitors Grid — SEO + Subreddit */
                        <section className="md-monitors-section">
                            <div className="md-monitors-grid">
                                {activeMonitors.map(folder => (
                                    <MonitorCard
                                        key={folder.id}
                                        folder={folder}
                                        leadCount={monitorStats[folder.id]?.leads}
                                        patternCount={monitorStats[folder.id]?.patterns}
                                        lastScanTime={monitorStats[folder.id]?.lastScan}
                                        monitorType="seo"
                                    />
                                ))}
                                {subredditMonitors.map(monitor => (
                                    <MonitorCard
                                        key={monitor.monitorId}
                                        folder={{
                                            id: monitor.monitorId,
                                            uid: monitor.uid,
                                            name: monitor.name,
                                            createdAt: monitor.createdAt,
                                            threadCount: 0,
                                            seed_keywords: monitor.subreddits.map(s => `r/${s}`)
                                        }}
                                        lastScanTime={monitor.lastMatchAt}
                                        monitorType="subreddit"
                                        onCardClick={() => navigate('/leads')}
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
                </>
            )}
        </div>
    );
};
