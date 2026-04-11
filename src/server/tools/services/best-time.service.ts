import { ArcticShiftService } from '../../discovery/arctic-shift.service.js';
import { redis } from '../../middleware/rateLimiter.js';
import { logger } from '../../utils/logger.js';

const arcticShift = new ArcticShiftService();

const CACHE_TTL = 86400; // 24h
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BATCH_COUNT = 10;       // 10 parallel requests
const BATCH_LIMIT = 100;      // 100 posts per request (Arctic Shift API max)
const BATCH_WINDOW = 30 * 86400; // 30 days per batch ≈ 300 days total coverage
const MIN_POSTS_FOR_RANKING = 3; // Minimum posts in a slot to count for "best times"

interface HeatmapCell {
    avgScore: number;
    postCount: number;
}

interface BestTimeResult {
    subreddit: string;
    sampleSize: number;
    heatmap: Record<number, Record<number, HeatmapCell>>;
    bestTimes: { day: string; hour: number; avgScore: number; postCount: number }[];
    todayBest?: { hour: number; avgScore: number; postCount: number } | null;
}

/** Pick the single highest-scoring slot for each day */
function bestPerDay(cells: { day: number; hour: number; avgScore: number; postCount: number }[]) {
    const byDay = new Map<number, typeof cells[0]>();
    for (const c of cells) {
        const cur = byDay.get(c.day);
        if (!cur || c.avgScore > cur.avgScore) byDay.set(c.day, c);
    }
    return Array.from(byDay.values()).sort((a, b) => b.avgScore - a.avgScore);
}

export async function getBestTimeToPost(subreddit: string, timezoneOffset?: number): Promise<BestTimeResult> {
    const cacheKey = `tools:best-time:${subreddit.toLowerCase()}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached) as BestTimeResult;
            // Recompute todayBest with current timezone offset
            if (timezoneOffset !== undefined) {
                return applyTimezone(parsed, timezoneOffset);
            }
            return parsed;
        }
    } catch (err) {
        logger.warn({ err }, 'Best-time cache read failed');
    }

    // Fetch ~1000 posts in parallel batches using time-window pagination
    // sort=asc gets oldest posts in each window — they've had time to accumulate real scores
    const now = Math.floor(Date.now() / 1000);
    const batches = Array.from({ length: BATCH_COUNT }, (_, i) => {
        const before = now - (i * BATCH_WINDOW);
        const after = before - BATCH_WINDOW;
        return arcticShift.searchPosts('', subreddit, BATCH_LIMIT, after, before, 'asc');
    });

    const batchResults = await Promise.all(batches);
    const posts = batchResults.flat();

    // Deduplicate by post ID, then filter out score ≤ 1 noise (removed/spam/just-posted)
    const seen = new Set<string>();
    const deduped: typeof posts = [];
    for (const p of posts) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        deduped.push(p);
    }
    const uniquePosts = deduped.filter(p => (p.score || 0) > 10); // >10 because of 10x scaling = real score > 1

    if (uniquePosts.length === 0) {
        throw new Error(`NO_DATA`);
    }

    logger.info({ tool: 'best-time', subreddit, totalFetched: posts.length, deduped: deduped.length, quality: uniquePosts.length }, 'Best-time posts fetched');

    // Bucket posts by UTC day-of-week (0-6) and hour (0-23)
    const buckets: Record<number, Record<number, { totalScore: number; count: number }>> = {};
    for (let d = 0; d < 7; d++) {
        buckets[d] = {};
        for (let h = 0; h < 24; h++) {
            buckets[d][h] = { totalScore: 0, count: 0 };
        }
    }

    for (const post of uniquePosts) {
        const date = new Date(post.created_utc * 1000);
        const day = date.getUTCDay();
        const hour = date.getUTCHours();
        const score = Math.round((post.score || 0) / 10); // Undo 10x scaling
        buckets[day][hour].totalScore += score;
        buckets[day][hour].count += 1;
    }

    // Build heatmap
    const heatmap: Record<number, Record<number, HeatmapCell>> = {};
    const allCells: { day: number; hour: number; avgScore: number; postCount: number }[] = [];

    for (let d = 0; d < 7; d++) {
        heatmap[d] = {};
        for (let h = 0; h < 24; h++) {
            const bucket = buckets[d][h];
            const avg = bucket.count > 0 ? Math.round(bucket.totalScore / bucket.count) : 0;
            heatmap[d][h] = { avgScore: avg, postCount: bucket.count };
            if (bucket.count > 0) {
                allCells.push({ day: d, hour: h, avgScore: avg, postCount: bucket.count });
            }
        }
    }

    // Top 5 best times — best slot per day, ranked by score
    const bestTimes = bestPerDay(allCells)
        .slice(0, 5)
        .map(c => ({ day: DAY_NAMES[c.day], hour: c.hour, avgScore: c.avgScore, postCount: c.postCount }));

    const result: BestTimeResult = {
        subreddit,
        sampleSize: deduped.length, // Total unique posts scanned (before quality filter)
        heatmap,
        bestTimes,
    };

    try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
    } catch (err) {
        logger.warn({ err }, 'Best-time cache write failed');
    }

    // Apply timezone if provided
    if (timezoneOffset !== undefined) {
        return applyTimezone(result, timezoneOffset);
    }

    return result;
}

/**
 * Shift heatmap hours by timezone offset and compute todayBest
 */
function applyTimezone(result: BestTimeResult, offsetMinutes: number): BestTimeResult {
    const offsetHours = Math.round(offsetMinutes / 60);

    // Shift heatmap by timezone offset
    const shifted: Record<number, Record<number, HeatmapCell>> = {};
    for (let d = 0; d < 7; d++) {
        shifted[d] = {};
        for (let h = 0; h < 24; h++) {
            shifted[d][h] = { avgScore: 0, postCount: 0 };
        }
    }

    for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
            const cell = result.heatmap[d]?.[h];
            if (!cell || cell.postCount === 0) continue;

            let newHour = h - offsetHours;
            let newDay = d;
            if (newHour < 0) { newHour += 24; newDay = (newDay - 1 + 7) % 7; }
            if (newHour >= 24) { newHour -= 24; newDay = (newDay + 1) % 7; }

            shifted[newDay][newHour] = cell;
        }
    }

    // Recompute best times with shifted data
    const allCells: { day: number; hour: number; avgScore: number; postCount: number }[] = [];
    for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
            const cell = shifted[d][h];
            if (cell.postCount > 0) {
                allCells.push({ day: d, hour: h, avgScore: cell.avgScore, postCount: cell.postCount });
            }
        }
    }

    const bestTimes = bestPerDay(allCells)
        .slice(0, 5)
        .map(c => ({ day: DAY_NAMES[c.day], hour: c.hour, avgScore: c.avgScore, postCount: c.postCount }));

    // Find best time for today (user's local day)
    const now = new Date();
    const localDay = now.getDay(); // 0=Sun based on system, but we want user's local
    // The offset already accounts for timezone, so we use the shifted heatmap
    const todayCells = allCells
        .filter(c => c.day === localDay)
        .sort((a, b) => b.avgScore - a.avgScore);

    const todayBest = todayCells.length > 0
        ? { hour: todayCells[0].hour, avgScore: todayCells[0].avgScore, postCount: todayCells[0].postCount }
        : null;

    return {
        ...result,
        heatmap: shifted,
        bestTimes,
        todayBest,
    };
}
