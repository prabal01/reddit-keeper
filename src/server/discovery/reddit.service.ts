import fetch from 'node-fetch';
import { redis } from '../middleware/rateLimiter.js';
import { DiscoveryResult, IDiscoveryService } from './types.js';
import { getGlobalConfig } from '../firestore.js';
import { logger } from '../utils/logger.js';

export class RedditDiscoveryService implements IDiscoveryService {
    private lastRequestTime = 0;

    /**
     * Helper to fetch data via the resilient-reddit-fetcher service or direct fetch (legacy).
     */
    private async fetchJson(url: string): Promise<any> {
        const serviceUrl = process.env.REDDIT_SERVICE_URL;
        const internalSecret = process.env.INTERNAL_FETCH_SECRET;

        if (serviceUrl) {
            const fetcherEndpoint = `${serviceUrl.replace(/\/$/, '')}/fetch`;
            const response = await fetch(fetcherEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${internalSecret}`
                },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown Error' }));
                throw new Error(`FETCHER_SERVICE_ERROR: ${response.status} - ${errorData.error || response.statusText}`);
            }

            return await response.json();
        }

        // LEGACY FALLBACK
        await this.waitIfNecessary();
        const res = await fetch(url.includes('.json') ? url : `${url.split('?')[0].replace(/\/$/, '')}.json`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://www.reddit.com/'
            }
        });

        if (!res.ok) throw new Error(`HTTP_${res.status}: ${res.statusText}`);
        return await res.json();
    }

    private async waitIfNecessary() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
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
            const safeCompetitor = cleanCompetitor.includes(' ') ? `"${cleanCompetitor}"` : cleanCompetitor;
            const antiPromo = `-"I built" -"launched"`;
            const query = `${rawQuery} ${antiPromo} ${noiseFilter}`;
            try {
                const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&t=year&limit=25`;
                logger.info({ platform: 'reddit', action: 'API_FETCH', url: searchUrl, searchTerm: query });
                
                const data = await this.fetchJson(searchUrl);
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

    async ideaDiscovery(idea: string, queries: string[], skipCache = false, intent?: { persona: string; pain: string; domain: string }): Promise<{ results: DiscoveryResult[]; scannedCount: number; isFromCache: boolean }> {
        const cleanIdea = idea.trim();
        const ALL_RESULTS_MAP = new Map<string, DiscoveryResult>();
        let scannedCount = 0;

        const noiseFilter = "-subreddit:BestofRedditorUpdates -subreddit:nosleep -subreddit:AITAH -subreddit:relationship_advice -subreddit:AmItheAsshole -subreddit:horrorstories -subreddit:Novelnews -subreddit:AskMenAdvice -subreddit:BORUpdates -subreddit:AnotherEdenGlobal -subreddit:FemFragLab -subreddit:BTSnark -subreddit:dropshipping -subreddit:ecommerce -subreddit:deals -subreddit:coupons";

        for (const rawQuery of queries) {
            const query = `${rawQuery} ${noiseFilter} -"I built" -"launched"`;
            try {
                const searchUrl = `https://old.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&t=all&limit=30`;
                logger.info({ platform: 'reddit', action: 'API_FETCH_IDEA', url: searchUrl, searchTerm: query });

                const data = await this.fetchJson(searchUrl);
                const children = data.data?.children || [];
                scannedCount += children.length;

                for (const child of children) {
                    const post = child.data;
                    const { score, markers } = this.calculateIdeaRelevanceScore(post, cleanIdea, intent, true);

                    if (score > 4000) {
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
                            intentMarkers: markers as any
                        };

                        if (!ALL_RESULTS_MAP.get(post.id)?.score || ALL_RESULTS_MAP.get(post.id)!.score < score) {
                            ALL_RESULTS_MAP.set(post.id, result);
                        }
                    }
                }
            } catch (err) {
                logger.error({ err, platform: 'reddit', query }, `Query failed`);
            }
        }

        if (ALL_RESULTS_MAP.size < 3 && queries.length > 0) {
            const words = cleanIdea.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const broadQuery = words.slice(0, 3).join(' ');

            if (broadQuery) {
                try {
                    const searchUrl = `https://old.reddit.com/search.json?q=${encodeURIComponent(broadQuery)}&sort=relevance&t=all&limit=50`;
                    const data = await this.fetchJson(searchUrl);
                    const children = data.data?.children || [];
                    scannedCount += children.length;
                    for (const child of children) {
                        const post = child.data;
                        const { score, markers } = this.calculateIdeaRelevanceScore(post, cleanIdea, intent, true);
                        if (score > 1000) {
                            ALL_RESULTS_MAP.set(post.id, {
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
                            });
                        }
                    }
                } catch (err) {
                    logger.error({ err, platform: 'reddit' }, "Fallback failed");
                }
            }
        }

        const finalResults = Array.from(ALL_RESULTS_MAP.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 50);

        const enriched = await this.checkMetadataCacheStatus(finalResults);
        return { results: enriched, isFromCache: false, scannedCount };
    }

    async fetchFullThreadRecord(url: string, commentLimit = 500): Promise<any | null> {
        try {
            const parsedUrl = new URL(url);
            let baseUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;
            const jsonWithoutTrailing = baseUrl.replace(/\/$/, "");
            const jsonUrl = `${jsonWithoutTrailing}.json?limit=${commentLimit}`;

            logger.info({ platform: 'reddit', action: 'API_FETCH', url: jsonUrl });
            const data = await this.fetchJson(jsonUrl);
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

    private calculateIdeaRelevanceScore(post: any, idea: string, intent?: { persona: string; pain: string; domain: string }, isIdeaDiscovery = false): { score: number; markers: string[] } {
        const title = (post.title || '').toLowerCase();
        const text = (post.selftext || '').toLowerCase();
        const combined = title + " " + text;
        const subredditLower = (post.subreddit || '').toLowerCase();

        const STOP_WORDS = new Set(['want', 'make', 'that', 'like', 'feels', 'this', 'with', 'from', 'your', 'about', 'some', 'thing', 'user', 'people', 'would', 'could', 'should', 'will', 'just', 'best', 'good', 'apps', 'tool']);

        let score = 0;
        const detail: string[] = [];

        const searchTerms = idea.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));

        if (combined.includes(searchTerms.join(' '))) {
            score += 5000;
            detail.push('EXACT_PHRASE');
        }

        let termMatches = 0;
        searchTerms.forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'i');
            if (regex.test(title)) {
                score += 4000;
                termMatches++;
                detail.push(`TITLE_MATCH:${term.toUpperCase()}`);
            } else if (regex.test(text)) {
                score += 1000;
                termMatches++;
                detail.push(`BODY_MATCH:${term.toUpperCase()}`);
            }
        });

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

