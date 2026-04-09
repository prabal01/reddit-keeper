import { Router, Request, Response } from 'express';
import { MonitoringService } from './service.js';
import { authMiddleware } from '../middleware/auth.js';
import { monitoringScraperQueue, opportunityMatcherQueue } from './worker.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ── Multi-Monitor CRUD ─────────────────────────────────────────────

/**
 * List all monitors for the authenticated user
 */
router.get('/monitors', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const monitors = await MonitoringService.getUserMonitors(req.user.uid);
        res.json(monitors);
    } catch (err: unknown) {
        logger.error(err, 'Request failed'); res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Create a new monitor (enforces plan monitorLimit and subredditsPerMonitor)
 */
router.post('/monitors', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { name, websiteContext, subreddits } = req.body;
    if (!websiteContext || !Array.isArray(subreddits)) {
        return res.status(400).json({ error: 'Invalid monitor data' });
    }

    const config = req.user.config;

    // Enforce monitor count limit
    if (config.monitorLimit !== -1) {
        const currentCount = await MonitoringService.countUserMonitors(req.user.uid);
        if (currentCount >= config.monitorLimit) {
            return res.status(403).json({
                error: `Monitor limit reached. Your plan allows ${config.monitorLimit} monitor(s).`,
                code: 'MONITOR_LIMIT_REACHED',
                limit: config.monitorLimit,
            });
        }
    }

    // Enforce subreddits per monitor limit
    if (config.subredditsPerMonitor !== -1 && subreddits.length > config.subredditsPerMonitor) {
        return res.status(403).json({
            error: `Too many subreddits. Your plan allows ${config.subredditsPerMonitor} subreddits per monitor.`,
            code: 'SUBREDDIT_LIMIT_EXCEEDED',
            limit: config.subredditsPerMonitor,
        });
    }

    try {
        const monitorId = await MonitoringService.saveUserMonitor(req.user.uid, {
            name: name || 'New Monitor',
            websiteContext,
            subreddits,
        });
        res.json({ success: true, monitorId });
    } catch (err: unknown) {
        logger.error(err, 'Request failed'); res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Get a specific monitor
 */
router.get('/monitors/:monitorId', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const monitor = await MonitoringService.getUserMonitor(req.user.uid, req.params.monitorId as string);
        if (!monitor) return res.status(404).json({ error: 'Monitor not found' });
        res.json(monitor);
    } catch (err: unknown) {
        logger.error(err, 'Request failed'); res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Update a specific monitor (enforces subredditsPerMonitor)
 */
router.put('/monitors/:monitorId', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { name, websiteContext, subreddits } = req.body;
    if (subreddits !== undefined && !Array.isArray(subreddits)) {
        return res.status(400).json({ error: 'Invalid subreddits' });
    }

    const config = req.user.config;

    // Verify monitor belongs to user
    const existing = await MonitoringService.getUserMonitor(req.user.uid, req.params.monitorId as string);
    if (!existing) return res.status(404).json({ error: 'Monitor not found' });

    // Enforce subreddits per monitor limit on update
    if (subreddits && config.subredditsPerMonitor !== -1 && subreddits.length > config.subredditsPerMonitor) {
        return res.status(403).json({
            error: `Too many subreddits. Your plan allows ${config.subredditsPerMonitor} subreddits per monitor.`,
            code: 'SUBREDDIT_LIMIT_EXCEEDED',
            limit: config.subredditsPerMonitor,
        });
    }

    try {
        await MonitoringService.saveUserMonitor(req.user.uid, {
            ...(name !== undefined && { name }),
            ...(websiteContext !== undefined && { websiteContext }),
            ...(subreddits !== undefined && { subreddits }),
            createdAt: existing.createdAt,
        }, req.params.monitorId as string);
        res.json({ success: true });
    } catch (err: unknown) {
        logger.error(err, 'Request failed'); res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Delete a specific monitor
 */
router.delete('/monitors/:monitorId', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    try {
        await MonitoringService.deleteUserMonitor(req.user.uid, req.params.monitorId as string);
        res.json({ success: true });
    } catch (err: unknown) {
        logger.error(err, 'Request failed'); res.status(500).json({ error: "Internal server error" });
    }
});

// ── Legacy single-monitor config routes (backward compat) ──────────

router.get('/config', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const config = await MonitoringService.getUserMonitor(req.user.uid, 'default');
        res.json(config || { uid: req.user.uid, monitorId: 'default', name: 'Default Monitor', websiteContext: '', subreddits: [], createdAt: '', lastMatchAt: null });
    } catch (err: unknown) {
        logger.error(err, 'Request failed'); res.status(500).json({ error: "Internal server error" });
    }
});

router.post('/config', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { websiteContext, subreddits } = req.body;

    if (!websiteContext || !Array.isArray(subreddits)) {
        return res.status(400).json({ error: 'Invalid config data' });
    }

    const config = req.user.config;

    // Enforce subreddits per monitor
    if (config.subredditsPerMonitor !== -1 && subreddits.length > config.subredditsPerMonitor) {
        return res.status(403).json({
            error: `Too many subreddits. Your plan allows ${config.subredditsPerMonitor} subreddits per monitor.`,
            code: 'SUBREDDIT_LIMIT_EXCEEDED',
            limit: config.subredditsPerMonitor,
        });
    }

    try {
        await MonitoringService.saveUserMonitor(req.user.uid, {
            name: 'Default Monitor',
            websiteContext,
            subreddits,
        }, 'default');
        res.json({ success: true });
    } catch (err: unknown) {
        logger.error(err, 'Request failed'); res.status(500).json({ error: "Internal server error" });
    }
});

// ── Opportunities ──────────────────────────────────────────────────

router.get('/opportunities', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const opportunities = await MonitoringService.getUserOpportunities(req.user.uid);
        res.json(opportunities);
    } catch (err: unknown) {
        logger.error(err, 'Request failed'); res.status(500).json({ error: "Internal server error" });
    }
});

