import { RedditDiscoveryService } from './reddit.service.js';
import { HnDiscoveryService } from './hn.service.js';
import { DiscoveryBrain } from './brain.js';
import { GoogleDiscoveryService } from './google.service.js';
import { DiscoveryResult, DiscoveryPlan, DiscoveryResponse } from './types.js';
import { logger } from '../utils/logger.js';
import { redis } from '../middleware/rateLimiter.js';

export class DiscoveryOrchestrator {
    private redditService = new RedditDiscoveryService();
    private hnService = new HnDiscoveryService();
    private googleService = new GoogleDiscoveryService();
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

        responses.forEach((resp: any) => {
            allResults = allResults.concat(resp.results);
            totalScanned += resp.scannedCount;
            totalFound += resp.results.length;
            totalCached += resp.results.filter((r: any) => r.isCached).length;
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

    async ideaDiscovery(idea: string, communities?: string[], skipCache = false): Promise<DiscoveryResponse> {
        const cacheKey = `discovery:idea:${Buffer.from(idea.trim().toLowerCase()).toString('base64').slice(0, 32)}:v5`;

        if (!skipCache) {
            try {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    logger.info({ action: 'CACHE_HIT_IDEA_DISCOVERY', idea }, "Returning cached discovery results");
                    return JSON.parse(cached);
                }
            } catch (err) {
                logger.error({ err }, "Cache read error in ideaDiscovery");
            }
        }

        logger.info({ action: 'IDEA_DISCOVERY_START_SERPER_PRIMARY', idea, skipCache }, `Master Query phase starting via Serper...`);
        const { expandIdeaToQueries } = await import('../ai.js');
        const { intent, queries } = await expandIdeaToQueries(idea, communities);
        const masterQuery = queries[0];
        logger.info({ masterQuery }, `Generated Master Query: ${masterQuery}`);

        // 2. Primary Phase (Serper API)
        const serperResp = await this.serperBaseline(masterQuery);
        let allResults = [...serperResp.results];
        let scannedCount = serperResp.discoveryPlan.scannedCount;

        // 3. Fallback Enhancement: If signal is too low, expand search to direct platform APIs
        if (allResults.length < 3) {
            logger.info({ action: 'DEEP_SEARCH_TRIGGERED', count: allResults.length }, "Low signal from Serper. Expanding to platform-specific deep search...");
            const [redditResp, hnResp] = await Promise.all([
                this.redditService.ideaDiscovery(idea, [idea], skipCache, intent).catch((err: Error) => {
                    logger.error({ err, platform: 'reddit' }, "Reddit fallback CRASHED");
                    return { results: [], scannedCount: 0, isFromCache: false };
                }),
                this.hnService.ideaDiscovery(idea, [idea], skipCache, intent).catch((err: Error) => {
                    logger.error({ err, platform: 'hn' }, "HN fallback CRASHED");
                    return { results: [], scannedCount: 0, isFromCache: false };
                })
            ]);
            allResults = [...allResults, ...redditResp.results, ...hnResp.results];
            scannedCount += (redditResp.scannedCount + hnResp.scannedCount);
        }

        // 4. Final Aggregation, Deduplication & Ranking
        const seenUrls = new Set<string>();
        let finalResults = allResults
            .filter(r => {
                if (seenUrls.has(r.url)) return false;
                seenUrls.add(r.url);
                return r.score > 0;
            })
            .sort((a, b) => b.score - a.score);

        // 5. Enrichment Phase: Fetch metadata for top results (especially from Serper)
        // We only enrich the top 5 to keep it fast.
        const topToEnrich = finalResults.slice(0, 5);
        await Promise.all(topToEnrich.map(async (r) => {
            if (r.ups === 0 && (r.source === 'reddit' || r.source === 'hn')) {
                try {
                    const fullData = await this.fetchFullThread(r.url, r.source);
                    if (fullData && fullData.post) {
                        r.ups = fullData.post.ups || 0;
                        r.num_comments = fullData.post.num_comments || 0;
                        r.isCached = true; // Mark as successfully fetched/cached
                    }
                } catch (err) {
                    logger.warn({ url: r.url }, "Failed to enrich metadata for result");
                }
            }
        }));

        logger.info({
            action: 'IDEA_DISCOVERY_COMPLETE',
            totalResults: finalResults.length,
            scannedCount
        }, `Master query discovery complete. Found ${finalResults.length} matches.`);

        // Log Top 10 results for visibility in terminal
        const topLog = finalResults.slice(0, 10).map(r => `[${r.source.toUpperCase()}][Score: ${r.score.toFixed(0)}][Ups: ${r.ups}] ${r.title}`);
        logger.info({ topResults: topLog }, "TOP 10 MASTER DISCOVERY RESULTS");

        const totalCached = finalResults.filter(r => r.isCached).length;

        const discoveryPlan: DiscoveryPlan = {
            scannedCount,
            totalFound: finalResults.length,
            cachedCount: totalCached,
            newCount: finalResults.length - totalCached,
            estimatedSyncTime: finalResults.length * 1.5,
            isFromCache: false,
            recommendedPath: finalResults.slice(0, 5).map(r => r.title)
        };

        const response: DiscoveryResponse = {
            results: finalResults,
            discoveryPlan,
            intent
        };

        // Cache the result for 24 hours
        try {
            await redis.setex(cacheKey, 86400, JSON.stringify(response));
            logger.info({ action: 'CACHE_SAVE_IDEA_DISCOVERY', idea }, "Saved discovery results to cache");
        } catch (err) {
            logger.error({ err }, "Cache save error in ideaDiscovery");
        }

        return response;
    }

    private async serperBaseline(query: string): Promise<DiscoveryResponse> {
        const SERPER_API_KEY = process.env.SERPER_API_KEY;
        if (!SERPER_API_KEY) {
            logger.error("SERPER_API_KEY is missing");
            return { results: [], discoveryPlan: this.emptyPlan() };
        }

        const serperUrl = "https://google.serper.dev/search";
        logger.info({ platform: 'serper', action: 'API_FETCH', url: serperUrl, searchTerm: query });

        try {
            const response = await fetch(serperUrl, {
                method: "POST",
                headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({ q: query, num: 20 })
            });

            if (!response.ok) {
                logger.error({ status: response.status, statusText: response.statusText }, "Serper API call failed");
                return { results: [], discoveryPlan: this.emptyPlan() };
            }

            const data: any = await response.json();
            const organic = data.organic || [];

            const rawResults: DiscoveryResult[] = organic.map((r: any) => {
                const source = r.link.includes('news.ycombinator.com') ? 'hn' : (r.link.includes('reddit.com') ? 'reddit' : 'google');
                return {
                    id: r.link,
                    title: r.title,
                    url: r.link,
                    subreddit: r.link.includes('/r/') ? `r/${r.link.split('/r/')[1].split('/')[0]}` : (source === 'hn' ? 'Hacker News' : 'Web'),
                    author: 'unknown',
                    source,
                    ups: 0,
                    num_comments: 0,
                    created_utc: Math.floor(Date.now() / 1000),
                    score: source !== 'google' ? 8000 : 5000, // Boost discussions
                    intentMarkers: ['SERPER_BASELINE']
                } as DiscoveryResult;
            });

            return {
                results: rawResults,
                discoveryPlan: {
                    scannedCount: organic.length,
                    totalFound: rawResults.length,
                    cachedCount: 0,
                    newCount: rawResults.length,
                    estimatedSyncTime: rawResults.length * 1.5,
                    isFromCache: false,
                    recommendedPath: rawResults.slice(0, 5).map((r: DiscoveryResult) => r.title)
                }
            };
        } catch (err) {
            logger.error({ err }, "Serper fetch failed");
            return { results: [], discoveryPlan: this.emptyPlan() };
        }
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
        const cacheKey = `thread_data:v1:${Buffer.from(urlOrId).toString('base64').slice(0, 32)}`;

        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                logger.info({ action: 'THREAD_CACHE_HIT', urlOrId }, "Returning cached thread data");
                return JSON.parse(cached);
            }
        } catch (err) {
            logger.warn({ err }, "Thread cache read error");
        }

        let fullData: any = null;
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
            fullData = await this.hnService.fetchFullThreadRecord(id);
        } else {
            fullData = await this.redditService.fetchFullThreadRecord(urlOrId);
        }

        if (fullData) {
            try {
                // Cache thread data for 7 days
                await redis.setex(cacheKey, 604800, JSON.stringify(fullData));
                // Also set meta cache for sync icons
                if (source === 'reddit') {
                    const threadId = urlOrId.match(/comments\/([a-z0-9]+)/)?.[1];
                    if (threadId) await redis.setex(`reddit_meta:${threadId}`, 604800, "1");
                }
            } catch (err) {
                logger.error({ err }, "Thread cache save error");
            }
        }

        return fullData;
    }
}
