import { Router, Request, Response, NextFunction } from 'express';
import { redis } from '../middleware/rateLimiter.js';
import { logger } from '../utils/logger.js';
import { getBestTimeToPost } from './services/best-time.service.js';
import { getSubredditStats } from './services/subreddit-stats.service.js';
import { getBrandMentions } from './services/brand-mentions.service.js';
import { getSubredditComparison } from './services/subreddit-compare.service.js';
import { getUserActivity } from './services/user-activity.service.js';
import { getThreadExplorer } from './services/thread-explorer.service.js';
import { getPainPoints } from './services/pain-points.service.js';
import { getOpportunities } from './services/opportunity-finder.service.js';
import { findSubreddits } from './services/subreddit-finder.service.js';

const router = Router();

// ── Input Validation ─────────────────────────────────────────────────

const SUBREDDIT_RE = /^[a-zA-Z0-9_]{2,21}$/;
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;
const REDDIT_URL_RE = /^https?:\/\/(www\.|old\.)?reddit\.com\/r\/\w+\/comments\//;

function sanitize(str: string): string {
    return str.replace(/<[^>]*>/g, '').trim();
}

function validateSubreddit(name: string): string | null {
    const clean = sanitize(name).toLowerCase().replace(/^r\//, '');
    if (!SUBREDDIT_RE.test(clean)) return null;
    return clean;
}

function validateUsername(name: string): string | null {
    const clean = sanitize(name).replace(/^u\//, '');
    if (!USERNAME_RE.test(clean)) return null;
    return clean;
}

// ── Rate Limiting ────────────────────────────────────────────────────

function toolRateLimiter(anonLimit: number, authLimit: number, windowSeconds: number = 60) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const isAuth = !!(req as any).user;
            const limit = isAuth ? authLimit : anonLimit;
            const key = isAuth
                ? `tools:rl:user:${(req as any).user.uid}`
                : `tools:rl:ip:${req.ip}`;

            const count = await redis.incr(key);
            if (count === 1) await redis.expire(key, windowSeconds);

            if (count > limit) {
                const ttl = await redis.ttl(key);
                const retryAfter = ttl > 0 ? ttl : windowSeconds;
                const minutes = Math.ceil(retryAfter / 60);
                res.set('Retry-After', String(retryAfter));
                res.status(429).json({
                    error: `You've used this tool too many times. Try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`,
                    retryAfter,
                });
                return;
            }
            next();
        } catch (err) {
            logger.warn({ err }, 'Tool rate limiter error, allowing through');
            next();
        }
    };
}

const tier1Limiter = toolRateLimiter(30, 60);
const tier2Limiter = toolRateLimiter(5, 15);

// ── Helpers ──────────────────────────────────────────────────────────

function isAuthenticated(req: Request): boolean {
    return !!(req as any).user;
}

// ── Tool 1: Best Time to Post ────────────────────────────────────────

router.post('/best-time', tier1Limiter, async (req: Request, res: Response) => {
    const raw = req.body?.subreddit;
    if (!raw) return void res.status(400).json({ error: 'Please enter a subreddit name.' });

    const subreddit = validateSubreddit(raw);
    if (!subreddit) return void res.status(400).json({ error: "That doesn't look like a valid subreddit name. It should be letters, numbers, or underscores." });

    try {
        const timezoneOffset = typeof req.body?.timezoneOffset === 'number' ? req.body.timezoneOffset : undefined;
        const result = await getBestTimeToPost(subreddit, timezoneOffset);
        res.json(result);
    } catch (err: any) {
        if (err.message === 'NO_DATA') {
            return void res.status(404).json({ error: `We couldn't find any posts in r/${subreddit}. Double-check the spelling?` });
        }
        logger.error({ err, tool: 'best-time', subreddit }, 'Best time tool error');
        res.status(500).json({ error: 'Something went wrong. Please try again in a moment.' });
    }
});

// ── Tool 2: Subreddit Activity Analyzer ──────────────────────────────

