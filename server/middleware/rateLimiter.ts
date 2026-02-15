import type { Request, Response, NextFunction } from "express";
import { getEffectiveConfig } from "./auth.js";

/**
 * Sliding window rate limiter.
 * Limits are driven by the user's resolved PlanConfig (not hardcoded).
 *
 * - Authenticated users → keyed by UID, limits from config
 * - Unauthenticated → keyed by IP, limits from free plan config
 */

interface RateLimitEntry {
    timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
        // Remove entries with all timestamps expired (> 5 min old)
        entry.timestamps = entry.timestamps.filter((t) => now - t < 5 * 60 * 1000);
        if (entry.timestamps.length === 0) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

export async function rateLimiterMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const config = await getEffectiveConfig(req);
    const limit = config.rateLimit;
    const windowMs = config.rateLimitWindow * 1000;

    // Key: UID for authenticated users, IP for anonymous
    const key = req.user?.uid || getClientIp(req);
    const now = Date.now();

    let entry = rateLimitStore.get(key);
    if (!entry) {
        entry = { timestamps: [] };
        rateLimitStore.set(key, entry);
    }

    // Remove timestamps outside the current window
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

    if (entry.timestamps.length >= limit) {
        const oldestInWindow = entry.timestamps[0];
        const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);

        res.set("Retry-After", String(retryAfter));
        res.status(429).json({
            error: "Too many requests. Please try again later.",
            retryAfter,
        });
        return;
    }

    entry.timestamps.push(now);
    next();
}

function getClientIp(req: Request): string {
    // Handle proxied requests (e.g., behind Vercel, Railway, nginx)
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
        return forwarded.split(",")[0].trim();
    }
    return req.ip || req.socket.remoteAddress || "unknown";
}
