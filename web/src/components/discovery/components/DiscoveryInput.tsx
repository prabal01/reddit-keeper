import React, { useState } from 'react';
import { Search, Lightbulb, Zap, Loader2, Sparkles, UploadCloud, AlertCircle, X, Plus } from 'lucide-react';


interface DiscoveryInputProps {
    activeTab: 'competitor' | 'idea' | 'bulk';
    setActiveTab: (tab: 'competitor' | 'idea' | 'bulk') => void;
    
    // Competitor State
    competitor: string;
    setCompetitor: (val: string) => void;
    onCompetitorSearch: () => void;
    
    // Idea State
    idea: string;
    setIdea: (val: string) => void;
    communities: string[];
    addCommunity: (comm: string) => void;
    removeCommunity: (comm: string) => void;
    competitorsList: string;
    setCompetitorsList: (val: string) => void;
    onIdeaSearch: () => void;
    
    // Bulk State
    bulkUrls: string;
    setBulkUrls: (val: string) => void;
    onBulkImport: (urls: string[]) => void;
    
    // Global State
    loading: boolean;
}

export const DiscoveryInput: React.FC<DiscoveryInputProps> = ({
    activeTab, setActiveTab,
    competitor, setCompetitor, onCompetitorSearch,
    idea, setIdea, communities, addCommunity, removeCommunity, competitorsList, setCompetitorsList, onIdeaSearch,
    bulkUrls, setBulkUrls, onBulkImport,
    loading
}) => {
    const [newCommunityLocal, setNewCommunityLocal] = useState('');
    const [bulkError, setBulkError] = useState<string | null>(null);

    const handleAddCommunity = () => {
        if (newCommunityLocal.trim()) {
            addCommunity(newCommunityLocal.trim());
            setNewCommunityLocal('');
        }
    };

    const validateAndImportBulk = () => {
        setBulkError(null);
        const rawUrls = bulkUrls.split(/[\n,]+/).map(u => u.trim()).filter(u => u !== '');
        
        if (rawUrls.length === 0) {
            setBulkError("Please enter at least one URL.");
            return;
        }

        if (rawUrls.length > 50) {
            setBulkError("Maximum 50 URLs allowed.");
            return;
        }

        const validatedUrls: string[] = [];
        const invalidUrls: string[] = [];

        rawUrls.forEach(url => {
            try {
                const parsedUrl = new URL(url);
                const isReddit = parsedUrl.hostname.includes('reddit.com');
                const isHN = parsedUrl.hostname.includes('news.ycombinator.com');

                if (isReddit) {
                    const paths = parsedUrl.pathname.split('/').filter(Boolean);
                    if (paths.length === 4 || paths.length === 5) validatedUrls.push(url);
                    else invalidUrls.push(url);
                } else if (isHN) {
                    if (parsedUrl.searchParams.has('id')) validatedUrls.push(url);
                    else invalidUrls.push(url);
                } else {
                    invalidUrls.push(url);
                }
            } catch (e) {
                invalidUrls.push(url);
            }
        });

        if (invalidUrls.length > 0) {
            setBulkError(`Found ${invalidUrls.length} invalid URLs. Only Reddit/HN thread URLs are allowed.`);
            return;
        }

        onBulkImport(validatedUrls);
    };

    const urlCount = bulkUrls.split('\n').map(l => l.trim()).filter(Boolean).length;

    return (
        <div className="discovery-input-card group/input">
            {/* Segmented Mode Selector */}
            <div className="flex p-1 bg-white/[0.03] rounded-2xl border border-white/5 mb-6 w-fit mx-auto sm:mx-0">
                {(['competitor', 'idea', 'bulk'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                            activeTab === tab 
                            ? 'bg-gradient-to-br from-[#FF4500] to-[#FF8717] text-white shadow-lg shadow-[#FF4500]/20' 
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        {tab === 'competitor' && <Search size={12} />}
                        {tab === 'idea' && <Lightbulb size={12} />}
                        {tab === 'bulk' && <Zap size={12} />}
                        {tab === 'competitor' ? 'Competitors' : tab === 'idea' ? 'Idea Search' : 'Bulk Import'}
                    </button>
                ))}
            </div>

            {/* Adaptive Input Area */}
            <div className="relative flex flex-col transition-all duration-500">
                {/* Competitor Mode */}
                <div className={`mode-content-grid ${activeTab === 'competitor' ? 'active' : ''}`}>
                    <div className="grid-inner">
                        <div className="pt-2 pb-6">
                            <input
                                className="w-full bg-transparent border-none text-3xl font-bold text-white outline-none focus:outline-none focus:ring-0 placeholder:text-slate-800 tracking-tight"
                                type="text"
                                placeholder="e.g. Notion, Linear, Slack..."
                                value={competitor}
                                onChange={(e) => setCompetitor(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && onCompetitorSearch()}
                                autoFocus
                                aria-label="Search for competitor or platform"
                            />
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mt-3">Deep Scanning reddit & hacker news for competitor intel</p>
                        </div>
                    </div>
                </div>

                {/* Idea Mode */}
                <div className={`mode-content-grid ${activeTab === 'idea' ? 'active' : ''}`}>
                    <div className="grid-inner">
                        <div className="pt-2 pb-6 space-y-6">
                            <textarea
                                className="w-full bg-transparent border-none resize-none text-2xl font-bold text-white outline-none focus:outline-none focus:ring-0 placeholder:text-slate-800 tracking-tight"
                                placeholder="Describe your idea... (e.g. A tool that helps developers find niche communities)"
                                rows={2}
                                value={idea}
                                onChange={(e) => setIdea(e.target.value)}
                                aria-label="Describe your research idea"
                            />
                            
                            <div className="flex flex-wrap gap-3 items-center">
                                <input
                                    className="flex-1 min-w-[240px] bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm font-semibold text-white outline-none focus:outline-none focus:ring-0 placeholder:text-slate-700 transition-all focus:bg-white/[0.08]"
                                    type="text"
                                    placeholder="Comma separated competitors (optional)..."
                                    value={competitorsList}
                                    onChange={(e) => setCompetitorsList(e.target.value)}
                                />
                                
                                <div className="flex items-center bg-white/5 rounded-xl px-4 py-3 border border-white/5 transition-all focus-within:bg-white/[0.08]">
                                    <input
                                        className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest outline-none focus:outline-none focus:ring-0 w-24 text-white placeholder:text-slate-700"
                                        type="text"
                                        placeholder="Add sub..."
                                        value={newCommunityLocal}
                                        onChange={(e) => setNewCommunityLocal(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddCommunity()}
                                    />
                                    <button className="ml-2 text-slate-500 hover:text-white" onClick={handleAddCommunity}>
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>

                            {communities.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {communities.map(c => (
                                        <span key={c} className="bg-[#FF4500]/10 text-[#FF8717] px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border border-[#FF4500]/10 flex items-center gap-2">
                                            r/{c}
                                            <button onClick={() => removeCommunity(c)} className="hover:text-white transition-colors"><X size={10} /></button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bulk Mode */}
                <div className={`mode-content-grid ${activeTab === 'bulk' ? 'active' : ''}`}>
                    <div className="grid-inner">
                        <div className="pt-2 pb-6">
                            <textarea
                                className="w-full bg-transparent border-none resize-none text-xl font-bold text-white outline-none focus:outline-none focus:ring-0 placeholder:text-slate-800 tracking-tight"
                                placeholder="Paste Reddit or Hacker News URLs... (one per line, up to 50)"
                                rows={4}
                                value={bulkUrls}
                                onChange={(e) => setBulkUrls(e.target.value)}
                            />
                            {bulkError && (
                                <div className="flex items-center gap-2 text-red-500/80 text-[10px] font-black uppercase tracking-widest mt-3 animate-in fade-in slide-in-from-left-2">
                                    <AlertCircle size={12} />
                                    {bulkError}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-4 pt-6 border-t border-white/5 flex flex-wrap items-center justify-between gap-6">
                    <div className="flex flex-wrap items-center gap-4">
                        {activeTab === 'bulk' && (
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${urlCount > 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-800'}`} />
                                {urlCount} URLs detected
                            </div>
                        )}
                    </div>

                    <button
                        className="dw-primary-btn min-w-[200px] group/btn !rounded-2xl !py-4"
                        onClick={activeTab === 'competitor' ? onCompetitorSearch : activeTab === 'idea' ? onIdeaSearch : validateAndImportBulk}
                        disabled={loading || (activeTab === 'competitor' && !competitor.trim()) || (activeTab === 'idea' && !idea.trim()) || (activeTab === 'bulk' && urlCount === 0)}
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : activeTab === 'competitor' ? (
                            <Search size={18} />
                        ) : activeTab === 'idea' ? (
                            <Sparkles size={18} className="group-hover/btn:animate-pulse text-orange-400" />
                        ) : (
                            <UploadCloud size={18} />
                        )}
                        <span className="ml-2">
                            {loading ? 'Processing...' : activeTab === 'competitor' ? 'Deep Search' : activeTab === 'idea' ? 'Discover Intel' : 'Import Threads'}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};
