import { RedditDiscoveryService } from './reddit.service.js';
import { HnDiscoveryService } from './hn.service.js';
import { DiscoveryBrain } from './brain.js';
import { GoogleDiscoveryService } from './google.service.js';
import { PullPushService } from './pullpush.service.js';
import { ArcticShiftService } from './arctic-shift.service.js';
import { DiscoveryResult, DiscoveryPlan, DiscoveryResponse } from './types.js';
import { logger } from '../utils/logger.js';
import { errMsg } from '../utils/errors.js';
import { redis } from '../middleware/rateLimiter.js';
import { getGlobalConfig, saveDiscoveryHistory, getDb } from '../firestore.js';

export class DiscoveryOrchestrator {
    private redditService = new RedditDiscoveryService();
    private hnService = new HnDiscoveryService();
    private googleService = new GoogleDiscoveryService();
    private brain = new DiscoveryBrain();
    private pullPushService = new PullPushService();
    private arcticShiftService = new ArcticShiftService();

    async search(uid: string, query: string, platforms: ('reddit' | 'hn')[] | 'all' = 'all', useAiBrain = false, skipCache = false, plan: string = 'free'): Promise<DiscoveryResponse> {
        logger.info({ action: 'SEARCH_START', uid, searchTerm: query, platforms, useAiBrain, skipCache }, `Searching for "${query}" (AI Brain: ${useAiBrain}, SkipCache: ${skipCache})`);

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
            return this.search(uid, boostedQuery, platforms); // Recursive call with boosted query
        }

        // If STILL no results even after boosting, fallback to JustSerp baseline
        if (allResults.length === 0) {
            logger.info({ action: 'FALLBACK_JUSTSERP', searchTerm: query }, `No results found. Falling back to JustSerp...`);
            return this.justSerpBaseline(query);
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

        const response: DiscoveryResponse = {
            results: sortedResults,
            discoveryPlan
        };

        // Enrich metadata for top results if needed
        await this.enrichMetadata(sortedResults);

        // Save to History (Awaited to ensure consistency before response)
        try {
            await saveDiscoveryHistory(uid, {
                type: 'competitor',
                query,
                params: { platforms: platformList, useAiBrain },
                resultsCount: sortedResults.length,
                topResults: sortedResults.slice(0, 5).map(r => ({
                    title: r.title,
                    url: r.url,
                    source: r.source,
                    score: r.score
                })),
                savedResults: sortedResults,
                discoveryPlan: discoveryPlan
            });
        } catch (err) {
            logger.error({ err }, "Failed to save search history");
        }

        return response;
    }

    async ideaDiscovery(uid: string, idea: string, communities?: string[], competitors?: string[], skipCache = false, plan: string = 'free'): Promise<DiscoveryResponse> {
        const cacheKey = `discovery:idea:${Buffer.from(idea.trim().toLowerCase()).toString('base64')}:v6`;

        if (!skipCache) {
            try {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    logger.info({ action: 'CACHE_HIT_IDEA_DISCOVERY', idea }, "Returning cached discovery results");
                   const res = JSON.parse(cached) as DiscoveryResponse;
            
            // Save to history even on cache hit
            saveDiscoveryHistory(uid, {
                type: 'idea',
                query: idea,
                params: { 
                    communities: communities || [], 
                    competitors: competitors || [],
                    platforms: ['reddit', 'hn'] 
                },
                resultsCount: res.results.length,
                topResults: res.results.slice(0, 5).map(r => ({
                    title: r.title,
                    url: r.url,
                    source: r.source,
                    score: r.score
                })),
                savedResults: res.results,
                discoveryPlan: res.discoveryPlan
            }).catch(err => logger.error({ err }, "Failed to save idea history on cache hit"));

            return res;
        }
    } catch (err) {
                logger.error({ err }, "Cache read error in ideaDiscovery");
            }
        }

        logger.info({ action: 'IDEA_DISCOVERY_START_SERPER_PRIMARY', idea, skipCache, plan }, `Master Query phase starting via Serper...`);
        const { expandIdeaToQueries } = await import('../ai.js');

        // Dynamic Query Density based on Plan
        const freePlans = ['free', 'trial', 'starter', 'past_due'];
        const queryCount = freePlans.includes(plan) ? 1 : 3;
        const { intent, queries } = await expandIdeaToQueries(idea, communities, competitors, queryCount);

        logger.info({ queries }, `Generated ${queries.length} queries for ${plan} plan`);

        // 2. Primary Phase (JustSerp API) - Parallel for Pro
        const serpResponses = await Promise.all(
            queries.map(q => this.justSerpBaseline(q))
        );

        let allResults: DiscoveryResult[] = [];
        let scannedCount = 0;

        serpResponses.forEach(resp => {
            allResults = [...allResults, ...resp.results];
            scannedCount += resp.discoveryPlan.scannedCount;
        });

