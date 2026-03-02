import fetch from 'node-fetch';
import { redis } from '../middleware/rateLimiter.js';
import { DiscoveryResult, IDiscoveryService } from './types.js';
import { getGlobalConfig } from '../firestore.js';
import { logger } from '../utils/logger.js';

export class HnDiscoveryService implements IDiscoveryService {
    private BASE_URL = 'https://hn.algolia.com/api/v1';
    private lastRequestTime = 0;

    private async waitIfNecessary() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        // Jitter: random interval 1s to 3s
        const randomInterval = Math.floor(Math.random() * (3000 - 1000 + 1) + 1000);

        if (timeSinceLastRequest < randomInterval) {
            const waitTime = randomInterval - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequestTime = Date.now();
    }

    async deepDiscovery(competitor: string, customQueries?: string[], skipCache = false): Promise<{ results: DiscoveryResult[]; scannedCount: number; isFromCache: boolean }> {
        const cleanCompetitor = competitor.trim();
        const cacheKey = customQueries
            ? `discovery_results:hn:${cleanCompetitor.toLowerCase()}:custom:v3`
            : `discovery_results:hn:${cleanCompetitor.toLowerCase()}:v3`;

        if (!skipCache) {
            try {
                logger.info({ platform: 'hn', action: 'DB_REDIS_GET', key: cacheKey });
                const cached = await redis.get(cacheKey);
                if (cached) {
                    return { results: JSON.parse(cached), isFromCache: true, scannedCount: 0 };
                }
            } catch (err) {
                logger.error({ err, platform: 'hn', action: 'CACHE_ERROR' }, `Cache error`);
            }
        }

        const compLower = cleanCompetitor.toLowerCase();
        const queries = customQueries || [
            `"${cleanCompetitor}" frustrated`,
            `"${cleanCompetitor}" alternative`,
            `"${cleanCompetitor}" vs`,
            `"${cleanCompetitor}" review`,
            `show hn "${cleanCompetitor}"`
        ];

        const allResultsMap = new Map<string, DiscoveryResult>();
        let scannedCount = 0;

        for (const query of queries) {
            await this.waitIfNecessary();
            try {
                const searchUrl = `${this.BASE_URL}/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=20`;
                logger.info({ platform: 'hn', action: 'API_FETCH', url: searchUrl, searchTerm: query });
                const res = await fetch(searchUrl);
                if (!res.ok) continue;

                const data: any = await res.json();
                const hits = data.hits || [];
                scannedCount += hits.length;

                for (const hit of hits) {
                    const { score, markers } = this.calculateRelevanceScore(hit, compLower);

                    if (score > 1000) {
                        const result: DiscoveryResult = {
                            id: hit.objectID,
                            title: hit.title,
                            author: hit.author,
                            subreddit: 'Hacker News',
                            ups: hit.points || 0,
                            num_comments: hit.num_comments || 0,
                            created_utc: hit.created_at_i,
                            url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
                            source: 'hn',
                            score,
                            intentMarkers: markers
                        };

                        if (!allResultsMap.has(hit.objectID) || allResultsMap.get(hit.objectID)!.score < score) {
                            allResultsMap.set(hit.objectID, result);
                        }
                    }
                }
            } catch (err) {
                logger.error({ err, platform: 'hn', query }, `Search error for "${query}"`);
            }
        }

        const finalResults = Array.from(allResultsMap.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 50);

        try {
            const config = await getGlobalConfig();
            logger.info({ platform: 'hn', action: 'DB_REDIS_SET', key: cacheKey, ttl: config.discovery_cache_ttl });
            await redis.set(cacheKey, JSON.stringify(finalResults), 'EX', config.discovery_cache_ttl);
        } catch (err) {
            logger.error({ err, platform: 'hn', action: 'CACHE_SET_ERROR' }, `Cache set failed`);
        }

        const enriched = await this.checkMetadataCacheStatus(finalResults);
        return { results: enriched, isFromCache: false, scannedCount };
    }

