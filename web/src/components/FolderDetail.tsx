import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFolders } from '../contexts/FolderContext';
import { useAuth } from '../contexts/AuthContext';
import { ThreadView } from './ThreadView';
import { AnalysisResults } from './AnalysisResults';
import { PremiumLoader, ButtonLoader } from './PremiumLoader';
import { Skeleton } from './Skeleton';
import './Folders.css';
import './AnalysisResults.css';
import { fetchFolderAnalysis } from '../lib/api';
import { AlertTriangle, Sparkles, Trash2, BarChart2, ArrowDownCircle, Calendar, MessageSquare as MessageSquareIcon, Users, ExternalLink, FileDown } from 'lucide-react';
import { exportReportToPDF } from '../lib/pdfExport';

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
    const { folders, getFolderThreads, deleteFolder, analyzeFolder } = useFolders();
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
        if (!folderId) return;

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
    }, [folderId, getFolderThreads, threadId]);

    // Fetch existing analysis on load
    useEffect(() => {
        if (!folderId || folderId === 'inbox') return;
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

    if (loading || !folder) {
        return (
            <div className="folder-detail-view">
                <div className="folder-header-actions" style={{ marginBottom: '2.5rem' }}>
                    <Skeleton width="180px" height="40px" style={{ borderRadius: '12px' }} />
                </div>

                <div className="folder-header" style={{ border: 'none', padding: 0, marginBottom: '3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                        <Skeleton width="48px" height="48px" style={{ borderRadius: '14px' }} />
                        <Skeleton width="300px" height="48px" />
                    </div>
                    <Skeleton width="100%" height="24px" style={{ marginBottom: '8px' }} />
                    <Skeleton width="80%" height="24px" style={{ marginBottom: '24px' }} />

                    <div className="folder-stats" style={{ background: 'rgba(255,255,255,0.03)', padding: '16px 24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'inline-flex', gap: '24px' }}>
                        <Skeleton width="120px" height="20px" />
                        <Skeleton width="120px" height="20px" />
                        <Skeleton width="150px" height="20px" />
                    </div>
                </div>

                <div className="threads-list" style={{ marginTop: '2rem' }}>
                    {[1, 2, 3].map(id => (
                        <div key={id} className="thread-card" style={{ padding: '20px', pointerEvents: 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <Skeleton width="20px" height="20px" circle style={{ marginTop: '4px' }} />
                                <div style={{ flex: 1 }}>
                                    <Skeleton width="70%" height="24px" style={{ marginBottom: '12px' }} />
                                    <div style={{ display: 'flex', gap: '16px' }}>
                                        <Skeleton width="100px" height="16px" />
                                        <Skeleton width="100px" height="16px" />
                                        <Skeleton width="120px" height="16px" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
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
            <div className="folder-header-actions" style={{ marginBottom: '2.5rem' }}>
                <button className="btn-secondary" onClick={() => navigate('/')}>
                    ← Back to Dashboard
                </button>
                <div className="action-group">
                    {threads.length > 0 && (
                        <button
                            className="btn-primary analyze-btn"
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '10px 24px',
                                borderRadius: '14px',
                                background: 'linear-gradient(135deg, var(--primary-color) 0%, #FF8717 100%)',
                                border: 'none',
                                color: 'white',
                                fontWeight: '700',
                                boxShadow: '0 8px 20px rgba(255, 69, 0, 0.2)'
                            }}
                        >
                            {isAnalyzing ? (
                                <>
                                    <ButtonLoader />
                                    {loadingMsg}
                                </>
                            ) : (
                                <>{analyses.length > 0 ? <><Sparkles size={18} /> Re-Analyze Intelligence</> : <><Sparkles size={18} /> Generate AI Intelligence</>}</>
                            )}
                        </button>
                    )}
                    <button className="btn-icon delete-btn" onClick={handleDelete} title="Delete Folder" style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)'
                    }}>
                        <Trash2 size={20} color="#ef4444" />
                    </button>
                </div>
            </div>

            <div className="folder-header" style={{ border: 'none', padding: 0, marginBottom: '3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255, 69, 0, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                        <BarChart2 size={24} />
                    </div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: '900', margin: 0, letterSpacing: '-0.04em', color: 'white' }}>{folder.name}</h2>
                </div>
                {folder.description && <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '800px', lineHeight: '1.6', margin: '0 0 24px 0' }}>{folder.description}</p>}

                <div className="folder-stats" style={{ background: 'rgba(255,255,255,0.03)', padding: '16px 24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'inline-flex', gap: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={14} color="var(--primary-color)" />
                        <span style={{ fontWeight: '700', color: 'white' }}>{threads.length}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Platforms Scanned</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BarChart2 size={14} color="#00D1FF" />
                        <span style={{ fontWeight: '700', color: 'white' }}>{threads.reduce((acc, t) => acc + (t.commentCount || 0), 0).toLocaleString()}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Raw Insights</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={14} color="#A855F7" />
                        <span style={{ color: 'var(--text-muted)' }}>Created {new Date(folder.createdAt).toLocaleDateString()}</span>
                    </div>
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
                                    <span className="report-hint" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <button
                                            className="btn-icon"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                exportReportToPDF(analysis);
                                            }}
                                            title="Download PDF"
                                            style={{
                                                padding: '4px',
                                                borderRadius: '6px',
                                                background: 'rgba(255, 69, 0, 0.1)',
                                                border: '1px solid rgba(255, 69, 0, 0.2)',
                                                color: 'var(--primary-color)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <FileDown size={16} />
                                        </button>
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
                <div className="threads-list" style={{ marginTop: '2rem' }}>
                    {threads.map(thread => (
                        <div key={thread.id} className="thread-card" onClick={() => handleSelectThread(thread)} style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{ color: 'var(--primary-color)', marginTop: '4px' }}>
                                    <MessageSquareIcon size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 className="thread-title" style={{ margin: '0 0 12px 0', fontSize: '1.1rem' }}>{thread.title}</h3>
                                    <div className="thread-meta" style={{ display: 'flex', gap: '16px', opacity: 0.8, fontSize: '0.85rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <ExternalLink size={14} color="var(--bg-accent)" />
                                            <span>r/{thread.subreddit}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Users size={14} />
                                            <span>u/{thread.author}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Calendar size={14} />
                                            <span>{new Date(thread.savedAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
