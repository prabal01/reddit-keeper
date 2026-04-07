import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDiscoveryContext } from './contexts/DiscoveryContext';
import { DiscoveryInput } from './components/DiscoveryInput';
import { ResultGrid } from './components/ResultGrid';
import { DiscoverySidebar } from './components/DiscoverySidebar';
import { DiscoverySuccessView } from './components/DiscoverySuccessView';
import { UpgradeModal } from '../UpgradeModal';
import { X, Lightbulb, History as HistoryIcon, Sparkles, Users, Link as LinkIcon, RotateCcw, ChevronLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { DiscoveryHistoryEntry } from './hooks/useDiscovery';
import { PageHeader } from '../common/PageHeader';
import { DiscoveryRecentHistory } from './components/DiscoveryRecentHistory';
import { SuccessStepper } from '../common/UXGuideComponents';
import { ResearchModeCards } from './components/ResearchModeCards';
import { DiscoveryWorkflowGuide } from './components/DiscoveryWorkflowGuide';
import { DiscoveryLoadingState } from './components/DiscoveryLoadingState';
import { UIButton } from '../common/UIButton';
import { Badge } from '../common/Badge';
import { Metadata } from '../common/Typography';
import './DiscoveryWorkbench.css';

export const DiscoveryWorkbench: React.FC = () => {
    const { isUpgradeModalOpen, closeUpgradeModal } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    
    const {
        results,
        selectedResults,
        loading,
        selectedIds,
        discoveryPlan,
        search,
        ideaSearch,
        startMonitoring,
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
        history,
        historyLoading,
        deleteHistoryItem,
        loadHistory,
        lastSyncInfo,
        setLastSyncInfo,
        error,
        setError
    } = useDiscoveryContext();

    const [activeTab, setActiveTab] = useState<'competitor' | 'idea' | 'bulk'>('idea');
    const [competitor, setCompetitor] = useState('');
    const [problem, setProblem] = useState('');
    const [audience, setAudience] = useState('');
    const [bulkUrls, setBulkUrls] = useState('');
    
    const [currentStep, setCurrentStep] = useState(0); 
    const [isMonitoringMode, setIsMonitoringMode] = useState(false);

    useEffect(() => {
        if (isMonitoringMode) return; // Don't advance the step if we're navigating to a folder
        if (results.length > 0 || lastSyncInfo) {
            setCurrentStep(2);
        } else if (isSearchingStarted) {
            setCurrentStep(2);
        }
    }, [results.length, lastSyncInfo, isSearchingStarted, isMonitoringMode]);

    const handleHistorySelect = useCallback(async (entry: DiscoveryHistoryEntry) => {
        setLastSyncInfo(null);
        if (entry.type === 'competitor') {
            setActiveTab('competitor');
            setCompetitor(entry.query);
            const loaded = await loadHistory(entry.id);
            if (!loaded) await search(entry.query);
        } else if (entry.type === 'idea') {
            setActiveTab('idea');
            if (entry.query.includes('for')) {
                const parts = entry.query.split('for');
                setProblem(parts[0].replace('I am solving ', '').trim());
                setAudience(parts[1].trim());
            } else {
                setProblem(entry.query);
            }
            const loaded = await loadHistory(entry.id);
            if (!loaded) await ideaSearch(entry.query, entry.params?.communities, entry.params?.competitors);
        } else if (entry.type === 'bulk') {
            setActiveTab('bulk');
            setBulkUrls(entry.query);
            const loaded = await loadHistory(entry.id);
            if (!loaded) await importUrls(entry.query.split('\n'));
        }
        setCurrentStep(2);
    }, [search, ideaSearch, importUrls, setLastSyncInfo, loadHistory]);

    useEffect(() => {
        if (location.state?.historyEntry) {
            const entry = location.state.historyEntry as DiscoveryHistoryEntry;
            handleHistorySelect(entry);
            window.history.replaceState({}, document.title);
        }
    }, [location.state, handleHistorySelect]);

    useEffect(() => {
        setError(null);
    }, [activeTab, setError]);

    const handleSearch = async () => {
        if (!competitor.trim()) return;
        setIsMonitoringMode(true);
        const folderId = await startMonitoring(competitor);
        if (folderId) {
            navigate(`/folders/${folderId}`);
        } else {
            setIsMonitoringMode(false); // Reset on failure so UI still works
        }
    };

    const handleIdeaSearch = async () => {
        if (!problem.trim()) return;
        const combinedQuery = audience.trim() 
            ? `I am solving ${problem} for ${audience}`
            : problem;
        setIsMonitoringMode(true);
        const folderId = await startMonitoring(combinedQuery);
        if (folderId) {
            navigate(`/folders/${folderId}`);
        } else {
            setIsMonitoringMode(false); // Reset on failure so UI still works
        }
    };

    const handleBulkImport = async (urls: string[]) => {
        await importUrls(urls);
    };

    const handleReset = () => {
        clearResults();
        setCompetitor('');
        setProblem('');
        setAudience('');
        setBulkUrls('');
        setLastSyncInfo(null);
        setCurrentStep(0);
    };

    const handleModeSelect = (mode: 'idea' | 'competitor' | 'bulk') => {
        setActiveTab(mode);
        setCurrentStep(1);
    };

    const getModeInfo = () => {
        switch (activeTab) {
            case 'idea': return { title: 'Idea Discovery', icon: <Sparkles size={14} />, desc: 'Finding relevant threads discussing your specific problem space.' };
            case 'competitor': return { title: 'Analyze Rivals', icon: <Users size={14} />, desc: 'Scanning discussions about specific competitor products.' };
            case 'bulk': return { title: 'Direct Links', icon: <LinkIcon size={14} />, desc: 'Deep-diving into the specific threads you provided.' };
        }
    };

    const modeInfo = getModeInfo();

    return (
        <div className="discovery-workbench-view flex h-[calc(100vh-64px)] overflow-hidden bg-(--bg-primary) outline-none">
            {/* Conditional Selection Sidebar (Only when results exist AND in Step 2) */}
            {selectedResults.length > 0 && currentStep === 2 && (
                <div className="w-80 border-r border-(--border) bg-(--bg-secondary)/20 backdrop-blur-xl flex flex-col h-full overflow-hidden animate-in slide-in-from-left duration-500">
                    <div className="discovery-sidebar-content flex-1 overflow-y-auto custom-scrollbar">
                        <DiscoverySidebar />
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Standardized Header Navigation Area */}
                <div className="flex items-center justify-between px-12 py-6 z-40 bg-linear-to-b from-(--bg-primary) to-transparent">
                    <PageHeader 
                        title="Discovery Workshop" 
                        subtitle={currentStep === 0 ? "Identify Opportunity Gaps" : "OpinionDeck AI v2.0"}
                    />
                    
                    <div className="flex items-center gap-4">
                        {/* Persistent Global Navigation Hook */}
                        {(currentStep === 1 || currentStep === 2) && !loading && (
                            <UIButton 
                                onClick={handleReset}
                                variant="secondary"
                                size="sm"
                                icon={currentStep === 1 ? <ChevronLeft size={16} /> : <RotateCcw size={16} />}
                            >
                                {currentStep === 1 ? 'Go Back' : 'New Research'}
                            </UIButton>
                        )}

                        {status && !loading && (
                            <Badge variant="premium" className="animate-in fade-in slide-in-from-right-4">
                                {status}
                            </Badge>
                        )}
                        
                        {/* History Icon (Always visible anchor) */}
                        <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-(--text-tertiary)">
                            <HistoryIcon size={18} />
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto px-12 pb-20 custom-scrollbar scroll-smooth">
                    <div className="dw-container w-full max-w-[1440px] mx-auto">
                        <div className="flex flex-col items-center">
                            <SuccessStepper 
                                steps={['Choose Path', 'Add Details', 'Extract Edge']}
                                currentStep={currentStep}
                            />
                        </div>

                        {currentStep === 0 && (
                            <div className="animate-in fade-in zoom-in-95 duration-1000">
                                <ResearchModeCards onSelect={handleModeSelect} />
                            </div>
                        )}

                        {currentStep === 1 && (
                            <div className="animate-in fade-in zoom-in-95 duration-700">
                                {/* Mode Info Box */}
                                <div className="max-w-4xl mx-auto flex items-center gap-4 px-6 py-4 bg-[#FF4500]/5 border border-[#FF4500]/10 rounded-2xl mb-8">
                                    <div className="w-8 h-8 rounded-lg bg-[#FF4500]/10 flex items-center justify-center text-[#FF4500]">
                                        {modeInfo.icon}
                                    </div>
                                    <div>
                                        <Metadata className="text-[#FF4500] opacity-100">{modeInfo.title}</Metadata>
                                        <p className="text-[11px] text-slate-400 font-medium">{modeInfo.desc}</p>
                                    </div>
                                </div>

                                <DiscoveryInput
                                    activeTab={activeTab}
                                    onBack={handleReset}
                                    competitor={competitor}
                                    setCompetitor={setCompetitor}
                                    onCompetitorSearch={handleSearch}
                                    problem={problem}
                                    setProblem={setProblem}
                                    audience={audience}
                                    setAudience={setAudience}
                                    onIdeaSearch={handleIdeaSearch}
                                    bulkUrls={bulkUrls}
                                    setBulkUrls={setBulkUrls}
                                    onBulkImport={handleBulkImport}
                                    loading={loading}
                                />
                            </div>
                        )}

                        {/* Persistent History Display for Selection & Input Steps */}
                        {(currentStep === 0 || currentStep === 1) && (
                            <div className="mt-20">
                                {history.length === 0 && !historyLoading && currentStep === 0 ? (
                                    <DiscoveryWorkflowGuide />
                                ) : (
                                    history.length > 0 && (
                                        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                                            <div className="flex items-center gap-3 mb-6 px-4">
                                                <HistoryIcon size={16} className="text-(--text-tertiary)" />
                                                <Metadata>Jump Back to Insights</Metadata>
                                            </div>
                                            <DiscoveryRecentHistory 
                                                history={history}
                                                isLoading={historyLoading}
                                                onDelete={deleteHistoryItem}
                                                onSelect={handleHistorySelect}
                                            />
                                        </div>
                                    )
                                )}
                            </div>
                        )}

                        {error && (
                            <div className="mt-8 max-w-4xl mx-auto px-6 py-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                    <span className="text-xs font-bold text-red-500/90">{error}</span>
                                </div>
                                <button onClick={() => setError(null)} className="text-red-500/40 hover:text-red-500 transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
                                {loading && (
                                    <DiscoveryLoadingState />
                                )}

                                {!loading && (
                                    <>
                                        {/* Result Grid Controls */}
                                        <div className="relative flex flex-wrap items-center justify-between gap-6 mt-8 mb-12 w-full px-8 py-5 bg-white/2 border border-white/5 rounded-[32px] backdrop-blur-3xl shadow-2xl">
                                            {results.length > 0 && (
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-4">
                                                        <button className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 hover:text-white transition-all" onClick={selectAllVisible}>Select All</button>
                                                        <div className="w-px h-4 bg-white/10" />
                                                        <button className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 hover:text-white transition-all" onClick={unselectAllVisible}>Clear Selection</button>
                                                    </div>
                                                </div>
                                            )}

                                            {discoveryPlan && (
                                                <div className="flex gap-8 items-center bg-black/40 px-8 py-3 rounded-2xl border border-white/10 shadow-lg backdrop-blur-3xl animate-in zoom-in-95 duration-500">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Checked</span>
                                                        <span className="text-sm font-black text-white">{discoveryPlan.scannedCount}</span>
                                                    </div>
                                                    <div className="w-px h-6 bg-white/10" />
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Found</span>
                                                        <span className="text-sm font-black text-[#FF4500]">{discoveryPlan.totalFound}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-5">
                                                <UIButton
                                                    variant={showSelectedOnly ? 'primary' : 'secondary'}
                                                    size="sm"
                                                    onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                                                    className="rounded-2xl!"
                                                >
                                                    {showSelectedOnly ? 'Showing Favorites' : 'Show Favorites'}
                                                </UIButton>
                                            </div>
                                        </div>

                                        {detectedIntent && activeTab === 'idea' && (
                                            <div className="bg-[#FF4500]/5 border border-[#FF4500]/10 p-8 rounded-[32px] mb-12 flex flex-col md:flex-row gap-8 items-center animate-in zoom-in-95 duration-700 backdrop-blur-xl">
                                                <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.3em] text-[#FF4500] bg-[#FF4500]/10 px-5 py-2.5 rounded-2xl border border-[#FF4500]/20 min-w-fit">
                                                    <Lightbulb size={18} className="animate-pulse" />
                                                    <span>AI Summary</span>
                                                </div>
                                                <div className="flex flex-wrap gap-x-8 gap-y-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Audience</span>
                                                        <span className="text-sm font-bold text-slate-300">{detectedIntent.persona}</span>
                                                    </div>
                                                    <div className="w-px h-8 bg-white/5" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Main Gap</span>
                                                        <span className="text-sm font-bold text-slate-300">{detectedIntent.pain}</span>
                                                    </div>
                                                    <div className="w-px h-8 bg-white/5" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Market</span>
                                                        <span className="text-sm font-bold text-slate-300">{detectedIntent.domain}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-0 w-full mb-20">
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
                                                />
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            <UpgradeModal
                isOpen={isUpgradeModalOpen}
                onClose={closeUpgradeModal}
            />
        </div>
    );
};
