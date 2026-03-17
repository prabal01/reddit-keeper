import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { API_BASE } from '../../../lib/api';
export interface DiscoveryResult {
    id: string;
    title: string;
    url: string;
    subreddit: string;
    author?: string;
    num_comments: number;
    score: number;
    isBulk?: boolean;
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
    const { getIdToken, refreshPlan } = useAuth();
    const [results, setResults] = useState<DiscoveryResult[]>([]);
    const [allDiscoveredMap, setAllDiscoveredMap] = useState<Map<string, DiscoveryResult>>(new Map());
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [discoveryPlan, setDiscoveryPlan] = useState<DiscoveryPlan | null>(null);
    const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
    const [intentFilter, setIntentFilter] = useState<IntentFilter>('all');
    const [status, setStatus] = useState<string | null>(null);
    const [detectedIntent, setDetectedIntent] = useState<{ persona: string; pain: string; domain: string } | null>(null);
    const [showSelectedOnly, setShowSelectedOnly] = useState(false);

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
            // Sync usage credits in UI
            refreshPlan();
        } catch (err: any) {
            console.error("Discovery error:", err);
            setStatus("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [getIdToken]);

    const ideaSearch = useCallback(async (idea: string, communities?: string[], competitors?: string[]) => {
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
                body: JSON.stringify({ idea, communities, competitors })
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
            // Sync usage credits in UI
            refreshPlan();
        } catch (err: any) {
            console.error("Idea Discovery error:", err);
            setStatus("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [getIdToken, loading]);

    const importUrls = useCallback(async (urls: string[]) => {
        if (urls.length === 0) return;

        setLoading(true);
        setStatus(`Importing ${urls.length} urls...`);

        const initialResults: DiscoveryResult[] = urls.map(url => {
            const parsedUrl = new URL(url);
            const source = parsedUrl.hostname.includes('reddit.com') ? 'reddit' : 'hn';
            let title = "Syncing thread...";
            let subreddit = "known";

            if (source === 'reddit') {
                const paths = parsedUrl.pathname.split('/').filter(Boolean);
                subreddit = paths[1] || 'reddit';
                if (paths[4]) {
                    title = paths[4].replace(/-/g, ' ').replace(/_/g, ' ');
                    title = title.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                }
            } else {
                subreddit = "Hacker News";
            }

            return {
                id: btoa(url),
                title,
                url,
                subreddit,
                author: 'unknown',
                num_comments: 0,
                score: 50,
                source,
                isBulk: true,
                isCached: false
            };
        });

        // Show results immediately
        setResults(initialResults);

        // Update selection and global map
        setSelectedIds(prev => {
            const next = new Set(prev);
            initialResults.forEach(r => next.add(r.id));
            return next;
        });

        setAllDiscoveredMap(prev => {
            const next = new Map(prev);
            initialResults.forEach(r => next.set(r.id, r));
            return next;
        });

        setStatus(null);
        setLoading(false);
    }, []);

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

    const enrichResult = useCallback(async (id: string, url: string, source: string) => {
        setLoading(true);
        setStatus("Enriching metadata...");
        try {
            const token = await getIdToken();
            const response = await fetch(`${API_BASE}/discovery/metadata`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ url, source })
            });

            if (response.ok) {
                const data = await response.json();
                const updatedResult = { ...data.result, isBulk: false } as DiscoveryResult;

                setResults(prev => prev.map(r => r.id === id ? updatedResult : r));
                setAllDiscoveredMap(prev => {
                    const next = new Map(prev);
                    next.set(id, updatedResult);
                    return next;
                });
            }
        } catch (err) {
            console.error("Failed to enrich metadata:", err);
        } finally {
            setLoading(false);
            setStatus(null);
        }
    }, [getIdToken]);

    const filteredResults = useMemo(() => {
        // Ensure selected items that are NOT in the current search results (e.g. Bulk Imports) 
        // stay visible in the grid as "sticky" items until unselected.
        const currentResultIds = new Set(results.map(r => r.id));
        const persistentItems = Array.from(selectedIds)
            .filter(id => !currentResultIds.has(id))
            .map(id => allDiscoveredMap.get(id))
            .filter(Boolean) as DiscoveryResult[];

        let combined = [...persistentItems, ...results];

        // Apply "Show Selected Only" filter
        if (showSelectedOnly) {
            combined = combined.filter(r => selectedIds.has(r.id));
        }

        return combined.filter(r => {
            const matchesPlatform = platformFilter === 'all' || r.source === platformFilter;
            // For Bulk items, we don't apply intent filtering as they are minimally parsed.
            const matchesIntent = r.isBulk || intentFilter === 'all' || (r.intentMarkers && r.intentMarkers.some((m: string) => m.toLowerCase() === intentFilter.toLowerCase()));
            return matchesPlatform && matchesIntent;
        });
    }, [results, selectedIds, allDiscoveredMap, platformFilter, intentFilter, showSelectedOnly]);

    const selectedResults = useMemo(() => {
        return Array.from(selectedIds)
            .map(id => allDiscoveredMap.get(id))
            .filter(Boolean) as DiscoveryResult[];
    }, [selectedIds, allDiscoveredMap]);

    const selectAllVisible = () => {
        const visibleIds = filteredResults.map(r => r.id);
        setSelectedIds(prev => {
            const next = new Set(prev);
            visibleIds.forEach(id => next.add(id));
            return next;
        });
    };

    const unselectAllVisible = () => {
        const visibleIds = filteredResults.map(r => r.id);
        setSelectedIds(prev => {
            const next = new Set(prev);
            visibleIds.forEach(id => next.delete(id));
            return next;
        });
    };

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
        importUrls,
        enrichResult,
        toggleSelection,
        selectAllVisible,
        unselectAllVisible,
        clearResults,
        setSelectedIds,
        detectedIntent,
        showSelectedOnly,
        setShowSelectedOnly
    };
};