    async fetchFullThreadRecord(id: string): Promise<any | null> {
        await this.waitIfNecessary();
        try {
            logger.info({ platform: 'hn', action: 'API_FETCH', url: `${this.BASE_URL}/items/${id}` });
            const response = await fetch(`${this.BASE_URL}/items/${id}`);
            if (!response.ok) return null;

            const data: any = await response.json();

            const post = {
                id: data.id.toString(),
                title: data.title,
                author: data.author,
                points: data.points || 0,
                num_comments: (data.children || []).length,
                url: `https://news.ycombinator.com/item?id=${data.id}`,
                subreddit: 'Hacker News',
                selftext: data.text || "",
                created_utc: Math.floor(new Date(data.created_at).getTime() / 1000)
            };

            const flattenedComments: any[] = [];
            const processComments = (comments: any[]) => {
                for (const comment of comments) {
                    if (comment.text) {
                        flattenedComments.push({
                            id: comment.id.toString(),
                            author: comment.author,
                            body: comment.text,
                            ups: 0,
                            parent_id: comment.parent_id?.toString(),
                            created_utc: Math.floor(new Date(comment.created_at).getTime() / 1000)
                        });
                    }
                    if (comment.children && comment.children.length > 0) {
                        processComments(comment.children);
                    }
                }
            };

            if (data.children) {
                processComments(data.children);
            }

            return {
                post,
                comments: flattenedComments,
                source: 'hn',
                fetchedAt: new Date().toISOString()
            };
        } catch (err) {
            logger.error({ err, platform: 'hn', id }, `Fetch error for ${id}`);
            return null;
        }
    }

    private calculateRelevanceScore(hit: any, compLower: string): { score: number; markers: DiscoveryResult['intentMarkers'] } {
        const title = (hit.title || '').toLowerCase();
        const text = (hit.story_text || '').toLowerCase();
        const combined = title + " " + text;

        let score = 0;
        const markers: DiscoveryResult['intentMarkers'] = [];

        if (!combined.includes(compLower)) return { score: 0, markers: [] };

        score += 5000; // Base score for mention
        if (title.includes(compLower)) score += 5000;

        const frustrationKeywords = ['annoying', 'frustrating', 'sucks', 'hate', 'broken', 'slow', 'expensive', 'problems'];
        const alternativeKeywords = ['alternatives', 'alternative', 'switching', 'better than', 'vs'];
        const questionKeywords = ['how to', 'help', 'recommendation', 'anyone', 'advice'];

        let hasFrustration = false;
        frustrationKeywords.forEach(k => {
            if (combined.includes(k)) {
                score += 2000;
                hasFrustration = true;
            }
        });
        if (hasFrustration) markers.push('frustration');

        let hasAlternative = false;
        alternativeKeywords.forEach(k => {
            if (combined.includes(k)) {
                score += 2000;
                hasAlternative = true;
            }
        });
        if (hasAlternative) markers.push('alternative');

        let hasQuestion = false;
        questionKeywords.forEach(k => {
            if (combined.includes(k)) {
                score += 1000;
                hasQuestion = true;
            }
        });
        if (hasQuestion) markers.push('question');

        // Engagement
        if (hit.num_comments > 20) {
            score += 3000;
            markers.push('high_engagement');
        }
        score += Math.min(hit.num_comments || 0, 100) * 20;
        score += Math.min(hit.points || 0, 200) * 10;

        // Recency Multiplier (Time Decay)
        const now = Math.floor(Date.now() / 1000);
        const ageInSeconds = now - (hit.created_at_i || now);
        const ageInDays = ageInSeconds / (60 * 60 * 24);

        let recencyMultiplier = 1.0;
        if (ageInDays <= 7) recencyMultiplier = 1.5; // Last week
        else if (ageInDays <= 30) recencyMultiplier = 1.3; // Last month
        else if (ageInDays <= 180) recencyMultiplier = 1.1; // Last 6 months

        score = Math.floor(score * recencyMultiplier);

        return { score, markers };
    }

