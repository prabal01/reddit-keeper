import { RedditDiscoveryService } from './reddit.service.js';
import { HnDiscoveryService } from './hn.service.js';
import { DiscoveryResult, DiscoveryPlan, DiscoveryResponse } from './types.js';
import { logger } from '../utils/logger.js';
import { DiscoveryBrain } from './brain.js';

export class DiscoveryOrchestrator {
    private redditService = new RedditDiscoveryService();
    private hnService = new HnDiscoveryService();
    private brain = new DiscoveryBrain();

    async search(query: string, platforms: ('reddit' | 'hn')[] | 'all' = 'all', useAiBrain = false, skipCache = false): Promise<DiscoveryResponse> {
        logger.info({ action: 'SEARCH_START', searchTerm: query, platforms, useAiBrain, skipCache }, `Searching for "${query}" (AI Brain: ${useAiBrain}, SkipCache: ${skipCache})`);

        const platformList: ('reddit' | 'hn')[] = platforms === 'all' ? ['reddit', 'hn'] : platforms;

        // Generate AI queries if requested
        let customQueries: string[] | undefined;
        if (useAiBrain) {
            logger.info({ action: 'AI_QUERY_EXPANSION', searchTerm: query }, "Expanding query via DiscoveryBrain...");
            customQueries = await this.brain.expandQuery(query);
            logger.info({ queries: customQueries }, `Expanded into ${customQueries.length} queries`);
        }

        const searchPromises = platformList.map(p => {
            if (p === 'reddit') return this.redditService.deepDiscovery(query, customQueries, skipCache);
            if (p === 'hn') return this.hnService.deepDiscovery(query, customQueries, skipCache);
            return Promise.resolve({ results: [], scannedCount: 0, isFromCache: false });
        });

        const responses = await Promise.all(searchPromises);

        let allResults: DiscoveryResult[] = [];
        let totalScanned = 0;
        let totalFound = 0;
        let totalCached = 0;
        let isAnyFromCache = false;

        responses.forEach(resp => {
            allResults = allResults.concat(resp.results);
            totalScanned += resp.scannedCount;
            totalFound += resp.results.length;
            totalCached += resp.results.filter(r => r.isCached).length;
            if (resp.isFromCache) isAnyFromCache = true;
        });

        // If no high-signal results, attempt Context Boosting (Query Ambiguity)
        const highSignalCount = allResults.filter(r => r.score > 1000).length;
        if (highSignalCount === 0 && !query.includes('software') && !query.includes('app') && !query.includes('tool')) {
            logger.info({ action: 'CONTEXT_BOOST', searchTerm: query }, `Low signal for "${query}". Attempting Context Boost...`);
            const boostedQuery = `${query} software OR app OR tool`; // Try to force tech context
            return this.search(boostedQuery, platforms); // Recursive call with boosted query
        }

        // If STILL no results even after boosting, fallback to Serper baseline
        if (allResults.length === 0) {
            logger.info({ action: 'FALLBACK_SERPER', searchTerm: query }, `No results found. Falling back to Serper...`);
            return this.serperBaseline(query);
        }

        const sortedResults = allResults.sort((a, b) => b.score - a.score);

        const discoveryPlan: DiscoveryPlan = {
            scannedCount: totalScanned,
            totalFound: totalFound,
            cachedCount: totalCached,
            newCount: totalFound - totalCached,
            estimatedSyncTime: (totalFound - totalCached) * 1.2,
            isFromCache: isAnyFromCache,
            recommendedPath: sortedResults.slice(0, 5).map(r => r.title)
        };

        return {
            results: sortedResults,
            discoveryPlan
        };
    }

    private async serperBaseline(query: string): Promise<DiscoveryResponse> {
        const SERPER_API_KEY = process.env.SERPER_API_KEY;
        if (!SERPER_API_KEY) {
            return { results: [], discoveryPlan: this.emptyPlan() };
        }

        const serperUrl = "https://google.serper.dev/search";
        logger.info({ platform: 'serper', action: 'API_FETCH', url: serperUrl, searchTerm: `site:reddit.com ${query}` });
        const response = await fetch(serperUrl, {
            method: "POST",
            headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ q: `site:reddit.com ${query}`, num: 20 })
        });

        if (!response.ok) return { results: [], discoveryPlan: this.emptyPlan() };

        const data: any = await response.json();
        const organic = data.organic || [];

        const rawResults: DiscoveryResult[] = organic.map((r: any) => ({
            id: r.link,
            title: r.title,
            url: r.link,
            subreddit: r.link.includes('/r/') ? r.link.split('/r/')[1].split('/')[0] : 'r/unknown',
            ups: 0,
            num_comments: 0,
            author: 'unknown',
            created_utc: Math.floor(Date.now() / 1000),
            source: 'reddit',
            score: 0
        }));

        return {
            results: rawResults,
            discoveryPlan: {
                scannedCount: organic.length,
                totalFound: organic.length,
                cachedCount: 0,
                newCount: organic.length,
                estimatedSyncTime: organic.length * 1.5,
                isFromCache: false,
                recommendedPath: rawResults.slice(0, 5).map(r => r.title)
            }
        };
    }

    private emptyPlan(): DiscoveryPlan {
        return {
            scannedCount: 0,
            totalFound: 0,
            cachedCount: 0,
            newCount: 0,
            estimatedSyncTime: 0,
            isFromCache: false,
            recommendedPath: []
        };
    }

    async fetchFullThread(urlOrId: string, source: 'reddit' | 'hn'): Promise<any> {
        if (source === 'hn') {
            // Extract numeric ID from HN URL if provided
            let id = urlOrId;
            if (urlOrId.includes('id=')) {
                const match = urlOrId.match(/id=(\d+)/);
                if (match) id = match[1];
            } else if (urlOrId.includes('item/')) {
                const match = urlOrId.match(/item\/(\d+)/);
                if (match) id = match[1];
            }
            return this.hnService.fetchFullThreadRecord(id);
        } else {
            return this.redditService.fetchFullThreadRecord(urlOrId);
        }
    }
}
