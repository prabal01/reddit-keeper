import { Router, Request, Response } from 'express';
import {
    getFolders,
    getFolder,
    createFolder,
    deleteFolder,
    saveThreadToFolder,
    getThreadsInFolder,
    getFolderAnalyses,
    updateFolderSyncStatus,
    updateFolderAnalysisStatus,
    incrementPendingSyncCount,
    createPlaceholderThread,
    updateThreadInsight,
    getDb,
    getPatternsInFolder,
    getLeadsInFolder,
    getMonitoringAlerts,
    type SavedThread,
} from '../firestore.js';
import { PullPushService } from '../discovery/pullpush.service.js';
import { ArcticShiftService } from '../discovery/arctic-shift.service.js';

const pullPushService = new PullPushService();
const arcticShiftService = new ArcticShiftService();
const extractRedditId = (url: string) => url?.match(/comments\/([a-z0-9]+)/)?.[1] ?? null;
import { authMiddleware } from '../middleware/auth.js';
import { usageGuard } from '../middleware/usageGuard.js';
import { granularAnalysisQueue, syncQueue } from '../queues.js';
import { countComments } from '../../reddit/tree-builder.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ── CRUD ──────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        const folders = await getFolders(req.user.uid);
        res.json(folders);
    } catch (err: unknown) {
        logger.error({ err }, 'GET /api/folders failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    const { name, description } = req.body;
    if (!name) return void res.status(400).json({ error: 'Folder name is required' });
    try {
        const folder = await createFolder(req.user.uid, name, description);
        res.json(folder);
    } catch (err: unknown) {
        logger.error({ err }, 'POST /api/folders failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id', async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        await deleteFolder(req.user.uid, req.params.id as string);
        res.json({ success: true });
    } catch (err: unknown) {
        logger.error({ err }, 'DELETE /api/folders/:id failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.patch('/:id/deactivate', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        const db = getDb();
        if (!db) return void res.status(500).json({ error: 'Database unavailable' });
        const ref = db.collection('folders').doc(req.params.id as string);
        const doc = await ref.get();
        if (!doc.exists || doc.data()?.uid !== req.user.uid) {
            return void res.status(404).json({ error: 'Monitor not found' });
        }
        await ref.update({ is_monitoring_active: false });
        res.json({ success: true });
    } catch (err: unknown) {
        logger.error({ err }, 'PATCH /api/folders/:id/deactivate failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Thread Management ──────────────────────────────────────────────

router.post('/:id/threads', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    const { threadData } = req.body;
    if (!threadData?.post?.id) return void res.status(400).json({ error: 'Invalid thread data' });
    try {
        await saveThreadToFolder(req.user.uid, req.params.id as string, threadData);

        const folderId = req.params.id as string;
        const folder = await getFolder(req.user.uid, folderId);
        let analysisRunId = folder?.currentAnalysisRunId;
        if (!analysisRunId || folder?.analysisStatus !== 'processing') {
            analysisRunId = `auto_${Date.now()}`;
            await updateFolderAnalysisStatus(req.user.uid, folderId, 'processing', analysisRunId);
        }

        const threadId = threadData.id || threadData.post?.id;
        await granularAnalysisQueue.add('granular-analyze', {
            threadId,
            url: threadData.source || threadData.post?.url,
            folderId,
            userUid: req.user.uid,
            title: threadData.title || threadData.post?.title,
            subreddit: threadData.subreddit || threadData.post?.subreddit,
            analysisRunId
        });

        res.json({ success: true });
    } catch (err: unknown) {
        logger.error({ err }, 'POST /api/folders/:id/threads failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:id/threads', async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        if (req.params.id as string === 'inbox') {
            const { listExtractions } = await import('../firestore.js');
            const extractions = await listExtractions(req.user.uid);
            const threads: SavedThread[] = extractions.map(ext => {
                const commentCount = ext.commentCount || (ext.content?.comments
                    ? countComments(ext.content.comments)
                    : (ext.content?.flattenedComments?.length || 0));
                return {
                    id: ext.id,
                    folderId: 'inbox',
                    uid: req.user!.uid,
                    title: ext.title,
                    author: ext.content?.post?.author || ext.post?.author || ext.content?.author || 'Unknown',
                    subreddit: ext.content?.post?.subreddit || ext.post?.subreddit || ext.source,
                    commentCount,
                    source: ext.source,
                    savedAt: ext.extractedAt,
                    data: {
                        post: ext.content?.post || ext.post || { title: ext.title },
                        content: ext.content,
                        metadata: { fetchedAt: ext.extractedAt, source: ext.source }
                    }
                };
            });
            return void res.json(threads);
        }

        const folderId = req.params.id as string;
        const uid = req.user.uid;
        const [threads, folder] = await Promise.all([
            getThreadsInFolder(uid, folderId),
            getFolder(uid, folderId)
        ]);

        // AUTO-RECOVERY: Re-queue stale (>5 min) processing threads
        const STALE_MS = 5 * 60 * 1000;
        const now = Date.now();
        const recoveryJobs: any[] = [];
        const recoveryRunId = folder?.currentAnalysisRunId || `auto_${now}`;

        for (const thread of threads) {
            const isStuck = thread.analysisStatus === 'pending' || thread.analysisStatus === 'processing';
            const triggerTime = thread.analysisTriggeredAt || thread.savedAt
                ? new Date(thread.analysisTriggeredAt || thread.savedAt).getTime()
                : 0;
            if (isStuck && (now - triggerTime > STALE_MS)) {
                await updateThreadInsight(uid, folderId, {
                    id: thread.id, folderId, uid,
                    threadLink: thread.source, status: 'processing'
                });
                recoveryJobs.push({
                    name: 'granular-analyze',
                    data: { threadId: thread.id, url: thread.source, folderId, userUid: uid, title: thread.title, subreddit: thread.subreddit, analysisRunId: recoveryRunId }
                });
            }
        }

        if (recoveryJobs.length > 0) {
            if (!folder?.currentAnalysisRunId) {
                await updateFolderAnalysisStatus(uid, folderId, 'processing', recoveryRunId);
            }
            await granularAnalysisQueue.addBulk(recoveryJobs);
        }

        res.json({
            threads,
            meta: {
                painPointCount: folder?.painPointCount || 0,
                triggerCount: folder?.triggerCount || 0,
                outcomeCount: folder?.outcomeCount || 0,
                intelligence_signals: folder?.intelligence_signals,
                totalAnalysisCount: folder?.totalAnalysisCount || 0,
                completedAnalysisCount: folder?.completedAnalysisCount || 0,
                failedCount: folder?.failedCount || 0,
                analysisStatus: folder?.analysisStatus
            }
        });
    } catch (err: unknown) {
        logger.error({ err }, 'GET /api/folders/:id/threads failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/:id/sync', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    const { urls, items } = req.body;
    const folderId = req.params.id as string;
    const hasUrls = Array.isArray(urls) && urls.length > 0;
    const hasItems = Array.isArray(items) && items.length > 0;
    if (!hasUrls && !hasItems) return void res.status(400).json({ error: 'Invalid URLs or Items provided' });

    const payloadList = hasItems ? items : urls.map((url: string) => ({ url }));
    try {
        await updateFolderSyncStatus(req.user.uid, folderId, 'syncing');
        await incrementPendingSyncCount(req.user.uid, folderId, payloadList.length);
        await Promise.all(payloadList.map((item: any) =>
            createPlaceholderThread(req.user!.uid, folderId, item.url, item)
        ));
        const priority = req.user.plan === 'free' ? 10 : 3;
        const jobs = payloadList.map((item: any) => ({
            name: 'sync',
            data: { url: item.url, folderId, userUid: req.user!.uid },
            opts: { priority }
        }));
        await syncQueue.addBulk(jobs);
        res.json({ success: true, count: payloadList.length });
    } catch (err: unknown) {
        logger.error({ err, folderId }, 'POST /api/folders/:id/sync failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Folder Metadata ───────────────────────────────────────────────

router.post('/:id/status', async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        await updateFolderAnalysisStatus(req.user.uid, req.params.id as string, req.body.status);
        res.json({ success: true });
    } catch (err: unknown) {
        logger.error({ err }, 'POST /api/folders/:id/status failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:id/patterns', async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        const patterns = await getPatternsInFolder(req.user.uid, req.params.id as string);
        res.json(patterns);
    } catch (err: unknown) {
        logger.error({ err }, 'GET /api/folders/:id/patterns failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:id/leads', async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        const leads = await getLeadsInFolder(req.user.uid, req.params.id as string);
        res.json(leads);
    } catch (err: unknown) {
        logger.error({ err }, 'GET /api/folders/:id/leads failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/:id/leads/backfill-authors', async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        const db = getDb();
        if (!db) throw new Error('DB not initialized');
        const folderId = req.params.id as string;

        // Verify ownership
        const folderDoc = await db.collection('folders').doc(folderId).get();
        if (!folderDoc.exists || folderDoc.data()?.uid !== req.user.uid) {
            return void res.status(403).json({ error: 'Forbidden' });
        }

        // Fetch all leads missing an author
        const leadsSnap = await db.collection('folders').doc(folderId).collection('leads').get();
        const leadsToFix = leadsSnap.docs.filter(d => {
            const author = d.data().author;
            return !author || author === 'unknown';
        });

        if (leadsToFix.length === 0) {
            return void res.json({ updated: 0, message: 'All leads already have authors' });
        }

        // Build id → doc map
        const idToDoc = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
        for (const doc of leadsToFix) {
            const id = extractRedditId(doc.data().thread_url || '');
            if (id) idToDoc.set(id, doc);
        }

        const idsToEnrich = Array.from(idToDoc.keys());
        const resolvedIds = new Set<string>();
        const authorMap = new Map<string, string>(); // shortId → author

        // Step A: PullPush
        if (idsToEnrich.length > 0) {
            const ppResults = await pullPushService.getSubmissionsByIds(idsToEnrich);
            for (const item of ppResults) {
                if (item.author && item.author !== 'unknown') {
                    authorMap.set(item.id, item.author);
                    resolvedIds.add(item.id);
                }
            }
        }

        // Step B: Arctic Shift for any missed
        const stillUnresolved = idsToEnrich.filter(id => !resolvedIds.has(id));
        if (stillUnresolved.length > 0) {
            const asResults = await arcticShiftService.getPostsByIds(stillUnresolved);
            for (const item of asResults) {
                if (item.author && item.author !== 'unknown') {
                    authorMap.set(item.id, item.author);
                    resolvedIds.add(item.id);
                }
            }
        }

        // Write updates to Firestore
        const batch = db.batch();
        let updated = 0;
        for (const [shortId, author] of authorMap.entries()) {
            const doc = idToDoc.get(shortId);
            if (doc) {
                batch.update(doc.ref, { author });
                updated++;
            }
        }
        if (updated > 0) await batch.commit();

        res.json({ updated, total: leadsToFix.length });
    } catch (err: unknown) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:id/alerts', async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        const alerts = await getMonitoringAlerts(req.user.uid, req.params.id as string);
        res.json(alerts);
    } catch (err: unknown) {
        logger.error({ err }, 'GET /api/folders/:id/alerts failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.patch('/:id/leads/:leadId', async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        const folderId = req.params.id as string;
        const leadId = req.params.leadId as string;
        const { status } = req.body;
        if (!['new', 'contacted', 'ignored'].includes(status)) {
            return void res.status(400).json({ error: 'Invalid status' });
        }
        const db = getDb();
        if (!db) throw new Error('DB not initialized');
        const folderDoc = await db.collection('folders').doc(folderId).get();
        if (!folderDoc.exists || folderDoc.data()?.uid !== req.user.uid) {
            return void res.status(403).json({ error: 'Forbidden' });
        }
        await db.collection('folders').doc(folderId).collection('leads').doc(leadId).update({ status });
        res.json({ success: true });
    } catch (err: unknown) {
        logger.error({ err }, 'PATCH /api/folders/:id/leads/:leadId failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Analysis ──────────────────────────────────────────────────────

function redactAnalysis(data: any): any {
    const redacted = { ...data, market_attack_summary: data.market_attack_summary };
    redacted.locked_counts = {
        pain_points: data.high_intensity_pain_points?.length || 0,
        triggers: data.switch_triggers?.length || 0,
        gaps: data.feature_gaps?.length || 0,
        roadmap: data.ranked_build_priorities?.length || 0
    };
    if (data.high_intensity_pain_points) {
        redacted.high_intensity_pain_points = data.high_intensity_pain_points.map(() => ({
            title: 'Locked Pain Point',
            context_quote: 'Unlock the Pro plan to see full details of this high-intensity pain point.'
        }));
    }
    if (data.switch_triggers) {
        redacted.switch_triggers = data.switch_triggers.map(() => ({
            title: 'Locked Switch Trigger',
            context_quote: 'This switching trigger is available on the Pro plan.'
        }));
    }
    if (data.feature_gaps) {
        redacted.feature_gaps = data.feature_gaps.map((f: any) => ({
            ...f, missing_or_weak_feature: 'Locked Feature Deficiency',
            context_summary: 'Unlock to see specific feature gaps and demand signals.', isLocked: true
        }));
    }
    if (data.competitive_weakness_map) {
        redacted.competitive_weakness_map = data.competitive_weakness_map.map((w: any) => ({
            ...w, competitor: 'Locked Competitor', perceived_weakness: 'Hidden',
            exploit_opportunity: 'This strike plan is exclusive to Pro users.', isLocked: true
        }));
    }
    if (data.ranked_build_priorities) {
        redacted.ranked_build_priorities = data.ranked_build_priorities.map((b: any) => ({
            ...b, initiative: 'Locked Strategy Initiative',
            justification: 'Unlock to see the full reasoning for this roadmap priority.', isLocked: true
        }));
    }
    if (data.messaging_and_positioning_angles) {
        redacted.messaging_and_positioning_angles = data.messaging_and_positioning_angles.map((m: any) => ({
            ...m, angle: 'Locked Messaging Angle',
            supporting_emotional_driver: 'This emotional lever is available on the Pro plan.',
            supporting_evidence_quotes: ['Locked...'], isLocked: true
        }));
    }
    if (data.risk_flags) {
        redacted.risk_flags = data.risk_flags.map((r: any) => ({
            ...r, risk: 'Locked Risk',
            evidence_basis: 'Unlock to see intelligence risks and validation signals.', isLocked: true
        }));
    }
    redacted.isLocked = true;
    return redacted;
}

router.post('/:id/analyze', authMiddleware, usageGuard('ANALYSIS'), async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        const folderId = req.params.id as string;
        const folder = folderId === 'inbox'
            ? { id: 'inbox', name: 'Inbox' }
            : await getFolder(req.user.uid, folderId);

        if (!folder) return void res.status(404).json({ error: 'Folder not found' });

        const firestore = await import('../firestore.js');
        const signals = await firestore.getFolderIntelligenceSignals(req.user.uid, folderId);
        const totalSignals = signals.painPoints.length + signals.triggers.length + signals.outcomes.length;
        if (totalSignals === 0) {
            return void res.status(400).json({ error: 'No analyzed insights found. Please analyze some threads first.' });
        }

        const { ClusterEngine } = await import('../clustering.js');
        const engine = new ClusterEngine(folderId, req.user.uid);
        const painPoints = await engine.aggregate(signals.painPoints, 'pain_point');
        const triggers = await engine.aggregate(signals.triggers, 'switch_trigger');
        const outcomes = await engine.aggregate(signals.outcomes, 'desired_outcome');

        const allClusters = [...painPoints, ...triggers, ...outcomes];
        await firestore.saveAggregatedInsights(folderId, allClusters);

        const { synthesizeReport } = await import('../ai.js');
        const uniqueThreadIds = new Set([
            ...signals.painPoints.map((s: any) => s.thread_id),
            ...signals.triggers.map((s: any) => s.thread_id),
            ...signals.outcomes.map((s: any) => s.thread_id)
        ]);
        const totalThreads = uniqueThreadIds.size;
        const totalComments = (folder as any)?.metrics?.commentsAnalyzed || 0;
        const synthesisResult = await synthesizeReport({ painPoints, triggers, outcomes }, totalThreads, totalComments);

        if (synthesisResult.usage) {
            const inputTokens = synthesisResult.usage.promptTokenCount || 0;
            const outputTokens = synthesisResult.usage.candidatesTokenCount || 0;
            await firestore.updateUserAicost(req.user.uid, {
                totalInputTokens: inputTokens,
                totalOutputTokens: outputTokens,
                totalAiCost: (inputTokens / 1_000_000) * 0.0375 + (outputTokens / 1_000_000) * 0.15
            });
        }

        const injectContext = (llmTitles: string[] | undefined, clusters: any[]) => {
            if (!llmTitles) return [];
            return llmTitles.map(title => {
                const matchedCluster = clusters.find(c => c.canonicalTitle === title);
                const firstInsight = matchedCluster?.rawInsights?.find((i: any) => i.quotes?.length > 0);
                return { title, context_quote: firstInsight?.quotes[0] || '' };
            });
        };

        const injectPriorityContext = (priorities: any[] | undefined, clusters: any[]) => {
            if (!priorities) return [];
            return priorities.map(p => {
                const cleanInitiative = (p.source_title || p.initiative || '').toLowerCase().trim();
                const matchedCluster = clusters.find(c => (c.canonicalTitle || '').toLowerCase().trim() === cleanInitiative);
                const firstInsight = matchedCluster?.rawInsights?.find((i: any) => i.quotes?.length > 0);
                return { ...p, context_quote: firstInsight?.quotes[0] || '' };
            });
        };

        const finalReport = {
            ...synthesisResult.parsedResult,
            ranked_build_priorities: injectPriorityContext(synthesisResult.parsedResult.ranked_build_priorities, painPoints),
            high_intensity_pain_points: injectContext(synthesisResult.parsedResult.high_intensity_pain_points, painPoints),
            top_switch_triggers: injectContext(synthesisResult.parsedResult.top_switch_triggers, triggers),
            top_desired_outcomes: injectContext(synthesisResult.parsedResult.top_desired_outcomes, outcomes),
            metadata: {
                ...synthesisResult.parsedResult.metadata,
                total_threads: totalThreads,
                total_comments: totalComments,
                generated_at: new Date().toISOString()
            }
        };

        await firestore.saveAnalysis(req.user.uid, folderId, finalReport, 'gemini-2.0-flash', synthesisResult.usage);
        await firestore.incrementAnalysisCount(req.user.uid);

        res.json({ success: true, folderId, aggregates: { painPoints, triggers, outcomes }, synthesis: finalReport });
    } catch (err: unknown) {
        logger.error({ err }, 'POST /api/folders/:id/analyze failed');
        res.status(500).json({ error: 'Failed to aggregate insights' });
    }
});

router.get('/:id/analysis', async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        const analyses = await getFolderAnalyses(req.user.uid, req.params.id as string);
        const isFree = req.user.plan === 'free';
        const flattened = analyses.map(a => {
            let cleanData = { ...a.data };
            if (isFree) cleanData = redactAnalysis(cleanData);
            return { ...cleanData, id: a.id, createdAt: a.createdAt || new Date().toISOString() };
        });
        res.json(flattened);
    } catch (err: unknown) {
        logger.error({ err }, 'GET /api/folders/:id/analysis failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