        // 3. Fallback Enhancement: If signal is too low, expand search to direct platform APIs
        if (allResults.length < 3) {
            logger.info({ action: 'DEEP_SEARCH_TRIGGERED', count: allResults.length }, "Low signal from JustSerp. Expanding to platform-specific deep search...");
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

        // 5. Enrichment Phase: Fetch metadata for top results (especially from JustSerp)
        await this.enrichMetadata(finalResults);

        logger.info({
            action: 'IDEA_DISCOVERY_COMPLETE',
            totalResults: finalResults.length,
            scannedCount
        }, `Master query discovery complete. Found ${finalResults.length} matches.`);

        // Log Top 10 results for visibility in terminal
        const topLog = finalResults.slice(0, 10).map(r => `[${r.source.toUpperCase()}][Score: ${r.score.toFixed(0)}][Comments: ${r.num_comments}] ${r.title}`);
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

        // Save to History (Awaited to ensure consistency before response)
        try {
            await saveDiscoveryHistory(uid, {
                type: 'idea',
                query: idea,
                params: {
                    communities,
                    competitors,
                    platforms: ['reddit', 'hn']
                },
                resultsCount: finalResults.length,
                topResults: finalResults.slice(0, 5).map(r => ({
                    title: r.title,
                    url: r.url,
                    source: r.source,
                    score: r.score
                })),
                savedResults: finalResults,
                discoveryPlan: discoveryPlan
            });
        } catch (err) {
            logger.error({ err }, "Failed to save idea history");
        }

        return response;
    }