        const domainTerms = ['budget', 'money', 'finance', 'expense', 'saving'];
        const hasStrongDomain = domainTerms.some(d => {
            const count = (combined.match(new RegExp(`\\b${d}\\b`, 'gi')) || []).length;
            return count > 2 || title.includes(d);
        });

        if (isIdeaDiscovery && !hasStrongDomain && termMatches < 3) {
            score -= 10000;
            detail.push('PENALTY:VAGUE_DOMAIN');
        }

        if (isIdeaDiscovery && score < 4000) {
            return { score: 0, markers: [] };
        }

        const qualitySubs = ['saas', 'productivity', 'startups', 'sysadmin', 'entrepreneur', 'technology', 'programming', 'softwareengineering', 'smallbusiness', 'webdev'];
        if (qualitySubs.includes(subredditLower)) {
            score += 1000;
            detail.push('SUB_QUALITY');
        }

        const intentKeywords = {
            frustration: ['annoying', 'frustrating', 'sucks', 'hate', 'broken', 'slow', 'expensive', 'problems'],
            seeking: ['recommendation', 'anyone', 'advice', 'help', 'looking for', 'alternatives']
        };

        intentKeywords.frustration.forEach(k => {
            if (combined.includes(k)) { score += 500; detail.push('INTENT:PAIN'); }
        });

        if (post.num_comments > 50) { score += 1000; detail.push('HIGH_ENGAGEMENT'); }

        return { score, markers: detail };
    }

    private calculateRelevanceScore(post: any, compLower: string): { score: number; markers: DiscoveryResult['intentMarkers'] } {
        const title = (post.title || '').toLowerCase();
        const text = (post.selftext || '').toLowerCase();
        const combined = title + " " + text;
        const subredditLower = (post.subreddit || '').toLowerCase();

        let score = 0;
        const markers: DiscoveryResult['intentMarkers'] = [];

        if (!combined.includes(compLower)) return { score: 0, markers: [] };

        const qualitySubs = ['saas', 'productivity', 'startups', 'sysadmin', 'entrepreneur', 'technology', 'programming', 'softwareengineering', 'smallbusiness', 'webdev'];
        const noiseSubs = ['sideproject', 'startups', 'startupindia', 'indiabusiness', 'passive_income', 'makemoneyonlineng', 'appgiveaway', 'thefinancetrending', 'bestofredditorupdates', 'nosleep', 'aitah', 'relationship_advice', 'amitheasshole', 'horrorstories', 'novelnews', 'askmenadvice', 'btssnark', 'anotheredenglobal'];

        if (subredditLower === compLower) score += 20000;
        else if (qualitySubs.includes(subredditLower)) score += 10000;
        else if (noiseSubs.includes(subredditLower)) score -= 30000;

        const frustrationKeywords = ['annoying', 'frustrating', 'sucks', 'hate', 'broken', 'slow', 'expensive', 'problems'];
        const alternativeKeywords = ['alternatives', 'alternative', 'switching', 'better than', 'vs'];
        const questionKeywords = ['how to', 'help', 'recommendation', 'anyone', 'advice'];

        let hasFrustration = false;
        frustrationKeywords.forEach(k => {
            if (combined.includes(k)) { score += 2000; hasFrustration = true; }
        });
        if (hasFrustration) markers.push('frustration');

        let hasAlternative = false;
        alternativeKeywords.forEach(k => {
            if (combined.includes(k)) { score += 2000; hasAlternative = true; }
        });
        if (hasAlternative) markers.push('alternative');

        let hasQuestion = false;
        questionKeywords.forEach(k => {
            if (combined.includes(k)) { score += 1000; hasQuestion = true; }
        });
        if (hasQuestion) markers.push('question');

        if (post.num_comments > 50) { score += 5000; markers.push('high_engagement'); }
        score += Math.min(post.num_comments, 100) * 10;

        const now = Math.floor(Date.now() / 1000);
        const ageInSeconds = now - (post.created_utc || now);
        const ageInDays = ageInSeconds / (60 * 60 * 24);

        let recencyMultiplier = 1.0;
        if (ageInDays <= 7) recencyMultiplier = 1.5;
        else if (ageInDays <= 30) recencyMultiplier = 1.3;
        else if (ageInDays <= 180) recencyMultiplier = 1.1;

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
