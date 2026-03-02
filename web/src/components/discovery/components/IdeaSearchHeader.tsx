import React, { useState } from 'react';
import { Loader2, Sparkles, Tag, X } from 'lucide-react';
import type { PlatformFilter, IntentFilter } from '../hooks/useDiscovery';

interface IdeaSearchHeaderProps {
    idea: string;
    setIdea: (val: string) => void;
    communities: string[];
    setCommunities: (val: string[]) => void;
    onSearch: () => void;
    loading: boolean;
    platformFilter: PlatformFilter;
    setPlatformFilter: (val: PlatformFilter) => void;
    intentFilter: IntentFilter;
    setIntentFilter: (val: IntentFilter) => void;
}

export const IdeaSearchHeader: React.FC<IdeaSearchHeaderProps> = ({
    idea, setIdea, communities, setCommunities, onSearch, loading,
    platformFilter, setPlatformFilter,
    intentFilter, setIntentFilter
}) => {
    const [newCommunity, setNewCommunity] = useState('');

    const addCommunity = () => {
        if (newCommunity.trim() && !communities.includes(newCommunity.trim())) {
            setCommunities([...communities, newCommunity.trim()]);
            setNewCommunity('');
        }
    };

    const removeCommunity = (comm: string) => {
        setCommunities(communities.filter(c => c !== comm));
    };

    return (
        <div className="discovery-header-section idea-discovery">
            <div className="idea-input-container">
                <div className="idea-text-box">
                    <textarea
                        placeholder="Describe the idea or problem space you want to explore... (e.g., 'A better way to manage local state in React apps that doesn't feel like boilerplate')"
                        value={idea}
                        onChange={(e) => setIdea(e.target.value)}
                        rows={3}
                    />
                    <div className="idea-actions">
                        <div className="seed-communities">
                            <div className="community-pills">
                                {communities.map(c => (
                                    <span key={c} className="community-pill">
                                        r/{c}
                                        <button onClick={() => removeCommunity(c)}><X size={12} /></button>
                                    </span>
                                ))}
                                <div className="add-community">
                                    <input
                                        type="text"
                                        placeholder="Add subreddit..."
                                        value={newCommunity}
                                        onChange={(e) => setNewCommunity(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && addCommunity()}
                                    />
                                    <button onClick={addCommunity} className="add-btn"><Tag size={12} /></button>
                                </div>
                            </div>
                        </div>

                        <button
                            className="search-button-large idea-btn"
                            onClick={onSearch}
                            disabled={loading || !idea.trim()}
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                            Find Relevant Discussions
                        </button>
                    </div>
                </div>
            </div>

            <div className="filter-toolbar">
                <div className="filter-group">
                    <span className="filter-label">Platform</span>
                    <div className="filter-pills">
                        {(['all', 'reddit'] as PlatformFilter[]).map(p => (
                            <button
                                key={p}
                                className={`filter-pill ${platformFilter === p ? 'active' : ''}`}
                                onClick={() => setPlatformFilter(p)}
                            >
                                {p.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="filter-group">
                    <span className="filter-label">Intent Filter</span>
                    <div className="filter-pills">
                        {(['all', 'frustration', 'alternative'] as IntentFilter[]).map(i => (
                            <button
                                key={i}
                                className={`filter-pill ${intentFilter === i ? 'active' : ''}`}
                                onClick={() => setIntentFilter(i)}
                            >
                                {i.replace('_', ' ').toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
