import fetch from 'node-fetch';
import { redis } from '../middleware/rateLimiter.js';
import { DiscoveryResult, IDiscoveryService } from './types.js';
import { getGlobalConfig } from '../firestore.js';
import { logger } from '../utils/logger.js';

export class HnDiscoveryService implements IDiscoveryService {
    private BASE_URL = 'https://hn.algolia.com/api/v1';
    private lastRequestTime = 0;
    private MIN_REQUEST_INTERVAL = 1000;

    private async waitIfNecessary() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
            const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
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