    async ideaDiscovery(idea: string, queries: string[], skipCache = false, intent?: { persona: string; pain: string; domain: string }): Promise<{ results: DiscoveryResult[]; scannedCount: number; isFromCache: boolean }> {
        const cleanIdea = idea.trim();
        const cacheKey = `discovery_results:hn:idea:${Buffer.from(cleanIdea).toString('base64').slice(0, 32)}:v2`;

        const cleanIntent = intent ? {
            persona: (intent.persona || '').trim(),
            pain: (intent.pain || '').trim(),
            domain: (intent.domain || '').trim()
        } : undefined;

        const allResultsMap = new Map<string, DiscoveryResult>();
        let scannedCount = 0;

        // HN Algolia search is keyword-based. We should strip advanced Reddit filters if any slipped in.
        const cleanQueries = queries.map(q => q.replace(/subreddit:\S+/g, '').trim());

        for (const query of cleanQueries) {
            await this.waitIfNecessary();
            try {
                const searchUrl = `${this.BASE_URL}/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=30`;
                logger.info({ platform: 'hn', action: 'API_FETCH_IDEA', url: searchUrl, searchTerm: query });
                const res = await fetch(searchUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                });

                const bodyText = await res.text();
                logger.debug({ platform: 'hn', status: res.status, bodySample: bodyText.slice(0, 100) }, "HN API Response received");

                if (!res.ok) {
                    logger.warn({ platform: 'hn', action: 'API_FETCH_ERROR', status: res.status, query, body: bodyText.slice(0, 100) }, "HN search failed");
                    continue;
                }

                const data: any = JSON.parse(bodyText);
                const hits = data.hits || [];
                scannedCount += hits.length;
                logger.info({ platform: 'hn', action: 'API_RESULT_COUNT', count: hits.length, query, totalScanned: scannedCount });

                for (const hit of hits) {
                    const { score, markers } = this.calculateIdeaRelevanceScore(hit, cleanIdea, cleanIntent, true);

                    if (score > 4000) { // Tightened for better accuracy
                        const result: DiscoveryResult = {
                            id: hit.objectID,
                            title: hit.title,
                            author: hit.author,
                            subreddit: 'Hacker News',
                            ups: hit.points || 0,
                            num_comments: hit.num_comments || 0,
                            created_utc: hit.created_at_i,
                            url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
                            source: 'hn',
                            score,
                            intentMarkers: markers
                        };

                        if (!allResultsMap.get(hit.objectID)?.score || allResultsMap.get(hit.objectID)!.score < score) {
                            allResultsMap.set(hit.objectID, result);
                        }
                    }
                }
            } catch (err) {
                logger.error({ err, platform: 'hn', query }, `Query failed`);
            }
        }

