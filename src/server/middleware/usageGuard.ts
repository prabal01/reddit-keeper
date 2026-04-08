import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { getOrCreateUser, getPlanConfig, resolveUserConfig } from '../firestore.js';

export type GuardedFeature = 'DISCOVERY' | 'ANALYSIS' | 'SAVED_THREADS';

/**
 * Middleware to enforce usage limits for specific features.
 * Must be placed AFTER authMiddleware.
 */
export const usageGuard = (feature: GuardedFeature) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const uid = req.user?.uid;
        const email = req.user?.email;

        if (!uid || !email) {
            return res.status(401).json({ error: "Authentication required for limit check" });
        }

        try {
            // Re-fetching user doc (will hit 60s cache from authMiddleware)
            // This ensures we have access to discoveryCount, analysisCount, etc.
            const user = await getOrCreateUser(uid, email);

            // Get effective config (plan defaults + overrides)
            const planConfig = await getPlanConfig(user.plan);
            const config = resolveUserConfig(planConfig, user.configOverrides);

            let limit = 0;
            let current = 0;
            let errorCode = "";

            switch (feature) {
                case 'DISCOVERY':
                    limit = config.discoveryLimit ?? 0;
                    current = user.discoveryCount ?? 0;
                    errorCode = "LIMIT_REACHED_DISCOVERY";
                    break;
                case 'ANALYSIS':
                    limit = config.analysisLimit ?? 0;
                    current = user.analysisCount ?? 0;
                    errorCode = "LIMIT_REACHED_ANALYSIS";
                    break;
                case 'SAVED_THREADS':
                    limit = config.savedThreadLimit ?? 0;
                    current = user.savedThreadCount ?? 0;
                    errorCode = "LIMIT_REACHED_SAVED";
                    break;
            }

            if (current >= limit) {
                return res.status(403).json({
                    error: `Usage limit reached for ${feature.toLowerCase().replace('_', ' ')}`,
                    code: errorCode,
                    limit,
                    current,
                    hint: "Contact hello@opiniondeck.com for extra credits during Beta."
                });
            }

            next();
        } catch (err: unknown) {
            logger.error({ err, uid }, "[UsageGuard] Error checking limits");
            // Fail closed — deny request when we can't verify limits
            return res.status(503).json({
                error: "Unable to verify usage limits. Please try again shortly.",
                code: "SERVICE_UNAVAILABLE",
            });
        }
    };
};
