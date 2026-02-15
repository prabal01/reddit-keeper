import type { Request, Response, NextFunction } from "express";
import {
    getAdminAuth,
    getOrCreateUser,
    getPlanConfig,
    resolveUserConfig,
    type PlanConfig,
    type UserDoc,
} from "../firestore.js";

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
    if (!authHeader?.startsWith("Bearer ")) {
        return next();
    }

    const token = authHeader.slice(7);
    const adminAuth = getAdminAuth();

    if (!adminAuth) {
        return next();
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

    next();
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
