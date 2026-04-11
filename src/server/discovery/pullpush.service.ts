import fetch from 'node-fetch';
import { DiscoveryResult } from './types.js';
import { logger } from '../utils/logger.js';
import { USER_AGENT } from '../config.js';
import { errMsg } from '../utils/errors.js';

export class PullPushService {
    private baseUrl = process.env.PULLPUSH_BASE_URL || 'https://api.pullpush.io';
    private lastRequestTime = 0;

    /**
     * Enforce minimal delay between requests to be respectful
     */
    private async enforceDelay(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minDelay = 500; // 500ms between requests

        if (timeSinceLastRequest < minDelay) {
            const waitTime = minDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequestTime = Date.now();
    }

    /**
     * Search submissions (posts) across Reddit
     * Key advantage: supports Reddit-wide search without specifying a subreddit
     */
    async searchSubmissions(
        keyword: string,
        subreddit?: string,
        limit: number = 100,
        after?: number,
        author?: string
    ): Promise<DiscoveryResult[]> {
        try {
            await this.enforceDelay();

            let url = `${this.baseUrl}/reddit/search/submission/?q=${encodeURIComponent(keyword)}&size=${limit}`;
            if (subreddit) url += `&subreddit=${encodeURIComponent(subreddit)}`;
            if (after) url += `&after=${after}`;
            if (author) url += `&author=${encodeURIComponent(author)}`;

            logger.info({ service: 'pullpush', action: 'SEARCH_SUBMISSIONS', keyword, subreddit }, `Searching submissions...`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                logger.warn({ service: 'pullpush', status: response.status }, `PullPush submission search failed`);
                return [];
            }

            const data: any = await response.json();
            const submissions = Array.isArray(data) ? data : data.data || [];

            const results: DiscoveryResult[] = submissions.map((sub: any) => ({
                id: sub.id || sub.submission_id,
                title: sub.title,
                url: `https://reddit.com${sub.permalink}`,
                subreddit: sub.subreddit,
                author: sub.author,
                source: 'pullpush' as const,
                num_comments: sub.num_comments || 0,
                created_utc: sub.created_utc || Math.floor(Date.now() / 1000),
                score: (sub.score || 0) * 10,
                selftext: sub.selftext || '',
            }));

            logger.info({ service: 'pullpush', action: 'SEARCH_SUBMISSIONS_RESULT', count: results.length }, `Found ${results.length} submissions`);
            return results;
        } catch (err: unknown) {
            logger.error({ service: 'pullpush', action: 'SEARCH_SUBMISSIONS_ERROR', err: errMsg(err) }, `PullPush search error`);
            return [];
        }
    }

    /**
     * Search comments
     */
    async searchComments(
        keyword: string,
        subreddit?: string,
        limit: number = 100,
        author?: string
    ): Promise<DiscoveryResult[]> {
        try {
            await this.enforceDelay();

            let url = `${this.baseUrl}/reddit/search/comment/?q=${encodeURIComponent(keyword)}&size=${limit}`;
            if (subreddit) url += `&subreddit=${encodeURIComponent(subreddit)}`;
            if (author) url += `&author=${encodeURIComponent(author)}`;

            logger.info({ service: 'pullpush', action: 'SEARCH_COMMENTS', keyword }, `Searching comments...`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                logger.warn({ service: 'pullpush', status: response.status }, `PullPush comment search failed`);
                return [];
            }

            const data: any = await response.json();
            const comments = Array.isArray(data) ? data : data.data || [];

            const results: DiscoveryResult[] = comments.map((comment: any) => ({
                id: comment.id || comment.comment_id,
                title: comment.body?.substring(0, 100) || 'Comment',
                url: `https://reddit.com${comment.permalink}`,
                subreddit: comment.subreddit,
                author: comment.author,
                source: 'pullpush' as const,
                num_comments: 0,
                created_utc: comment.created_utc || Math.floor(Date.now() / 1000),
                score: (comment.score || 0) * 10
            }));

            logger.info({ service: 'pullpush', action: 'SEARCH_COMMENTS_RESULT', count: results.length }, `Found ${results.length} comments`);
            return results;
        } catch (err: unknown) {
            logger.error({ service: 'pullpush', action: 'SEARCH_COMMENTS_ERROR', err: errMsg(err) }, `PullPush comment search error`);
            return [];
        }
    }

    /**
     * Fetch post metadata (author, num_comments) for a batch of Reddit post IDs.
     * Uses the ?ids= param — works from any IP including Cloud Run datacenter ranges.
     * IDs should be the short Reddit base36 IDs (no t3_ prefix), e.g. ["abc123", "def456"]
     */
    async getSubmissionsByIds(ids: string[]): Promise<{ id: string; author: string; num_comments: number }[]> {
        if (ids.length === 0) return [];
        try {
            await this.enforceDelay();
            const url = `${this.baseUrl}/reddit/search/submission/?ids=${ids.join(',')}`;
            logger.info({ service: 'pullpush', action: 'GET_BY_IDS', count: ids.length }, `Fetching ${ids.length} submissions by ID`);

            const response = await fetch(url, {
                headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }
            });

            if (!response.ok) {
                logger.warn({ service: 'pullpush', status: response.status }, `PullPush get-by-ids failed`);
                return [];
            }

            const data: any = await response.json();
            const submissions = Array.isArray(data) ? data : (data.data || []);

            return submissions.map((sub: any) => ({
                id: sub.id || sub.submission_id || '',
                author: sub.author || 'unknown',
                num_comments: sub.num_comments || 0
            }));
        } catch (err: unknown) {
            logger.error({ service: 'pullpush', action: 'GET_BY_IDS_ERROR', err: errMsg(err) }, `PullPush get-by-ids error`);
            return [];
        }
    }
}
