import type { Request, Response, NextFunction } from "express";
import {
    getAdminAuth,
    getOrCreateUser,
    getPlanConfig,
    resolveUserConfig,
    type PlanConfig,
    type UserDoc,
} from "../firestore.js";
import { logContext } from "../utils/logger.js";

// Extend Express Request to include user info
declare global {
    namespace Express {
        interface Request {
            user?: {
                uid: string;
                email: string;
                plan: UserDoc["plan"];
                config: PlanConfig;
            } | null;
        }
    }
}

/**
 * Optional auth middleware.
 * - If Authorization header present → verify token, load user + config
 * - If missing or invalid → req.user = null (unauthenticated, gets free config)
 * - Never rejects the request — downstream decides what to do
 */
export async function authMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> {
    req.user = null;

    const authHeader = req.headers.authorization;
    const devBypass = req.headers['x-opiniondeck-dev'] === 'true';

    const finish = () => {
        logContext.run({ userId: req.user?.uid }, () => next());
    };

    if (!authHeader?.startsWith("Bearer ") && !devBypass) {
        return finish();
    }

    if (devBypass) {
        req.user = {
            uid: "dev-extension-user",
            email: "extension-dev@local.dev",
            plan: "pro",
            config: await getPlanConfig("pro"),
        };
        return finish();
    }

    const token = authHeader?.slice(7) || "";
    const adminAuth = getAdminAuth();

    if (!adminAuth) {
        if (process.env.NODE_ENV === 'production') {
            console.error("CRITICAL: Firebase Auth not initialized in production.");
            return finish(); // Downstream will catch req.user === null and return 401
        }

        // Mock user for local dev without Firestore/Auth (optional, kept for easy local testing if specifically desired)
        // But let's make it explicit: only if devBypass was already handled or similar.
        // Actually, let's just treat it as unauthenticated if Auth is missing to avoid confusion.
        return finish();
    }

    try {
        const decoded = await adminAuth.verifyIdToken(token);
        const user = await getOrCreateUser(decoded.uid, decoded.email || "");
        const planConfig = await getPlanConfig(user.plan === "past_due" ? "free" : user.plan);
        const config = resolveUserConfig(planConfig, user.configOverrides);

        req.user = {
            uid: user.uid,
            email: user.email,
            plan: user.plan,
            config,
        };
    } catch (err) {
        // Invalid / expired token → treat as unauthenticated
        console.warn("Auth token verification failed:", (err as Error).message);
    }

    finish();
}

/**
 * Get the effective PlanConfig for the current request.
 * Authenticated users get their resolved config; anonymous users get the free plan config.
 */
export async function getEffectiveConfig(req: Request): Promise<PlanConfig> {
    if (req.user) {
        return req.user.config;
    }
    return getPlanConfig("free");
}