    private async justSerpBaseline(query: string): Promise<DiscoveryResponse> {
        const JUST_SERP_KEY = process.env.JUST_SERP_KEY;
        const JUSTSERP_DAILY_CAP = parseInt(process.env.JUSTSERP_DAILY_CAP || '50', 10);

        if (!JUST_SERP_KEY) {
            logger.error("JUST_SERP_KEY is missing");
            return { results: [], discoveryPlan: this.emptyPlan() };
        }

        // Check quota before calling JustSERP
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const db = getDb();
        const quotaDocRef = db.collection('quota_counters').doc(`justserp_${today}`);

        try {
            const quotaDoc = await quotaDocRef.get();
            const quotaData = quotaDoc.data() || { count: 0, cap: JUSTSERP_DAILY_CAP, date: today };

            if (quotaData.count >= JUSTSERP_DAILY_CAP) {
                logger.warn({ platform: 'justserp', action: 'QUOTA_EXHAUSTED', count: quotaData.count, cap: JUSTSERP_DAILY_CAP }, `JustSERP daily cap reached (${quotaData.count}/${JUSTSERP_DAILY_CAP}). Returning empty.`);
                return { results: [], discoveryPlan: this.emptyPlan() };
            }
        } catch (err: unknown) {
            logger.error({ err: errMsg(err), action: 'QUOTA_CHECK_ERROR' }, `Failed to check JustSERP quota`);
            // On error, fail gracefully and don't call JustSERP
            return { results: [], discoveryPlan: this.emptyPlan() };
        }

        const justSerpUrl = "https://api.justserp.com/v1/search";
        logger.info({ platform: 'justserp', action: 'API_FETCH', url: justSerpUrl, searchTerm: query });

        try {
            const response = await fetch(justSerpUrl, {
                method: "POST",
                headers: { "X-API-KEY": JUST_SERP_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({ keyword: query, num: 20 })
            });

            if (!response.ok) {
                logger.error({ status: response.status, statusText: response.statusText }, "JustSerp API call failed");
                return { results: [], discoveryPlan: this.emptyPlan() };
            }

            // Increment quota counter and log usage
            try {
                await quotaDocRef.set({
                    count: (await quotaDocRef.get()).data()?.count || 0 + 1,
                    cap: JUSTSERP_DAILY_CAP,
                    date: today
                }, { merge: true });

                // Log to serp_usage collection
                await db.collection('serp_usage').add({
                    source: 'justserp',
                    keyword: query,
                    timestamp: new Date().toISOString(),
                    cost_estimate: 0.01
                });
            } catch (logErr: any) {
                logger.error({ err: logErr.message, action: 'QUOTA_LOG_ERROR' }, `Failed to log JustSERP usage`);
            }

            const data: any = await response.json();
            const organic = data.organic_results || [];

            const rawResults: DiscoveryResult[] = organic.map((r: any) => {
                const source = r.link.includes('news.ycombinator.com') ? 'hn' : (r.link.includes('reddit.com') ? 'reddit' : 'google');

                // Optimized parsing for comment counts from displayedLink (e.g., "120+ comments")
                let numComments = 0;
                if (source === 'reddit' && r.displayedLink) {
                    const match = r.displayedLink.match(/(\d+)\+? comments/);
                    if (match) {
                        numComments = parseInt(match[1], 10);
                    }
                }

                const markers = ['general_discussion'];
                if (numComments > 50) markers.push('high_engagement');
                const titleLower = r.title.toLowerCase();
                if (titleLower.includes('how') || titleLower.includes('help') || titleLower.includes('?')) markers.push('question');
                if (titleLower.includes('alternative') || titleLower.includes('vs') || titleLower.includes('better')) markers.push('alternative');
                if (titleLower.includes('sucks') || titleLower.includes('hate') || titleLower.includes('annoy')) markers.push('frustration');

                return {
                    id: r.link,
                    title: r.title,
                    url: r.link,
                    subreddit: r.link.includes('/r/') ? r.link.split('/r/')[1].split('/')[0] : (source === 'hn' ? 'Hacker News' : 'Web'),
                    author: 'unknown',
                    source,
                    num_comments: numComments,
                    created_utc: Math.floor(Date.now() / 1000),
                    score: source !== 'google' ? 8000 : 5000,
                    intentMarkers: markers
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
            logger.error({ err }, "JustSerp fetch failed");
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
        const cacheKey = `thread_data:v1:${Buffer.from(urlOrId).toString('base64')}`;

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

    private async enrichMetadata(results: DiscoveryResult[]): Promise<void> {
        try {
            const config = await getGlobalConfig();
            const enrichmentLimit = config.discovery_enrichment_limit || 10;
            const topToEnrich = results.slice(0, enrichmentLimit);

            const needsEnrichment = topToEnrich.filter((r): r is DiscoveryResult & { source: 'reddit' | 'hn' } =>
                (r.num_comments === 0 || r.author === 'unknown') && (r.source === 'reddit' || r.source === 'hn')
            );

            if (needsEnrichment.length === 0) return;

            logger.info({
                action: 'ENRICHMENT_PHASE_START',
                totalChecked: topToEnrich.length,
                toEnrich: needsEnrichment.length
            }, `Enriching metadata for ${needsEnrichment.length} results...`);

            // Extract Reddit post IDs (short base36 IDs from URLs like /comments/abc123/)
            const extractId = (url: string) => url.match(/comments\/([a-z0-9]+)/)?.[1] ?? null;

            const redditResults = needsEnrichment.filter(r => r.source === 'reddit');
            const redditIds = redditResults.map(r => extractId(r.url)).filter((id): id is string => id !== null);

            // Build a lookup map: shortId → result object (for applying enrichment data)
            const idToResult = new Map<string, DiscoveryResult>();
            for (const r of redditResults) {
                const id = extractId(r.url);
                if (id) idToResult.set(id, r);
            }

            // --- Step 1: PullPush (works from datacenter IPs, no proxy needed) ---
            const resolvedIds = new Set<string>();
            if (redditIds.length > 0) {
                const pullPushData = await this.pullPushService.getSubmissionsByIds(redditIds);
                for (const item of pullPushData) {
                    const r = idToResult.get(item.id);
                    if (r && item.author && item.author !== 'unknown') {
                        r.author = item.author;
                        r.num_comments = item.num_comments || r.num_comments;
                        r.isCached = true;
                        resolvedIds.add(item.id);
                    }
                }
                logger.info({ action: 'ENRICHMENT_PULLPUSH', resolved: resolvedIds.size, total: redditIds.length }, `PullPush resolved ${resolvedIds.size}/${redditIds.length} authors`);
            }

            // --- Step 2: Arctic Shift for IDs PullPush missed ---
            const unresolved = redditIds.filter(id => !resolvedIds.has(id));
            if (unresolved.length > 0) {
                const arcticData = await this.arcticShiftService.getPostsByIds(unresolved);
                for (const item of arcticData) {
                    const r = idToResult.get(item.id);
                    if (r && item.author && item.author !== 'unknown') {
                        r.author = item.author;
                        r.num_comments = item.num_comments || r.num_comments;
                        r.isCached = true;
                        resolvedIds.add(item.id);
                    }
                }
                logger.info({ action: 'ENRICHMENT_ARCTIC_SHIFT', resolved: resolvedIds.size, total: redditIds.length }, `Arctic Shift resolved ${resolvedIds.size - (redditIds.length - unresolved.length)}/${unresolved.length} additional authors`);
            }

            // --- Step 3: Fall back to full thread fetch (proxy/fetcher/direct) for anything still unresolved ---
            const stillUnresolved = needsEnrichment.filter(r => r.author === 'unknown');
            if (stillUnresolved.length > 0) {
                logger.info({ action: 'ENRICHMENT_FALLBACK', count: stillUnresolved.length }, `Falling back to Reddit fetcher for ${stillUnresolved.length} results`);
                await Promise.all(stillUnresolved.map(async (r) => {
                    try {
                        const fullData = await this.fetchFullThread(r.url, r.source);
                        if (fullData && fullData.post) {
                            r.num_comments = fullData.post.num_comments || 0;
                            r.author = fullData.post.author || 'unknown';
                            r.isCached = true;
                        }
                    } catch (err) {
                        logger.warn({ url: r.url }, "Fallback enrichment failed for result");
                    }
                }));
            }
        } catch (err) {
            logger.error({ err }, "Enrichment phase failed");
        }
    }
}
