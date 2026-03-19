import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDiscoveryContext } from './contexts/DiscoveryContext';
import { DiscoveryInput } from './components/DiscoveryInput';
import { ResultGrid } from './components/ResultGrid';
import { DiscoverySidebar } from './components/DiscoverySidebar';
import { DiscoverySuccessView } from './components/DiscoverySuccessView';
import { UpgradeModal } from '../UpgradeModal';
import { Lightbulb } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import type { DiscoveryHistoryEntry } from './hooks/useDiscovery';
import './DiscoveryWorkbench.css';

export const DiscoveryWorkbench: React.FC = () => {
    const { isUpgradeModalOpen, closeUpgradeModal } = useAuth();
    const location = useLocation();
    
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
        detectedIntent,
        showSelectedOnly,
        setShowSelectedOnly,
        isSearchingStarted,
        lastSyncInfo,
        setLastSyncInfo
    } = useDiscoveryContext();

    const [activeTab, setActiveTab] = useState<'competitor' | 'idea' | 'bulk'>('idea');
    const [competitor, setCompetitor] = useState('');
    const [idea, setIdea] = useState('');
    const [bulkUrls, setBulkUrls] = useState('');
    const [communities, setCommunities] = useState<string[]>([]);
    const [competitorsList, setCompetitorsList] = useState('');

    const handleHistorySelect = useCallback(async (entry: DiscoveryHistoryEntry) => {
        if (entry.type === 'competitor') {
            setActiveTab('competitor');
            setCompetitor(entry.query);
            await search(entry.query);
        } else if (entry.type === 'idea') {
            setActiveTab('idea');
            setIdea(entry.query);
            setCommunities(entry.params.communities || []);
            setCompetitorsList(entry.params.competitors?.join(', ') || '');
            await ideaSearch(entry.query, entry.params.communities, entry.params.competitors);
        }
    }, [search, ideaSearch]);

    // Handle history selection from sidebar navigation
    useEffect(() => {
        if (location.state?.historyEntry) {
            const entry = location.state.historyEntry as DiscoveryHistoryEntry;
            handleHistorySelect(entry);
            // Clear state so it doesn't trigger on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location.state, handleHistorySelect]);

    const handleSearch = async () => {
        if (!competitor.trim()) return;
        await search(competitor);
    };

    const handleIdeaSearch = async () => {
        if (!idea.trim()) return;
        const competitors = competitorsList.split(',').map(c => c.trim()).filter(c => c !== '');
        await ideaSearch(idea, communities, competitors);
    };

    const handleBulkImport = async (urls: string[]) => {
        await importUrls(urls);
    };

    const handleClear = () => {
        clearResults();
        setCompetitor('');
        setIdea('');
        setBulkUrls('');
        setCompetitorsList('');
        setCommunities([]);
    };

    return (
        <div className={`w-full h-full min-h-[calc(100vh-64px)] flex flex-col transition-all duration-700 ease-in-out ${isSearchingStarted || results.length > 0 ? 'active' : 'hero'}`}>
            {/* Integrated Panel Toolbar - Simplified */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/2 backdrop-blur-md sticky top-0 z-40">
                <div className="flex flex-col">
                    <h2 className="text-sm font-black text-white tracking-tight uppercase leading-none mb-0.5">Discovery Workbench</h2>
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none">Intelligence Engine</span>
                </div>
                
                <div className="flex items-center gap-3">
                    {status && <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FF4500] animate-pulse">{status}</div>}
                </div>
            </div>

            <div className="flex-1 flex flex-row overflow-hidden relative">
                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto px-12 py-10 custom-scrollbar">
                    <div className="dw-container mt-[2vh]">
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
                            <div className="relative flex flex-wrap items-center justify-between gap-4 mt-6 mb-8 w-full px-6 py-4 bg-white/3 border border-white/10 rounded-2xl backdrop-blur-xl">
                                {results.length > 0 && !loading && (
                                    <div className="flex items-center gap-2">
                                        <button className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors" onClick={selectAllVisible}>Select All</button>
                                        <button className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors" onClick={unselectAllVisible}>Clear Selection</button>
                                        <div className="w-px h-3 bg-white/10 mx-1" />
                                        <button className="text-[10px] font-black uppercase tracking-widest text-red-500/80 hover:text-red-500 transition-colors" onClick={handleClear}>Reset Search</button>
                                    </div>
                                )}

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
                                </div>
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
                                        isSidebarOpen={selectedResults.length > 0}
                                    />
                                )}
                            </main>
                        </div>
                    )}
                </div>

                {/* Local Side Panel (Cart) restored correctly in the horizontal flex */}
                {selectedResults.length > 0 && <DiscoverySidebar />}
            </div>

            <UpgradeModal
                isOpen={isUpgradeModalOpen}
                onClose={closeUpgradeModal}
            />
        </div>
    );
};
