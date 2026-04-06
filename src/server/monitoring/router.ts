import { Router, Request, Response } from 'express';
import { MonitoringService } from './service.js';
import { authMiddleware } from '../middleware/auth.js';
import { monitoringScraperQueue, opportunityMatcherQueue } from './worker.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ── User Configuration ─────────────────────────────────────────────

router.get('/config', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const config = await MonitoringService.getUserMonitor(req.user.uid);
        res.json(config || { uid: req.user.uid, websiteContext: '', subreddits: [], createdAt: '', lastMatchAt: null });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/config', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { websiteContext, subreddits } = req.body;
    
    if (!websiteContext || !Array.isArray(subreddits)) {
        return res.status(400).json({ error: 'Invalid config data' });
    }

    try {
        await MonitoringService.saveUserMonitor(req.user.uid, { websiteContext, subreddits });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── Opportunities ──────────────────────────────────────────────────

router.get('/opportunities', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const opportunities = await MonitoringService.getUserOpportunities(req.user.uid);
        res.json(opportunities);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/opportunities/:id/status', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { status } = req.body;
    try {
        await MonitoringService.updateOpportunityStatus(req.user.uid, req.params.id as string, status);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── Manual Trigger (Admin or Debug) ────────────────────────────────

router.post('/sync', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    
    try {
        logger.info({ action: 'MONITORING_MANUAL_SYNC', uid: req.user.uid }, `Manual full sync (Scrape + Match) triggered`);
        // Use deterministic jobId to prevent overlapping syncs for the same user
        await monitoringScraperQueue.add(`manual-sync-${req.user.uid}`, { triggeredBy: req.user.uid }, {
            jobId: `manual-sync-${req.user.uid}`
        });
        res.json({ success: true, message: "Sync enqueued" });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/match', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    
    try {
        const config = await MonitoringService.getUserMonitor(req.user.uid);
        if (!config || !config.subreddits.length) {
            return res.status(400).json({ error: "No subreddits configured for monitoring." });
        }

        logger.info({ action: 'MONITORING_MANUAL_MATCH', uid: req.user.uid }, `Manual matching pipeline triggered`);
        
        await opportunityMatcherQueue.add(`manual-match-${req.user.uid}`, { 
            uid: req.user.uid,
            subreddits: config.subreddits
        }, {
            jobId: `manual-match-${req.user.uid}`
        });
        
        res.json({ success: true, message: "Matching pipeline triggered using cached posts." });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── Subreddit Suggestions ──────────────────────────────────────────

router.post('/suggestions', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    let { context } = req.body;
    
    if (!context) return res.status(400).json({ error: 'Context required' });

    try {
        let summarizedContext = null;

        // 1. Detect if context is a URL
        const isUrl = /^(http|https):\/\/[^ "]+$/.test(context.trim());
        if (isUrl) {
            logger.info({ action: 'MONITORING_SUGGESTION_URL', url: context }, `Extracting context from URL`);
            summarizedContext = await MonitoringService.scrapeAndSummarize(context.trim());
            context = summarizedContext; // Use summarized text for query expansion
        }

        // 2. Expand Context to Keywords (for potential future use or to ensure we have text)
        const { expandIdeaToQueries } = await import('../ai.js');
        const { intent } = await expandIdeaToQueries(context, [], [], 1);
        
        // 3. Search for real subreddits using the full context for brainstorming
        const suggestions = await MonitoringService.searchSubreddits(context);

        res.json({
            summarizedContext,
            suggestions
        });
    } catch (err: any) {
        logger.error({ err, context }, "Suggestions endpoint failed");
        res.status(500).json({ error: err.message });
    }
});

export default router;
