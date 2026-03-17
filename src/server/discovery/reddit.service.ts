import fetch from 'node-fetch';
import { redis } from '../middleware/rateLimiter.js';
import { DiscoveryResult, IDiscoveryService } from './types.js';
import { getGlobalConfig } from '../firestore.js';
import { logger } from '../utils/logger.js';

export class RedditDiscoveryService implements IDiscoveryService {
    private lastRequestTime = 0;

    private async waitIfNecessary() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        // Jitter: random interval between 1s and 3s
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
            await this.waitIfNecessary();
            try {
                const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&t=year&limit=25`;
                logger.info({ platform: 'reddit', action: 'API_FETCH', url: searchUrl, searchTerm: query });
                const res = await fetch(searchUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Accept': 'application/json',
                        'Referer': 'https://www.reddit.com/'
                    }
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

    async ideaDiscovery(idea: string, queries: string[], skipCache = false, intent?: { persona: string; pain: string; domain: string }): Promise<{ results: DiscoveryResult[]; scannedCount: number; isFromCache: boolean }> {
        const cleanIdea = idea.trim();
        const cacheKey = `discovery_results:reddit:idea:${Buffer.from(cleanIdea).toString('base64').slice(0, 32)}:v3`;

        const cleanIntent = intent ? {
            persona: (intent.persona || '').trim(),
            pain: (intent.pain || '').trim(),
            domain: (intent.domain || '').trim()
        } : undefined;

        const allResultsMap = new Map<string, DiscoveryResult>();
        let scannedCount = 0;

        const noiseFilter = "-subreddit:BestofRedditorUpdates -subreddit:nosleep -subreddit:AITAH -subreddit:relationship_advice -subreddit:AmItheAsshole -subreddit:horrorstories -subreddit:Novelnews -subreddit:AskMenAdvice -subreddit:BORUpdates -subreddit:AnotherEdenGlobal -subreddit:FemFragLab -subreddit:BTSnark -subreddit:dropshipping -subreddit:ecommerce -subreddit:deals -subreddit:coupons";

        for (const rawQuery of queries) {
            const query = `${rawQuery} ${noiseFilter} -"I built" -"launched"`;
            await this.waitIfNecessary();
            try {
                // Use old.reddit.com for better JSON stability and less blocking
                const searchUrl = `https://old.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&t=all&limit=30`;
                logger.info({ platform: 'reddit', action: 'API_FETCH_IDEA', url: searchUrl, searchTerm: query });

                const res = await fetch(searchUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Accept': 'application/json',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': 'https://old.reddit.com/',
                        'DNT': '1'
                    },
                    timeout: 10000
                });

                const bodyText = await res.text();
                logger.debug({ platform: 'reddit', status: res.status, bodySample: bodyText.slice(0, 200) }, "Reddit API Response received");

                if (!res.ok) {
                    logger.warn({ platform: 'reddit', action: 'API_FETCH_ERROR', status: res.status, query, body: bodyText.slice(0, 100) }, `Reddit search failed`);
                    continue;
                }

                const data: any = JSON.parse(bodyText);
                const children = data.data?.children || [];
                scannedCount += children.length;
                logger.info({ platform: 'reddit', action: 'API_RESULT_COUNT', count: children.length, query, totalScanned: scannedCount });

                for (const child of children) {
                    const post = child.data;
                    const { score, markers } = this.calculateIdeaRelevanceScore(post, cleanIdea, cleanIntent, true);

                    if (score > 4000) { // Higher bar for quality
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

                        if (!allResultsMap.get(post.id)?.score || allResultsMap.get(post.id)!.score < score) {
                            allResultsMap.set(post.id, result);
                        }
                    }
                }
            } catch (err) {
                logger.error({ err, platform: 'reddit', query }, `Query failed`);
            }
        }

        // Broader Fallback if no high-signal results found
        if (allResultsMap.size < 3 && queries.length > 0) {
            const words = cleanIdea.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const broadQuery = words.slice(0, 3).join(' ');

            if (broadQuery) {
                logger.info({ platform: 'reddit', action: 'BROADER_SEARCH_FALLBACK', broadQuery }, "Attempting broad fallback search...");
                await this.waitIfNecessary();
                try {
                    const searchUrl = `https://old.reddit.com/search.json?q=${encodeURIComponent(broadQuery)}&sort=relevance&t=all&limit=50`;
                    const res = await fetch(searchUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                            'Accept': 'application/json',
                            'Referer': 'https://old.reddit.com/'
                        },
                        timeout: 10000
                    });
                    if (res.ok) {
                        const data: any = await res.json();
                        const children = data.data?.children || [];
                        scannedCount += children.length;
                        logger.info({ platform: 'reddit', action: 'API_RESULT_COUNT_FALLBACK', count: children.length, query: broadQuery });
                        for (const child of children) {
                            const post = child.data;
                            const { score, markers } = this.calculateIdeaRelevanceScore(post, cleanIdea, cleanIntent, true);
                            if (score > 1000) {
                                allResultsMap.set(post.id, {
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
                    }
                } catch (err) {
                    logger.error({ err, platform: 'reddit' }, "Fallback failed");
                }
            }
        }

        const finalResults = Array.from(allResultsMap.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 50);

        const enriched = await this.checkMetadataCacheStatus(finalResults);
        return { results: enriched, isFromCache: false, scannedCount };
    }

    private calculateIdeaRelevanceScore(post: any, idea: string, intent?: { persona: string; pain: string; domain: string }, isIdeaDiscovery = false): { score: number; markers: string[] } {
        const title = (post.title || '').toLowerCase();
        const text = (post.selftext || '').toLowerCase();
        const combined = title + " " + text;
        const subredditLower = (post.subreddit || '').toLowerCase();

        const STOP_WORDS = new Set(['want', 'make', 'that', 'like', 'feels', 'this', 'with', 'from', 'your', 'about', 'some', 'thing', 'user', 'people', 'would', 'could', 'should', 'will', 'just', 'best', 'good', 'apps', 'tool']);

        let score = 0;
        const detail: string[] = [];

        // 1. Dual-Signal extraction from Idea
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
        // If "budget" and "chat" are close, it is a massive signal
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

        // 3. Anti-Vague Filter (The "ChatGPT Playbook" Penalty)
        // If it matches 'chat' and 'app' but 'budget' only appears once in a long text, it's a listicle.
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

        // Subreddit Quality filters
        const qualitySubs = ['saas', 'productivity', 'startups', 'sysadmin', 'entrepreneur', 'technology', 'programming', 'softwareengineering', 'smallbusiness', 'webdev'];
        if (qualitySubs.includes(subredditLower)) {
            score += 1000;
            detail.push('SUB_QUALITY');
        }

        // Intent Mapping
        const intentKeywords = {
            frustration: ['annoying', 'frustrating', 'sucks', 'hate', 'broken', 'slow', 'expensive', 'problems'],
            seeking: ['recommendation', 'anyone', 'advice', 'help', 'looking for', 'alternatives']
        };

        intentKeywords.frustration.forEach(k => {
            if (new RegExp(`\\b${k}\\b`, 'i').test(combined)) { score += 500; detail.push('INTENT:PAIN'); }
        });

        // Engagement
        if (post.num_comments > 50) { score += 1000; detail.push('HIGH_ENGAGEMENT'); }

        return { score, markers: detail };
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
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'application/json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.reddit.com/',
                    'DNT': '1'
                }
            });

            if (!response.ok) {
                const body = await response.text().catch(() => "Could not read body");
                logger.error({
                    platform: 'reddit',
                    action: 'API_FETCH_ERROR',
                    status: response.status,
                    statusText: response.statusText,
                    url: jsonUrl,
                    body: body.slice(0, 500)
                }, `Reddit API returned non-OK status: ${response.status}`);
                return null;
            }

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
