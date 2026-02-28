import fetch from 'node-fetch';
import { redis } from '../middleware/rateLimiter.js';
import { DiscoveryResult, IDiscoveryService } from './types.js';
import { getGlobalConfig } from '../firestore.js';
import { logger } from '../utils/logger.js';

export class RedditDiscoveryService implements IDiscoveryService {
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
            ? `discovery_results:reddit:${cleanCompetitor.toLowerCase()}:custom:v4`
            : `discovery_results:reddit:${cleanCompetitor.toLowerCase()}:v4`;

        if (!skipCache) {
            try {
                logger.info({ platform: 'reddit', action: 'DB_REDIS_GET', key: cacheKey });
                const cached = await redis.get(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    const enriched = await this.checkMetadataCacheStatus(parsed);
                    return { results: enriched, isFromCache: true, scannedCount: enriched.length };
                }
            } catch (err) {
                logger.error({ err, platform: 'reddit', action: 'CACHE_ERROR' }, `Cache error`);
            }
        }

        const compLower = cleanCompetitor.toLowerCase();
        const queries = customQueries || [
            `title:${cleanCompetitor} + frustrated`,
            `title:${cleanCompetitor} + alternative`,
            `title:${cleanCompetitor} + vs`,
            `title:${cleanCompetitor} + review`,
            `title:${cleanCompetitor} + sucks`,
            `"${cleanCompetitor}" + annoying`,
            `"${cleanCompetitor}" + problems`,
            `"${cleanCompetitor}"`
        ];

        const allResultsMap = new Map<string, DiscoveryResult>();
        let scannedCount = 0;

        const noiseFilter = "-subreddit:BestofRedditorUpdates -subreddit:nosleep -subreddit:AITAH -subreddit:relationship_advice -subreddit:AmItheAsshole -subreddit:horrorstories -subreddit:Novelnews -subreddit:AskMenAdvice -subreddit:BORUpdates -subreddit:AnotherEdenGlobal -subreddit:FemFragLab -subreddit:BTSnark";

