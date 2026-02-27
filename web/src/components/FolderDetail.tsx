import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFolders } from '../contexts/FolderContext';
import { useAuth } from '../contexts/AuthContext';
import { ThreadView } from './ThreadView';
import { AnalysisResults } from './AnalysisResults';
import { PremiumLoader } from './PremiumLoader';
import { Skeleton } from './Skeleton';
import './Folders.css';
import './AnalysisResults.css';
import { fetchFolderAnalysis, aggregateInsights } from '../lib/api';
import { AlertTriangle, Sparkles, Trash2, BarChart2, Calendar, MessageSquare as MessageSquareIcon, ExternalLink, FileDown, Loader2, Target, Lightbulb, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { exportReportToPDF } from '../lib/pdfExport';
import { IntelligenceScanner } from './IntelligenceScanner';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
    tokenCount?: number;
    analysisStatus?: 'pending' | 'processing' | 'success' | 'failed';
}

interface ThreadInsight {
    id: string;
    status: 'processing' | 'success' | 'failed';
    insights?: any;
    error?: string;
}

export const FolderDetail: React.FC = () => {
    const { folderId } = useParams<{ folderId: string }>();
    const navigate = useNavigate();
    const { folders, getFolderThreads, deleteFolder, analyzeFolder } = useFolders();
    const { refreshStats } = useAuth();

    // Handle "inbox" virtual folder
    const folder = folderId === 'inbox'
        ? { id: 'inbox', name: 'Inbox', description: 'Unorganized threads', createdAt: new Date().toISOString(), threadCount: 0, uid: '' }
        : folders.find((f: any) => f.id === folderId);

    const [threads, setThreads] = useState<SavedThread[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedThread, setSelectedThread] = useState<any | null>(null);
    const [fetchingThread, setFetchingThread] = useState(false);

    // Analysis State
    const [analyses, setAnalyses] = useState<any[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [realtimeFolder, setRealtimeFolder] = useState<any>(null);
    const [threadInsights] = useState<Record<string, ThreadInsight>>({});
    const [isAggregating, setIsAggregating] = useState(false);

    // Real-time Folder & Insights Listener
    useEffect(() => {
        if (!folderId || folderId === 'inbox' || !db) return;

        // 1. Listen to Folder for Metrics
        const folderDocRef = doc(db, 'folders', folderId);
        const unsubFolder = onSnapshot(folderDocRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setRealtimeFolder(data);
                if (data.analysisStatus === 'processing') {
                    setIsAnalyzing(true);
                } else if (data.analysisStatus === 'complete' || data.analysisStatus === 'idle') {
                    setIsAnalyzing(false);
                }
            }
        });

        // 2. Initial fetch for threads and meta
        getFolderThreads(folderId).then((data: any) => {
            if (data.threads) {
                setThreads(data.threads);
            } else if (Array.isArray(data)) {
                setThreads(data);
            }

            if (data.meta) {
                setRealtimeFolder((prev: any) => ({ ...prev, ...data.meta }));
            }
            setLoading(false);
        });

        fetchFolderAnalysis(folderId)
            .then(data => {
                if (Array.isArray(data)) {
                    setAnalyses(data);
                } else if (data) {
                    setAnalyses([data]);
                }
            })
            .catch(err => console.error("Failed to load analysis:", err));

        return () => {
            unsubFolder();
        };
    }, [folderId, getFolderThreads]);

    // Helper to select thread with lazy loading
    const handleSelectThread = async (item: any) => {
        // If it's an insight and not a thread, show insight view (TBD)
        // For now, if we have thread data, show it.
        const thread = item as SavedThread;
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

                const threadObj = {
                    id: thread.id,
                    title: thread.title,
                    post: { title: thread.title, subreddit: thread.subreddit, author: thread.author },
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

    const handleDelete = async () => {
        if (!folder) return;
        if (confirm('Are you sure you want to delete this folder? All saved threads will be lost.')) {
            await deleteFolder(folder.id);
            navigate('/');
        }
    };

    const calculateTotalTokens = () => {
        return threads.reduce((acc, thread) => {
            if (thread.tokenCount) return acc + thread.tokenCount;
            const estimatedChars = (thread.title.length + (thread.commentCount * 1100));
            return acc + Math.ceil(estimatedChars / 4);
        }, 0);
    };

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num.toString();
    };

    const totalTokens = calculateTotalTokens();
    const formattedTokens = formatNumber(totalTokens);

    const handleAnalyze = async () => {
        if (!folderId || (threads.length === 0 && Object.keys(threadInsights).length === 0)) return;
        console.log(`Starting analysis for ${totalTokens} estimated tokens (${formattedTokens})`);
        setIsAnalyzing(true);
        setAnalysisError(null);
        try {
            await analyzeFolder(folderId);
            await refreshStats();
        } catch (err: any) {
            setAnalysisError(err.message || "Failed to analyze folder");
            setIsAnalyzing(false);
        }
    };

    const handleTestAggregation = async () => {
        if (!folderId) return;
        setIsAggregating(true);
        try {
            const result = await aggregateInsights(folderId);
            console.log("Aggregation Result:", result);
            alert(`Aggregation complete! Created ${result.aggregates.painPoints.length + result.aggregates.triggers.length + result.aggregates.outcomes.length} clusters.`);
            // Optionally refresh analysis history
            const data = await fetchFolderAnalysis(folderId);
            if (Array.isArray(data)) setAnalyses(data);
            else if (data) setAnalyses([data]);
        } catch (err: any) {
            alert("Aggregation failed: " + err.message);
        } finally {
            setIsAggregating(false);
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

    const MetricsBar = ({ folder }: { folder: any }) => {
        if (!folder) return null;

        const metrics = [
            { label: 'Pain Points', count: folder.painPointCount || 0, icon: <ShieldAlert size={18} />, color: '#ef4444' },
            { label: 'Switch Triggers', count: folder.triggerCount || 0, icon: <Target size={18} />, color: '#3b82f6' },
            { label: 'Desired Outcomes', count: folder.outcomeCount || 0, icon: <Lightbulb size={18} />, color: '#10b981' }
        ];

        const total = folder.totalAnalysisCount || 0;
        const completed = folder.completedAnalysisCount || 0;

        if (total > 0) {
            metrics.push({
                label: 'Analysed',
                count: `${completed}/${total}`,
                icon: <CheckCircle2 size={18} />,
                color: completed === total ? '#10b981' : '#f59e0b'
            });
        }

        return (
            <div className="analysis-metrics-bar" style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${metrics.length}, 1fr)`,
                gap: '20px',
                marginBottom: '2.5rem',
                background: 'rgba(255,255,255,0.02)',
                padding: '24px',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.05)',
                position: 'sticky',
                top: '20px',
                zIndex: 10,
                backdropFilter: 'blur(16px)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
            }}>
                {metrics.map((m, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                            <div style={{ color: m.color }}>{m.icon}</div>
                            <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{m.label}</span>
                        </div>
                        <div style={{
                            fontSize: '2rem',
                            fontWeight: '900',
                            color: (folder.analysisStatus === 'processing' && (m.count === 0 || (typeof m.count === 'string' && m.count.startsWith('0/'))))
                                ? 'rgba(255,255,255,0.3)'
                                : 'white'
                        }}>
                            {m.count}
                        </div>
                    </div>
                ))}
            </div>
        );
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

    if (loading) {
        return (
            <div className="folder-detail-view">
                <div className="folder-header-actions" style={{ marginBottom: '2.5rem' }}>
                    <Skeleton width="180px" height="40px" style={{ borderRadius: '12px' }} />
                </div>
                <div className="folder-header" style={{ border: 'none', padding: 0, marginBottom: '3rem' }}>
                    <Skeleton width="300px" height="48px" style={{ marginBottom: '12px' }} />
                    <Skeleton width="100%" height="24px" style={{ marginBottom: '8px' }} />
                    <Skeleton width="80%" height="24px" />
                </div>
            </div>
        );
    }

    if (!folder) {
        return (
            <div className="folder-detail-view" style={{ textAlign: 'center', padding: '100px 40px' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', width: '80px', height: '80px', borderRadius: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#ef4444' }}>
                    <AlertTriangle size={40} />
                </div>
                <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'white', marginBottom: '12px' }}>Folder Not Found</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px' }}>
                    The folder you're looking for doesn't exist or has been deleted.
                </p>
                <button className="btn-primary" onClick={() => navigate('/')}>
                    Go to Dashboard
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
                <div className="action-group" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {isAnalyzing ? (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            padding: '10px 24px',
                            borderRadius: '14px',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            color: '#3b82f6',
                            fontWeight: 600
                        }}>
                            <Loader2 className="animate-spin" size={18} />
                            Analyzing Intelligence...
                        </div>
                    ) : (
                        (threads.length > 0 || Object.keys(threadInsights).length > 0) && (
                            <button
                                className="btn-primary analyze-btn"
                                onClick={handleAnalyze}
                                disabled={isAnalyzing || folder.syncStatus === 'syncing'}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '10px 24px',
                                    borderRadius: '14px',
                                    background: 'linear-gradient(135deg, var(--primary-color) 0%, #FF8717 100%)',
                                    border: 'none',
                                    boxShadow: '0 4px 15px rgba(255, 135, 23, 0.3)',
                                    color: 'white',
                                    fontWeight: '700'
                                }}
                            >
                                <Sparkles size={18} />
                                {analyses.length > 0 ? 'Re-Analyze Intelligence' : 'Generate AI Intelligence'}
                            </button>
                        )
                    )}

                    {/* Temporary Test Aggregation Button */}
                    <button
                        className="btn-secondary"
                        onClick={handleTestAggregation}
                        disabled={isAggregating || isAnalyzing}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            color: '#10b981',
                            fontWeight: 600,
                            padding: '10px 16px',
                            borderRadius: '12px'
                        }}
                    >
                        {isAggregating ? <Loader2 className="animate-spin" size={16} /> : <BarChart2 size={16} />}
                        Test Aggregation
                    </button>

                    {isAnalyzing && (
                        <button
                            className="btn-secondary"
                            onClick={async () => {
                                if (confirm('Is the analysis stuck? This will force the status back to IDLE.')) {
                                    // Use direct import for getAuth to ensure current user token
                                    const { getAuth } = await import('firebase/auth');
                                    const token = await getAuth().currentUser?.getIdToken();
                                    const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3001/api' : '/api';

                                    await fetch(`${API_BASE}/folders/${folderId}/status`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`
                                        },
                                        body: JSON.stringify({ status: 'idle' })
                                    });
                                    window.location.reload();
                                }
                            }}
                            style={{ padding: '10px', minWidth: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)' }}
                            title="Clear Stuck Analysis"
                        >
                            <AlertTriangle size={18} color="#f59e0b" />
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
                    {folder.syncStatus === 'syncing' && (
                        <div className="syncing-badge" style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#3b82f6',
                            padding: '6px 14px',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            marginLeft: '10px'
                        }}>
                            <Loader2 size={14} className="animate-spin" />
                            BACKGROUND SYNCING
                        </div>
                    )}
                </div>
                {folder.description && <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '800px', lineHeight: '1.6', margin: '0 0 24px 0' }}>{folder.description}</p>}

                <div className="folder-stats" style={{ background: 'rgba(255,255,255,0.03)', padding: '16px 24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'inline-flex', gap: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={14} color="var(--primary-color)" />
                        <span style={{ fontWeight: '700', color: 'white' }}>
                            {Math.max(threads.length + Object.keys(threadInsights).length, (folder as any).totalAnalysisCount || 0)}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>Platforms Scanned</span>
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

            {/* Consolidated Metrics Bar */}
            {realtimeFolder && (realtimeFolder.analysisStatus === 'processing' || (realtimeFolder.painPointCount || 0) > 0) && (
                <MetricsBar folder={realtimeFolder} />
            )}

            <IntelligenceScanner isAnalyzing={isAnalyzing} />

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
                                        <button className="btn-icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); exportReportToPDF(analysis); }} title="Download PDF" style={{ padding: '4px', borderRadius: '6px', background: 'rgba(255, 69, 0, 0.1)', border: '1px solid rgba(255, 69, 0, 0.2)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FileDown size={16} />
                                        </button>
                                        {index === 0 ? "(Expanded)" : "(Click to view history)"}
                                    </span>
                                </summary>
                                <div className="report-content">
                                    <AnalysisResults data={analysis} onCitationClick={handleCitationClick} />
                                </div>
                            </details>
                        </div>
                    ))}
                </div>
            )}

            <div className="threads-list" style={{ marginTop: '2rem' }}>
                {threads
                    .sort((a, b) => {
                        const dateA = new Date((a as any).savedAt || 0).getTime();
                        const dateB = new Date((b as any).savedAt || 0).getTime();
                        return dateB - dateA;
                    })
                    .map(item => {
                        const status = (item as any).analysisStatus || (isAnalyzing ? 'processing' : 'pending');

                        return (
                            <div key={item.id} className={`thread-card ${status}`} onClick={() => handleSelectThread(item)} style={{ padding: '20px', position: 'relative' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ color: status === 'success' ? '#10b981' : 'var(--primary-color)', marginTop: '4px' }}>
                                        {status === 'success' ? <CheckCircle2 size={20} /> : <MessageSquareIcon size={20} />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h3 className="thread-title" style={{ margin: '0 0 4px 0', fontSize: '1.1rem', opacity: status === 'success' ? 0.7 : 1 }}>
                                            {(item as any).title || 'Extracted Insight'}
                                        </h3>
                                        <div className="thread-meta" style={{ display: 'flex', gap: '16px', opacity: 0.8, fontSize: '0.85rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <ExternalLink size={14} color="var(--bg-accent)" />
                                                <span>{(item as any).subreddit || 'r/extracted'}</span>
                                            </div>
                                            {status && (
                                                <div style={{
                                                    marginLeft: 'auto',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 800,
                                                    textTransform: 'uppercase',
                                                    color: status === 'processing' ? '#3b82f6' :
                                                        status === 'success' ? '#10b981' : '#ef4444'
                                                }}>
                                                    {status === 'processing' && <Loader2 size={12} className="animate-spin" />}
                                                    {status}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
            </div>
        </div>
    );
};
