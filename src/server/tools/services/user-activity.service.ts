import { PullPushService } from '../../discovery/pullpush.service.js';
import { redis } from '../../middleware/rateLimiter.js';
import { logger } from '../../utils/logger.js';

const pullPush = new PullPushService();

const CACHE_TTL = 43200; // 12h

interface UserActivityResult {
    username: string;
    postCount: number;
    commentCount: number;
    topSubreddits: { subreddit: string; count: number }[];
    recentPosts: { title: string; subreddit: string; score: number; created_utc: number; url: string }[];
    activityByMonth: { month: string; posts: number; comments: number }[];
    locked: boolean;
    freeCount: number;
}

export async function getUserActivity(
    username: string,
    isAuthenticated: boolean
): Promise<UserActivityResult> {
    const cacheKey = `tools:user:${username.toLowerCase()}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached) as UserActivityResult;
            if (!isAuthenticated) {
                return {
                    ...parsed,
                    recentPosts: parsed.recentPosts.slice(0, 5),
                    activityByMonth: parsed.activityByMonth.slice(-6),
                    locked: parsed.recentPosts.length > 5,
                    freeCount: 5,
                };
            }
            return { ...parsed, locked: false, freeCount: parsed.recentPosts.length };
        }
    } catch (err) {
        logger.warn({ err }, 'User-activity cache read failed');
    }

    // Fetch posts and comments by this author
    const [submissions, comments] = await Promise.all([
        pullPush.searchSubmissions('', undefined, 100, undefined, username),
        pullPush.searchComments('', undefined, 100, username),
    ]);

    if (submissions.length === 0 && comments.length === 0) {
        throw new Error('NO_DATA');
    }

    // Top subreddits (combined posts + comments)
    const subCounts: Record<string, number> = {};
    for (const item of [...submissions, ...comments]) {
        const sub = item.subreddit || '';
        if (sub) subCounts[sub] = (subCounts[sub] || 0) + 1;
    }
    const topSubreddits = Object.entries(subCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15)
        .map(([subreddit, count]) => ({ subreddit, count }));

    // Recent posts
    const recentPosts = submissions
        .sort((a, b) => (b.created_utc || 0) - (a.created_utc || 0))
        .slice(0, 20)
        .map(s => ({
            title: s.title,
            subreddit: s.subreddit || '',
            score: Math.round((s.score || 0) / 10), // Undo 10x scaling
            created_utc: s.created_utc,
            url: s.url,
        }));

    // Activity by month
    const monthMap: Record<string, { posts: number; comments: number }> = {};
    for (const s of submissions) {
        if (s.created_utc) {
            const date = new Date(s.created_utc * 1000);
            const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
            if (!monthMap[key]) monthMap[key] = { posts: 0, comments: 0 };
            monthMap[key].posts++;
        }
    }
    for (const c of comments) {
        if (c.created_utc) {
            const date = new Date(c.created_utc * 1000);
            const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
            if (!monthMap[key]) monthMap[key] = { posts: 0, comments: 0 };
            monthMap[key].comments++;
        }
    }
    const activityByMonth = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({ month, ...data }));

    const fullResult: UserActivityResult = {
        username,
        postCount: submissions.length,
        commentCount: comments.length,
        topSubreddits,
        recentPosts,
        activityByMonth,
        locked: false,
        freeCount: recentPosts.length,
    };

    // Cache full result
    try {
        await redis.set(cacheKey, JSON.stringify(fullResult), 'EX', CACHE_TTL);
    } catch (err) {
        logger.warn({ err }, 'User-activity cache write failed');
    }

    // Apply gating for anonymous users
    if (!isAuthenticated && fullResult.recentPosts.length > 5) {
        return {
            ...fullResult,
            recentPosts: fullResult.recentPosts.slice(0, 5),
            activityByMonth: fullResult.activityByMonth.slice(-6),
            locked: true,
            freeCount: 5,
        };
    }

    return fullResult;
}
