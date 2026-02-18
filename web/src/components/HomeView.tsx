
import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useFolders } from "../contexts/FolderContext";
import { UrlInput } from "./UrlInput";
import { FilterBar, type FilterState } from "./FilterBar";
import { ThreadView } from "./ThreadView";
import { ExportPanel } from "./ExportPanel";
import { UpgradePrompt } from "./UpgradePrompt";
import { PricingPage } from "./PricingPage";
import { SEOContent } from "./SEOContent";
import { useRedditThread } from "../hooks/useRedditThread";
import type { CLIOptions } from "@core/reddit/types.js";
import { applyFilters } from "@core/utils/filters.js";
import { useNavigate } from "react-router-dom";
import { PremiumLoader, ButtonLoader } from "./PremiumLoader";
import { FolderList } from "./FolderList";
import { ExtensionModal } from "./ExtensionModal";
import { BRANDING } from "../constants/branding";
import { AlertTriangle, Check, X, Activity, FolderOpen, FileText, Clock } from 'lucide-react';

import { fetchUserStats } from "../lib/api";

export function HomeView() {
    const { plan, user } = useAuth();
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        if (user) {
            fetchUserStats().then(setStats).catch(console.error);
        }
    }, [user]);

    const { thread, metadata, loading, error, fetch: fetchThread } = useRedditThread();
    const [filters, setFilters] = useState<FilterState>({
        minScore: undefined,
        maxDepth: undefined,
        skipDeleted: false,
        opOnly: false,
        topN: undefined,
    });
    const navigate = useNavigate();
    const { saveThread, folders, createFolder } = useFolders();
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const newFolderInputRef = useRef<HTMLInputElement>(null);
    const { fetchFolders } = useFolders();
    const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);

    useEffect(() => {
        fetchFolders();
    }, [fetchFolders]);

    const handleFetch = (url: string, sort: string) => {
        fetchThread({ url, sort });
        setSaveStatus('idle');
    };

    const handleSaveToFolder = async (folderId: string) => {
        if (!thread) return;
        setSaveStatus('saving');
        try {
            await saveThread(folderId, thread);
            setSaveStatus('success');
        } catch (err) {
            setSaveStatus('error');
        }
    };

    const handleSelectChange = (value: string) => {
        if (value === '__new__') {
            setShowNewFolder(true);
            setNewFolderName('');
        } else if (value) {
            handleSaveToFolder(value);
        }
    };

    const handleCreateAndSave = async () => {
        const name = newFolderName.trim();
        if (!name || !thread) return;
        setSaveStatus('saving');
        try {
            const folder = await createFolder(name);
            await saveThread(folder.id, thread);
            setSaveStatus('success');
            setShowNewFolder(false);
            setNewFolderName('');
        } catch (err) {
            setSaveStatus('error');
        }
    };

    const handleNewFolderKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCreateAndSave();
        } else if (e.key === 'Escape') {
            setShowNewFolder(false);
            setNewFolderName('');
        }
    };

    // Auto-focus the new folder input when it appears
    useEffect(() => {
        if (showNewFolder && newFolderInputRef.current) {
            newFolderInputRef.current.focus();
        }
    }, [showNewFolder]);

    // Detect extension error and show modal
    useEffect(() => {
        if (error && error.includes("Extension not found")) {
            setIsExtensionModalOpen(true);
        }
    }, [error]);

    const filteredThread = useMemo(() => {
        if (!thread) return null;

        const filterOpts: CLIOptions = {
            format: "md",
            stdout: false,
            copy: false,
            sort: "confidence",
            skipDeleted: filters.skipDeleted,
            opOnly: filters.opOnly,
            tokenCount: false,
            minScore: filters.minScore,
            maxDepth: filters.maxDepth,
            top: filters.topN,
        };

        const filteredComments = applyFilters(thread.comments, filterOpts);

        return {
            ...thread,
            comments: filteredComments,
        };
    }, [thread, filters]);

    const showUpgrade = metadata?.truncated === true && plan !== "pro";

    return (
        <>
            <UrlInput onFetch={handleFetch} loading={loading} />

            {error && (
                <div className="error-banner" role="alert">
                    <span className="error-icon" aria-hidden="true"><AlertTriangle size={20} /></span>
                    <p>{error}</p>
                </div>
            )}

            {loading && (
                <PremiumLoader text="Fetching data from platform..." />
            )}

            {filteredThread && !loading && (
                <>
                    <div className="controls-bar">
                        <FilterBar {...filters} onChange={setFilters} />
                        <div className="action-buttons">
                            <ExportPanel thread={filteredThread} />
                            <div className="save-selector">
                                {!showNewFolder ? (
                                    <select
                                        onChange={(e) => handleSelectChange(e.target.value)}
                                        disabled={saveStatus === 'saving'}
                                        className="btn-secondary"
                                        value=""
                                        aria-label="Save thread to folder"
                                    >
                                        <option value="" disabled>Save to Folder...</option>
                                        {folders.map(f => (
                                            <option key={f.id} value={f.id}>{f.name}</option>
                                        ))}
                                        <option value="__new__">+ New Folder</option>
                                    </select>
                                ) : (
                                    <div className="new-folder-inline">
                                        <input
                                            ref={newFolderInputRef}
                                            type="text"
                                            className="new-folder-input"
                                            placeholder="Folder name..."
                                            value={newFolderName}
                                            onChange={(e) => setNewFolderName(e.target.value)}
                                            onKeyDown={handleNewFolderKeyDown}
                                            disabled={saveStatus === 'saving'}
                                            aria-label="New folder name"
                                        />
                                        <button
                                            className="new-folder-save-btn"
                                            onClick={handleCreateAndSave}
                                            disabled={!newFolderName.trim() || saveStatus === 'saving'}
                                            aria-label="Create folder and save thread"
                                        >
                                            {saveStatus === 'saving' ? <ButtonLoader /> : <Check size={16} />}
                                        </button>
                                        <button
                                            className="new-folder-cancel-btn"
                                            onClick={() => { setShowNewFolder(false); setNewFolderName(''); }}
                                            disabled={saveStatus === 'saving'}
                                            aria-label="Cancel creating folder"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}
                                {saveStatus === 'success' && <span className="save-indicator success"><Check size={14} /> Saved</span>}
                                {saveStatus === 'error' && <span className="save-indicator error"><X size={14} /> Failed</span>}
                            </div>
                        </div>
                    </div>

                    {showUpgrade && metadata && (
                        <UpgradePrompt
                            totalComments={metadata.totalCommentsFetched}
                            commentsShown={metadata.commentsReturned}
                        />
                    )}

                    <ThreadView thread={filteredThread} />
                </>
            )}

            {!thread && !loading && !error && (
                <div className="dashboard-home">
                    <header className="dashboard-header">
                        <h1>Welcome to {BRANDING.NAME}</h1>
                        <p className="subtitle">Your Strategic Market Intelligence Hub</p>
                    </header>

                    <div className="impact-metrics-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '20px',
                        margin: '30px 0',
                        width: '100%'
                    }}>
                        <div className="metric-card" style={{ background: 'var(--card-bg)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div className="label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}><Activity size={14} /> Intelligence Scanned</div>
                            <div className="value" style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--primary-color)' }}>{stats?.intelligenceScanned || 0} <span style={{ fontSize: '0.9rem', opacity: 0.6, fontWeight: 'normal' }}>points</span></div>
                        </div>
                        <div className="metric-card" style={{ background: 'var(--card-bg)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div className="label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}><FolderOpen size={14} /> Active Folders</div>
                            <div className="value" style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)' }}>{folders.length}</div>
                        </div>
                        <div className="metric-card" style={{ background: 'var(--card-bg)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div className="label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={14} /> Reports Generated</div>
                            <div className="value" style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--success-color)' }}>{stats?.reportsGenerated || 0}</div>
                        </div>
                        <div className="metric-card" style={{ background: 'var(--card-bg)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div className="label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> Hours Saved</div>
                            <div className="value" style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--warning-color)' }}>{(stats?.hoursSaved || 0).toFixed(1)} <span style={{ fontSize: '0.9rem', opacity: 0.6, fontWeight: 'normal' }}>h</span></div>
                        </div>
                    </div>

                    <FolderList onSelect={(folder) => navigate(`/folders/${folder.id}`)} />

                    {!user && (
                        <>
                            {plan !== "pro" && <PricingPage />}
                            <SEOContent />
                        </>
                    )}
                </div>
            )}

            <ExtensionModal
                isOpen={isExtensionModalOpen}
                onClose={() => setIsExtensionModalOpen(false)}
            />
        </>
    );
}