router.post('/subreddit-stats', tier1Limiter, async (req: Request, res: Response) => {
    const raw = req.body?.subreddit;
    if (!raw) return void res.status(400).json({ error: 'Please enter a subreddit name.' });

    const subreddit = validateSubreddit(raw);
    if (!subreddit) return void res.status(400).json({ error: "That doesn't look like a valid subreddit name." });

    try {
        const result = await getSubredditStats(subreddit, isAuthenticated(req));
        res.json(result);
    } catch (err: any) {
        if (err.message === 'NO_DATA') {
            return void res.status(404).json({ error: `We couldn't find any posts in r/${subreddit}. Double-check the spelling?` });
        }
        logger.error({ err, tool: 'subreddit-stats', subreddit }, 'Subreddit stats tool error');
        res.status(500).json({ error: 'Something went wrong. Please try again in a moment.' });
    }
});

// ── Tool 3: Brand Mention Tracker ────────────────────────────────────

router.post('/brand-mentions', tier1Limiter, async (req: Request, res: Response) => {
    const rawBrand = req.body?.brand;
    if (!rawBrand) return void res.status(400).json({ error: 'Please enter a brand or product name.' });

    const brand = sanitize(rawBrand).slice(0, 100);
    if (brand.length < 2) return void res.status(400).json({ error: 'Brand name is too short.' });

    let subreddit: string | undefined;
    if (req.body?.subreddit) {
        const validated = validateSubreddit(req.body.subreddit);
        if (!validated) return void res.status(400).json({ error: "That doesn't look like a valid subreddit name." });
        subreddit = validated;
    }

    try {
        const result = await getBrandMentions(brand, subreddit, isAuthenticated(req));
        res.json(result);
    } catch (err: any) {
        if (err.message === 'NO_DATA') {
            return void res.status(404).json({ error: `We couldn't find any mentions of "${brand}" on Reddit. Try a different name or spelling?` });
        }
        logger.error({ err, tool: 'brand-mentions', brand }, 'Brand mentions tool error');
        res.status(500).json({ error: 'Something went wrong. Please try again in a moment.' });
    }
});

// ── Tool 4: Subreddit Comparison ────────────────────────────────────

router.post('/subreddit-compare', tier1Limiter, async (req: Request, res: Response) => {
    const rawSubs = req.body?.subreddits;
    if (!Array.isArray(rawSubs) || rawSubs.length < 2 || rawSubs.length > 3) {
        return void res.status(400).json({ error: 'Please enter 2 or 3 subreddit names to compare.' });
    }

    const subreddits: string[] = [];
    for (const raw of rawSubs) {
        const validated = validateSubreddit(raw);
        if (!validated) return void res.status(400).json({ error: `"${raw}" doesn't look like a valid subreddit name.` });
        subreddits.push(validated);
    }

    try {
        const result = await getSubredditComparison(subreddits);
        res.json(result);
    } catch (err: any) {
        if (err.message === 'NO_DATA') {
            return void res.status(404).json({ error: "We couldn't find data for one or more of those subreddits. Double-check the names?" });
        }
        logger.error({ err, tool: 'subreddit-compare', subreddits }, 'Subreddit compare tool error');
        res.status(500).json({ error: 'Something went wrong. Please try again in a moment.' });
    }
});

// ── Tool 5: User Activity Lookup ────────────────────────────────────

router.post('/user-activity', tier1Limiter, async (req: Request, res: Response) => {
    const raw = req.body?.username;
    if (!raw) return void res.status(400).json({ error: 'Please enter a Reddit username.' });

    const username = validateUsername(raw);
    if (!username) return void res.status(400).json({ error: "That doesn't look like a valid Reddit username. Usernames are 3-20 characters with letters, numbers, underscores, or hyphens." });

    try {
        const result = await getUserActivity(username, isAuthenticated(req));
        res.json(result);
    } catch (err: any) {
        if (err.message === 'NO_DATA') {
            return void res.status(404).json({ error: `We couldn't find any activity for u/${username}. The account may be private or the username may be misspelled.` });
        }
        logger.error({ err, tool: 'user-activity', username }, 'User activity tool error');
        res.status(500).json({ error: 'Something went wrong. Please try again in a moment.' });
    }
});

// ── Tool 6: Thread Explorer ─────────────────────────────────────────