        // Broader Fallback if no high-signal results found
        if (allResultsMap.size < 3 && cleanQueries.length > 0) {
            const words = cleanIdea.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const broadQuery = words.slice(0, 3).join(' ');

            if (broadQuery) {
                logger.info({ platform: 'hn', action: 'BROADER_SEARCH_FALLBACK', broadQuery }, "Attempting broad fallback search...");
                await this.waitIfNecessary();
                try {
                    const searchUrl = `${this.BASE_URL}/search?query=${encodeURIComponent(broadQuery)}&tags=story&hitsPerPage=50`;
                    const res = await fetch(searchUrl, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                    });
                    if (res.ok) {
                        const data: any = await res.json();
                        const hits = data.hits || [];
                        scannedCount += hits.length;
                        logger.info({ platform: 'hn', action: 'API_RESULT_COUNT_FALLBACK', count: hits.length, query: broadQuery });
                        for (const hit of hits) {
                            const { score, markers } = this.calculateIdeaRelevanceScore(hit, cleanIdea, cleanIntent, true);
                            if (score > 1000) {
                                allResultsMap.set(hit.objectID, {
                                    id: hit.objectID,
                                    title: hit.title,
                                    author: hit.author,
                                    subreddit: 'Hacker News',
                                    ups: hit.points || 0,
                                    num_comments: hit.num_comments || 0,
                                    created_utc: hit.created_at_i,
                                    url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
                                    source: 'hn',
                                    score,
                                    intentMarkers: markers
                                });
                            }
                        }
                    }
                } catch (err) {
                    logger.error({ err, platform: 'hn' }, "Fallback search failed");
                }
            }
        }

        const finalResults = Array.from(allResultsMap.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 50);

        const enriched = await this.checkMetadataCacheStatus(finalResults);
        return { results: enriched, isFromCache: false, scannedCount };
    }

    private calculateIdeaRelevanceScore(hit: any, idea: string, intent?: { persona: string; pain: string; domain: string }, isIdeaDiscovery = false): { score: number; markers: string[] } {
        const title = (hit.title || '').toLowerCase();
        const text = (hit.story_text || '').toLowerCase();
        const combined = title + " " + text;

        const STOP_WORDS = new Set(['want', 'make', 'that', 'like', 'feels', 'this', 'with', 'from', 'your', 'about', 'some', 'thing', 'user', 'people', 'would', 'could', 'should', 'will', 'just', 'best', 'good', 'apps', 'tool']);

        let score = 0;
        const detail: string[] = [];

        // 1. Dual-Signal extraction
        const searchTerms = idea.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));

        // Exact Phrase Bonus
        if (combined.includes(searchTerms.join(' '))) {
            score += 5000;
            detail.push('EXACT_PHRASE');
        }

        let termMatches = 0;
        let titleMatch = false;
        searchTerms.forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'i');
            if (regex.test(title)) {
                score += 4000;
                termMatches++;
                titleMatch = true;
                detail.push(`TITLE_MATCH:${term.toUpperCase()}`);
            } else if (regex.test(text)) {
                score += 1000;
                termMatches++;
                detail.push(`BODY_MATCH:${term.toUpperCase()}`);
            }
        });

        // 2. Proximity Check (Window of 150 characters)
        if (searchTerms.length >= 2) {
            for (let i = 0; i < searchTerms.length; i++) {
                for (let j = i + 1; j < searchTerms.length; j++) {
                    const posI = combined.indexOf(searchTerms[i]);
                    const posJ = combined.indexOf(searchTerms[j]);
                    if (posI !== -1 && posJ !== -1 && Math.abs(posI - posJ) < 150) {
                        score += 5000;
                        detail.push('PROXIMITY_BOOST');
                    }
                }
            }
        }

        // 3. Anti-Vague Filter
        const domainTerms = ['budget', 'money', 'finance', 'expense', 'saving'];
        const hasStrongDomain = domainTerms.some(d => {
            const count = (combined.match(new RegExp(`\\b${d}\\b`, 'gi')) || []).length;
            return count > 2 || title.includes(d);
        });

        if (isIdeaDiscovery && !hasStrongDomain && termMatches < 3) {
            score -= 10000;
            detail.push('PENALTY:VAGUE_DOMAIN');
        }

        // 4. Final Threshold kill
        if (isIdeaDiscovery && score < 4000) {
            return { score: 0, markers: [] };
        }

        // Engagement
        score += (hit.points || 0) * 10;
        score += (hit.num_comments || 0) * 20;

        // Extra boost for Show HN
        if (title.includes("show hn")) { score += 2000; detail.push('SHOW_HN'); }

        return { score, markers: detail };
    }

    private async checkMetadataCacheStatus(results: DiscoveryResult[]): Promise<DiscoveryResult[]> {
        return Promise.all(results.map(async (r) => {
            const cacheKey = `hn_meta:${r.id}`;
            try {
                logger.info({ platform: 'hn', action: 'DB_REDIS_EXISTS', key: cacheKey });
                const exists = await redis.exists(cacheKey);
                return { ...r, isCached: exists === 1 };
            } catch {
                return { ...r, isCached: false };
            }
        }));
    }
}
