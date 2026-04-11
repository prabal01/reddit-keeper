import fetch from 'node-fetch';
import { DiscoveryResult } from './types.js';
import { logger } from '../utils/logger.js';
import { USER_AGENT } from '../config.js';
import { errMsg } from '../utils/errors.js';

export class ArcticShiftService {
    private baseUrl = process.env.ARCTIC_SHIFT_BASE_URL || 'https://arctic-shift.photon-reddit.com';
    private rateLimit = parseInt(process.env.ARCTIC_SHIFT_RATE_LIMIT || '30', 10); // req/min
    private lastRequestTime = 0;
    private requestCount = 0;
    private windowStart = Date.now();

    /**
     * Enforce soft rate limit (requests per minute)
     */
    private async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const windowElapsed = now - this.windowStart;

        // Reset window every minute
        if (windowElapsed > 60000) {
            this.windowStart = now;
            this.requestCount = 0;
        }

        // If we've hit the limit for this window, wait
        if (this.requestCount >= this.rateLimit) {
            const waitTime = 60000 - windowElapsed + 100;
            logger.info({ service: 'arctic_shift', waitMs: waitTime }, `Rate limit reached. Waiting...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.windowStart = Date.now();
            this.requestCount = 0;
        }

        this.requestCount++;
        const now2 = Date.now();
        const timeSinceLastRequest = now2 - this.lastRequestTime;
        const jitterDelay = Math.floor(Math.random() * 500) + 100; // 100-600ms jitter
        if (timeSinceLastRequest < jitterDelay) {
            await new Promise(resolve => setTimeout(resolve, jitterDelay - timeSinceLastRequest));
        }
        this.lastRequestTime = Date.now();
    }

    /**
     * Search posts within a subreddit, optionally filtering by title keyword.
     * Arctic Shift requires subreddit or author scope — keyword-only search is not supported.
     * When keyword is provided it filters by title match; when empty it returns recent posts.
     */
    async searchPosts(
        keyword: string,
        subreddit: string,
        limit: number = 100,
        after?: number,
        before?: number,
        sort: 'asc' | 'desc' = 'desc'
    ): Promise<DiscoveryResult[]> {
        if (!subreddit) {
            logger.warn({ service: 'arctic_shift', action: 'SEARCH_POSTS_SKIP' }, `Arctic Shift requires a subreddit for post search`);
            return [];
        }
        try {
            await this.enforceRateLimit();

            let url = `${this.baseUrl}/api/posts/search?subreddit=${encodeURIComponent(subreddit)}&limit=${limit}&sort=${sort}&meta-app=opiniondeck`;
            if (keyword) url += `&title=${encodeURIComponent(keyword)}`;
            if (after) url += `&after=${after}`;
            if (before) url += `&before=${before}`;

            logger.info({ service: 'arctic_shift', action: 'SEARCH_POSTS', keyword: keyword || '(browse)', subreddit }, `Searching posts...`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                logger.warn({ service: 'arctic_shift', status: response.status }, `Arctic Shift search failed`);
                return [];
            }

            const data: any = await response.json();
            const posts = data.data || [];

            const results: DiscoveryResult[] = posts.map((post: any) => ({
                id: post.id || post.post_id,
                title: post.title,
                url: `https://reddit.com${post.permalink}`,
                subreddit: post.subreddit,
                author: post.author,
                source: 'arctic_shift' as const,
                num_comments: post.num_comments || 0,
                created_utc: post.created_utc || Math.floor(Date.now() / 1000),
                score: (post.score || 0) * 10, // Scale score for consistency with other sources
                selftext: post.selftext || '',
            }));

            logger.info({ service: 'arctic_shift', action: 'SEARCH_POSTS_RESULT', count: results.length }, `Found ${results.length} posts`);
            return results;
        } catch (err: unknown) {
            logger.error({ service: 'arctic_shift', action: 'SEARCH_POSTS_ERROR', err: errMsg(err) }, `Arctic Shift error`);
            return [];
        }
    }

    /**
     * Search comments within a subreddit, optionally filtering by body keyword.
     * Arctic Shift requires subreddit or author scope — keyword-only search is not supported.
     */
    async searchComments(
        keyword: string,
        subreddit: string,
        limit: number = 100
    ): Promise<DiscoveryResult[]> {
        if (!subreddit) {
            logger.warn({ service: 'arctic_shift', action: 'SEARCH_COMMENTS_SKIP' }, `Arctic Shift requires a subreddit for comment search`);
            return [];
        }
        try {
            await this.enforceRateLimit();

            let url = `${this.baseUrl}/api/comments/search?subreddit=${encodeURIComponent(subreddit)}&limit=${limit}&sort=desc&meta-app=opiniondeck`;
            if (keyword) url += `&body=${encodeURIComponent(keyword)}`;

            logger.info({ service: 'arctic_shift', action: 'SEARCH_COMMENTS', keyword: keyword || '(browse)', subreddit }, `Searching comments...`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                logger.warn({ service: 'arctic_shift', status: response.status }, `Arctic Shift comment search failed`);
                return [];
            }

            const data: any = await response.json();
            const comments = data.data || [];

            const results: DiscoveryResult[] = comments.map((comment: any) => ({
                id: comment.id || comment.comment_id,
                title: comment.body?.substring(0, 100) || 'Comment',
                url: `https://reddit.com${comment.permalink}`,
                subreddit: comment.subreddit,
                author: comment.author,
                source: 'arctic_shift' as const,
                num_comments: 0,
                created_utc: comment.created_utc || Math.floor(Date.now() / 1000),
                score: (comment.score || 0) * 10
            }));

            logger.info({ service: 'arctic_shift', action: 'SEARCH_COMMENTS_RESULT', count: results.length }, `Found ${results.length} comments`);
            return results;
        } catch (err: unknown) {
            logger.error({ service: 'arctic_shift', action: 'SEARCH_COMMENTS_ERROR', err: errMsg(err) }, `Arctic Shift comment search error`);
            return [];
        }
    }

    /**
     * Fetch post metadata (author, num_comments) for a batch of Reddit post IDs.
     * Uses the ?ids= param with t3_ fullname prefix — works from any IP.
     * IDs should be the short base36 IDs (no t3_ prefix), e.g. ["abc123", "def456"]
     * Returns [] gracefully if Arctic Shift doesn't support this endpoint.
     */
    async getPostsByIds(ids: string[]): Promise<{ id: string; author: string; num_comments: number }[]> {
        if (ids.length === 0) return [];
        try {
            await this.enforceRateLimit();
            const fullnames = ids.map(id => `t3_${id}`).join(',');
            const url = `${this.baseUrl}/api/posts/search?ids=${fullnames}&limit=${ids.length}`;
            logger.info({ service: 'arctic_shift', action: 'GET_BY_IDS', count: ids.length }, `Fetching ${ids.length} posts by ID`);

            const response = await fetch(url, {
                headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }
            });

            if (!response.ok) {
                logger.warn({ service: 'arctic_shift', status: response.status }, `Arctic Shift get-by-ids failed`);
                return [];
            }

            const data: any = await response.json();
            const posts = data.data || [];

            return posts.map((post: any) => ({
                id: (post.id || post.post_id || '').replace(/^t3_/, ''),
                author: post.author || 'unknown',
                num_comments: post.num_comments || 0
            }));
        } catch (err: unknown) {
            logger.error({ service: 'arctic_shift', action: 'GET_BY_IDS_ERROR', err: errMsg(err) }, `Arctic Shift get-by-ids error`);
            return [];
        }
    }
}
