
import React, { useState, useEffect, useCallback } from 'react';
import { useFolders } from '../contexts/FolderContext';
import { Search, Info, Check, ArrowRight, Loader2, MessageSquare, ThumbsUp, ExternalLink } from 'lucide-react';
import './ResearchView.css';

interface DiscoveryResult {
    id: string;
    title: string;
    url: string;
    subreddit: string;
    ups: number;
    num_comments: number;
    score: number;
    isCached?: boolean;
}

interface DiscoveryPlan {
    scannedCount: number;
    totalFound: number;
    cachedCount: number;
    newCount: number;
    estimatedSyncTime: number;
    isFromCache?: boolean;
    recommendedPath?: string[];
}

export const ResearchView: React.FC = () => {
    const { folders, createFolder, syncThreads } = useFolders();
    const [competitor, setCompetitor] = useState('');
    const [results, setResults] = useState<DiscoveryResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [targetFolderId, setTargetFolderId] = useState('');
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [extensionConnected, setExtensionConnected] = useState<boolean | null>(null);
    const [loadingSteps, setLoadingSteps] = useState<{ id: string; label: string; status: 'pending' | 'loading' | 'complete' | 'error' }[]>([]);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isSearchingStarted, setIsSearchingStarted] = useState(false);
    const [deepDiscovery, setDeepDiscovery] = useState(true);
    const [discoveryPlan, setDiscoveryPlan] = useState<DiscoveryPlan | null>(null);

    // Debug mode check from URL params
    const searchParams = new URLSearchParams(window.location.search);
    const isDebugMode = searchParams.get('debug') === 'true';

    // Ping extension on mount
    useEffect(() => {
        const pingExtension = () => {
            const requestId = "ping-" + Math.random().toString(36).substring(7);

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

            // If no response in 3s, assume not connected
            setTimeout(() => {
                setExtensionConnected(current => {
                    if (current === null) return false;
                    return current;
                });
                window.removeEventListener('message', handlePingResponse);
            }, 3000);
        };

        pingExtension();
    }, []);

    // Auto-select first folder
    useEffect(() => {
        if (folders.length > 0 && !targetFolderId) {
            setTargetFolderId(folders[0].id);
        }
    }, [folders, targetFolderId]);

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            const folder = await createFolder(newFolderName.trim());
            setTargetFolderId(folder.id);
            setNewFolderName('');
            setIsCreatingFolder(false);
        } catch (err: any) {
            console.error("Failed to create folder:", err);
            setStatus("Error: " + err.message);
        }
    };

    const handleSearch = useCallback(async () => {
        if (!competitor.trim()) return;

        setIsSearchingStarted(true);
        setLoading(true);
        setResults([]);
        setDiscoveryPlan(null);
        setSelectedIds(new Set());
        setStatus(null);

        // MODE: We can choose based on user plan or toggle in the future
        // For now, we prefer backend as per implementation plan, but keep extension code as fallback
        const usePluginDiscovery = false; // Set to true to use extension logic

        const steps = usePluginDiscovery ? [
            { id: 'ext', label: 'Checking extension connectivity', status: 'loading' as const },
            { id: 'query', label: 'Generating surgical search queries', status: 'pending' as const },
            { id: 'pains', label: 'Scanning competitor pain points', status: 'pending' as const },
            { id: 'alts', label: 'Scouting brand alternatives', status: 'pending' as const },
            { id: 'niche', label: 'Processing niche brand mentions', status: 'pending' as const },
            { id: 'rank', label: 'Ranking by intent and relevance', status: 'pending' as const },
            { id: 'filter', label: 'Filtering noise & promotional signal', status: 'pending' as const },
            { id: 'weights', label: 'Calibrating relevance weights', status: 'pending' as const },
            { id: 'dashboard', label: 'Preparing intelligence dashboard', status: 'pending' as const }
        ] : [
            { id: 'connect', label: 'Connecting to discovery engine', status: 'loading' as const },
            { id: 'api_check', label: deepDiscovery ? 'Initializing Deep Search Queue' : 'Verifying Google indices', status: 'pending' as const },
            { id: 'fetch', label: deepDiscovery ? 'Searching Reddit communities' : 'Scanning competitor mentions', status: 'pending' as const },
            { id: 'enrich', label: 'Enriching with engagement metadata', status: 'pending' as const },
            { id: 'rank', label: 'Ranking by intent and relevance', status: 'pending' as const },
            { id: 'final', label: 'Preparing intelligence dashboard', status: 'pending' as const }
        ];
        setLoadingSteps(steps);

        if (usePluginDiscovery) {
            // RESTORED PLUGIN CODE
            if (extensionConnected === false) {
                setTimeout(() => {
                    setLoadingSteps(prev => prev.map(s => s.id === 'ext' ? { ...s, status: 'error', label: 'Extension not detected' } : s));
                    setStatus("Please install or enable the extension to perform discovery.");
                }, 800);
                return;
            }

            const requestId = Math.random().toString(36).substring(7);

            const handleProgress = (event: MessageEvent) => {
                if (event.data.type === "OPINION_DECK_DISCOVERY_PROGRESS") {
                    const { stepId, results: finalResults } = event.data;
                    if (stepId === 'results_ready' && finalResults) {
                        setResults(finalResults);
                        setLoadingSteps(prev => prev.map(s => ({ ...s, status: 'complete' as const })));
                        if (finalResults.length === 0) setStatus("No relevant threads found. Try a different name.");
                        setTimeout(() => setLoading(false), 800);
                        return;
                    }
                    setLoadingSteps(prev => {
                        const stepIndex = prev.findIndex(s => s.id === stepId);
                        if (stepIndex === -1) return prev;
                        return prev.map((s, idx) => {
                            if (idx < stepIndex) return { ...s, status: 'complete' as const };
                            if (idx === stepIndex) return { ...s, status: 'loading' as const };
                            return s;
                        });
                    });
                }
            };

            const handleMessage = (event: MessageEvent) => {
                if (event.data.type === "OPINION_DECK_DISCOVERY_RESPONSE" && event.data.id === requestId) {
                    if (event.data.success) {
                        if (event.data.sidepanel) {
                            setLoadingSteps(prev => prev.map(s => s.id === 'ext' ? { ...s, status: 'complete' } : s.id === 'query' ? { ...s, status: 'loading' } : s));
                            return;
                        }
                        setLoadingSteps(prev => prev.map(s => ({ ...s, status: 'complete' })));
                        setResults(event.data.results || []);
                        if (event.data.results.length === 0) setStatus("No relevant threads found. Try a different competitor name.");
                        setTimeout(() => setLoading(false), 800);
                    } else {
                        setLoadingSteps(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
                        setStatus("Error: " + (event.data.error || "Failed to fetch results"));
                        setTimeout(() => setLoading(false), 800);
                    }
                    window.removeEventListener('message', handleMessage);
                    window.removeEventListener('message', handleProgress);
                }
            };

            window.addEventListener('message', handleMessage);
            window.addEventListener('message', handleProgress);

            window.postMessage({
                type: "OPINION_DECK_DISCOVERY_REQUEST",
                id: requestId,
                competitor: competitor.trim()
            }, window.location.origin);
        } else {
            // BACKEND DISCOVERY PATH
            try {
                // 1. Initial connection
                await new Promise(r => setTimeout(r, 800));
                setLoadingSteps(prev => prev.map(s => s.id === 'connect' ? { ...s, status: 'complete' } : s.id === 'api_check' ? { ...s, status: 'loading' } : s));

                // 2. Call Backend
                const response = await fetch('/api/discovery/search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}` // Assuming token-based auth
                    },
                    body: JSON.stringify({
                        query: competitor.trim(),
                        deepDiscovery
                    })
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || 'Discovery failed');
                }

                // Transition through steps while waiting for data (simulated for UI)
                await new Promise(r => setTimeout(r, 1200));
                setLoadingSteps(prev => prev.map(s => s.id === 'api_check' ? { ...s, status: 'complete' } : s.id === 'fetch' ? { ...s, status: 'loading' } : s));

                await new Promise(r => setTimeout(r, 1500));
                setLoadingSteps(prev => prev.map(s => s.id === 'fetch' ? { ...s, status: 'complete' } : s.id === 'enrich' ? { ...s, status: 'loading' } : s));

                const data = await response.json();

                await new Promise(r => setTimeout(r, 1000));
                setLoadingSteps(prev => prev.map(s => s.id === 'enrich' ? { ...s, status: 'complete' } : s.id === 'rank' ? { ...s, status: 'loading' } : s));

                if (data.results && data.results.length > 0) {
                    setResults(data.results);
                }
                if (data.discoveryPlan) {
                    setDiscoveryPlan(data.discoveryPlan);
                } else if (!data.results || data.results.length === 0) {
                    setStatus("No relevant threads found. Try a broader search.");
                }

                await new Promise(r => setTimeout(r, 800));
                setLoadingSteps(prev => prev.map(s => s.id === 'rank' ? { ...s, status: 'complete' } : s.id === 'final' ? { ...s, status: 'complete' } : s));
                setTimeout(() => setLoading(false), 800);

            } catch (err: any) {
                console.error("Discovery error:", err);
                setStatus("Error: " + err.message);
                setLoadingSteps(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
                setTimeout(() => setLoading(false), 800);
            }
        }
    }, [competitor, deepDiscovery, extensionConnected]);

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            if (newSelected.size >= 10) return;
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleBatchSave = async () => {
        if (selectedIds.size === 0 || !targetFolderId) return;

        const threadsToSave = results.filter(r => selectedIds.has(r.id));
        setLoading(true);
        setStatus(null);

        const folderName = folders.find(f => f.id === targetFolderId)?.name || 'folder';

        setLoadingSteps([
            { id: 'prep', label: `Preparing ${threadsToSave.length} threads for sync`, status: 'loading' as const },
            { id: 'queue', label: `Enqueuing in ${folderName} bucket`, status: 'pending' as const },
            { id: 'done', label: 'Background sync initiated', status: 'pending' as const }
        ]);

        try {
            // Prep phase
            await new Promise(r => setTimeout(r, 600));
            setLoadingSteps(prev => prev.map(s => s.id === 'prep' ? { ...s, status: 'complete' } : s.id === 'queue' ? { ...s, status: 'loading' } : s));

            const urls = threadsToSave.map(t => t.url);
            await syncThreads(targetFolderId, urls);

            await new Promise(r => setTimeout(r, 800));
            setLoadingSteps(prev => prev.map(s => s.id === 'queue' ? { ...s, status: 'complete' } : s.id === 'done' ? { ...s, status: 'complete' } : s));

            setStatus(`Successfully queued ${threadsToSave.length} threads for background sync!`);
            setSelectedIds(new Set());
        } catch (err: any) {
            console.error("Batch save failed:", err);
            setStatus("Error: " + err.message);
            setLoadingSteps(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
        }

        setTimeout(() => {
            setLoading(false);
            setProgress(null);
        }, 1000);
    };

    return (
        <div className={`research-view ${isSearchingStarted || results.length > 0 ? 'searching-started' : ''}`}>
            <header className="research-header">
                <h1>Competitor Discovery</h1>
                <p>Find the most engaged Reddit discussions about your competitors.</p>
            </header>

            {extensionConnected === false && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid #ef4444',
                    padding: '20px',
                    borderRadius: '16px',
                    marginBottom: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px'
                }}>
                    <Info color="#ef4444" size={24} />
                    <div>
                        <strong style={{ color: '#ef4444', display: 'block', marginBottom: '4px' }}>Extension Not Detected</strong>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Please make sure the OpinionDeck extension is installed, enabled, and you have <strong>reloaded this page</strong> after any updates.
                        </span>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ marginLeft: 'auto', padding: '8px 15px', borderRadius: '8px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
                    >
                        Reload Page
                    </button>
                </div>
            )}

            <div className="discovery-hero-section">

                <div className="search-container">
                    <div className="search-box-large">
                        <input
                            type="text"
                            placeholder="e.g. Notion, Linear, Slack..."
                            value={competitor}
                            onChange={(e) => setCompetitor(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <button className="search-button-large" onClick={handleSearch} disabled={loading || !competitor.trim()}>
                            {loading && !progress ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                            Search
                        </button>
                    </div>

                    {isDebugMode && (
                        <div className="discovery-options">
                            <label className="toggle-container">
                                <input
                                    type="checkbox"
                                    checked={deepDiscovery}
                                    onChange={(e) => setDeepDiscovery(e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                                <span className="toggle-label">Deep Discovery (Slow, but high quality)</span>
                            </label>
                            <div className="discovery-hint">
                                {deepDiscovery ?
                                    "Uses a specialized algorithm to find deep intent threads." :
                                    "Uses Google/Serper for broad discovery."}
                            </div>
                        </div>
                    )}

                    {status && <div className="status-message" style={{ marginTop: '20px', color: status.includes('Error') ? 'var(--error-color, #ef4444)' : 'var(--primary-color)' }}>{status}</div>}
                </div>
            </div>

            {loading && !!loadingSteps.length && (
                <div className="discovery-loading-view">
                    <div className="loading-content-discovery">
                        <h2>
                            {loadingSteps.some(s => s.id === 'prep') ? 'Syncing Research...' : `Analyzing Reddit for ${competitor}...`}
                        </h2>
                        <div className="loading-steps-list">
                            {loadingSteps.map((step) => (
                                <div key={step.id} className={`loading-step-item ${step.status}`}>
                                    <div className="step-indicator">
                                        {step.status === 'complete' ? <Check size={16} className="text-success" /> :
                                            step.status === 'loading' ? <Loader2 className="animate-spin text-primary" size={16} /> :
                                                <div className="step-dot-idle"></div>}
                                    </div>
                                    <span className="step-label">{step.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {!loading && discoveryPlan && (
                <div className="discovery-plan-banner">
                    <div className="plan-stats">
                        <div className="plan-stat">
                            <span className="stat-label">Scanned</span>
                            <span className="stat-value">{discoveryPlan.scannedCount}</span>
                        </div>
                        <div className="plan-stat">
                            <span className="stat-label">High Signal</span>
                            <span className="stat-value">{discoveryPlan.totalFound}</span>
                        </div>
                        <div className="plan-stat">
                            <span className="stat-label">Cached</span>
                            <span className="stat-value">{discoveryPlan.cachedCount}</span>
                        </div>
                        <div className="plan-stat">
                            <span className="stat-label">Sync Time</span>
                            <span className="stat-value">~{Math.round(discoveryPlan.estimatedSyncTime)}s</span>
                        </div>
                    </div>
                    {discoveryPlan.isFromCache && (
                        <div className="plan-cache-badge">
                            <Info size={14} /> Global search cached 24h ago
                        </div>
                    )}
                </div>
            )}

            {!loading && results.length > 0 && (
                <div className="results-grid">
                    {results.map(thread => (
                        <div
                            key={thread.id}
                            className={`thread-card-discovery ${selectedIds.has(thread.id) ? 'selected' : ''}`}
                            onClick={() => toggleSelection(thread.id)}
                        >
                            <div className="checkbox-indicator">
                                {selectedIds.has(thread.id) && <Check size={16} />}
                            </div>
                            <div className="thread-card-header">
                                <span className="thread-subreddit-tag">r/{thread.subreddit}</span>
                                <div className="header-right-discovery">
                                    {thread.isCached && <span className="cached-badge">CACHED</span>}
                                    <a
                                        href={thread.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="external-link-icon"
                                        onClick={(e) => e.stopPropagation()}
                                        title="Open in Reddit"
                                    >
                                        <ExternalLink size={14} />
                                    </a>
                                </div>
                            </div>
                            <h3 className="thread-title-discovery">{thread.title}</h3>
                            <div className="thread-stats-discovery">
                                <div className="stat-item">
                                    <ThumbsUp size={14} /> {thread.ups}
                                </div>
                                <div className="stat-item">
                                    <MessageSquare size={14} /> {thread.num_comments}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedIds.size > 0 && (
                <div className="action-bar-fixed">
                    <div className="action-info">
                        {selectedIds.size} {selectedIds.size === 1 ? 'thread' : 'threads'} selected
                    </div>
                    <div className="bar-actions">
                        <div className="folder-selection-magic">
                            <select
                                className="folder-dropdown-discovery"
                                value={targetFolderId}
                                onChange={(e) => {
                                    if (e.target.value === 'NEW_FOLDER') {
                                        setIsCreatingFolder(true);
                                    } else {
                                        setTargetFolderId(e.target.value);
                                    }
                                }}
                                disabled={loading}
                            >
                                <option value="" disabled>Select target folder...</option>
                                {folders.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                                <option value="NEW_FOLDER">+ Create New Folder...</option>
                            </select>
                        </div>
                        <button
                            className="batch-save-btn"
                            disabled={loading || !targetFolderId}
                            onClick={handleBatchSave}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    Saving {progress?.current}/{progress?.total}...
                                </>
                            ) : (
                                <>
                                    <ArrowRight size={18} />
                                    Save to Folder
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
            {isCreatingFolder && (
                <div className="modal-overlay-discovery">
                    <div className="folder-create-modal">
                        <h3>Create New Folder</h3>
                        <p>Group these threads into a new research bucket.</p>
                        <input
                            type="text"
                            placeholder="e.g. Slack Frustrations"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter' && newFolderName.trim()) {
                                    handleCreateFolder();
                                }
                            }}
                            autoFocus
                        />
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setIsCreatingFolder(false)}>Cancel</button>
                            <button
                                className="create-btn"
                                disabled={!newFolderName.trim()}
                                onClick={handleCreateFolder}
                            >
                                <Check size={16} /> Create & Select
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
