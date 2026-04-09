import fetch from 'node-fetch';
import { redis } from '../middleware/rateLimiter.js';
import { DiscoveryResult, IDiscoveryService } from './types.js';
import { getGlobalConfig } from '../firestore.js';
import { logger } from '../utils/logger.js';
import { USER_AGENT } from '../config.js';
import { errMsg } from '../utils/errors.js';
import { ArcticShiftService } from './arctic-shift.service.js';
import { PullPushService } from './pullpush.service.js';

export class RedditDiscoveryService implements IDiscoveryService {
    private lastRequestTime = 0;
    // PullPush: Reddit-wide search (for discovery with no subreddit context)
    // Arctic Shift: Subreddit-specific search (for monitoring workflows with known subreddits)
    private arcticShiftService = new ArcticShiftService();
    private pullPushService = new PullPushService();

    /**
     * Helper to fetch data via residential proxy, local fetcher, or direct fetch.
     * Priority: Proxy > Local Fetcher > Direct Fetch
     */
    private async fetchJson(url: string): Promise<any> {
        // PRIORITY 1: Residential Proxy (if configured)
        const proxyHost = process.env.PROXY_HOST;
        const proxyPort = process.env.PROXY_PORT;
        const proxyUser = process.env.PROXY_USER;
        const proxyPass = process.env.PROXY_PASS;

        if (proxyHost && proxyPort && proxyUser && proxyPass) {
            logger.info({ platform: 'reddit', action: 'FETCH_VIA_PROXY', host: proxyHost }, `Fetching via residential proxy...`);
            return this.fetchViaProxy(url, proxyHost, proxyPort, proxyUser, proxyPass);
        }

        // PRIORITY 2: Local fetcher service (home IP)
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

        // PRIORITY 3: Direct fetch (will fail on datacenter IPs)
        logger.warn({ platform: 'reddit', action: 'FETCH_DIRECT', url }, `No proxy or fetcher configured. Attempting direct fetch (may fail on datacenter IPs).`);
        await this.waitIfNecessary();
        const res = await fetch(url.includes('.json') ? url : `${url.split('?')[0].replace(/\/$/, '')}.json`, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'application/json',
                'Referer': 'https://www.reddit.com/'
            }
        });

        if (!res.ok) throw new Error(`HTTP_${res.status}: ${res.statusText}`);
        return await res.json();
    }

    /**
     * Fetch via residential SOCKS5 proxy
     */
    private async fetchViaProxy(
        url: string,
        host: string,
        port: string,
        user: string,
        pass: string
    ): Promise<any> {
        try {
            const { SocksProxyAgent } = await import('socks-proxy-agent');
            const socksUrl = `socks5://${user}:${pass}@${host}:${port}`;
            const agent = new SocksProxyAgent(socksUrl);

            await this.waitIfNecessary();
            const finalUrl = url.includes('.json') ? url : `${url.split('?')[0].replace(/\/$/, '')}.json`;

            const res = await fetch(finalUrl, {
                agent,
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'application/json',
                    'Referer': 'https://www.reddit.com/'
                }
            });

            if (!res.ok) throw new Error(`HTTP_${res.status}: ${res.statusText}`);
            return await res.json();
        } catch (err: unknown) {
            logger.error({ platform: 'reddit', action: 'PROXY_FETCH_ERROR', err: errMsg(err) }, `Proxy fetch failed`);
            throw err;
        }
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
        let allResultsMap = new Map<string, DiscoveryResult>();
        let scannedCount = 0;

        // For discovery (Reddit-wide search with no subreddit context), use PullPush
        // Arctic Shift requires a subreddit, so it's used only for monitoring workflows
        logger.info({ platform: 'reddit', action: 'LAYER1_PULLPUSH_START', keyword: cleanCompetitor }, `Layer 1: Searching via PullPush (Reddit-wide)...`);
        const pullPushResults = await this.pullPushService.searchSubmissions(cleanCompetitor, undefined, 100);

        if (pullPushResults.length > 0) {
            logger.info({ platform: 'reddit', action: 'LAYER1_PULLPUSH_SUCCESS', count: pullPushResults.length }, `PullPush returned ${pullPushResults.length} results`);
            for (const result of pullPushResults) {
                if (!allResultsMap.has(result.id) || allResultsMap.get(result.id)!.score < result.score) {
                    allResultsMap.set(result.id, result);
                }
            }
            scannedCount += pullPushResults.length;
        } else {
            // PullPush returned 0 results — return empty.
            // For MVP discovery, we rely on PullPush (Reddit-wide search).
            // Arctic Shift is reserved for monitoring workflows with specific subreddits.
            logger.info({ platform: 'reddit', action: 'NO_RESULTS_FOUND', keyword: cleanCompetitor }, `PullPush returned 0 results for "${cleanCompetitor}"`);
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

    /**
     * Fetch the most recent posts from a specific subreddit.
     * Efficient single-request fetch for monitoring.
     */
    async fetchSubredditNew(subreddit: string, limit: number = 100): Promise<any[]> {
        const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`;
        try {
            const data = await this.fetchJson(url);
            if (!data?.data?.children) return [];

            return data.data.children.map((child: any) => ({
                id: child.data.name, // t3_...
                title: child.data.title,
                selftext: child.data.selftext,
                subreddit: child.data.subreddit,
                author: child.data.author,
                url: `https://www.reddit.com${child.data.permalink}`,
                num_comments: child.data.num_comments,
                created_utc: child.data.created_utc
            }));
        } catch (err: unknown) {
            logger.error({ action: 'REDDIT_SUBREDDIT_FETCH_ERROR', subreddit, err: errMsg(err) }, `Failed to fetch r/${subreddit}`);
            throw err;
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
