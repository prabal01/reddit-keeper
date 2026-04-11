import { ArcticShiftService } from '../../discovery/arctic-shift.service.js';
import { redis } from '../../middleware/rateLimiter.js';
import { logger } from '../../utils/logger.js';

const arcticShift = new ArcticShiftService();

const CACHE_TTL = 86400; // 24h
const BATCH_COUNT = 5;
const BATCH_LIMIT = 100;
const BATCH_WINDOW = 30 * 86400; // 30 days per batch
const FREE_AUTHOR_LIMIT = 5;

interface SubredditStatsResult {
    subreddit: string;
    sampleSize: number;
    avgScore: number;
    avgComments: number;
    postsPerDay: number;
    topAuthors: { author: string; count: number }[];
    scoreDistribution: { range: string; count: number }[];
    locked?: boolean;
    freeCount?: number;
    totalFound?: number;
}

export async function getSubredditStats(subreddit: string, isAuthenticated: boolean = false): Promise<SubredditStatsResult> {
    const cacheKey = `tools:sub-stats:${subreddit.toLowerCase()}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached) as SubredditStatsResult;
            if (!isAuthenticated && parsed.topAuthors.length > FREE_AUTHOR_LIMIT) {
                return {
                    ...parsed,
                    topAuthors: parsed.topAuthors.slice(0, FREE_AUTHOR_LIMIT),
                    locked: true,
                    freeCount: FREE_AUTHOR_LIMIT,
                    totalFound: parsed.topAuthors.length,
                };
            }
            return parsed;
        }
    } catch (err) {
        logger.warn({ err }, 'Sub-stats cache read failed');
    }

    // Fetch ~500 posts in parallel batches using time-window pagination
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 86400);

    const batches = Array.from({ length: BATCH_COUNT }, (_, i) => {
        const before = now - (i * BATCH_WINDOW);
        const after = before - BATCH_WINDOW;
        return arcticShift.searchPosts('', subreddit, BATCH_LIMIT, after, before, 'asc');
    });

    const batchResults = await Promise.all(batches);
    const allPosts = batchResults.flat();

    // Deduplicate by post ID
    const seen = new Set<string>();
    const posts = allPosts.filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
    });

    if (posts.length === 0) {
        throw new Error('NO_DATA');
    }

    // sampleSize = total unique posts found (before quality filter)
    const sampleSize = posts.length;

    // Quality filter: only posts with real score > 1 (score > 10 due to 10x scaling)
    const qualityPosts = posts.filter(p => (p.score || 0) > 10);

    logger.info({ tool: 'subreddit-stats', subreddit, totalFetched: allPosts.length, unique: posts.length, quality: qualityPosts.length }, 'Sub-stats posts fetched');

    // Compute stats using quality-filtered posts only
    let totalScore = 0;
    let totalComments = 0;
    const authorCounts: Record<string, number> = {};
    const scoreBuckets = { '0-5': 0, '6-25': 0, '26-100': 0, '101-500': 0, '500+': 0 };

    for (const post of qualityPosts) {
        const score = Math.round((post.score || 0) / 10); // Undo 10x scaling
        totalScore += score;
        totalComments += post.num_comments || 0;

        const author = post.author || 'unknown';
        if (author !== '[deleted]' && author !== 'AutoModerator') {
            authorCounts[author] = (authorCounts[author] || 0) + 1;
        }

        if (score <= 5) scoreBuckets['0-5']++;
        else if (score <= 25) scoreBuckets['6-25']++;
        else if (score <= 100) scoreBuckets['26-100']++;
        else if (score <= 500) scoreBuckets['101-500']++;
        else scoreBuckets['500+']++;
    }

    // Posts per day: count quality posts from last 30 days and divide by 30
    const recentPosts = qualityPosts.filter(p => p.created_utc >= thirtyDaysAgo);
    const postsPerDay = recentPosts.length > 0
        ? Math.round((recentPosts.length / 30) * 10) / 10
        : 0;

    const topAuthors = Object.entries(authorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([author, count]) => ({ author, count }));

    const scoreDistribution = Object.entries(scoreBuckets)
        .map(([range, count]) => ({ range, count }));

    const denominator = qualityPosts.length || 1;
    const result: SubredditStatsResult = {
        subreddit,
        sampleSize,
        avgScore: Math.round(totalScore / denominator),
        avgComments: Math.round(totalComments / denominator),
        postsPerDay,
        topAuthors,
        scoreDistribution,
    };

    try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
    } catch (err) {
        logger.warn({ err }, 'Sub-stats cache write failed');
    }

    if (!isAuthenticated && result.topAuthors.length > FREE_AUTHOR_LIMIT) {
        return {
            ...result,
            topAuthors: result.topAuthors.slice(0, FREE_AUTHOR_LIMIT),
            locked: true,
            freeCount: FREE_AUTHOR_LIMIT,
            totalFound: result.topAuthors.length,
        };
    }

    return result;
}
