import { Router, Request, Response } from 'express';
import { getPlanConfig, getDb, getUserStats } from '../firestore.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        const stats = await getUserStats(req.user.uid);
        res.json(stats);
    } catch (err: unknown) {
        logger.error({ err }, 'GET /api/user/stats failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/plan', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            const freeConfig = await getPlanConfig('free');
            return void res.json({ plan: 'free', authenticated: false, config: freeConfig });
        }

        const db = getDb();
        let monitorCount = 0;
        let totalLeads = 0;

        if (db) {
            const monitorSnap = await db.collection('folders')
                .where('uid', '==', req.user.uid)
                .where('is_monitoring_active', '==', true)
                .get();
            monitorCount = monitorSnap.size;

            const leadCounts = await Promise.all(
                monitorSnap.docs.map(async (doc) => {
                    const leadsSnap = await db.collection('folders').doc(doc.id).collection('leads').get();
                    return leadsSnap.size;
                })
            );
            totalLeads = leadCounts.reduce((sum, c) => sum + c, 0);
        }

        res.json({
            plan: req.user.plan,
            authenticated: true,
            config: req.user.config,
            usage: {
                ...req.user.usage,
                monitorCount,
                totalSubreddits: 0,
                leadsFound: totalLeads,
                newLeadsCount: 0,
            },
        });
    } catch (err: unknown) {
        logger.error({ err }, 'GET /api/user/plan failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
