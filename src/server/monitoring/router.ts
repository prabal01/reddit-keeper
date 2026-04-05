import { Router, Request, Response } from 'express';
import { MonitoringService } from './service.js';
import { authMiddleware } from '../middleware/auth.js';
import { monitoringScraperQueue } from './worker.js';
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
    
    // For V1, we'll allow any authenticated user to trigger a sync for testing
    // but in production, we should limit this.
    try {
        logger.info({ action: 'MONITORING_MANUAL_SYNC', uid: req.user.uid }, `Manual sync triggered`);
        await monitoringScraperQueue.add("manual-sync", { triggeredBy: req.user.uid });
        res.json({ success: true, message: "Sync enqueued" });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── Subreddit Suggestions ──────────────────────────────────────────

router.post('/suggestions', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { context } = req.body;
    
    if (!context) return res.status(400).json({ error: 'Context required' });

    try {
        const { DiscoveryOrchestrator } = await import('../discovery/orchestrator.js');
        const orchestrator = new DiscoveryOrchestrator();
        const { intent, queries } = await (orchestrator as any).discoveryBrain.expandIdeaToQueries(context, [], [], 3);
        
        // Use the expanded intent to mock/suggest subreddits
        // For V1, we'll return a static-ish list based on the domain analysis
        // In a real version, we'd search Reddit for these keywords to find related subreddits.
        const suggestions = [
            { name: "saas", members: "1.2M", signal: "High" },
            { name: "startup", members: "4.5M", signal: "Medium" },
            { name: "entrepreneur", members: "2.1M", signal: "High" },
            { name: "productivity", members: "3.4M", signal: "Medium" }
        ];

        res.json(suggestions);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
