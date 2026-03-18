import React, { useState } from 'react';
import { Sparkles, Loader2, X, Plus } from 'lucide-react';
import type { PlatformFilter, IntentFilter } from '../hooks/useDiscovery';

interface IdeaSearchHeaderProps {
    idea: string;
    setIdea: (val: string) => void;
    onSearch: () => void;
    loading: boolean;
    platformFilter: PlatformFilter;
    setPlatformFilter: (val: PlatformFilter) => void;
    intentFilter: IntentFilter;
    setIntentFilter: (val: IntentFilter) => void;
    competitors: string;
    setCompetitors: (val: string) => void;
    communities: string[];
    addCommunity: (comm: string) => void;
    removeCommunity: (comm: string) => void;
}

export const IdeaSearchHeader: React.FC<IdeaSearchHeaderProps> = ({
    idea, setIdea, onSearch, loading,
    platformFilter, setPlatformFilter,
    intentFilter, setIntentFilter,
    competitors, setCompetitors,
    communities, addCommunity, removeCommunity
}) => {
    const [newCommunityLocal, setNewCommunityLocal] = useState('');

    const handleAddCommunity = () => {
        if (newCommunityLocal.trim()) {
            addCommunity(newCommunityLocal.trim());
            setNewCommunityLocal('');
        }
    };

    return (
        <div className="w-full flex flex-col items-center transition-all duration-500 z-10">
            <div className="dw-search-wrapper">
                <div className="dw-input-container relative">
                    <textarea
                        className="w-full bg-transparent border-none resize-none text-white text-lg font-bold leading-relaxed outline-none p-1.5 placeholder:text-slate-600 tracking-tight pr-10"
                        placeholder="Describe your idea... (e.g. A tool that helps developers find niche communities)"
                        rows={2}
                        value={idea}
                        onChange={(e) => setIdea(e.target.value)}
                    />
                </div>

                <div className="px-2 bg-transparent">
                    <div className="dw-input-container !rounded-xl !py-0.5">
                        <input
                            className="w-full bg-transparent border-none px-4 py-2.5 text-white text-sm font-semibold outline-none transition-all duration-300 placeholder:text-slate-500"
                            type="text"
                            placeholder="Comma separated competitors (optional)..."
                            value={competitors}
                            onChange={(e) => setCompetitors(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex justify-between items-end gap-5 border-t border-white/10 pt-1 px-2">
                    <div className="flex-1">
                        <div className="flex flex-wrap gap-2.5">
                            {communities.map(c => (
                                <span key={c} className="bg-[#FF4500]/10 text-[#FF8717] px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-[#FF4500]/20">
                                    r/{c}
                                    <button
                                        className="bg-transparent border-none text-[#FF8717] cursor-pointer flex items-center opacity-60 hover:opacity-100 transition-opacity"
                                        onClick={() => removeCommunity(c)}
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                            <div className="flex items-center bg-white/5 rounded-full px-4 py-1.5 border border-white/10 focus-within:border-[#FF4500]/30 transition-colors">
                                <input
                                    className="bg-transparent border-none text-white text-[10px] font-black uppercase tracking-widest outline-none w-28 pl-1 placeholder:text-slate-500"
                                    type="text"
                                    placeholder="Add sub..."
                                    value={newCommunityLocal}
                                    onChange={(e) => setNewCommunityLocal(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddCommunity()}
                                />
                                <button className="bg-transparent border-none text-slate-500 hover:text-white cursor-pointer flex items-center pr-1 transition-colors" onClick={handleAddCommunity}>
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <button
                        className="dw-primary-btn"
                        onClick={onSearch}
                        disabled={loading || !idea.trim()}
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                        Find Discussions
                    </button>
                </div>

                <div className="dw-filter-row">
                    <div className="dw-filter-box">
                        <span className="dw-filter-label">Platform</span>
                        <div className="dw-filter-divider"></div>
                        <div className="flex gap-1.5">
                            {(['all', 'reddit', 'hn'] as PlatformFilter[]).map(p => (
                                <button
                                    key={p}
                                    className={`dw-filter-btn ${platformFilter === p ? 'active' : ''}`}
                                    onClick={() => setPlatformFilter(p)}
                                >
                                    {p.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="dw-filter-box">
                        <span className="dw-filter-label">Intent</span>
                        <div className="dw-filter-divider"></div>
                        <div className="flex gap-1.5">
                            {(['all', 'frustration', 'alternative', 'high_engagement'] as IntentFilter[]).map(i => (
                                <button
                                    key={i}
                                    className={`dw-filter-btn ${intentFilter === i ? 'active' : ''}`}
                                    onClick={() => setIntentFilter(i)}
                                >
                                    {i.replace('_', ' ').toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
