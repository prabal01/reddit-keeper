import React, { useState } from 'react';
import { useFolders } from '../../contexts/FolderContext';
import { useDiscovery } from './hooks/useDiscovery';
import { SearchHeader } from './components/SearchHeader';
import { IdeaSearchHeader } from './components/IdeaSearchHeader';
import { ResultGrid } from './components/ResultGrid';
import { SelectionCart } from './components/SelectionCart';
import { DiscoverySuccessView } from './components/DiscoverySuccessView';
import { Info, Search as SearchIcon, Lightbulb } from 'lucide-react';
import './DiscoveryWorkbench.css';

export const DiscoveryWorkbench: React.FC = () => {
    const { syncThreads, folders } = useFolders();
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
        toggleSelection,
        clearResults,
        status,
        setSelectedIds,
        detectedIntent
    } = useDiscovery();

    const [activeTab, setActiveTab] = useState<'competitor' | 'idea'>('competitor');
    const [competitor, setCompetitor] = useState('');
    const [idea, setIdea] = useState('');
    const [communities, setCommunities] = useState<string[]>([]);

    const [isSearchingStarted, setIsSearchingStarted] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSyncInfo, setLastSyncInfo] = useState<{ count: number, folderName: string, folderId: string } | null>(null);

    const handleSearch = async () => {
        if (!competitor.trim()) return;
        setIsSearchingStarted(true);
        await search(competitor);
    };

    const handleIdeaSearch = async () => {
        if (!idea.trim()) return;
        setIsSearchingStarted(true);
        await ideaSearch(idea, communities);
    };

    const handleTabChange = (tab: 'competitor' | 'idea') => {
        setActiveTab(tab);
        // We don't necessarily clear results when switching tabs, unless user wants a fresh start
    };

    const handleSaveSelection = async (folderId: string) => {
        const urls = selectedResults.map(r => r.url);
        const items = selectedResults.map(r => ({
            url: r.url,
            title: r.title,
            author: "unknown",
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
    };

    return (
        <div className={`discovery-workbench ${isSearchingStarted || results.length > 0 ? 'active' : 'hero'}`}>
            <header className="workbench-header">
                <h1>Discovery Workbench</h1>
                <p>Build your research intelligence from Reddit & Hacker News.</p>
            </header>

            <div className="discovery-tabs">
                <button
                    className={`discovery-tab ${activeTab === 'competitor' ? 'active' : ''}`}
                    onClick={() => handleTabChange('competitor')}
                >
                    <SearchIcon size={16} />
                    Competitor Discovery
                </button>
                <button
                    className={`discovery-tab ${activeTab === 'idea' ? 'active' : ''}`}
                    onClick={() => handleTabChange('idea')}
                >
                    <Lightbulb size={16} />
                    Idea Discovery
                </button>
            </div>

            {activeTab === 'competitor' ? (
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
            ) : (
                <IdeaSearchHeader
                    idea={idea}
                    setIdea={setIdea}
                    communities={communities}
                    setCommunities={setCommunities}
                    onSearch={handleIdeaSearch}
                    loading={loading}
                    platformFilter={platformFilter}
                    setPlatformFilter={setPlatformFilter}
                    intentFilter={intentFilter}
                    setIntentFilter={setIntentFilter}
                />
            )}

            {status && <div className="workbench-status">{status}</div>}

            {discoveryPlan && !loading && (
                <div className="discovery-summary-bar">
                    <div className="summary-pills">
                        <span className="summary-pill">Scanned: <b>{discoveryPlan.scannedCount}</b></span>
                        <span className="summary-pill">High Signal: <b>{discoveryPlan.totalFound}</b></span>
                        {discoveryPlan.isFromCache && <span className="summary-pill cache"><Info size={12} /> Cached</span>}
                    </div>
                </div>
            )}

            {detectedIntent && activeTab === 'idea' && !loading && (
                <div className="discovery-intent-banner">
                    <div className="intent-label">
                        <Lightbulb size={14} className="text-yellow-500" />
                        <span>Idea Context:</span>
                    </div>
                    <div className="intent-tags">
                        <span className="intent-tag"><b>Persona:</b> {detectedIntent.persona}</span>
                        <span className="intent-tag"><b>Pain:</b> {detectedIntent.pain}</span>
                        <span className="intent-tag"><b>Domain:</b> {detectedIntent.domain}</span>
                    </div>
                </div>
            )}

            <main className="workbench-main">
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
                    />
                )}
            </main>

            <SelectionCart
                selectedCount={selectedIds.size}
                onSave={handleSaveSelection}
                onClear={handleClear}
                loading={isSaving}
            />
        </div>
    );
};
