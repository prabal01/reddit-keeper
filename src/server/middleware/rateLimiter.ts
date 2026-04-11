import { Request, Response, NextFunction } from "express";
import { Redis } from "ioredis";
import { config } from "../config.js";

// Initialize Redis Client
const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
});

redis.on("error", (err) => {
    // Suppress connection errors to avoid log spam if Redis is down (fail open)
    console.warn("[REDIS] Connection Error:", err.message);
});

redis.on("connect", () => {
    console.log("[REDIS] Connected to Redis Cloud");
});

// ── Rate limit constants (plan-independent) ─────────────────────────
const GLOBAL_LIMIT = 200;           // 200 req/min for all authenticated users
const GLOBAL_WINDOW = 60;           // 60 seconds
const EXPENSIVE_OP_LIMIT = 10;      // 10 req/min for costly AI/scraping endpoints
const EXPENSIVE_OP_WINDOW = 60;

export const createRateLimiter = (limit: number, windowSeconds: number = 60) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const key = req.user
                ? `rate_limit:user:${req.user.uid}`
                : `rate_limit:ip:${req.ip}`;

            const currentCount = await redis.incr(key);

            if (currentCount === 1) {
                await redis.expire(key, windowSeconds);
            }

            if (currentCount > limit) {
                res.status(429).json({
                    error: "Too many requests",
                    message: `Rate limit exceeded. Please try again in ${windowSeconds} seconds.`,
                });
                return;
            }

            next();
        } catch (error) {
            console.error("[RateLimiter] Redis Error:", error);
            next();
        }
    };
};

// ── Global rate limiter (200 req/min, plan-independent) ─────────────
export const rateLimiterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // @ts-ignore - req.user added by auth middleware
        const key = req.user ? `rate_limit:global:${req.user.uid}` : `rate_limit:global:ip:${req.ip}`;

        // Admin bypass
        // @ts-ignore
        if (req.user && req.user.email) {
            const adminEmailsStr = process.env.ADMIN_EMAILS || "";
            const adminEmails = adminEmailsStr.split(",").map((e: string) => e.trim().toLowerCase());
            // @ts-ignore
            if (adminEmails.includes(req.user.email.toLowerCase())) {
                return next();
            }
        }

        const currentCount = await redis.incr(key);

        if (currentCount === 1) {
            await redis.expire(key, GLOBAL_WINDOW);
        }

        if (currentCount > GLOBAL_LIMIT) {
            // Safety: ensure key has TTL
            const ttl = await redis.ttl(key);
            if (ttl === -1) {
                await redis.expire(key, GLOBAL_WINDOW);
            }

            res.status(429).json({
                error: "Too many requests",
                message: `Rate limit exceeded (${GLOBAL_LIMIT}/min). Please try again shortly.`,
            });
            return;
        }

        next();
    } catch (error) {
        console.error("[RateLimiter] Redis Error:", error);
        // Fail open if Redis is down
        next();
    }
};

// ── Expensive operation limiter (10 req/min) ────────────────────────
// Apply to endpoints that trigger AI inference, Reddit scraping, etc.
export const expensiveOpLimiter = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // @ts-ignore
        const uid = req.user?.uid;
        if (!uid) return next(); // auth middleware handles this

        const key = `rate_limit:expensive:${uid}`;
        const currentCount = await redis.incr(key);

        if (currentCount === 1) {
            await redis.expire(key, EXPENSIVE_OP_WINDOW);
        }

        if (currentCount > EXPENSIVE_OP_LIMIT) {
            const ttl = await redis.ttl(key);
            if (ttl === -1) {
                await redis.expire(key, EXPENSIVE_OP_WINDOW);
            }

            res.status(429).json({
                error: "Too many requests",
                message: `This operation is limited to ${EXPENSIVE_OP_LIMIT} requests per minute. Please wait before retrying.`,
            });
            return;
        }

        next();
    } catch (error) {
        console.error("[RateLimiter] Redis Error:", error);
        next();
    }
};

// Strict limiter for auth endpoints (prevent brute force)
export const authRateLimiter = createRateLimiter(5, 60);

export { redis }; // Export for use in other files (Queue)
