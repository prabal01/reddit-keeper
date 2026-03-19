import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFolders } from '../contexts/FolderContext';
import { useAuth } from '../contexts/AuthContext';
import { ThreadView } from './ThreadView';
import { AnalysisResults } from './AnalysisResults';
import { PremiumLoader } from './PremiumLoader';
import { Skeleton } from './Skeleton';
import { FolderHeader } from './folder/FolderHeader';
import { FolderMetrics } from './folder/FolderMetrics';
import { FolderAnalyses } from './folder/FolderAnalyses';
import { ThreadTable } from './folder/ThreadTable';
import './Folders.css';
import './AnalysisResults.css';
import './folder/Folder.css';
import { fetchFolderAnalysis, aggregateInsights } from '../lib/api';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { exportReportToPDF } from '../lib/pdfExport';
import { toast } from 'react-hot-toast';
import { Sidebar } from './Sidebar';
import { IntelligenceScanner } from './IntelligenceScanner';
import { BulkImportModal } from './BulkImportModal';

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

    useEffect(() => {
        if (!folderId || folderId === 'inbox') {
            setLoading(false);
            return;
        }

        const loadFolderData = async () => {
            try {
                const threadData = await getFolderThreads(folderId) as any;
                setThreads(Array.isArray(threadData) ? threadData : (threadData.threads || []));

                const analysisData = await fetchFolderAnalysis(folderId);
                if (analysisData) {
                    const processData = (d: any) => ({
                        ...(d.data || d),
                        id: d.id,
                        createdAt: d.createdAt || (d.data && d.data.createdAt),
                        model: d.model
                    });
                    if (Array.isArray(analysisData)) {
                        setAnalyses(analysisData.map(processData).sort((a: any, b: any) =>
                            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                        ));
                    } else {
                        setAnalyses([processData(analysisData)]);
                    }
                }

                const f = folders.find(f => f.id === folderId);
                if (f) {
                    setRealtimeFolder(f);
                    setIsAnalyzing(f.syncStatus === 'syncing');
                }
            } catch (err) {
                console.error("[FolderDetail] Error loading data:", err);
            } finally {
                setLoading(false);
            }
        };

        loadFolderData();

        const currentFolder = folders.find(f => f.id === folderId);
        let pollInterval: any;
        if (currentFolder?.syncStatus === 'syncing' || isAnalyzing) {
            pollInterval = setInterval(loadFolderData, 10000);
        }

        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [folderId, folders]);

    const handleSelectThread = async (item: any) => {
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
                toast.error("Failed to load thread content from Cloud Storage.");
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

    const handleAnalyze = async () => {
        if (!folderId || (threads.length === 0 && Object.keys(threadInsights).length === 0)) return;
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
            toast.success(`Aggregation complete! Created ${result.aggregates.painPoints.length + result.aggregates.triggers.length + result.aggregates.outcomes.length} clusters.`);
            
            const rawData = await fetchFolderAnalysis(folderId);
            const processData = (d: any) => ({ ...(d.data || d), id: d.id, createdAt: d.createdAt || (d.data && d.data.createdAt), model: d.model });
            if (Array.isArray(rawData)) setAnalyses(rawData.map(processData));
            else if (rawData) setAnalyses([processData(rawData)]);
        } catch (err: any) {
            toast.error("Aggregation failed: " + err.message);
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

    if (fetchingThread) {
        return <PremiumLoader fullPage text="Downloading from Cloud..." />;
    }

    if (loading) {
        return (
            <div className="flex-center full-page">
                <Loader2 className="animate-spin" size={32} color="var(--primary-color)" />
            </div>
        );
    }

    if (!folder) {
        return (
            <div className="flex-center full-page column">
                <AlertCircle size={48} color="#ef4444" />
                <h2 className="mt-4">Folder Not Found</h2>
                <button className="btn-primary mt-4" onClick={() => navigate('/')}>Return Home</button>
            </div>
        );
    }

    return (
        <div className="app-container">
            <Sidebar />
            <main className="main-content">
                <div className="folder-detail-container">
                    <FolderHeader 
                        folder={folder}
                        isAnalyzing={isAnalyzing || (realtimeFolder || folder).analysisStatus === 'analyzing'}
                        isAggregating={isAggregating}
                        hasThreads={threads.length > 0}
                        analysesCount={analyses.length}
                        onAnalyze={handleAnalyze}
                        onImport={() => setShowImportModal(true)}
                        onReport={handleTestAggregation}
                        onDelete={handleDelete}
                        onClearStuck={async () => {
                            if (confirm('Is the analysis stuck? This will force the status back to IDLE.')) {
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
                    />

                    {analysisError && (
                        <div className="error-banner mb-6">
                            <span className="error-icon"><AlertCircle size={20} /></span>
                            <p>{analysisError}</p>
                        </div>
                    )}

                    <FolderMetrics folder={realtimeFolder || folder} />

                    <IntelligenceScanner isAnalyzing={isAnalyzing || (realtimeFolder || folder).analysisStatus === 'analyzing'} />

                    <FolderAnalyses 
                        analyses={analyses} 
                        onCitationClick={handleCitationClick} 
                    />

                    <ThreadTable 
                        threads={threads} 
                        isAnalyzing={isAnalyzing || (realtimeFolder || folder).analysisStatus === 'analyzing'}
                        onSelectThread={handleSelectThread}
                    />
                </div>

                {/* Thread Detail Modal */}
                {selectedThread && (
                    <div className="modal-overlay" onClick={() => setSelectedThread(null)}>
                        <div className="modal-content large" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>{selectedThread.title || selectedThread.post?.title || 'Insight Details'}</h3>
                                <button className="btn-icon" onClick={() => setSelectedThread(null)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body scrollable">
                                <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
                                    <div className="detail-main">
                                        <div className="detail-section" style={{ marginBottom: '24px' }}>
                                            <h4 style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>Raw Content</h4>
                                            <div style={{ 
                                                padding: '20px', 
                                                background: 'rgba(0,0,0,0.2)', 
                                                borderRadius: '12px', 
                                                fontSize: '0.95rem', 
                                                lineHeight: '1.6', 
                                                color: 'var(--text-primary)',
                                                border: '1px solid var(--border-light)'
                                            }}>
                                                {selectedThread.content || selectedThread.summary || 'No original content available.'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="detail-sidebar">
                                        <div style={{ 
                                            padding: '20px', 
                                            background: 'var(--bg-secondary)', 
                                            borderRadius: '12px', 
                                            border: '1px solid var(--border)' 
                                        }}>
                                            <h4 style={{ marginBottom: '16px', fontSize: '0.9rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Thread Info</h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Source</span>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{selectedThread.post?.subreddit || 'Reddit'}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Author</span>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>u/{selectedThread.post?.author || 'Anonymous'}</span>
                                                </div>
                                                {selectedThread.metadata?.source && (
                                                    <a 
                                                        href={selectedThread.metadata.source} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="btn-glass"
                                                        style={{ marginTop: '16px', justifyContent: 'center', width: '100%' }}
                                                    >
                                                        Open on Source
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showImportModal && folderId && (
                    <BulkImportModal
                        folderId={folderId}
                        onClose={() => setShowImportModal(false)}
                        onSuccess={(count) => {
                            toast.success(`Successfully started import of ${count} URLs`);
                        }}
                    />
                )}
            </main>
        </div>
    );
};
