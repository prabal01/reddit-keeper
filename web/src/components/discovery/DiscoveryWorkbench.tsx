import React, { useState } from 'react';
import { useFolders } from '../../contexts/FolderContext';
import { useAuth } from '../../contexts/AuthContext';
import { useDiscovery } from './hooks/useDiscovery';
import { SearchHeader } from './components/SearchHeader';
import { IdeaSearchHeader } from './components/IdeaSearchHeader';
import { BulkImportHeader } from './components/BulkImportHeader';
import { ResultGrid } from './components/ResultGrid';
import { DiscoverySidebar } from './components/DiscoverySidebar';
import { DiscoverySuccessView } from './components/DiscoverySuccessView';
import DiscoveryHistoryPopover from './components/DiscoveryHistoryPopover';
import { UpgradeModal } from '../UpgradeModal';
import { Info, Search as SearchIcon, Lightbulb, Sidebar as SidebarIcon, Zap, History as HistoryIcon } from 'lucide-react';
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

    const handleTabChange = (tab: 'competitor' | 'idea' | 'bulk') => {
        setActiveTab(tab);
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

    const renderHeader = () => {
        switch (activeTab) {
            case 'competitor':
                return (
                    <SearchHeader
                        competitor={competitor}
                        setCompetitor={setCompetitor}
                        onSearch={handleSearch}
                        loading={loading}
                        platformFilter={platformFilter}
                        setPlatformFilter={setPlatformFilter}
                        intentFilter={intentFilter}
                        setIntentFilter={setIntentFilter}
                    />
                );
            case 'idea':
                return (
                    <IdeaSearchHeader
                        idea={idea}
                        setIdea={setIdea}
                        communities={communities}
                        addCommunity={(comm) => setCommunities([...communities, comm])}
                        removeCommunity={(comm) => setCommunities(communities.filter(c => c !== comm))}
                        competitors={competitorsList}
                        setCompetitors={setCompetitorsList}
                        onSearch={handleIdeaSearch}
                        loading={loading}
                        platformFilter={platformFilter}
                        setPlatformFilter={setPlatformFilter}
                        intentFilter={intentFilter}
                        setIntentFilter={setIntentFilter}
                    />
                );
            case 'bulk':
                return (
                    <BulkImportHeader
                        onImport={handleBulkImport}
                        loading={loading}
                    />
                );
        }
    };

    return (
        <div className={`w-full px-5 min-h-[calc(100vh-80px)] flex flex-col transition-all duration-500 ease-in-out ${isSearchingStarted || results.length > 0 ? 'active' : 'hero'} ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <header className={`mb-4 ${isSearchingStarted || results.length > 0 ? 'text-left scale-90 origin-left mb-1' : 'text-center mt-[5vh]'}`}>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-0 tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-[#FF8717] transition-all duration-700">
                    Discovery Workbench
                </h1>
                <p className="text-sm text-slate-400 opacity-80">Build your research intelligence from Reddit & Hacker News.</p>
            </header>

            <div className="flex gap-6 w-full flex-1 relative min-w-0">
                <div className="flex-1 min-w-0 flex flex-col transition-all duration-400">
                    <div className="dw-container">
                        {/* Tab Bar */}
                        <div className="dw-tab-bar">
                            <div className="flex gap-4 w-full justify-start items-center">
                                <button
                                    className={`dw-tab-btn ${activeTab === 'competitor' ? 'active' : ''}`}
                                    onClick={() => handleTabChange('competitor')}
                                >
                                    <SearchIcon size={14} />
                                    Competitors
                                </button>
                                <button
                                    className={`dw-tab-btn ${activeTab === 'idea' ? 'active' : ''}`}
                                    onClick={() => handleTabChange('idea')}
                                >
                                    <Lightbulb size={14} />
                                    Idea Search
                                </button>
                                <button
                                    className={`dw-tab-btn ${activeTab === 'bulk' ? 'active' : ''}`}
                                    onClick={() => handleTabChange('bulk')}
                                >
                                    <Zap size={14} />
                                    Bulk Import
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    className={`dw-tab-btn ${isHistoryOpen ? 'active' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsHistoryOpen(!isHistoryOpen);
                                    }}
                                    title="Search History"
                                >
                                    <HistoryIcon size={14} />
                                    History
                                </button>
                            </div>
                        </div>

                        {/* Search Input Area */}
                        <div className="py-2 px-4 sm:px-8 relative">
                            {renderHeader()}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-y-4 gap-x-6 mt-2 mb-3 w-full px-2">
                        <div className="flex flex-wrap gap-3 items-center z-10">
                            {results.length > 0 && !loading && (
                                <>
                                    <button className="dw-icon-btn hover:!bg-white/10" onClick={selectAllVisible}>Select All Shown</button>
                                    <button className="dw-icon-btn hover:!border-white/40 hover:!bg-white/10" onClick={unselectAllVisible}>Clear Shown</button>
                                </>
                            )}
                            <button
                                className="dw-icon-btn hover:!text-red-500 hover:!border-red-500/30 hover:!bg-red-500/10"
                                onClick={handleClear}
                            >
                                Clear All
                            </button>
                        </div>

                        {discoveryPlan && !loading && (
                            <div className="flex gap-6 bg-white/[0.03] backdrop-blur-2xl px-8 py-3.5 rounded-[18px] border border-white/10 shadow-2xl z-20 order-last xl:order-none mx-auto xl:mx-0 ring-1 ring-white/5">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Scanned</span>
                                    <span className="text-sm font-bold text-white tabular-nums">{discoveryPlan.scannedCount}</span>
                                </div>
                                <div className="w-px h-4 bg-white/10" />
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">High Signal</span>
                                    <span className="text-sm font-bold text-[#FF8717] tabular-nums">{discoveryPlan.totalFound}</span>
                                </div>
                                {discoveryPlan.isFromCache && (
                                    <>
                                        <div className="w-px h-4 bg-white/10" />
                                        <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                                            <Info size={12} />
                                            <span>Cached</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <div className="flex flex-wrap gap-3 items-center justify-end z-10 order-2 xl:order-none ml-auto">
                            {status && <div className="text-xs font-black uppercase tracking-widest text-[#FF4500] animate-pulse mr-2">{status}</div>}
                            <button
                                className={`dw-icon-btn flex items-center gap-2.5 ${showSelectedOnly ? 'active-focus' : ''}`}
                                onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                                title="Show Selected Only"
                            >
                                <div className={`w-2 h-2 rounded-full transition-all duration-500 focus-dot ${!showSelectedOnly ? 'bg-slate-700' : ''}`}></div>
                                Selected Only
                            </button>
                            <button
                                className={`dw-icon-btn ${isSidebarOpen ? 'active-solid' : ''}`}
                                style={{ width: '2.75rem', height: '2.75rem', padding: '0', justifyContent: 'center', borderRadius: '14px' }}
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                title="Toggle Research Workspace"
                            >
                                <SidebarIcon size={18} />
                            </button>
                        </div>
                    </div>

                    {detectedIntent && activeTab === 'idea' && !loading && (
                        <div className="bg-[#FF4500]/10 border border-[#FF4500]/20 p-4 rounded-2xl mb-8 flex flex-col md:flex-row gap-4 items-center">
                            <div className="flex items-center gap-2 text-sm font-bold text-[#FF4500]">
                                <Lightbulb size={16} />
                                <span>Idea Context:</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className="bg-white/5 px-3 py-1.5 rounded-lg text-xs border border-white/5 text-slate-300"><b>Persona:</b> {detectedIntent.persona}</span>
                                <span className="bg-white/5 px-3 py-1.5 rounded-lg text-xs border border-white/5 text-slate-300"><b>Pain:</b> {detectedIntent.pain}</span>
                                <span className="bg-white/5 px-3 py-1.5 rounded-lg text-xs border border-white/5 text-slate-300"><b>Domain:</b> {detectedIntent.domain}</span>
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

                    <DiscoveryHistoryPopover
                        history={history}
                        isOpen={isHistoryOpen}
                        onClose={() => setIsHistoryOpen(false)}
                        onSelect={handleHistorySelect}
                        onDelete={deleteHistoryItem}
                        isLoading={historyLoading}
                    />
                </div>

                {isSidebarOpen && (
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
