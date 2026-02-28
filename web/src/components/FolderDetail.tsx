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
import { AlertTriangle, Sparkles, Trash2, BarChart2, Calendar, MessageSquare as MessageSquareIcon, ExternalLink, FileDown, Loader2, Target, Lightbulb, ShieldAlert, CheckCircle2, UploadCloud, FileText } from 'lucide-react';
import { exportReportToPDF } from '../lib/pdfExport';
import { IntelligenceScanner } from './IntelligenceScanner';
import { BulkImportModal } from './BulkImportModal';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
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
    extractedPainPoints?: string[];
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
    const [showImportModal, setShowImportModal] = useState(false);

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

        // 2. Listen to Threads
        const threadsQuery = query(
            collection(db, 'saved_threads'),
            where('folderId', '==', folderId)
        );
        const unsubThreads = onSnapshot(threadsQuery, (snapshot) => {
            const threadData = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id
            })) as SavedThread[];
            setThreads(threadData);
            setLoading(false);
        });

        // 3. Listen to Analysis Results
        const analysisQuery = query(
            collection(db, 'folder_analyses'),
            where('folderId', '==', folderId)
        );
        const unsubAnalysis = onSnapshot(analysisQuery, (snapshot) => {
            const analysisData = snapshot.docs.map(doc => {
                const raw = doc.data();
                return {
                    ...(raw.data || raw),
                    id: doc.id,
                    createdAt: raw.createdAt || (raw.data && raw.data.createdAt),
                    model: raw.model
                };
            }).sort((a: any, b: any) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            });
            setAnalyses(analysisData);
        });

        return () => {
            unsubFolder();
            unsubThreads();
            unsubAnalysis();
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
            const rawData = await fetchFolderAnalysis(folderId);
            const processData = (d: any) => ({ ...(d.data || d), id: d.id, createdAt: d.createdAt || (d.data && d.data.createdAt), model: d.model });
            if (Array.isArray(rawData)) setAnalyses(rawData.map(processData));
            else if (rawData) setAnalyses([processData(rawData)]);
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
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
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

                    <button
                        className="btn-secondary"
                        onClick={() => setShowImportModal(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '10px 16px',
                            borderRadius: '14px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'white',
                            fontWeight: 600
                        }}
                    >
                        <UploadCloud size={16} />
                        Bulk Import
                    </button>

                    {/* Generate Report Button */}
                    <button
                        className="btn-primary"
                        onClick={handleTestAggregation}
                        disabled={isAggregating || isAnalyzing}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            border: 'none',
                            color: 'white',
                            fontWeight: 700,
                            padding: '10px 20px',
                            borderRadius: '14px',
                            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                        }}
                    >
                        {isAggregating ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
                        Get Report
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
                            {(realtimeFolder || folder as any).totalAnalysisCount || threads.length}
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

            {analyses.length > 0 && (() => {
                const latestReport = analyses[0];
                const pastReports = analyses.slice(1);

                return (
                    <div className="analysis-reports-section" style={{ marginTop: '2rem' }}>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FileText size={24} color="var(--primary-color)" />
                            Latest AI Report
                        </h3>
                        <div className="latest-report-card" style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ background: 'var(--primary-color)', color: 'white', fontSize: '0.75rem', fontWeight: 800, padding: '4px 8px', borderRadius: '6px' }}>LATEST</div>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        Generated {latestReport.createdAt ? new Date(latestReport.createdAt).toLocaleString() : 'Recently'}
                                    </span>
                                </div>
                                <button className="btn-secondary" onClick={() => exportReportToPDF(latestReport)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.85rem' }}>
                                    <FileDown size={14} /> Download PDF
                                </button>
                            </div>
                            <div style={{ padding: '24px' }}>
                                <AnalysisResults data={latestReport} onCitationClick={handleCitationClick} />
                            </div>
                        </div>

                        {pastReports.length > 0 && (
                            <div className="past-reports-section" style={{ marginTop: '3rem' }}>
                                <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '1rem' }}>Previous Reports</h4>
                                <div className="past-reports-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {pastReports.map((analysis, index) => (
                                        <details key={analysis.id || index} className="report-collapsible" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <summary className="report-summary" style={{ padding: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, color: 'white' }}>
                                                    <Calendar size={16} color="var(--text-muted)" />
                                                    Report from {analysis.createdAt ? new Date(analysis.createdAt).toLocaleString() : 'Unknown Date'}
                                                </span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Click to view details</span>
                                            </summary>
                                            <div style={{ padding: '24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                                                    <button className="btn-secondary" onClick={() => exportReportToPDF(analysis)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.85rem' }}>
                                                        <FileDown size={14} /> Download PDF
                                                    </button>
                                                </div>
                                                <AnalysisResults data={analysis} onCitationClick={handleCitationClick} />
                                            </div>
                                        </details>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            <div className="thread-list-container" style={{ marginTop: '2rem' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Saved Threads</h3>
                <div className="thread-list-header">
                    <div>Thread / Source</div>
                    <div>Saved Date</div>
                    <div>Status</div>
                    <div>Key Pain Points</div>
                </div>
                {threads
                    .sort((a, b) => {
                        const dateA = new Date(a.savedAt || 0).getTime();
                        const dateB = new Date(b.savedAt || 0).getTime();
                        return dateB - dateA;
                    })
                    .map(item => {
                        const status = item.analysisStatus || (isAnalyzing ? 'processing' : 'pending');
                        const painPoints = item.extractedPainPoints || [];

                        return (
                            <div key={item.id} className="thread-list-row" onClick={() => handleSelectThread(item)}>
                                <div className="thread-list-cell">
                                    <div className="thread-list-title" title={item.title || 'Extracted Insight'}>
                                        {item.title || 'Extracted Insight'}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', marginTop: '4px', opacity: 0.6 }}>
                                        <ExternalLink size={12} />
                                        <span>{item.subreddit || 'Unknown Source'}</span>
                                        {item.commentCount !== undefined && (
                                            <>
                                                <span style={{ margin: '0 4px', opacity: 0.5 }}>•</span>
                                                <MessageSquareIcon size={12} />
                                                <span>{item.commentCount} comments</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="thread-list-cell">
                                    {item.savedAt ? new Date(item.savedAt).toLocaleDateString() : '—'}
                                </div>
                                <div className="thread-list-cell">
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        background: status === 'processing' ? 'rgba(59, 130, 246, 0.1)' :
                                            status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        color: status === 'processing' ? '#3b82f6' :
                                            status === 'success' ? '#10b981' : '#ef4444'
                                    }}>
                                        {status === 'success' ? <CheckCircle2 size={12} /> :
                                            status === 'processing' ? <Loader2 size={12} className="animate-spin" /> :
                                                status === 'pending' ? <MessageSquareIcon size={12} /> :
                                                    <AlertTriangle size={12} />}
                                        {status}
                                    </div>
                                </div>
                                <div className="thread-list-cell">
                                    {painPoints.length > 0 ? (
                                        <div className="thread-list-badges">
                                            {painPoints.slice(0, 2).map((pp, i) => (
                                                <span key={i} className="pain-point-badge" title={pp}>{pp}</span>
                                            ))}
                                            {painPoints.length > 2 && (
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', alignSelf: 'center' }}>
                                                    +{painPoints.length - 2} more
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>
                                            {status === 'success' ? 'None found' : 'Waiting analysis...'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
            </div>

            {showImportModal && folderId && (
                <BulkImportModal
                    folderId={folderId}
                    onClose={() => setShowImportModal(false)}
                    onSuccess={(count) => {
                        console.log(`Successfully started import of ${count} URLs`);
                    }}
                />
            )}
        </div>
    );
};