router.post('/thread-explorer', tier1Limiter, async (req: Request, res: Response) => {
    const rawUrl = req.body?.url;
    if (!rawUrl) return void res.status(400).json({ error: 'Please enter a Reddit thread URL.' });

    const url = sanitize(rawUrl).slice(0, 500);
    if (!REDDIT_URL_RE.test(url)) {
        return void res.status(400).json({ error: "That doesn't look like a Reddit thread URL. Try pasting a link like https://reddit.com/r/subreddit/comments/..." });
    }

    try {
        const result = await getThreadExplorer(url, isAuthenticated(req));
        res.json(result);
    } catch (err: any) {
        if (err.message?.includes('Invalid Reddit URL')) {
            return void res.status(400).json({ error: "We couldn't parse that URL. Make sure it points to a Reddit post." });
        }
        logger.error({ err, tool: 'thread-explorer', url }, 'Thread explorer tool error');
        res.status(500).json({ error: 'Something went wrong. Please try again in a moment.' });
    }
});

// ── Tool 7: Pain Point Finder (Tier 2) ──────────────────────────────

router.post('/pain-points', tier2Limiter, async (req: Request, res: Response) => {
    const rawKeyword = req.body?.keyword;
    const rawSub = req.body?.subreddit;

    if (!rawKeyword) return void res.status(400).json({ error: 'Please enter a keyword or topic.' });
    if (!rawSub) return void res.status(400).json({ error: 'Please enter a subreddit to search in.' });

    const keyword = sanitize(rawKeyword).slice(0, 100);
    if (keyword.length < 2) return void res.status(400).json({ error: 'Keyword is too short.' });

    const subreddit = validateSubreddit(rawSub);
    if (!subreddit) return void res.status(400).json({ error: "That doesn't look like a valid subreddit name." });

    try {
        const result = await getPainPoints(keyword, subreddit, isAuthenticated(req));
        res.json(result);
    } catch (err: any) {
        if (err.message === 'NO_DATA') {
            return void res.status(404).json({ error: `We couldn't find any posts about "${keyword}" in r/${subreddit}. Try broader terms or a different subreddit?` });
        }
        logger.error({ err, tool: 'pain-points', keyword, subreddit }, 'Pain points tool error');
        res.status(500).json({ error: 'Something went wrong analyzing those posts. Please try again in a moment.' });
    }
});

// ── Tool 8: Opportunity Finder (Tier 2) ─────────────────────────────

router.post('/opportunities', tier2Limiter, async (req: Request, res: Response) => {
    const rawProduct = req.body?.product;
    const rawSub = req.body?.subreddit;

    if (!rawProduct) return void res.status(400).json({ error: 'Please describe your product.' });
    if (!rawSub) return void res.status(400).json({ error: 'Please enter a subreddit to search in.' });

    const product = sanitize(rawProduct).slice(0, 200);
    if (product.length < 3) return void res.status(400).json({ error: 'Product description is too short.' });

    const subreddit = validateSubreddit(rawSub);
    if (!subreddit) return void res.status(400).json({ error: "That doesn't look like a valid subreddit name." });

    try {
        const result = await getOpportunities(product, subreddit, isAuthenticated(req));
        res.json(result);
    } catch (err: any) {
        if (err.message === 'NO_DATA') {
            return void res.status(404).json({ error: `We couldn't find relevant posts about "${product}" in r/${subreddit}. Try different keywords or a broader subreddit?` });
        }
        logger.error({ err, tool: 'opportunities', product, subreddit }, 'Opportunity finder tool error');
        res.status(500).json({ error: 'Something went wrong analyzing those posts. Please try again in a moment.' });
    }
});

// ── Tool 9: Subreddit Finder (Tier 2) ───────────────────────────────

router.post('/find-subreddits', tier2Limiter, async (req: Request, res: Response) => {
    const rawDesc = req.body?.description;

    if (!rawDesc) return void res.status(400).json({ error: 'Please describe your product or audience.' });

    const description = sanitize(rawDesc).slice(0, 500);
    if (description.length < 10) return void res.status(400).json({ error: 'Please write a longer description so we can find the best communities.' });

    try {
        const result = await findSubreddits(description, isAuthenticated(req));
        res.json(result);
    } catch (err: any) {
        if (err.message === 'NO_DATA') {
            return void res.status(404).json({ error: "We couldn't find matching subreddits. Try describing your product or audience differently?" });
        }
        logger.error({ err, tool: 'find-subreddits', description: description.slice(0, 50) }, 'Subreddit finder tool error');
        res.status(500).json({ error: 'Something went wrong. Please try again in a moment.' });
    }
});

export default router;
