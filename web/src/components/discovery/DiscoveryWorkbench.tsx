import React, { useState } from 'react';
import { useFolders } from '../../contexts/FolderContext';
import { useAuth } from '../../contexts/AuthContext';
import { useDiscovery } from './hooks/useDiscovery';
import { DiscoveryInput } from './components/DiscoveryInput';
import { ResultGrid } from './components/ResultGrid';
import { DiscoverySidebar } from './components/DiscoverySidebar';
import { DiscoverySuccessView } from './components/DiscoverySuccessView';
import DiscoveryHistoryPopover from './components/DiscoveryHistoryPopover';
import { UpgradeModal } from '../UpgradeModal';
import { Lightbulb, Sidebar as SidebarIcon, History as HistoryIcon } from 'lucide-react';
import './DiscoveryWorkbench.css';

export const DiscoveryWorkbench: React.FC = () => {
    const { syncThreads, folders } = useFolders();
    const { isUpgradeModalOpen, closeUpgradeModal } = useAuth();
    const {
        results,
        selectedResults,
        loading,
        selectedIds,
        discoveryPlan,
        platformFilter,
        setPlatformFilter,
        intentFilter,
        setIntentFilter,
        search,
        ideaSearch,
        importUrls,
        enrichResult,
        toggleSelection,
        selectAllVisible,
        unselectAllVisible,
        clearResults,
        status,
        setSelectedIds,
        detectedIntent,
        showSelectedOnly,
        setShowSelectedOnly,
        history,
        historyLoading,
        deleteHistoryItem
    } = useDiscovery();

    const [activeTab, setActiveTab] = useState<'competitor' | 'idea' | 'bulk'>('idea');
    const [competitor, setCompetitor] = useState('');
    const [idea, setIdea] = useState('');
    const [bulkUrls, setBulkUrls] = useState('');
    const [communities, setCommunities] = useState<string[]>([]);
    const [competitorsList, setCompetitorsList] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [isSearchingStarted, setIsSearchingStarted] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [lastSyncInfo, setLastSyncInfo] = useState<{ count: number, folderName: string, folderId: string } | null>(null);

    const handleSearch = async () => {
        if (!competitor.trim()) return;
        setIsSearchingStarted(true);
        await search(competitor);
    };

    const handleIdeaSearch = async () => {
        if (!idea.trim()) return;
        setIsSearchingStarted(true);
        const competitors = competitorsList.split(',').map(c => c.trim()).filter(c => c !== '');
        await ideaSearch(idea, communities, competitors);
    };

    const handleBulkImport = async (urls: string[]) => {
        setIsSearchingStarted(true);
        await importUrls(urls);
    };

    const handleSaveSelection = async (folderId: string) => {
        const urls = selectedResults.map(r => r.url);
        const items = selectedResults.map(r => ({
            url: r.url,
            title: r.title,
            author: r.author || "unknown",
            subreddit: r.subreddit,
            num_comments: r.num_comments
        }));
        const folder = folders.find((f: any) => f.id === folderId);
        const count = selectedResults.length;

        setIsSaving(true);
        try {
            await syncThreads(folderId, urls, items);
            setLastSyncInfo({
                count,
                folderId,
                folderName: folder?.name || 'Selected Folder'
            });
            setSelectedIds(new Set());
            clearResults();
            setIsSearchingStarted(false);
            setCompetitor('');
            setIdea('');
            setBulkUrls('');
            setCompetitorsList('');
        } catch (err) {
            console.error("Failed to save selection:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleClear = () => {
        clearResults();
        setIsSearchingStarted(false);
        setCompetitor('');
        setIdea('');
        setBulkUrls('');
        setCompetitorsList('');
        setCommunities([]);
    };

    const handleHistorySelect = async (entry: any) => {
        if (entry.type === 'competitor') {
            setActiveTab('competitor');
            setCompetitor(entry.query);
            setIsSearchingStarted(true);
            await search(entry.query);
        } else if (entry.type === 'idea') {
            setActiveTab('idea');
            setIdea(entry.query);
            setCommunities(entry.params.communities || []);
            setCompetitorsList(entry.params.competitors?.join(', ') || '');
            setIsSearchingStarted(true);
            await ideaSearch(entry.query, entry.params.communities, entry.params.competitors);
        }
        setIsHistoryOpen(false);
    };

    return (
        <div className={`w-full px-5 min-h-[calc(100vh-80px)] flex flex-col transition-all duration-700 ease-in-out ${isSearchingStarted || results.length > 0 ? 'active' : 'hero'} ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <header className={`transition-all duration-700 ${isSearchingStarted || results.length > 0 ? 'h-0 opacity-0 overflow-hidden mb-0' : 'text-center mt-[8vh] mb-12'}`}>
                <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold mb-3 tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-white/20">
                    Discovery Workbench
                </h1>
                <p className="text-sm font-medium text-slate-500 tracking-widest uppercase">Intelligent Research Engine</p>
            </header>

            <div className="flex gap-8 w-full flex-1 relative min-w-0">
                <div className="flex-1 min-w-0 flex flex-col">
                    <div className="dw-container">
                        <DiscoveryInput
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            competitor={competitor}
                            setCompetitor={setCompetitor}
                            onCompetitorSearch={handleSearch}
                            idea={idea}
                            setIdea={setIdea}
                            communities={communities}
                            addCommunity={(comm: string) => setCommunities([...communities, comm])}
                            removeCommunity={(comm: string) => setCommunities(communities.filter(c => c !== comm))}
                            competitorsList={competitorsList}
                            setCompetitorsList={setCompetitorsList}
                            onIdeaSearch={handleIdeaSearch}
                            bulkUrls={bulkUrls}
                            setBulkUrls={setBulkUrls}
                            onBulkImport={handleBulkImport}
                            loading={loading}
                        />
                    </div>

                    {(isSearchingStarted || results.length > 0 || loading) && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
                            {/* Unified Control Bar */}
                            <div className="relative flex flex-wrap items-center justify-between gap-4 mt-6 mb-8 w-full px-4 py-3 bg-white/[0.02] border border-white/5 rounded-2xl backdrop-blur-xl">
                                <div className="flex items-center gap-3">
                                    <button 
                                        className={`dw-tab-btn !px-4 !py-2 !rounded-xl !border-white/5 ${isHistoryOpen ? 'active' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsHistoryOpen(!isHistoryOpen);
                                        }}
                                    >
                                        <HistoryIcon size={14} />
                                        History
                                    </button>
                                    <div className="w-px h-4 bg-white/10 mx-1" />
                                    {results.length > 0 && !loading && (
                                        <div className="flex items-center gap-2">
                                            <button className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors" onClick={selectAllVisible}>Select All</button>
                                            <button className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors" onClick={unselectAllVisible}>Clear Selection</button>
                                            <div className="w-px h-3 bg-white/10 mx-1" />
                                            <button className="text-[10px] font-black uppercase tracking-widest text-red-500/80 hover:text-red-500 transition-colors" onClick={handleClear}>Reset Search</button>
                                        </div>
                                    )}
                                </div>

                                {discoveryPlan && !loading && (
                                    <div className="flex gap-6 items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Scanned</span>
                                            <span className="text-xs font-bold text-white tabular-nums">{discoveryPlan.scannedCount}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">High Signal</span>
                                            <span className="text-xs font-bold text-[#FF8717] tabular-nums">{discoveryPlan.totalFound}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3">
                                    {status && <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FF4500] animate-pulse">{status}</div>}
                                    
                                    {results.length > 0 && !loading && (
                                        <>
                                            <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10">
                                                {(['all', 'reddit', 'hn'] as const).map(p => (
                                                    <button
                                                        key={p}
                                                        onClick={() => setPlatformFilter(p)}
                                                        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${
                                                            platformFilter === p ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
                                                        }`}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                            <select
                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 outline-none focus:text-white focus:border-[#FF4500]/30 appearance-none cursor-pointer"
                                                value={intentFilter}
                                                onChange={(e) => setIntentFilter(e.target.value as any)}
                                            >
                                                <option value="all">All Intents</option>
                                                <option value="frustration">Frustration</option>
                                                <option value="alternative">Alternatives</option>
                                                <option value="high_engagement">High Signal</option>
                                            </select>
                                            <div className="w-px h-4 bg-white/10" />
                                        </>
                                    )}
                                    <button
                                        className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                                            showSelectedOnly ? 'bg-[#FF4500]/10 border-[#FF4500]/30 text-[#FF8717]' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'
                                        }`}
                                        onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${showSelectedOnly ? 'bg-[#FF4500] shadow-[0_0_8px_rgba(255,69,0,0.5)]' : 'bg-slate-700'}`} />
                                        Selected Only
                                    </button>
                                    <button
                                        className={`p-2 rounded-xl border transition-all ${
                                            isSidebarOpen ? 'bg-gradient-to-br from-[#FF4500] to-[#FF8717] border-transparent text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'
                                        }`}
                                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                        title="Toggle Research Workspace"
                                    >
                                        <SidebarIcon size={16} />
                                    </button>
                                </div>

                                <DiscoveryHistoryPopover
                                    history={history}
                                    isOpen={isHistoryOpen}
                                    onClose={() => setIsHistoryOpen(false)}
                                    onSelect={handleHistorySelect}
                                    onDelete={deleteHistoryItem}
                                    isLoading={historyLoading}
                                />
                            </div>

                            {detectedIntent && activeTab === 'idea' && !loading && (
                                <div className="bg-[#FF4500]/5 border border-[#FF4500]/10 p-6 rounded-[24px] mb-8 flex flex-col md:flex-row gap-6 items-center animate-in zoom-in-95 duration-500">
                                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#FF4500]">
                                        <Lightbulb size={16} />
                                        <span>Idea Context</span>
                                    </div>
                                    <div className="flex flex-wrap gap-4">
                                        <span className="text-xs text-slate-400"><b>Persona:</b> {detectedIntent.persona}</span>
                                        <span className="text-xs text-slate-400"><b>Pain:</b> {detectedIntent.pain}</span>
                                        <span className="text-xs text-slate-400"><b>Domain:</b> {detectedIntent.domain}</span>
                                    </div>
                                </div>
                            )}

                            <main className="mt-0 w-full mb-20">
                                {lastSyncInfo ? (
                                    <DiscoverySuccessView
                                        {...lastSyncInfo}
                                        onReset={() => setLastSyncInfo(null)}
                                    />
                                ) : (
                                    <ResultGrid
                                        results={results}
                                        selectedIds={selectedIds}
                                        onToggle={toggleSelection}
                                        onEnrichResult={enrichResult}
                                        isSidebarOpen={isSidebarOpen}
                                    />
                                )}
                            </main>
                        </div>
                    )}
                </div>

                {(isSearchingStarted || results.length > 0 || loading) && isSidebarOpen && (
                    <DiscoverySidebar
                        selectedResults={selectedResults}
                        onToggleSelection={toggleSelection}
                        onSave={handleSaveSelection}
                        onClear={() => setSelectedIds(new Set())}
                        isSaving={isSaving}
                    />
                )}
            </div>

            <UpgradeModal
                isOpen={isUpgradeModalOpen}
                onClose={closeUpgradeModal}
            />
        </div>
    );
};
