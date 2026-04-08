import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { getDb, verifyInviteCode } from '../firestore.js';
import { sendAlert } from '../alerts.js';
import { config } from '../config.js';
import { adminMiddleware } from '../middleware/admin.js';
import {
    getGlobalStats,
    getDailyStats,
    getAllUsers,
    getBetaTokens,
    createInviteCode,
    updateWaitlistStatus,
    getWaitlist,
    getStats
} from '../admin.js';
import { syncQueue, granularAnalysisQueue, analysisQueue } from '../queues.js';
import { monitoringScraperQueue, opportunityMatcherQueue } from '../monitoring/worker.js';

const router = Router();

// Dashboard Metrics
router.get('/metrics', adminMiddleware, async (req: Request, res: Response) => {
    try {
        const stats = await getGlobalStats();
        const daily = await getDailyStats();
        res.json({ counts: stats, daily });
    } catch (err: unknown) {
        logger.error(err); res.status(500).json({ error: "Internal server error" });
    }
});

// User Management
router.get('/users', adminMiddleware, async (req: Request, res: Response) => {
    try {
        const lastDocId = req.query.lastDocId as string | undefined;
        const users = await getAllUsers(50, lastDocId);
        res.json(users);
    } catch (err: unknown) {
        logger.error(err); res.status(500).json({ error: "Internal server error" });
    }
});

const VALID_PLANS = ["free", "trial", "starter", "pro", "professional", "beta", "enterprise", "past_due"] as const;

router.post('/users/:uid/plan', adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { plan } = req.body;
        if (!VALID_PLANS.includes(plan)) {
            return res.status(400).json({ error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}` });
        }
        const { updateUserPlan } = await import("../firestore.js");
        await updateUserPlan(req.params.uid as string, plan);
        res.json({ success: true, plan });
    } catch (err: unknown) {
        logger.error(err); res.status(500).json({ error: "Internal server error" });
    }
});

// Beta Tokens
router.get('/tokens', adminMiddleware, async (req: Request, res: Response) => {
    try {
        const tokens = await getBetaTokens();
        res.json(tokens);
    } catch (err: unknown) {
        logger.error(err); res.status(500).json({ error: "Internal server error" });
    }
});

router.post('/tokens', adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { code, maxUses } = req.body;
        await createInviteCode(code, maxUses || 1);
        res.json({ success: true });
    } catch (err: unknown) {
        logger.error(err); res.status(500).json({ error: "Internal server error" });
    }
});

// Waitlist
router.get('/waitlist', adminMiddleware, async (req: Request, res: Response) => {
    try {
        const wlist = await getWaitlist();
        res.json(wlist);
    } catch (err: unknown) {
        logger.error(err); res.status(500).json({ error: "Internal server error" });
    }
});

// BullMQ Stats
router.get('/bullmq-stats', adminMiddleware, async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        const activeAnalysesCount = (await db.collection("folders").where("analysisStatus", "==", "processing").count().get()).data().count;
        const failedAnalysesCount = (await db.collection("folders").where("analysisStatus", "==", "failed").count().get()).data().count;
        const completedAnalysesCount = (await db.collection("folders").where("analysisStatus", "==", "complete").count().get()).data().count;

        const stats = {
            sync: await getStats(syncQueue),
            granular: await getStats(granularAnalysisQueue),
            analysis: {
                active: activeAnalysesCount,
                waiting: 0,
                completed: completedAnalysesCount,
                failed: failedAnalysesCount,
            },
            monitoring_scraper: await getStats(monitoringScraperQueue),
            monitoring_matcher: await getStats(opportunityMatcherQueue)
        };
        res.json(stats);
    } catch (err: unknown) {
        logger.error(err); res.status(500).json({ error: "Internal server error" });
    }
});

// AI Intelligence Sandbox (Testing Matching)
router.post('/test-match', adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { title, selftext, websiteContext } = req.body;
        if (!title || !websiteContext) {
            return res.status(400).json({ error: "Title and Website Context are required" });
        }

        const { scoreMarketingOpportunity } = await import("../ai.js");
        const result = await scoreMarketingOpportunity(websiteContext, { 
            title, 
            selftext: selftext || "", 
            subreddit: "tester" 
        });

        res.json(result);
    } catch (err: unknown) {
        logger.error(err); res.status(500).json({ error: "Internal server error" });
    }
});

// Invite Codes (secret-guarded, not adminMiddleware)
router.get('/invite-codes', async (req: Request, res: Response) => {
    const { secret } = req.query;
    if (secret !== (config.adminSecret || 'deck-dev-secret')) {
        return void res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const db = getDb();
        const snapshot = await db.collection('invite_codes').get();
        res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err: unknown) {
        logger.error({ err }, 'GET /api/admin/invite-codes failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/waitlist/:id/status', adminMiddleware, async (req: Request, res: Response) => {
    try {
        await updateWaitlistStatus(req.params.id as string, req.body.status);
        res.json({ success: true });
    } catch (err: unknown) {
        logger.error({ err }, 'POST /api/admin/waitlist/:id/status failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/test-alert', adminMiddleware, async (req: Request, res: Response) => {
    try {
        await sendAlert('SYSTEM', 'Manual Trigger Test from Admin Terminal', {
            executedBy: req.user?.email,
            ip: req.ip,
            timestamp: new Date().toISOString()
        });
        res.json({ success: true, message: 'Alert sent to Telegram' });
    } catch (err: unknown) {
        logger.error({ err }, 'GET /api/admin/test-alert failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Invite Generator UI (serves HTML page)
router.get('/invite-gen', (_req: Request, res: Response) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;");
    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Invite Generator | OpinionDeck</title></head><body><p>Invite Generator — use the API directly: POST /api/admin/tokens</p></body></html>`);
});

export default router;
