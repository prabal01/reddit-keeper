import React from 'react';
import { Search, Loader2 } from 'lucide-react';
import type { PlatformFilter, IntentFilter } from '../hooks/useDiscovery';

interface SearchHeaderProps {
    competitor: string;
    setCompetitor: (val: string) => void;
    onSearch: () => void;
    loading: boolean;
    platformFilter: PlatformFilter;
    setPlatformFilter: (val: PlatformFilter) => void;
    intentFilter: IntentFilter;
    setIntentFilter: (val: IntentFilter) => void;
}

export const SearchHeader: React.FC<SearchHeaderProps> = ({
    competitor, setCompetitor, onSearch, loading,
    platformFilter, setPlatformFilter,
    intentFilter, setIntentFilter
}) => {
    return (
        <div className="w-full flex flex-col items-center transition-all duration-500 z-10">
            <div className="dw-search-wrapper">
                <div className="dw-search-input-box relative">
                    <input
                        className="flex-1 bg-transparent border-none px-6 py-1 text-base font-bold text-white outline-none placeholder:text-slate-500 tracking-tight"
                        type="text"
                        placeholder="e.g. Notion, Linear, Slack..."
                        value={competitor}
                        onChange={(e) => setCompetitor(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && onSearch()}
                    />
                    <button
                        className="dw-primary-btn"
                        onClick={onSearch}
                        disabled={loading || !competitor.trim()}
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                        Deep Search
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
                                    <div className="flex items-center gap-2">
                                        {p.toUpperCase()}
                                    </div>
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
