export interface DiscoveryResult {
    id: string;
    title: string;
    author: string;
    subreddit: string; // Used for HN as well (e.g., 'Hacker News')
    ups: number;
    num_comments: number;
    created_utc: number;
    url: string;
    source: 'reddit' | 'hn';
    score: number;
    isCached?: boolean;
    intentMarkers?: ('frustration' | 'alternative' | 'high_engagement' | 'question' | 'partial_match')[];
}

export interface DiscoveryPlan {
    scannedCount: number;
    totalFound: number;
    cachedCount: number;
    newCount: number;
    estimatedSyncTime: number;
    isFromCache: boolean;
    recommendedPath: string[];
}

export interface DiscoveryResponse {
    results: DiscoveryResult[];
    discoveryPlan: DiscoveryPlan;
}

export interface IDiscoveryService {
    deepDiscovery(query: string): Promise<{ results: DiscoveryResult[]; scannedCount: number; isFromCache: boolean }>;
    fetchFullThreadRecord(idOrUrl: string): Promise<any>;
}