router.post('/opportunities/:id/status', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { status } = req.body;
    try {
        await MonitoringService.updateOpportunityStatus(req.user.uid, req.params.id as string, status);
        res.json({ success: true });
    } catch (err: unknown) {
        logger.error(err, 'Request failed'); res.status(500).json({ error: "Internal server error" });
    }
});

router.post('/opportunities/bulk/status', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { ids, status } = req.body;

    if (!Array.isArray(ids) || !status) {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    try {
        const promises = ids.map(id => MonitoringService.updateOpportunityStatus(req.user!.uid, id, status));
        await Promise.all(promises);
        res.json({ success: true, updated: ids.length });
    } catch (err: unknown) {
        logger.error(err, 'Request failed'); res.status(500).json({ error: "Internal server error" });
    }
});

router.delete('/opportunities/bulk', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { ids } = req.body;

    if (!Array.isArray(ids)) {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    try {
        await MonitoringService.deleteOpportunities(req.user.uid, ids);
        res.json({ success: true, deleted: ids.length });
    } catch (err: unknown) {
        logger.error(err, 'Request failed'); res.status(500).json({ error: "Internal server error" });
    }
});

router.get('/opportunities/export/csv', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const opportunities = await MonitoringService.getAllUserOpportunities(req.user.uid);

        const headers = ['Title', 'Author', 'Subreddit', 'Score', 'Status', 'Date', 'URL'];
        const rows = opportunities.map(opp => [
            `"${opp.postTitle.replace(/"/g, '""')}"`,
            opp.postAuthor,
            opp.postSubreddit,
            opp.relevanceScore,
            opp.status,
            new Date(opp.createdAt * 1000).toISOString().split('T')[0],
            opp.postUrl
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
        res.send(csv);
    } catch (err: unknown) {
        logger.error(err, 'Request failed'); res.status(500).json({ error: "Internal server error" });
    }
});

// ── Manual Trigger ────────────────────────────────────────────────

router.post('/sync', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        logger.info({ action: 'MONITORING_MANUAL_SYNC', uid: req.user.uid }, `Manual full sync triggered`);
        await monitoringScraperQueue.add(`manual-sync-${req.user.uid}`, { triggeredBy: req.user.uid }, {
            jobId: `manual-sync-${req.user.uid}`
        });
        res.json({ success: true, message: "Sync enqueued" });
    } catch (err: unknown) {
        logger.error(err, 'Request failed'); res.status(500).json({ error: "Internal server error" });
    }
});

router.post('/match', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { monitorId = 'default' } = req.body;

    try {
        const monitor = await MonitoringService.getUserMonitor(req.user.uid, monitorId);
        if (!monitor || !monitor.subreddits.length) {
            return res.status(400).json({ error: "No subreddits configured for this monitor." });
        }

        logger.info({ action: 'MONITORING_MANUAL_MATCH', uid: req.user.uid, monitorId }, `Manual matching triggered`);

        const jobId = `manual-match-${req.user.uid}-${monitorId}`;
        await opportunityMatcherQueue.add(jobId, {
            uid: req.user.uid,
            monitorId,
            subreddits: monitor.subreddits
        }, { jobId });

        res.json({ success: true, message: "Matching pipeline triggered using cached posts." });
    } catch (err: unknown) {
        logger.error(err, 'Request failed'); res.status(500).json({ error: "Internal server error" });
    }
});

// ── Subreddit Suggestions ──────────────────────────────────────────

router.post('/suggestions', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    let { context } = req.body;

    if (!context) return res.status(400).json({ error: 'Context required' });

    try {
        let summarizedContext = null;

        const isUrl = /^(http|https):\/\/[^ "]+$/.test(context.trim());
        if (isUrl) {
            logger.info({ action: 'MONITORING_SUGGESTION_URL', url: context }, `Extracting context from URL`);
            summarizedContext = await MonitoringService.scrapeAndSummarize(context.trim());
            context = summarizedContext;
        }

        const { expandIdeaToQueries } = await import('../ai.js');
        const { intent } = await expandIdeaToQueries(context, [], [], 1);

        const suggestions = await MonitoringService.searchSubreddits(context);

        res.json({
            summarizedContext,
            suggestions
        });
    } catch (err: unknown) {
        logger.error({ err, context }, "Suggestions endpoint failed");
        logger.error(err, 'Request failed'); res.status(500).json({ error: "Internal server error" });
    }
});

// ── Plan limits info ───────────────────────────────────────────────

router.get('/limits', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const currentCount = await MonitoringService.countUserMonitors(req.user.uid);
        const config = req.user.config;
        res.json({
            monitorLimit: config.monitorLimit,
            subredditsPerMonitor: config.subredditsPerMonitor,
            currentMonitorCount: currentCount,
            canCreateMonitor: config.monitorLimit === -1 || currentCount < config.monitorLimit,
        });
    } catch (err: unknown) {
        logger.error(err, 'Request failed'); res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
