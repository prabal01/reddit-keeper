import { parseRedditUrl } from '../../../reddit/parser.js';
import { fetchThread } from '../../../reddit/client.js';
import { redis } from '../../middleware/rateLimiter.js';
import { logger } from '../../utils/logger.js';
import type { Comment } from '../../../reddit/types.js';

const CACHE_TTL = 86400; // 24h
const FREE_COMMENT_LIMIT = 3;

interface ThreadExplorerResult {
    post: {
        title: string;
        author: string;
        subreddit: string;
        score: number;
        num_comments: number;
        selftext: string;
        created_utc: number;
        url: string;
    };
    stats: {
        totalComments: number;
        avgCommentScore: number;
        topCommenter: string;
        uniqueCommenters: number;
    };
    topComments: { author: string; body: string; score: number; depth: number }[];
    commentDepthDistribution: { depth: number; count: number }[];
    locked: boolean;
    freeCount: number;
    totalFound: number;
}

function flattenComments(comments: Comment[], depth: number = 0): { author: string; body: string; score: number; depth: number }[] {
    const flat: { author: string; body: string; score: number; depth: number }[] = [];
    for (const c of comments) {
        flat.push({
            author: c.author || 'unknown',
            body: c.body || '',
            score: c.score || 0,
            depth,
        });
        if (c.replies && c.replies.length > 0) {
            flat.push(...flattenComments(c.replies, depth + 1));
        }
    }
    return flat;
}

export async function getThreadExplorer(
    url: string,
    isAuthenticated: boolean
): Promise<ThreadExplorerResult> {
    // Parse the URL to get a post ID for cache key
    const urlInfo = parseRedditUrl(url);
    const cacheKey = `tools:thread:${urlInfo.postId}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached) as ThreadExplorerResult;
            if (!isAuthenticated && parsed.topComments.length > FREE_COMMENT_LIMIT) {
                return {
                    ...parsed,
                    topComments: parsed.topComments.slice(0, FREE_COMMENT_LIMIT),
                    locked: true,
                    freeCount: FREE_COMMENT_LIMIT,
                };
            }
            return { ...parsed, locked: false, freeCount: parsed.topComments.length };
        }
    } catch (err) {
        logger.warn({ err }, 'Thread-explorer cache read failed');
    }

    // Fetch the full thread
    const thread = await fetchThread(urlInfo);

    // Flatten all comments for analysis
    const allComments = flattenComments(thread.comments);

    // Stats
    const authorCounts: Record<string, number> = {};
    let totalScore = 0;
    const depthCounts: Record<number, number> = {};

    for (const c of allComments) {
        if (c.author !== '[deleted]' && c.author !== 'AutoModerator') {
            authorCounts[c.author] = (authorCounts[c.author] || 0) + 1;
        }
        totalScore += c.score;
        depthCounts[c.depth] = (depthCounts[c.depth] || 0) + 1;
    }

    const topCommenter = Object.entries(authorCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown';

    // Top comments sorted by score
    const topComments = allComments
        .sort((a, b) => b.score - a.score)
        .slice(0, 15)
        .map(c => ({
            author: c.author,
            body: c.body.length > 500 ? c.body.slice(0, 500) + '...' : c.body,
            score: c.score,
            depth: c.depth,
        }));

    // Depth distribution
    const commentDepthDistribution = Object.entries(depthCounts)
        .sort(([a], [b]) => Number(a) - Number(b))
        .slice(0, 10)
        .map(([depth, count]) => ({ depth: Number(depth), count }));

    const fullResult: ThreadExplorerResult = {
        post: {
            title: thread.post.title,
            author: thread.post.author || 'unknown',
            subreddit: thread.post.subreddit,
            score: thread.post.score || 0,
            num_comments: thread.post.numComments || 0,
            selftext: (thread.post.selftext || '').length > 1000
                ? (thread.post.selftext || '').slice(0, 1000) + '...'
                : (thread.post.selftext || ''),
            created_utc: thread.post.createdUtc || 0,
            url: thread.post.url || url,
        },
        stats: {
            totalComments: allComments.length,
            avgCommentScore: allComments.length > 0 ? Math.round(totalScore / allComments.length) : 0,
            topCommenter,
            uniqueCommenters: Object.keys(authorCounts).length,
        },
        topComments,
        commentDepthDistribution,
        locked: false,
        freeCount: topComments.length,
        totalFound: topComments.length,
    };

    // Cache full result
    try {
        await redis.set(cacheKey, JSON.stringify(fullResult), 'EX', CACHE_TTL);
    } catch (err) {
        logger.warn({ err }, 'Thread-explorer cache write failed');
    }

    // Apply gating for anonymous users
    if (!isAuthenticated && fullResult.topComments.length > FREE_COMMENT_LIMIT) {
        return {
            ...fullResult,
            topComments: fullResult.topComments.slice(0, FREE_COMMENT_LIMIT),
            locked: true,
            freeCount: FREE_COMMENT_LIMIT,
        };
    }

    return fullResult;
}
