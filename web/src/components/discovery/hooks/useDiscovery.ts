import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { API_BASE } from '../../../lib/api';
export interface DiscoveryResult {
    id: string;
    title: string;
    url: string;
    subreddit: string;
    ups: number;
    num_comments: number;
    score: number;
    isCached?: boolean;
    source: 'reddit' | 'hn';
    intentMarkers?: ('frustration' | 'alternative' | 'high_engagement' | 'question')[];
}

export interface DiscoveryPlan {
    scannedCount: number;
    totalFound: number;
    cachedCount: number;
    newCount: number;
    estimatedSyncTime: number;
    isFromCache?: boolean;
}

export type PlatformFilter = 'all' | 'reddit' | 'hn';
export type IntentFilter = 'frustration' | 'alternative' | 'high_engagement' | 'all';

export const useDiscovery = () => {
    const { getIdToken } = useAuth();
    const [results, setResults] = useState<DiscoveryResult[]>([]);
    const [allDiscoveredMap, setAllDiscoveredMap] = useState<Map<string, DiscoveryResult>>(new Map());
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [discoveryPlan, setDiscoveryPlan] = useState<DiscoveryPlan | null>(null);
    const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
    const [intentFilter, setIntentFilter] = useState<IntentFilter>('all');
    const [status, setStatus] = useState<string | null>(null);
    const [detectedIntent, setDetectedIntent] = useState<{ persona: string; pain: string; domain: string } | null>(null);

    const search = useCallback(async (query: string) => {
        if (!query.trim()) return;

        setLoading(true);
        setStatus(null);

        try {
            const token = await getIdToken();
            const response = await fetch(`${API_BASE}/discovery/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ query, platform: 'all' })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Discovery failed');
            }

            const data = await response.json();

            // Option A: Replace results (Clear on Search)
            // But we update the session map so Selection Cart still knows about previous items
            const newResults = data.results as DiscoveryResult[];
            setResults(newResults);

            setAllDiscoveredMap(prev => {
                const next = new Map(prev);
                newResults.forEach(r => next.set(r.id, r));
                return next;
            });

            setDiscoveryPlan(data.discoveryPlan);
        } catch (err: any) {
            console.error("Discovery error:", err);
            setStatus("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [getIdToken]);

    const ideaSearch = useCallback(async (idea: string, communities?: string[]) => {
        if (!idea.trim()) return;

        setLoading(true);
        setStatus("Brainstorming search queries via AI...");

        try {
            const token = await getIdToken();

            // Artificial delay to show the first status, or just proceed
            setTimeout(() => {
                if (loading) setStatus("Searching Reddit (Sequential 1 req/sec to respect limits)...");
            }, 1500);

            const response = await fetch(`${API_BASE}/discovery/idea`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ idea, communities })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Idea Discovery failed');
            }

            const data = await response.json();

            if (data.results.length === 0) {
                setStatus("No high-signal discussions found. Try broadening your idea description.");
            } else {
                setStatus(null);
            }

            if (data.intent) {
                setDetectedIntent(data.intent);
            }

            const newResults = data.results as DiscoveryResult[];
            setResults(newResults);

            setAllDiscoveredMap(prev => {
                const next = new Map(prev);
                newResults.forEach(r => next.set(r.id, r));
                return next;
            });

            setDiscoveryPlan(data.discoveryPlan);
        } catch (err: any) {
            console.error("Idea Discovery error:", err);
            setStatus("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [getIdToken, loading]);

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const clearResults = () => {
        setResults([]);
        setDiscoveryPlan(null);
        setSelectedIds(new Set());
        setAllDiscoveredMap(new Map());
        setDetectedIntent(null);
    };

    const filteredResults = useMemo(() => {
        return results.filter(r => {
            const matchesPlatform = platformFilter === 'all' || r.source === platformFilter;
            const matchesIntent = intentFilter === 'all' || (r.intentMarkers && r.intentMarkers.includes(intentFilter as any));
            return matchesPlatform && matchesIntent;
        });
    }, [results, platformFilter, intentFilter]);

    const selectedResults = useMemo(() => {
        return Array.from(selectedIds)
            .map(id => allDiscoveredMap.get(id))
            .filter(Boolean) as DiscoveryResult[];
    }, [selectedIds, allDiscoveredMap]);

    return {
        results: filteredResults,
        allResults: results,
        selectedResults,
        loading,
        selectedIds,
        discoveryPlan,
        platformFilter,
        setPlatformFilter,
        intentFilter,
        setIntentFilter,
        status,
        search,
        ideaSearch,
        toggleSelection,
        clearResults,
        setSelectedIds,
        detectedIntent
    };
};
