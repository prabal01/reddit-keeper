import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFolders } from '../contexts/FolderContext';
import { useAuth } from '../contexts/AuthContext';
import { ThreadView } from './ThreadView';
import { AnalysisResults } from './AnalysisResults';
import { PremiumLoader, ButtonLoader } from './PremiumLoader';
import './Folders.css';
import './AnalysisResults.css';
import { fetchFolderAnalysis } from '../lib/api';
import { AlertTriangle, Sparkles, Trash2, BarChart2, ArrowDownCircle } from 'lucide-react';

interface SavedThread {
    id: string;
    title: string;
    subreddit: string;
    author: string;
    commentCount: number;
    source: string;
    savedAt: string;
    data: any;
    storageUrl?: string;
}

export const FolderDetail: React.FC = () => {
    const { folderId, threadId } = useParams<{ folderId: string; threadId?: string }>();
    const navigate = useNavigate();
    const { folders, getFolderThreads, deleteFolder, analyzeFolder, loading: foldersLoading } = useFolders();
    const { refreshStats } = useAuth();

    // Handle "inbox" virtual folder
    const folder = folderId === 'inbox'
        ? { id: 'inbox', name: 'Inbox', description: 'Unorganized threads', createdAt: new Date().toISOString(), threadCount: 0, uid: '' }
        : folders.find(f => f.id === folderId);

    const [threads, setThreads] = useState<SavedThread[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedThread, setSelectedThread] = useState<any | null>(null);
    const [fetchingThread, setFetchingThread] = useState(false);

    // Analysis State
    const [analyses, setAnalyses] = useState<any[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    // Helper to select thread with lazy loading
    const handleSelectThread = async (thread: SavedThread) => {
        if (thread.data) {
            setSelectedThread(thread.data);
            return;
        }

        if (thread.storageUrl) {
            setFetchingThread(true);
            try {
                const response = await fetch(thread.storageUrl);
                if (!response.ok) throw new Error("Failed to fetch thread from storage");
                const fullData = await response.json();

                // Reconstruct the expected object structure for ThreadView
                const threadObj = {
                    id: thread.id,
                    title: thread.title,
                    post: { title: thread.title, subreddit: thread.subreddit, author: thread.author }, // Minimal fallback
                    content: fullData,
                    metadata: {
                        fetchedAt: thread.savedAt,
                        toolVersion: "ext-1.0.1",
                        source: thread.source
                    }
                };

                setSelectedThread(threadObj);
            } catch (err) {
                console.error("Lazy Load Error:", err);
                alert("Failed to load thread content from Cloud Storage.");
            } finally {
                setFetchingThread(false);
            }
        }
    };

    useEffect(() => {
        if (!folderId || !folder) return;

        let mounted = true;
        setLoading(true);
        getFolderThreads(folderId).then(data => {
            if (mounted) {
                setThreads(data);
                setLoading(false);

                // Deep link selection
                if (threadId) {
                    const target = data.find((t: any) => t.id === threadId || t.data?.id === threadId);
                    if (target) handleSelectThread(target);
                }
            }
        });
        return () => { mounted = false; };
    }, [folderId, folder, getFolderThreads, threadId]);

    // Fetch existing analysis on load
    useEffect(() => {
        if (!folderId) return;
        fetchFolderAnalysis(folderId)
            .then(data => {
                if (Array.isArray(data)) {
                    setAnalyses(data);
                } else if (data) {
                    setAnalyses([data]);
                }
            })
            .catch(err => console.error("Failed to load analysis:", err));
    }, [folderId]);

    const handleDelete = async () => {
        if (!folder) return;
        if (confirm('Are you sure you want to delete this folder? All saved threads will be lost.')) {
            await deleteFolder(folder.id);
            navigate('/');
        }
    };

    const [loadingMsg, setLoadingMsg] = useState("Initializing AI...");

    useEffect(() => {
        if (!isAnalyzing) return;
        const messages = [
            "Reading executive summary...",
            "Identifying top themes...",
            "Extracting feature requests...",
            "Locating pain points & bugs...",
            "Calculating sentiment scores...",
            "Finalizing research report..."
        ];
        let i = 0;
        setLoadingMsg(messages[0]);
        const interval = setInterval(() => {
            i = (i + 1) % messages.length;
            setLoadingMsg(messages[i]);
        }, 2000);
        return () => clearInterval(interval);
    }, [isAnalyzing]);

    const handleAnalyze = async () => {
        if (!folderId || threads.length === 0) return;
        setIsAnalyzing(true);
        setAnalysisError(null);
        try {
            const result = await analyzeFolder(folderId);
            // Prepend the new analysis so it's first
            setAnalyses(prev => [result, ...prev]);
            await refreshStats(); // Update credits in sidebar
        } catch (err: any) {
            setAnalysisError(err.message || "Failed to analyze folder");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleCitationClick = async (commentId: string) => {
        const cleanId = commentId.replace("ID:", "").trim();
        const targetThread = threads.find(t => t.data && JSON.stringify(t.data).includes(cleanId));

        if (targetThread) {
            await handleSelectThread(targetThread);
            setTimeout(() => {
                const el = document.getElementById(cleanId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('highlight-flash');
                    setTimeout(() => el.classList.remove('highlight-flash'), 2000);
                }
            }, 500);
        }
    };

    if (fetchingThread) {
        return <PremiumLoader fullPage text="Downloading from Cloud..." />;
    }

    if (selectedThread) {
        return (
            <div className="folder-detail-view">
                <button className="btn-secondary" onClick={() => {
                    setSelectedThread(null);
                    navigate(`/folders/${folderId}`);
                }}>
                    ← Back to Folder
                </button>
                <div style={{ marginTop: '1rem' }}>
                    <ThreadView thread={selectedThread} />
                </div>
            </div>
        );
    }

    if (foldersLoading && !folder) {
        return <PremiumLoader fullPage text="Locating Folder..." />;
    }

    if (!folder) {
        return (
            <div className="folder-detail-view">
                <div className="error-banner">
                    <span className="error-icon"><AlertTriangle size={20} /></span>
                    <p>Folder not found</p>
                </div>
                <button className="btn-secondary" onClick={() => navigate('/')}>
                    Go Home
                </button>
            </div>
        );
    }

    return (
        <div className="folder-detail-view">
            <div className="folder-header-actions">
                <button className="btn-secondary" onClick={() => navigate('/')}>
                    ← Back
                </button>
                <div className="action-group">
                    {threads.length > 0 && (
                        <button
                            className="btn-primary analyze-btn"
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {isAnalyzing ? (
                                <>
                                    <ButtonLoader />
                                    {loadingMsg}
                                </>
                            ) : (
                                <>{analyses.length > 0 ? <><Sparkles size={16} /> Re-Analyze Folder</> : <><Sparkles size={16} /> Analyze with AI</>}</>
                            )}
                        </button>
                    )}
                    <button className="btn-icon delete-btn" onClick={handleDelete} title="Delete Folder">
                        <Trash2 size={18} color="var(--error-color)" />
                    </button>
                </div>
            </div>

            <div className="folder-header">
                <h2>{folder.name}</h2>
                {folder.description && <p>{folder.description}</p>}
                <div className="folder-stats">
                    <span>{threads.length} threads</span>
                    <span>•</span>
                    <span>{threads.reduce((acc, t) => acc + (t.commentCount || 0), 0).toLocaleString()} comments</span>
                    <span>•</span>
                    <span>Created {new Date(folder.createdAt).toLocaleDateString()}</span>
                </div>
            </div>

            {analysisError && (
                <div className="error-banner">
                    <span className="error-icon"><AlertTriangle size={20} /></span>
                    <p>{analysisError}</p>
                </div>
            )}

            {analyses.length > 0 && (
                <div className="analysis-feed">
                    {analyses.map((analysis, index) => (
                        <div key={analysis.id || index} className="analysis-wrapper">
                            <details className="report-collapsible" open={index === 0}>
                                <summary className="report-summary">
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <BarChart2 size={18} color="var(--primary-color)" /> AI Intelligence Report
                                        {analysis.createdAt && (
                                            <span style={{ fontSize: '0.8rem', fontWeight: 400, opacity: 0.8 }}>
                                                — {new Date(analysis.createdAt).toLocaleString()}
                                            </span>
                                        )}
                                        {index === 0 && <span className="badge-new" style={{ fontSize: '0.7rem', background: 'var(--bg-accent)', color: 'white', padding: '2px 8px', borderRadius: '10px' }}>LATEST</span>}
                                    </span>
                                    <span className="report-hint">
                                        {index === 0 ? "(Expanded)" : "(Click to view history)"}
                                    </span>
                                </summary>
                                <div className="report-content">
                                    <AnalysisResults
                                        data={analysis}
                                        onCitationClick={(id) => handleCitationClick(id)}
                                    />
                                </div>
                            </details>
                            {index === 0 && (
                                <div className="analysis-divider">
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.7 }}>
                                        <ArrowDownCircle size={16} /> Source Threads <ArrowDownCircle size={16} />
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {loading ? (
                <PremiumLoader text="Retrieving Saved Threads..." />
            ) : threads.length === 0 ? (
                <div className="empty-state">
                    <p>No threads saved yet.</p>
                </div>
            ) : (
                <div className="threads-list">
                    {threads.map(thread => (
                        <div key={thread.id} className="thread-card" onClick={() => handleSelectThread(thread)}>
                            <h3 className="thread-title">{thread.title}</h3>
                            <div className="thread-meta">
                                <span>r/{thread.subreddit}</span>
                                <span>u/{thread.author}</span>
                                <span>Saved {new Date(thread.savedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
