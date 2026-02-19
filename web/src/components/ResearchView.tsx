
import React, { useState, useEffect, useCallback } from 'react';
import { useFolders } from '../contexts/FolderContext';
import { Search, Info, Check, ArrowRight, Loader2, MessageSquare, ThumbsUp } from 'lucide-react';
import './ResearchView.css';

interface DiscoveryResult {
    id: string;
    title: string;
    url: string;
    subreddit: string;
    ups: number;
    num_comments: number;
    score: number;
}

export const ResearchView: React.FC = () => {
    const { folders, createFolder } = useFolders();
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

        setLoading(true);
        setResults([]);
        setSelectedIds(new Set());
        setStatus(null);

        const steps = [
            { id: 'ext', label: 'Checking extension connectivity', status: 'loading' as const },
            { id: 'query', label: 'Generating surgical search queries', status: 'pending' as const },
            { id: 'reddit', label: 'Deep-scanning relevant subreddits', status: 'pending' as const },
            { id: 'rank', label: 'Ranking by intent and relevance', status: 'pending' as const },
            { id: 'finish', label: 'Finalizing insights', status: 'pending' as const }
        ];
        setLoadingSteps(steps);

        const requestId = Math.random().toString(36).substring(7);

        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === "OPINION_DECK_DISCOVERY_RESPONSE" && event.data.id === requestId) {
                if (event.data.success) {
                    setLoadingSteps(prev => prev.map(s => ({ ...s, status: 'complete' })));
                    setResults(event.data.results || []);
                    if (event.data.results.length === 0) {
                        setStatus("No relevant threads found. Try a different competitor name.");
                    }
                } else {
                    setLoadingSteps(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
                    setStatus("Error: " + (event.data.error || "Failed to fetch results"));
                }
                setTimeout(() => setLoading(false), 800);
                window.removeEventListener('message', handleMessage);
            }
        };

        window.addEventListener('message', handleMessage);

        // Simulate granular updates for "magic" feel
        setTimeout(() => {
            setLoadingSteps(prev => prev.map(s => s.id === 'ext' ? { ...s, status: 'complete' } : s.id === 'query' ? { ...s, status: 'loading' } : s));
        }, 800);

        setTimeout(() => {
            setLoadingSteps(prev => prev.map(s => s.id === 'query' ? { ...s, status: 'complete' } : s.id === 'reddit' ? { ...s, status: 'loading' } : s));
        }, 1800);

        window.postMessage({
            type: "OPINION_DECK_DISCOVERY_REQUEST",
            id: requestId,
            competitor: competitor.trim()
        }, window.location.origin);

        setTimeout(() => {
            setLoadingSteps(prev => prev.map(s => s.id === 'reddit' ? { ...s, status: 'complete' } : s.id === 'rank' ? { ...s, status: 'loading' } : s));
        }, 4000);

        setTimeout(() => {
            setLoadingSteps(prev => prev.map(s => s.id === 'rank' ? { ...s, status: 'complete' } : s.id === 'finish' ? { ...s, status: 'loading' } : s));
        }, 5500);

    }, [competitor]);

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
            { id: 'fetch', label: 'Deep-fetching reddit intelligence', status: 'pending' as const },
            { id: 'extract', label: 'Extracting key signals & comments', status: 'pending' as const },
            { id: 'cloud', label: `Uploading to ${folderName}`, status: 'pending' as const },
            { id: 'sync', label: 'Synchronizing research bucket', status: 'pending' as const }
        ]);

        try {
            // Prep phase
            await new Promise(r => setTimeout(r, 800));
            setLoadingSteps(prev => prev.map(s => s.id === 'prep' ? { ...s, status: 'complete' } : s.id === 'fetch' ? { ...s, status: 'loading' } : s));

            for (let i = 0; i < threadsToSave.length; i++) {
                const thread = threadsToSave[i];
                const currentLabel = `Fetching: ${thread.title.substring(0, 30)}...`;
                setLoadingSteps(prev => prev.map(s => s.id === 'fetch' ? { ...s, label: currentLabel } : s));

                // 1. Fetch JSON via extension bridge
                const requestId = Math.random().toString(36).substring(7);
                window.postMessage({
                    type: "OPINION_DECK_FETCH_REQUEST",
                    id: requestId,
                    url: thread.url
                }, window.location.origin);

                const fetchResponse: any = await new Promise((resolve, reject) => {
                    const listener = (event: MessageEvent) => {
                        if (event.data.type === "OPINION_DECK_FETCH_RESPONSE" && event.data.id === requestId) {
                            window.removeEventListener('message', listener);
                            if (event.data.success) resolve(event.data.data);
                            else reject(new Error(event.data.error));
                        }
                    };
                    window.addEventListener('message', listener);
                    setTimeout(() => reject(new Error("Fetch timed out")), 20000);
                });

                // Transition to extract
                setLoadingSteps(prev => prev.map(s =>
                    s.id === 'fetch' ? { ...s, status: 'complete', label: 'Deep-fetched reddit intelligence' } :
                        s.id === 'extract' ? { ...s, status: 'loading', label: `Cleaning data for: ${thread.title.substring(0, 20)}...` } : s
                ));

                // 2. Wrap into payload
                const postData = fetchResponse[0]?.data?.children[0]?.data || {};
                const commentListing = fetchResponse[1]?.data?.children || [];

                const payload = {
                    id: `reddit_${thread.id}`,
                    source: 'reddit',
                    url: thread.url,
                    title: thread.title,
                    folderId: targetFolderId,
                    extractedAt: new Date().toISOString(),
                    content: {
                        post: postData,
                        comments: commentListing.filter((c: any) => c.kind === 't1').map((c: any) => ({
                            id: c.data.id,
                            author: c.data.author,
                            body: c.data.body,
                            score: c.data.score,
                            replies: []
                        }))
                    }
                };

                // Transition to cloud
                setLoadingSteps(prev => prev.map(s =>
                    s.id === 'extract' ? { ...s, status: 'complete', label: 'Extracted key signals & comments' } :
                        s.id === 'cloud' ? { ...s, status: 'loading', label: `Syncing with Opinion Deck (${i + 1}/${threadsToSave.length})` } : s
                ));

                // 3. Save via bridge
                const saveRequestId = Math.random().toString(36).substring(7);
                window.postMessage({
                    type: "OPINION_DECK_SAVE_REQUEST",
                    id: saveRequestId,
                    data: payload
                }, window.location.origin);

                await new Promise((resolve, reject) => {
                    const listener = (event: MessageEvent) => {
                        if (event.data.type === "OPINION_DECK_SAVE_RESPONSE" && event.data.id === saveRequestId) {
                            window.removeEventListener('message', listener);
                            if (event.data.success) resolve(true);
                            else reject(new Error(event.data.error));
                        }
                    };
                    window.addEventListener('message', listener);
                    setTimeout(() => reject(new Error("Save timed out")), 20000);
                });

                // Reset for next thread if not last
                if (i < threadsToSave.length - 1) {
                    setLoadingSteps(prev => prev.map(s =>
                        s.id === 'cloud' ? { ...s, status: 'loading' } :
                            s.id === 'fetch' ? { ...s, status: 'loading' } :
                                s.id === 'extract' ? { ...s, status: 'pending' } : s
                    ));
                    await new Promise(r => setTimeout(r, 600));
                }
            }

            // Final sync phase
            setLoadingSteps(prev => prev.map(s =>
                s.id === 'cloud' ? { ...s, status: 'complete' } :
                    s.id === 'sync' ? { ...s, status: 'loading' } : s
            ));
            await new Promise(r => setTimeout(r, 1200));
            setLoadingSteps(prev => prev.map(s => s.id === 'sync' ? { ...s, status: 'complete' } : s));

        } catch (err: any) {
            console.error("Batch save failed:", err);
            setStatus("Error: " + err.message);
            setLoadingSteps(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
        }

        setTimeout(() => {
            setLoading(false);
            setProgress(null);
            setStatus(`Successfully saved ${threadsToSave.length} threads!`);
            setSelectedIds(new Set());
        }, 1000);
    };

    return (
        <div className="research-view">
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
                {status && <div className="status-message" style={{ marginTop: '20px', color: status.includes('Error') ? 'var(--error-color, #ef4444)' : 'var(--primary-color)' }}>{status}</div>}
            </div>

            {loading && !!loadingSteps.length && (
                <div className="discovery-loading-view">
                    <div className="loading-content-discovery">
                        <div className="magic-spinner-container">
                            <div className="pulse-spinner-outer"></div>
                            <div className="pulse-spinner-inner"></div>
                            <Loader2 className="animate-spin main-loader-icon" size={32} />
                        </div>
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
                            <span className="thread-subreddit-tag">r/{thread.subreddit}</span>
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
