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

interface SavedThread {
    id: string;
    title: string;
    subreddit: string;
    author: string;
    savedAt: string;
    data: any;
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

    // Analysis State
    const [analyses, setAnalyses] = useState<any[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

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
                    if (target) setSelectedThread(target.data);
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
                // API now returns an array of analyses
                if (Array.isArray(data)) {
                    setAnalyses(data);
                } else if (data) {
                    // Backward compatibility if API wraps or returns single object
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

    const handleCitationClick = (commentId: string) => {
        // 1. Find which thread contains this comment
        // Clean ID (remove "ID:" prefix if present)
        const cleanId = commentId.replace("ID:", "").trim();

        const targetThread = threads.find(t => {
            // Need to search deep in the comment tree? 
            // The SavedThread.data contains the full JSON with comments.
            // We can do a quick regex check on the stringified data for performance, 
            // or traverse. String match is faster for "does it exist".
            return JSON.stringify(t.data).includes(cleanId);
        });

        if (targetThread) {
            setSelectedThread(targetThread.data);
            // Wait for render then scroll
            setTimeout(() => {
                const el = document.getElementById(cleanId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('highlight-flash');
                    setTimeout(() => el.classList.remove('highlight-flash'), 2000);
                } else {
                    console.warn("Element not found after render:", cleanId);
                }
            }, 500); // 500ms delay to allow React to render the ThreadView
        } else {
            alert(`Could not locate comment ${cleanId} in saved threads.`);
        }
    };

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
                    <span className="error-icon">⚠️</span>
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
                        >
                            {isAnalyzing ? (
                                <>
                                    <ButtonLoader />
                                    {loadingMsg}
                                </>
                            ) : (
                                <>{analyses.length > 0 ? "✨ Re-Analyze Folder" : "✨ Analyze with AI"}</>
                            )}
                        </button>
                    )}
                    <button className="btn-icon delete-btn" onClick={handleDelete} title="Delete Folder">
                        🗑️
                    </button>
                </div>
            </div>

            <div className="folder-header">
                <h2>{folder.name}</h2>
                {folder.description && <p>{folder.description}</p>}
                <div className="folder-stats">
                    <span>{threads.length} threads</span>
                    <span>•</span>
                    <span>{threads.reduce((acc, t) => acc + (t.data.num_comments || 0), 0).toLocaleString()} comments</span>
                    <span>•</span>
                    <span>Created {new Date(folder.createdAt).toLocaleDateString()}</span>
                </div>
            </div>

            {analysisError && (
                <div className="error-banner">
                    <span className="error-icon">⚠️</span>
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
                                        📊 AI Intelligence Report
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
                                    <span>👇 Source Threads 👇</span>
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
                        <div key={thread.id} className="thread-card" onClick={() => setSelectedThread(thread.data)}>
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
