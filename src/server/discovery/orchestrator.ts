import { RedditDiscoveryService } from './reddit.service.js';
import { HnDiscoveryService } from './hn.service.js';
import { DiscoveryBrain } from './brain.js';
import { PullPushService } from './pullpush.service.js';
import { ArcticShiftService } from './arctic-shift.service.js';
import { DiscoveryResult, DiscoveryPlan, DiscoveryResponse } from './types.js';
import { logger } from '../utils/logger.js';
import { errMsg } from '../utils/errors.js';
import { redis } from '../middleware/rateLimiter.js';
import { getGlobalConfig, saveDiscoveryHistory, getDb, getPlanConfig } from '../firestore.js';

export class DiscoveryOrchestrator {
    private redditService = new RedditDiscoveryService();
    private hnService = new HnDiscoveryService();
    private brain = new DiscoveryBrain();
    private pullPushService = new PullPushService();
    private arcticShiftService = new ArcticShiftService();

    async search(uid: string, query: string, platforms: ('reddit' | 'hn')[] | 'all' = 'all', useAiBrain = false, skipCache = false, plan: string = 'free', _depth = 0): Promise<DiscoveryResponse> {
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
            if (_depth >= 1) {
                logger.warn({ action: 'CONTEXT_BOOST_MAX_DEPTH', searchTerm: query }, 'Recursion depth limit reached, falling back to SERP');
                return this.searloBaseline(query);
            }
            logger.info({ action: 'CONTEXT_BOOST', searchTerm: query }, `Low signal for "${query}". Attempting Context Boost...`);
            const boostedQuery = `${query} software OR app OR tool`;
            return this.search(uid, boostedQuery, platforms, useAiBrain, skipCache, plan, _depth + 1);
        }

