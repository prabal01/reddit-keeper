import { Request, Response, NextFunction } from "express";
import { Redis } from "ioredis";

// Initialize Redis Client
// Uses REDIS_URL from .env (e.g., redis://:password@host:port)
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
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

const WINDOW_SIZE_IN_SECONDS = 60;
const FALLBACK_ANON_LIMIT = 15; // Increased from 5 to stop accidental lockouts during normal browsing

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

export const rateLimiterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Use User ID if authenticated, otherwise IP
        // @ts-ignore - req.user added by auth middleware
        const key = req.user ? `rate_limit:user:${req.user.uid}` : `rate_limit:ip:${req.ip}`;

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

        // Simple Fixed Window Counter
        const currentCount = await redis.incr(key);

        if (currentCount === 1) {
            // Set expiration on first increment
            await redis.expire(key, WINDOW_SIZE_IN_SECONDS);
        }

        // Determine the dynamic max limit
        let dynamicLimit = FALLBACK_ANON_LIMIT;
        // @ts-ignore
        if (req.user && req.user.config && req.user.config.rateLimit) {
            // @ts-ignore
            dynamicLimit = req.user.config.rateLimit;
        }

        if (currentCount > dynamicLimit) {
            // Safety Check: Ensure the key has a TTL. If it doesn't, it might be stuck indefinitely due to a race condition.
            const ttl = await redis.ttl(key);
            if (ttl === -1) {
                await redis.expire(key, WINDOW_SIZE_IN_SECONDS);
            }

            res.status(429).json({
                error: "Too many requests",
                message: req.user
                    ? `You have exceeded your plan limit of ${dynamicLimit} requests per minute. Upgrade to Pro for higher limits.`
                    : "You have exceeded the API limits.",
            });
            return;
        }

        next();
    } catch (error) {
        console.error("[RateLimiter] Redis Error:", error);
        // Fail open if Redis is down so users aren't blocked
        next();
    }
};

// Strict limiter for auth endpoints (prevent brute force)
export const authRateLimiter = createRateLimiter(5, 60);

export { redis }; // Export for use in other files (Queue)
