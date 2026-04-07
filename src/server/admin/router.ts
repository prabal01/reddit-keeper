import { Router, Request, Response } from 'express';
console.log("[INIT] Admin Router module evaluated. Registering endpoints...");
import { adminMiddleware } from '../middleware/admin.js';
import { 
    getGlobalStats, 
    getDailyStats, 
    getAllUsers, 
    getBetaTokens, 
    createInviteCode, 
    getWaitlist,
    getStats 
} from '../admin.js';
import { getDb } from '../firestore.js';
import { syncQueue, granularAnalysisQueue, analysisQueue } from '../queues.js';
import { monitoringScraperQueue, opportunityMatcherQueue } from '../monitoring/worker.js';

const router = Router();

// Dashboard Metrics
router.get('/metrics', adminMiddleware, async (req: Request, res: Response) => {
    try {
        const stats = await getGlobalStats();
        const daily = await getDailyStats();
        res.json({ counts: stats, daily });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// User Management
router.get('/users', adminMiddleware, async (req: Request, res: Response) => {
    try {
        const lastDocId = req.query.lastDocId as string | undefined;
        const users = await getAllUsers(50, lastDocId);
        res.json(users);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/users/:uid/plan', adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { plan } = req.body;
        const { updateUserPlan } = await import("../firestore.js");
        await updateUserPlan(req.params.uid as string, plan as any);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Beta Tokens
router.get('/tokens', adminMiddleware, async (req: Request, res: Response) => {
    try {
        const tokens = await getBetaTokens();
        res.json(tokens);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/tokens', adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { code, maxUses } = req.body;
        await createInviteCode(code, maxUses || 1);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Waitlist
router.get('/waitlist', adminMiddleware, async (req: Request, res: Response) => {
    try {
        const wlist = await getWaitlist();
        res.json(wlist);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
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
    } catch (err: any) {
        res.status(500).json({ error: err.message });
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
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
