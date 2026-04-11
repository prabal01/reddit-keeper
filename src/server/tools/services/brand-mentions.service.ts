import { PullPushService } from '../../discovery/pullpush.service.js';
import { redis } from '../../middleware/rateLimiter.js';
import { logger } from '../../utils/logger.js';

const pullPush = new PullPushService();

const CACHE_TTL = 43200; // 12h
const FREE_LIMIT = 5;

interface MentionPost {
    id: string;
    title: string;
    subreddit: string;
    author: string;
    score: number;
    created_utc: number;
    url: string;
}

interface BrandMentionsResult {
    brand: string;
    totalMentions: number;
    posts: MentionPost[];
    subredditBreakdown: { subreddit: string; count: number }[];
    timeline: { month: string; count: number }[];
    locked: boolean;
    freeCount: number;
}

export async function getBrandMentions(
    brand: string,
    subreddit: string | undefined,
    isAuthenticated: boolean
): Promise<BrandMentionsResult> {
    const cacheKey = `tools:brand:${brand.toLowerCase()}:${(subreddit || 'all').toLowerCase()}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached) as BrandMentionsResult;
            // Apply gating based on auth
            if (!isAuthenticated && parsed.posts.length > FREE_LIMIT) {
                return {
                    ...parsed,
                    posts: parsed.posts.slice(0, FREE_LIMIT),
                    locked: true,
                    freeCount: FREE_LIMIT,
                };
            }
            return { ...parsed, locked: false, freeCount: parsed.posts.length };
        }
    } catch (err) {
        logger.warn({ err }, 'Brand-mentions cache read failed');
    }

    const submissions = await pullPush.searchSubmissions(brand, subreddit, 100);

    if (submissions.length === 0) {
        throw new Error('NO_DATA');
    }

    // Build mention list
    const allPosts: MentionPost[] = submissions.map(s => ({
        id: s.id,
        title: s.title,
        subreddit: s.subreddit || '',
        author: s.author || 'unknown',
        score: Math.round((s.score || 0) / 10), // Undo 10x scaling
        created_utc: s.created_utc,
        url: s.url,
    }));

    // Subreddit breakdown
    const subCounts: Record<string, number> = {};
    for (const post of allPosts) {
        if (post.subreddit) {
            subCounts[post.subreddit] = (subCounts[post.subreddit] || 0) + 1;
        }
    }
    const subredditBreakdown = Object.entries(subCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15)
        .map(([subreddit, count]) => ({ subreddit, count }));

    // Timeline (by month)
    const monthCounts: Record<string, number> = {};
    for (const post of allPosts) {
        if (post.created_utc) {
            const date = new Date(post.created_utc * 1000);
            const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
            monthCounts[key] = (monthCounts[key] || 0) + 1;
        }
    }
    const timeline = Object.entries(monthCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count }));

    const fullResult: BrandMentionsResult = {
        brand,
        totalMentions: allPosts.length,
        posts: allPosts.slice(0, 20),
        subredditBreakdown,
        timeline,
        locked: false,
        freeCount: allPosts.length,
    };

    // Cache full result
    try {
        await redis.set(cacheKey, JSON.stringify(fullResult), 'EX', CACHE_TTL);
    } catch (err) {
        logger.warn({ err }, 'Brand-mentions cache write failed');
    }

    // Apply gating for anonymous users
    if (!isAuthenticated && fullResult.posts.length > FREE_LIMIT) {
        return {
            ...fullResult,
            posts: fullResult.posts.slice(0, FREE_LIMIT),
            locked: true,
            freeCount: FREE_LIMIT,
        };
    }

    return fullResult;
}