        // If STILL no results even after boosting, fallback to SERP baseline
        if (allResults.length === 0) {
            logger.info({ action: 'FALLBACK_SERP', searchTerm: query }, `No results found. Falling back to Searlo SERP...`);
            return this.searloBaseline(query);
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

        logger.info({ action: 'IDEA_DISCOVERY_START_SEARLO_PRIMARY', idea, skipCache, plan }, `Master Query phase starting via Searlo...`);
        const { expandIdeaToQueries } = await import('../ai.js');

        // Dynamic Query Density based on Plan (driven from Firestore PlanConfig)
        const planConfig = await getPlanConfig(plan);
        const queryCount = planConfig.serpQueriesPerDiscovery;
        const { intent, queries } = await expandIdeaToQueries(idea, communities, competitors, queryCount);

        logger.info({ queries }, `Generated ${queries.length} queries for ${plan} plan`);

        // 2. Primary Phase (Searlo SERP API) - Parallel for Pro
        const serpResponses = await Promise.all(
            queries.map(q => this.searloBaseline(q))
        );

        let allResults: DiscoveryResult[] = [];
        let scannedCount = 0;

        serpResponses.forEach(resp => {
            allResults = [...allResults, ...resp.results];
            scannedCount += resp.discoveryPlan.scannedCount;
        });

        // 3. Fallback Enhancement: If signal is too low, expand search to direct platform APIs
        if (allResults.length < 3) {
            logger.info({ action: 'DEEP_SEARCH_TRIGGERED', count: allResults.length }, "Low signal from Searlo. Expanding to platform-specific deep search...");
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
        const finalResults = allResults
            .filter(r => {
                if (seenUrls.has(r.url)) return false;
                seenUrls.add(r.url);
                return r.score > 0;
            })
            .sort((a, b) => b.score - a.score);

        // 5. Enrichment Phase: Fetch metadata for top results missing author/comments
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

    private parseSerpDescription(desc: string): { author: string; upvotes: number; numComments: number } {
        let author = 'unknown', upvotes = 0, numComments = 0;
        if (!desc) return { author, upvotes, numComments };

        const authorMatch = desc.match(/Posted by u\/(\S+)/);
        if (authorMatch) author = authorMatch[1];

        const votesMatch = desc.match(/([\d,]+)\s+votes?/);
        if (votesMatch) upvotes = parseInt(votesMatch[1].replace(/,/g, ''), 10);

        const commentsMatch = desc.match(/([\d,]+)\s+comments?/);
        if (commentsMatch) numComments = parseInt(commentsMatch[1].replace(/,/g, ''), 10);

        return { author, upvotes, numComments };
    }

    private parseSnippetDate(snippet: string): number | null {
        if (!snippet) return null;
        const match = snippet.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\s+(\d{4})\b/i);
        if (!match) return null;
        const [, day, rawMonth, year] = match;
        const month = rawMonth.length === 4 ? rawMonth.slice(0, 3) : rawMonth;
        const date = new Date(`${day} ${month} ${year}`);
        if (isNaN(date.getTime())) return null;
        return Math.floor(date.getTime() / 1000);
    }

    private async searloBaseline(query: string): Promise<DiscoveryResponse> {
        const SEARLO_API_KEY = process.env.SEARLO_API_KEY;
        const globalConfig = await getGlobalConfig();
        const dailyCap = globalConfig.searlo_daily_cap;
        const maxRetries = globalConfig.searlo_max_retries;
        const responseCacheTtl = globalConfig.searlo_response_cache_ttl;

        if (!SEARLO_API_KEY) {
            logger.error("SEARLO_API_KEY is missing");
            return { results: [], discoveryPlan: this.emptyPlan() };
        }

        // Check Redis cache first
        const serpCacheKey = `searlo:response:${Buffer.from(query.trim().toLowerCase()).toString('base64')}`;
        try {
            const cached = await redis.get(serpCacheKey);
            if (cached) {
                logger.info({ platform: 'searlo', action: 'CACHE_HIT', query }, 'Returning cached Searlo response');
                return JSON.parse(cached);
            }
        } catch (err) {
            logger.warn({ err }, 'Searlo cache read error');
        }

        // Check quota before calling Searlo
        const today = new Date().toISOString().split('T')[0];
        const db = getDb();
        const quotaDocRef = db.collection('quota_counters').doc(`searlo_${today}`);

        try {
            const quotaDoc = await quotaDocRef.get();
            const quotaData = quotaDoc.data() || { count: 0, cap: dailyCap, date: today };

            if (quotaData.count >= dailyCap) {
                logger.warn({ platform: 'searlo', action: 'QUOTA_EXHAUSTED', count: quotaData.count, cap: dailyCap }, `Searlo daily cap reached (${quotaData.count}/${dailyCap}). Returning empty.`);
                return { results: [], discoveryPlan: this.emptyPlan() };
            }
        } catch (err: unknown) {
            logger.error({ err: errMsg(err), action: 'QUOTA_CHECK_ERROR' }, `Failed to check Searlo quota`);
            return { results: [], discoveryPlan: this.emptyPlan() };
        }

        const searloUrl = "https://api.searlo.tech/api/v1/search";
        const currentYear = new Date().getFullYear();
        const searchQuery = `${query} site:reddit.com after:${currentYear}-01-01`;
        logger.info({ platform: 'searlo', action: 'API_FETCH', searchTerm: searchQuery });

        // Retry loop for transient failures
        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const url = new URL(searloUrl);
                url.searchParams.set('q', searchQuery);
                url.searchParams.set('limit', '10');
                url.searchParams.set('page', '1');

                const response = await fetch(url.toString(), {
                    method: 'GET',
                    headers: { 'X-API-Key': SEARLO_API_KEY, 'Content-Type': 'application/json' }
                });

                if (response.status >= 500 && attempt < maxRetries) {
                    const delay = 2000 * Math.pow(2, attempt);
                    logger.warn({ status: response.status, attempt }, `Searlo 5xx, retrying in ${delay}ms`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }

                if (!response.ok) {
                    logger.error({ status: response.status, statusText: response.statusText }, "Searlo API call failed");
                    return { results: [], discoveryPlan: this.emptyPlan() };
                }

                // Increment quota counter and log usage (only on success)
                try {
                    const { FieldValue } = await import('firebase-admin/firestore');
                    await quotaDocRef.set({
                        count: FieldValue.increment(1),
                        cap: dailyCap,
                        date: today
                    }, { merge: true });

                    await db.collection('serp_usage').add({
                        source: 'searlo',
                        keyword: query,
                        timestamp: new Date().toISOString(),
                        cost_estimate: 0.01
                    });
                } catch (logErr: any) {
                    logger.error({ err: logErr.message, action: 'QUOTA_LOG_ERROR' }, `Failed to log Searlo usage`);
                }

                const data: any = await response.json();
                const organic = data.organic || [];

                const rawResults: DiscoveryResult[] = organic.map((r: any) => {
                    const source = r.link.includes('news.ycombinator.com') ? 'hn' : (r.link.includes('reddit.com') ? 'reddit' : 'google');

                    // Parse rich metadata from Searlo description (author, votes, comments)
                    const { author, upvotes, numComments } = this.parseSerpDescription(r.description);

                    const markers = ['general_discussion'];
                    if (numComments > 50) markers.push('high_engagement');
                    if (upvotes > 100) markers.push('high_engagement');
                    const titleLower = r.title.toLowerCase();
                    if (titleLower.includes('how') || titleLower.includes('help') || titleLower.includes('?')) markers.push('question');
                    if (titleLower.includes('alternative') || titleLower.includes('vs') || titleLower.includes('better')) markers.push('alternative');
                    if (titleLower.includes('sucks') || titleLower.includes('hate') || titleLower.includes('annoy')) markers.push('frustration');

                    // Use upvotes as ranking signal instead of hardcoded score
                    const engagementScore = (upvotes * 10) + (numComments * 50);
                    const baseScore = source !== 'google' ? 5000 : 2000;

                    return {
                        id: r.link,
                        title: r.title,
                        url: r.link,
                        subreddit: r.link.includes('/r/') ? r.link.split('/r/')[1].split('/')[0] : (source === 'hn' ? 'Hacker News' : 'Web'),
                        author,
                        source,
                        num_comments: numComments,
                        created_utc: this.parseSnippetDate(r.snippet) ?? Math.floor(Date.now() / 1000),
                        score: baseScore + engagementScore,
                        intentMarkers: markers
                    } as DiscoveryResult;
                });

                const result: DiscoveryResponse = {
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

                // Cache the SERP response
                try {
                    await redis.setex(serpCacheKey, responseCacheTtl, JSON.stringify(result));
                } catch (err) {
                    logger.warn({ err }, 'Searlo cache save error');
                }

                return result;
            } catch (err) {
                lastError = err as Error;
                if (attempt < maxRetries) {
                    const delay = 2000 * Math.pow(2, attempt);
                    logger.warn({ err, attempt }, `Searlo network error, retrying in ${delay}ms`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
            }
        }

        logger.error({ err: lastError }, "Searlo fetch failed after retries");
        return { results: [], discoveryPlan: this.emptyPlan() };
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

        let fullData: any;
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

            // Data freshness cutoffs (unix seconds) — skip services that won't have newer posts
            const PULLPUSH_CUTOFF = 1748736000;    // June 1, 2025
            const ARCTIC_SHIFT_CUTOFF = 1767225600; // Jan 1, 2026

            // --- Step 1: PullPush (works from datacenter IPs, no proxy needed) ---
            const resolvedIds = new Set<string>();
            const pullpushEligible = redditIds.filter(id => {
                const r = idToResult.get(id);
                return r && r.created_utc < PULLPUSH_CUTOFF;
            });
            const pullpushSkipped = redditIds.length - pullpushEligible.length;
            if (pullpushSkipped > 0) {
                logger.info({ action: 'ENRICHMENT_PULLPUSH_SKIP', skipped: pullpushSkipped }, `Skipped ${pullpushSkipped} posts newer than PullPush data dump cutoff`);
            }
            if (pullpushEligible.length > 0) {
                const pullPushData = await this.pullPushService.getSubmissionsByIds(pullpushEligible);
                for (const item of pullPushData) {
                    const r = idToResult.get(item.id);
                    if (r && item.author && item.author !== 'unknown') {
                        r.author = item.author;
                        r.num_comments = item.num_comments || r.num_comments;
                        r.isCached = true;
                        resolvedIds.add(item.id);
                    }
                }
                logger.info({ action: 'ENRICHMENT_PULLPUSH', resolved: resolvedIds.size, total: pullpushEligible.length }, `PullPush resolved ${resolvedIds.size}/${pullpushEligible.length} authors`);
            }

            // --- Step 2: Arctic Shift for IDs PullPush missed ---
            const unresolved = redditIds.filter(id => !resolvedIds.has(id));
            const arcticEligible = unresolved.filter(id => {
                const r = idToResult.get(id);
                return r && r.created_utc < ARCTIC_SHIFT_CUTOFF;
            });
            const arcticSkipped = unresolved.length - arcticEligible.length;
            if (arcticSkipped > 0) {
                logger.info({ action: 'ENRICHMENT_ARCTIC_SKIP', skipped: arcticSkipped }, `Skipped ${arcticSkipped} posts newer than Arctic Shift data dump cutoff`);
            }
            if (arcticEligible.length > 0) {
                const arcticData = await this.arcticShiftService.getPostsByIds(arcticEligible);
                for (const item of arcticData) {
                    const r = idToResult.get(item.id);
                    if (r && item.author && item.author !== 'unknown') {
                        r.author = item.author;
                        r.num_comments = item.num_comments || r.num_comments;
                        r.isCached = true;
                        resolvedIds.add(item.id);
                    }
                }
                logger.info({ action: 'ENRICHMENT_ARCTIC_SHIFT', resolved: resolvedIds.size, total: arcticEligible.length }, `Arctic Shift resolved ${resolvedIds.size - (redditIds.length - unresolved.length)}/${arcticEligible.length} additional authors`);
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
