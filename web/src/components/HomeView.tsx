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
import { AlertTriangle, Check, X, Activity, FolderOpen, Clock, MessageSquare } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { MetricCard } from "./common/MetricCard";
import "./Home.css";

export function HomeView() {
    const { plan, user, userStats: stats } = useAuth();

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
    const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);

    const handleFetch = (url: string, sort: string) => {
        fetchThread({ url, sort });
        setSaveStatus('idle');
    };

    const handleSaveToFolder = async (folderId: string) => {
        if (!thread) return;
        setSaveStatus('saving');
        try {
            await saveThread(folderId, thread);
            toast.success("Thread saved successfully");
            setSaveStatus('success');
        } catch (err) {
            toast.error("Failed to save thread");
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
            toast.success(`Created folder "${name}" and saved thread`);
            setSaveStatus('success');
            setShowNewFolder(false);
            setNewFolderName('');
        } catch (err) {
            toast.error("Failed to create folder or save thread");
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
        <div className="dashboard-home">
            <UrlInput onFetch={handleFetch} loading={loading} />

            {error && (
                <div className="error-banner mb-6" role="alert">
                    <span className="error-icon" aria-hidden="true"><AlertTriangle size={20} /></span>
                    <p>{error}</p>
                </div>
            )}

            {loading && (
                <PremiumLoader text="Fetching intelligence from platform..." />
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
                <>
                    <header className="dashboard-header">
                        <h1>Welcome to {BRANDING.NAME}</h1>
                        <p className="subtitle">Your Strategic Market Intelligence Hub</p>
                    </header>

                    <div className="impact-stats-bar">
                        <MetricCard 
                            label="Intelligence Scanned" 
                            value={stats?.intelligenceScanned || 0} 
                            icon={<Activity size={18} />} 
                            color="#FF4500"
                            loading={!stats}
                            variant="minimal"
                        />
                        <MetricCard 
                            label="Insights Found" 
                            value={stats?.commentsAnalyzed || 0} 
                            icon={<MessageSquare size={18} />} 
                            color="#00D1FF"
                            loading={!stats}
                            variant="minimal"
                        />
                        <MetricCard 
                            label="Strategy Folders" 
                            value={folders.length} 
                            icon={<FolderOpen size={18} />} 
                            color="#A855F7"
                            loading={!stats}
                            variant="minimal"
                        />
                        <MetricCard 
                            label="Hours Saved" 
                            value={`${(stats?.hoursSaved || 0).toFixed(1)}h`} 
                            icon={<Clock size={18} />} 
                            color="#EAB308"
                            loading={!stats}
                            variant="minimal"
                        />
                    </div>

                    <FolderList onSelect={(folder) => navigate(`/folders/${folder.id}`)} />

                    {!user && (
                        <>
                            {plan !== "pro" && <PricingPage />}
                            <SEOContent />
                        </>
                    )}
                </>
            )}

            <ExtensionModal
                isOpen={isExtensionModalOpen}
                onClose={() => setIsExtensionModalOpen(false)}
            />
        </div>
    );
}
