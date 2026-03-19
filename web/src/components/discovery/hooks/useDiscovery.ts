import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useFolders } from '../../../contexts/FolderContext';
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

export interface DiscoveryHistoryEntry {
    id: string;
    type: 'competitor' | 'idea' | 'bulk';
    query: string;
    params: {
        communities?: string[];
        competitors?: string[];
        platforms: ('reddit' | 'hn')[];
        useAiBrain?: boolean;
    };
    resultsCount: number;
    createdAt: string;
    topResults?: {
        title: string;
        url: string;
        source: 'reddit' | 'hn' | 'google';
        score: number;
    }[];
}

export type PlatformFilter = 'all' | 'reddit' | 'hn';
export type IntentFilter = 'frustration' | 'alternative' | 'high_engagement' | 'all';

export const useDiscovery = () => {
    const { getIdToken } = useAuth();
    const { syncThreads } = useFolders();
    
    const [results, setResults] = useState<DiscoveryResult[]>([]);
    const [allDiscoveredMap, setAllDiscoveredMap] = useState<Map<string, DiscoveryResult>>(new Map());
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSearchingStarted, setIsSearchingStarted] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [discoveryPlan, setDiscoveryPlan] = useState<DiscoveryPlan | null>(null);
    const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
    const [intentFilter, setIntentFilter] = useState<IntentFilter>('all');
    const [status, setStatus] = useState<string | null>(null);
    const [detectedIntent, setDetectedIntent] = useState<{ persona: string; pain: string; domain: string } | null>(null);
    const [showSelectedOnly, setShowSelectedOnly] = useState(false);
    const [history, setHistory] = useState<DiscoveryHistoryEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [lastSyncInfo, setLastSyncInfo] = useState<{ count: number, folderName: string, folderId: string } | null>(null);

    const fetchHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const token = await getIdToken();
            const response = await fetch(`${API_BASE}/discovery/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setHistory(data.history);
            }
        } catch (err) {
            console.error("Failed to fetch history:", err);
        } finally {
            setHistoryLoading(false);
        }
    }, [getIdToken]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const deleteHistoryItem = useCallback(async (id: string) => {
        try {
            const token = await getIdToken();
            const response = await fetch(`${API_BASE}/discovery/history/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setHistory(prev => prev.filter(item => item.id !== id));
            }
        } catch (err) {
            console.error("Failed to delete history item:", err);
        }
    }, [getIdToken]);

    const search = useCallback(async (query: string) => {
        if (!query.trim()) return;
        setLoading(true);
        setIsSearchingStarted(true);
        setStatus('Initializing search...');
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
            if (!response.ok) throw new Error('Discovery failed');
            const data = await response.json();
            setResults(data.results);
            setAllDiscoveredMap(prev => {
                const next = new Map(prev);
                data.results.forEach((r: DiscoveryResult) => next.set(r.id, r));
                return next;
            });
            setDiscoveryPlan(data.discoveryPlan);
            fetchHistory();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setStatus(null);
        }
    }, [getIdToken, fetchHistory]);

    const ideaSearch = useCallback(async (idea: string, communities?: string[], competitors?: string[]) => {
        setLoading(true);
        setIsSearchingStarted(true);
        setStatus('Analyzing niche...');
        try {
            const token = await getIdToken();
            const response = await fetch(`${API_BASE}/discovery/idea`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ idea, communities, competitors })
            });
            if (!response.ok) throw new Error('Idea discovery failed');
            const data = await response.json();
            setResults(data.results);
            setAllDiscoveredMap(prev => {
                const next = new Map(prev);
                data.results.forEach((r: DiscoveryResult) => next.set(r.id, r));
                return next;
            });
            setDiscoveryPlan(data.discoveryPlan);
            setDetectedIntent(data.intent);
            fetchHistory();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setStatus(null);
        }
    }, [getIdToken, fetchHistory]);

    const importUrls = useCallback(async (urls: string[]) => {
        setLoading(true);
        setIsSearchingStarted(true);
        setStatus('Importing signals...');
        try {
            const token = await getIdToken();
            const response = await fetch(`${API_BASE}/discovery/metadata`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ urls })
            });
            if (!response.ok) throw new Error('Import failed');
            const data = await response.json();
            const imports = data.results.map((r: any) => ({ ...r, isBulk: true }));
            setResults(imports);
            setAllDiscoveredMap(prev => {
                const next = new Map(prev);
                imports.forEach((r: DiscoveryResult) => next.set(r.id, r));
                return next;
            });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setStatus(null);
        }
    }, [getIdToken]);

    const enrichResult = useCallback(async (_id: string, _url: string, _source: string) => {
        // Simple mock for now if needed, or implement full API
    }, []);

    const toggleSelection = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const selectAllVisible = useCallback(() => {
        const visibleIds = results.map(r => r.id);
        setSelectedIds(prev => new Set([...Array.from(prev), ...visibleIds]));
    }, [results]);

    const unselectAllVisible = useCallback(() => {
        const visibleIds = new Set(results.map(r => r.id));
        setSelectedIds(prev => new Set(Array.from(prev).filter(id => !visibleIds.has(id))));
    }, [results]);

    const clearResults = useCallback(() => {
        setResults([]);
        setDiscoveryPlan(null);
        setDetectedIntent(null);
        setIsSearchingStarted(false);
    }, []);

    const saveSelection = useCallback(async (folderId: string, folderName: string) => {
        const selectedResults = Array.from(selectedIds)
            .map(id => allDiscoveredMap.get(id))
            .filter(Boolean) as DiscoveryResult[];
            
        if (selectedResults.length === 0) return;

        const urls = selectedResults.map(r => r.url);
        const items = selectedResults.map(r => ({
            url: r.url,
            title: r.title,
            author: r.author || "unknown",
            subreddit: r.subreddit,
            num_comments: r.num_comments
        }));
        const count = selectedResults.length;

        setIsSaving(true);
        try {
            await syncThreads(folderId, urls, items);
            setLastSyncInfo({ count, folderId, folderName });
            setSelectedIds(new Set());
            clearResults();
        } catch (err) {
            console.error("Failed to save:", err);
            throw err;
        } finally {
            setIsSaving(false);
        }
    }, [selectedIds, allDiscoveredMap, syncThreads, clearResults]);

    const selectedResults = useMemo(() => {
        return Array.from(selectedIds)
            .map(id => allDiscoveredMap.get(id))
            .filter(Boolean) as DiscoveryResult[];
    }, [selectedIds, allDiscoveredMap]);

    return useMemo(() => ({
        results,
        allResults: Array.from(allDiscoveredMap.values()),
        selectedResults,
        loading,
        isSaving,
        isSearchingStarted,
        setIsSearchingStarted,
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
        setShowSelectedOnly,
        history,
        historyLoading,
        fetchHistory,
        deleteHistoryItem,
        saveSelection,
        lastSyncInfo,
        setLastSyncInfo
    }), [
        results, allDiscoveredMap, selectedResults, loading, isSaving, 
        isSearchingStarted, selectedIds, discoveryPlan, platformFilter, 
        intentFilter, status, search, ideaSearch, importUrls, 
        enrichResult, toggleSelection, selectAllVisible, unselectAllVisible, 
        clearResults, detectedIntent, showSelectedOnly, history, 
        historyLoading, fetchHistory, deleteHistoryItem, saveSelection, 
        lastSyncInfo
    ]);
};
