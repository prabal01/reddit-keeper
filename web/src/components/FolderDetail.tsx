import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFolders } from '../contexts/FolderContext';
import { useAuth } from '../contexts/AuthContext';
import { FolderHeader } from './folder/FolderHeader';
import { PremiumLoader } from './PremiumLoader';
import './Folders.css';
import './AnalysisResults.css';
import './folder/Folder.css';
import { fetchFolderAnalysis, aggregateInsights } from '../lib/api';
import { Loader2, AlertCircle, X, AlertTriangle, Sparkles, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Badge } from './common/Badge';
import { UIButton } from './common/UIButton';
import { H2, Metadata } from './common/Typography';

// Tab Components
import { InboxTab } from './folder/tabs/InboxTab';
import { MarketMapTab } from './folder/tabs/MarketMapTab';
import { StrategyTab } from './folder/tabs/StrategyTab';
import { ConfigsTab } from './folder/tabs/ConfigsTab';
import type { Lead } from '../contexts/FolderContext';

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

export const FolderDetail: React.FC = () => {
    const { folderId } = useParams<{ folderId: string }>();
    const navigate = useNavigate();
    const { folders, getFolderThreads, deleteFolder, analyzeFolder, getFolderPatterns, getFolderLeads, updateLeadStatus, getFolderAlerts } = useFolders();
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
    const [isAggregating, setIsAggregating] = useState(false);

    const [patterns, setPatterns] = useState<any[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);

    // 3-Tab Dashboard + Configs panel state
    const [activeTab, setActiveTab] = useState<'feed' | 'painmap' | 'strategy'>('feed');
    const [showConfigs, setShowConfigs] = useState(false);

    useEffect(() => {
        if (!folderId || folderId === 'inbox') {
            setLoading(false);
            return;
        }

        const loadFolderData = async () => {
            try {
                const [threadData, patternData, leadData, alertData] = await Promise.all([
                    getFolderThreads(folderId),
                    getFolderPatterns(folderId),
                    getFolderLeads(folderId),
                    getFolderAlerts(folderId)
                ]);

                setThreads(Array.isArray(threadData) ? threadData : ((threadData as any).threads || []));
                setPatterns(patternData || []);
                setLeads(leadData || []);
                setAlerts(alertData || []);

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

    // Batch status update for person-centric leads (all threads from one author)
    const handleBatchUpdateLeadStatus = async (leadIds: string[], status: 'new' | 'contacted' | 'ignored'): Promise<void> => {
        if (!folderId) return;
        try {
            await Promise.all(leadIds.map(id => updateLeadStatus(folderId, id, status)));
            setLeads(prev => prev.map(l => leadIds.includes(l.id) ? { ...l, status } : l));
            toast.success(`Marked ${leadIds.length > 1 ? `${leadIds.length} threads` : 'thread'} as ${status}`);
        } catch {
            toast.error("Failed to update status");
        }
    };

    const handleAnalyze = async () => {
        if (!folderId || threads.length === 0) return;
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
            setActiveTab('feed');
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

    const handleClearStuck = async () => {
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
    };

    if (fetchingThread) {
        return <PremiumLoader fullPage text="Loading thread..." />;
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
        <div className="folder-detail-view dashboard-layout">
            <div className="folder-detail-container">
                <FolderHeader
                    folder={folder}
                    isAnalyzing={isAnalyzing || (realtimeFolder || folder).analysisStatus === 'analyzing'}
                    leadsCount={leads.length}
                    patternsCount={patterns.length}
                    lastScanTime={alerts[0]?.timestamp || null}
                    onConfigsOpen={() => setShowConfigs(s => !s)}
                    configsOpen={showConfigs}
                />

                {analysisError && (
                    <div className="error-banner mb-6">
                        <span className="error-icon"><AlertTriangle size={20} /></span>
                        <p>{analysisError}</p>
                    </div>
                )}

                {/* Inline Configs Panel */}
                {showConfigs && (
                    <div className="configs-inline-panel">
                        <ConfigsTab
                            folder={realtimeFolder || folder}
                            onDelete={handleDelete}
                            onClearStuck={handleClearStuck}
                            onClose={() => setShowConfigs(false)}
                        />
                    </div>
                )}

                {/* 3-Tab Navigation */}
                <div className="folder-tab-navbar sticky-tabs fadeInUp bg-(--bg-secondary)/50 backdrop-blur-md border-b border-(--border-light) mb-6 flex items-center px-2">
                    <button
                        className={`folder-tab flex items-center gap-2 px-6 py-4 border-b-2 transition-all ${activeTab === 'feed' ? 'border-(--bg-accent) text-(--text-primary)' : 'border-transparent text-(--text-tertiary) hover:text-(--text-secondary)'}`}
                        onClick={() => setActiveTab('feed')}
                        title="People you should reach out to"
                    >
                        <span className="text-sm font-bold">Prospects</span>
                        {leads.length > 0 && (
                            <Badge variant="neutral" className="px-1.5! py-0! text-[10px]! font-black! bg-(--bg-accent)/10 text-(--bg-accent)">
                                {leads.length}
                            </Badge>
                        )}
                    </button>
                    <button
                        className={`folder-tab flex items-center gap-2 px-6 py-4 border-b-2 transition-all ${activeTab === 'painmap' ? 'border-(--bg-accent) text-(--text-primary)' : 'border-transparent text-(--text-tertiary) hover:text-(--text-secondary)'}`}
                        onClick={() => setActiveTab('painmap')}
                        title="Common problems people are having"
                    >
                        <span className="text-sm font-bold">Problems</span>
                        {patterns.length > 0 && (
                            <Badge variant="neutral" className="px-1.5! py-0! text-[10px]! font-black! bg-orange-500/10 text-orange-500">
                                {patterns.length}
                            </Badge>
                        )}
                    </button>
                    <button
                        className={`folder-tab flex items-center gap-2 px-6 py-4 border-b-2 transition-all ${activeTab === 'strategy' ? 'border-(--bg-accent) text-(--text-primary)' : 'border-transparent text-(--text-tertiary) hover:text-(--text-secondary)'}`}
                        onClick={() => setActiveTab('strategy')}
                        title="Settings for this monitor"
                    >
                        <Sparkles size={14} className={activeTab === 'strategy' ? 'text-(--bg-accent)' : ''} />
                        <span className="text-sm font-bold">Settings</span>
                    </button>
                </div>

                <div className="tab-content-wrapper">
                    {activeTab === 'feed' && (
                        <InboxTab
                            leads={leads}
                            alerts={alerts}
                            onUpdateLeadStatus={handleBatchUpdateLeadStatus}
                        />
                    )}

                    {activeTab === 'painmap' && (
                        <MarketMapTab
                            patterns={patterns}
                        />
                    )}

                    {activeTab === 'strategy' && (
                        <StrategyTab
                            analyses={analyses}
                            isAnalyzing={isAnalyzing}
                            isAggregating={isAggregating}
                            hasThreads={threads.length > 0}
                            onAnalyze={handleAnalyze}
                            onReport={handleTestAggregation}
                            onCitationClick={handleCitationClick}
                        />
                    )}
                </div>
            </div>

            {/* Thread Detail Modal */}
            {selectedThread && (
                <div className="modal-overlay fixed inset-0 bg-(--bg-primary)/80 backdrop-blur-sm z-2000 flex items-center justify-center p-6" onClick={() => setSelectedThread(null)}>
                    <div className="modal-content large bg-(--bg-secondary) border border-(--border-light) rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="modal-header p-6 border-b border-(--border-light) flex justify-between items-center bg-(--bg-secondary)">
                            <H2 className="text-xl! truncate pr-8">{selectedThread.title || selectedThread.post?.title || 'Insight Details'}</H2>
                            <UIButton variant="secondary" size="sm" className="p-2!" onClick={() => setSelectedThread(null)} icon={<X size={20} />} />
                        </div>
                        <div className="modal-body overflow-y-auto p-8 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8">
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <Metadata className="text-(--text-tertiary) font-bold uppercase tracking-wider text-[10px]">Intelligence Source</Metadata>
                                        <div className="bg-(--bg-input) border border-(--border-light) rounded-2xl p-6 text-(--text-primary) leading-relaxed selection:bg-(--bg-accent)/20">
                                            {selectedThread.content || selectedThread.summary || 'No original content available.'}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="bg-(--bg-input) border border-(--border-light) rounded-2xl p-6 space-y-6 shadow-sm">
                                        <div className="space-y-4">
                                            <Metadata className="text-(--text-tertiary) font-bold uppercase tracking-wider text-[10px]">Signal Origin</Metadata>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-(--text-secondary)">Subreddit</span>
                                                    <span className="font-bold text-(--bg-accent)">r/{selectedThread.post?.subreddit || 'Reddit'}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-(--text-secondary)">Thread Author</span>
                                                    <span className="font-bold">u/{selectedThread.post?.author || 'Anonymous'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {selectedThread.metadata?.source && (
                                            <UIButton
                                                variant="primary"
                                                className="w-full justify-center"
                                                onClick={() => window.open(selectedThread.metadata.source, '_blank')}
                                                icon={<ExternalLink size={16} />}
                                            >
                                                Open on Source
                                            </UIButton>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
