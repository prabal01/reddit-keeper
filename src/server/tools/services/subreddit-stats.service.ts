import { ArcticShiftService } from '../../discovery/arctic-shift.service.js';
import { redis } from '../../middleware/rateLimiter.js';
import { logger } from '../../utils/logger.js';

const arcticShift = new ArcticShiftService();

const CACHE_TTL = 86400; // 24h

interface SubredditStatsResult {
    subreddit: string;
    sampleSize: number;
    avgScore: number;
    avgComments: number;
    postsPerDay: number;
    topAuthors: { author: string; count: number }[];
    scoreDistribution: { range: string; count: number }[];
}

export async function getSubredditStats(subreddit: string): Promise<SubredditStatsResult> {
    const cacheKey = `tools:sub-stats:${subreddit.toLowerCase()}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
    } catch (err) {
        logger.warn({ err }, 'Sub-stats cache read failed');
    }

    const posts = await arcticShift.searchPosts('', subreddit, 100);

    if (posts.length === 0) {
        throw new Error('NO_DATA');
    }

    // Compute stats
    let totalScore = 0;
    let totalComments = 0;
    const authorCounts: Record<string, number> = {};
    const scoreBuckets = { '0-10': 0, '11-50': 0, '51-100': 0, '101-500': 0, '500+': 0 };

    for (const post of posts) {
        const score = Math.round((post.score || 0) / 10); // Undo the 10x scaling from arctic-shift service
        totalScore += score;
        totalComments += post.num_comments || 0;

        const author = post.author || 'unknown';
        if (author !== '[deleted]' && author !== 'AutoModerator') {
            authorCounts[author] = (authorCounts[author] || 0) + 1;
        }

        if (score <= 10) scoreBuckets['0-10']++;
        else if (score <= 50) scoreBuckets['11-50']++;
        else if (score <= 100) scoreBuckets['51-100']++;
        else if (score <= 500) scoreBuckets['101-500']++;
        else scoreBuckets['500+']++;
    }

    // Posts per day estimate
    const timestamps = posts.map(p => p.created_utc).filter(Boolean).sort((a, b) => a - b);
    let postsPerDay = 0;
    if (timestamps.length >= 2) {
        const spanDays = (timestamps[timestamps.length - 1] - timestamps[0]) / 86400;
        postsPerDay = spanDays > 0 ? Math.round((posts.length / spanDays) * 10) / 10 : posts.length;
    }

    const topAuthors = Object.entries(authorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([author, count]) => ({ author, count }));

    const scoreDistribution = Object.entries(scoreBuckets)
        .map(([range, count]) => ({ range, count }));

    const result: SubredditStatsResult = {
        subreddit,
        sampleSize: posts.length,
        avgScore: Math.round(totalScore / posts.length),
        avgComments: Math.round(totalComments / posts.length),
        postsPerDay,
        topAuthors,
        scoreDistribution,
    };

    try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
    } catch (err) {
        logger.warn({ err }, 'Sub-stats cache write failed');
    }

    return result;
}