        for (const rawQuery of queries) {
            // Ensure competitor name is quoted if it has spaces or is a common word
            const safeCompetitor = cleanCompetitor.includes(' ') ? `"${cleanCompetitor}"` : cleanCompetitor;
            const antiPromo = `-"I built" -"launched"`;
            const query = `${rawQuery} ${antiPromo} ${noiseFilter}`;
            await this.waitIfNecessary();
            try {
                const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&t=year&limit=25`;
                logger.info({ platform: 'reddit', action: 'API_FETCH', url: searchUrl, searchTerm: query });
                const res = await fetch(searchUrl, {
                    headers: { 'User-Agent': 'OpinionDeck-Discovery/1.0.0' }
                });
                if (!res.ok) continue;

                const data: any = await res.json();
                const children = data.data?.children || [];
                scannedCount += children.length;

                for (const child of children) {
                    const post = child.data;
                    const { score, markers } = this.calculateRelevanceScore(post, compLower);

                    if (score > 1000) {
                        const result: DiscoveryResult = {
                            id: post.id,
                            title: post.title,
                            author: post.author,
                            subreddit: post.subreddit,
                            ups: post.ups,
                            num_comments: post.num_comments,
                            created_utc: post.created_utc,
                            url: `https://www.reddit.com${post.permalink}`,
                            source: 'reddit',
                            score,
                            intentMarkers: markers
                        };

                        if (!allResultsMap.has(post.id) || allResultsMap.get(post.id)!.score < score) {
                            allResultsMap.set(post.id, result);
                        }
                    }
                }
            } catch (err) {
                logger.error({ err, platform: 'reddit', query }, `Search error for "${query}"`);
            }
        }

        const finalResults = Array.from(allResultsMap.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 50);

        try {
            const config = await getGlobalConfig();
            logger.info({ platform: 'reddit', action: 'DB_REDIS_SET', key: cacheKey, ttl: config.discovery_cache_ttl });
            await redis.set(cacheKey, JSON.stringify(finalResults), 'EX', config.discovery_cache_ttl);
        } catch (err) {
            logger.error({ err, platform: 'reddit', action: 'CACHE_SET_ERROR' }, `Cache set failed`);
        }

        const enriched = await this.checkMetadataCacheStatus(finalResults);
        return { results: enriched, isFromCache: false, scannedCount };
    }

    async fetchFullThreadRecord(url: string, commentLimit = 500): Promise<any | null> {
        await this.waitIfNecessary();
        try {
            const parsedUrl = new URL(url);
            let baseUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;
            const jsonWithoutTrailing = baseUrl.replace(/\/$/, "");
            const jsonUrl = `${jsonWithoutTrailing}.json?limit=${commentLimit}`;

            logger.info({ platform: 'reddit', action: 'API_FETCH', url: jsonUrl });
            const response = await fetch(jsonUrl, {
                headers: { 'User-Agent': 'OpinionDeck-Discovery/1.0.0' }
            });
            if (!response.ok) return null;

            const data: any = await response.json();
            const postData = data[0]?.data?.children[0]?.data;
            if (!postData) return null;

            const post = {
                id: postData.fullname || `t3_${postData.id}`,
                title: postData.title,
                author: postData.author,
                subreddit: postData.subreddit,
                ups: postData.ups,
                num_comments: postData.num_comments,
                permalink: postData.permalink,
                selftext: postData.selftext,
                created_utc: postData.created_utc
            };

            const flattenedComments: any[] = [];
            const processComments = (commentList: any[]) => {
                for (const child of commentList) {
                    if (child.kind === 't1' && flattenedComments.length < commentLimit) {
                        const c = child.data;
                        flattenedComments.push({
                            id: c.id,
                            author: c.author,
                            body: c.body,
                            ups: c.ups,
                            parent_id: c.parent_id,
                            created_utc: c.created_utc
                        });
                        if (c.replies && c.replies.data && c.replies.data.children) {
                            processComments(c.replies.data.children);
                        }
                    }
                }
            };

            if (data[1] && data[1].data && data[1].data.children) {
                processComments(data[1].data.children);
            }

            return {
                post,
                comments: flattenedComments,
                source: 'reddit',
                fetchedAt: new Date().toISOString()
            };
        } catch (err) {
            logger.error({ err, platform: 'reddit', url }, `Fetch error for ${url}`);
            return null;
        }
    }

    private calculateRelevanceScore(post: any, compLower: string): { score: number; markers: DiscoveryResult['intentMarkers'] } {
        const title = (post.title || '').toLowerCase();
        const text = (post.selftext || '').toLowerCase();
        const combined = title + " " + text;
        const subredditLower = (post.subreddit || '').toLowerCase();

        let score = 0;
        const markers: DiscoveryResult['intentMarkers'] = [];

        if (!combined.includes(compLower)) return { score: 0, markers: [] };

        // Subreddit Quality
        const qualitySubs = ['saas', 'productivity', 'startups', 'sysadmin', 'entrepreneur', 'technology', 'programming', 'softwareengineering', 'smallbusiness', 'webdev'];
        const noiseSubs = ['sideproject', 'startups', 'startupindia', 'indiabusiness', 'passive_income', 'makemoneyonlineng', 'appgiveaway', 'thefinancetrending', 'bestofredditorupdates', 'nosleep', 'aitah', 'relationship_advice', 'amitheasshole', 'horrorstories', 'novelnews', 'askmenadvice', 'btssnark', 'anotheredenglobal'];

        if (subredditLower === compLower) score += 20000;
        else if (qualitySubs.includes(subredditLower)) score += 10000;
        else if (noiseSubs.includes(subredditLower)) score -= 30000; // Strong penalty for known noise subs

        // Intent Mapping
        const promoKeywords = ['i built', 'my app', 'my saas', 'just launched', 'solo dev'];
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

        let isPromo = false;
        promoKeywords.forEach(k => {
            if (combined.includes(k)) {
                score -= 20000; // HUGE penalty for self-promo
                isPromo = true;
            }
        });

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
        if (post.num_comments > 50) {
            score += 5000;
            markers.push('high_engagement');
        }
        score += Math.min(post.num_comments, 100) * 10;

        // Recency Multiplier (Time Decay)
        // Newer = higher multiplier. 1 year old = 1.0x, 1 week old = ~1.3x, today = 1.5x
        const now = Math.floor(Date.now() / 1000);
        const ageInSeconds = now - (post.created_utc || now);
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
            const threadId = this.extractIdFromUrl(r.url);
            if (!threadId) return { ...r, isCached: false };
            const cacheKey = `reddit_meta:${threadId}`;
            try {
                logger.info({ platform: 'reddit', action: 'DB_REDIS_EXISTS', key: cacheKey });
                const exists = await redis.exists(cacheKey);
                return { ...r, isCached: exists === 1 };
            } catch {
                return { ...r, isCached: false };
            }
        }));
    }

    private extractIdFromUrl(url: string): string | null {
        const match = url.match(/comments\/([a-z0-9]+)/);
        return match ? match[1] : null;
    }
}
