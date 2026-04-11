import { ArcticShiftService } from '../../discovery/arctic-shift.service.js';
import { redis } from '../../middleware/rateLimiter.js';
import { logger } from '../../utils/logger.js';

const arcticShift = new ArcticShiftService();

const CACHE_TTL = 86400; // 24h
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface HeatmapCell {
    avgScore: number;
    postCount: number;
}

interface BestTimeResult {
    subreddit: string;
    sampleSize: number;
    heatmap: Record<number, Record<number, HeatmapCell>>;
    bestTimes: { day: string; hour: number; avgScore: number }[];
}

export async function getBestTimeToPost(subreddit: string): Promise<BestTimeResult> {
    const cacheKey = `tools:best-time:${subreddit.toLowerCase()}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
    } catch (err) {
        logger.warn({ err }, 'Best-time cache read failed');
    }

    const posts = await arcticShift.searchPosts('', subreddit, 100);

    if (posts.length === 0) {
        throw new Error(`NO_DATA`);
    }

    // Bucket posts by day-of-week (0-6) and hour (0-23)
    const buckets: Record<number, Record<number, { totalScore: number; count: number }>> = {};
    for (let d = 0; d < 7; d++) {
        buckets[d] = {};
        for (let h = 0; h < 24; h++) {
            buckets[d][h] = { totalScore: 0, count: 0 };
        }
    }

    for (const post of posts) {
        const date = new Date(post.created_utc * 1000);
        const day = date.getUTCDay();
        const hour = date.getUTCHours();
        buckets[day][hour].totalScore += (post.score || 0);
        buckets[day][hour].count += 1;
    }

    // Build heatmap
    const heatmap: Record<number, Record<number, HeatmapCell>> = {};
    const allCells: { day: number; hour: number; avgScore: number }[] = [];

    for (let d = 0; d < 7; d++) {
        heatmap[d] = {};
        for (let h = 0; h < 24; h++) {
            const bucket = buckets[d][h];
            const avg = bucket.count > 0 ? Math.round(bucket.totalScore / bucket.count) : 0;
            heatmap[d][h] = { avgScore: avg, postCount: bucket.count };
            if (bucket.count > 0) {
                allCells.push({ day: d, hour: h, avgScore: avg });
            }
        }
    }

    // Top 5 best times
    const bestTimes = allCells
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 5)
        .map(c => ({ day: DAY_NAMES[c.day], hour: c.hour, avgScore: c.avgScore }));

    const result: BestTimeResult = {
        subreddit,
        sampleSize: posts.length,
        heatmap,
        bestTimes,
    };

    try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
    } catch (err) {
        logger.warn({ err }, 'Best-time cache write failed');
    }

    return result;
}
