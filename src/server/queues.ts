import { Queue, Worker } from "bullmq";
import crypto from "crypto";
import { 
    saveThreadToFolder, 
    getFolder, 
    updateFolderAnalysisStatus, 
    incrementPendingSyncCount,
    updateThreadInsight,
    getThreadsInFolder,
    updateStats, 
    saveAnalysis,
    getAdminStorage,
    getDb
} from "./firestore.js";
import { DiscoveryOrchestrator } from "./discovery/orchestrator.js";
import { analyzeThreadGranular, analyzeThreads, analyzeDiscoveryBatch } from "./ai.js";
import { sendAlert } from "./alerts.js";
import { config } from "./config.js";
import { errMsg } from "./utils/errors.js";
import { logger } from "./utils/logger.js";
export const discoveryOrchestrator = new DiscoveryOrchestrator();

export const sharedConnectionConfig = {
    url: config.redisUrl,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
};

// ── Shared BullMQ Queues ──────────────────────────────────────────

export const analysisQueue = new Queue("analysis", {
    connection: sharedConnectionConfig,
    defaultJobOptions: {
        removeOnComplete: { count: 100, age: 24 * 3600 },
        removeOnFail: { count: 1000, age: 7 * 24 * 3600 },
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 }
    }
});

export const syncQueue = new Queue("reddit-sync", {
    connection: sharedConnectionConfig,
    defaultJobOptions: {
        removeOnComplete: { count: 50, age: 3600 },
        removeOnFail: { count: 100, age: 24 * 3600 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 }
    }
});

export const granularAnalysisQueue = new Queue("granular-analysis", {
    connection: sharedConnectionConfig,
    defaultJobOptions: {
        removeOnComplete: { count: 100, age: 3600 },
        removeOnFail: { count: 100, age: 24 * 3600 },
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 }
    }
});

export const monitoringCronQueue = new Queue("monitoring-cron", {
    connection: sharedConnectionConfig,
    defaultJobOptions: {
        removeOnComplete: { count: 50, age: 7 * 24 * 3600 },
        removeOnFail: { count: 50, age: 7 * 24 * 3600 },
        attempts: 2,
    }
});

// ── BullMQ Workers ────────────────────────────────────────────────

export const syncWorker = new Worker("reddit-sync", async (job) => {
    const { url, folderId, userUid } = job.data;
    logger.info(`[SyncWorker] Processing thread: ${url} for folder: ${folderId}`);

    try {
        const source: 'reddit' | 'hn' = url.includes('news.ycombinator.com') ? 'hn' : 'reddit';
        const fullData = await discoveryOrchestrator.fetchFullThread(url, source);

        if (!fullData) throw new Error(`Failed to fetch thread data from ${source.toUpperCase()}`);

        await saveThreadToFolder(userUid, folderId, fullData);
        
        const folder = await getFolder(userUid, folderId);
        const analysisRunId = folder?.currentAnalysisRunId || `auto_${Date.now()}`;
        await updateFolderAnalysisStatus(userUid, folderId, 'processing', analysisRunId);

        const finalThreadId = crypto.createHash('md5').update(url).digest('hex').substring(0, 16);
        await granularAnalysisQueue.add("granular-analyze", {
            threadId: finalThreadId,
            url: url,
            folderId,
            userUid,
            title: fullData.title || fullData.post?.title,
            subreddit: fullData.subreddit || fullData.post?.subreddit,
            analysisRunId
        });
    } catch (err: unknown) {
        logger.error({ err, url }, "[SyncWorker] Failed to sync thread");
        throw err;
    } finally {
        await incrementPendingSyncCount(userUid, folderId, -1);
    }
}, {
    connection: sharedConnectionConfig,
    concurrency: 1,
    limiter: { max: 1, duration: 1000 },
    drainDelay: 5,
    stalledInterval: 30000
});

export const granularAnalysisWorker = new Worker("granular-analysis", async (job) => {
    const { threadId, url, folderId, userUid } = job.data;
    const threadDocId = crypto.createHash('md5').update(url).digest('hex').substring(0, 16);

    try {
        await updateThreadInsight(userUid, folderId, {
            id: threadDocId,
            folderId,
            uid: userUid,
            threadLink: url,
            status: 'processing'
        });

        const threads = await getThreadsInFolder(userUid, folderId);
        const thread = threads.find(t => t.id === threadDocId);

        if (!thread) throw new Error(`Thread ${threadId} not found in folder ${folderId}`);

        let comments = (thread.data as any)?.comments || [];
        if (thread.storageUrl && comments.length === 0) {
            const url = new URL(thread.storageUrl);
            const pathWithV0 = url.pathname.split('/o/')[1].split('?')[0];
            const filePath = decodeURIComponent(pathWithV0);
            const [fileContents] = await getAdminStorage().bucket().file(filePath).download();
            const contentJson = JSON.parse(fileContents.toString());
            comments = contentJson.flattenedComments || contentJson.comments || contentJson.reviews || [];
        }

        const analysisPromise = analyzeThreadGranular({
            id: threadDocId,
            title: thread.title,
            subreddit: thread.subreddit,
            comments: comments
        });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("AI Analysis timed out after 2 minutes")), 120000)
        );

        const insights = await Promise.race([analysisPromise, timeoutPromise]) as any;

        await updateThreadInsight(userUid, folderId, {
            id: threadDocId,
            folderId,
            uid: userUid,
            threadLink: url || thread.source,
            status: 'success',
            insights
        });

        (job.data as any).completedInsights = insights;

    } catch (err: unknown) {
        logger.error({ err, threadDocId }, "[GranularWorker] Failed to process thread");
        await updateThreadInsight(userUid, folderId, {
            id: threadDocId,
            folderId,
            uid: userUid,
            threadLink: url,
            status: 'failed',
            error: errMsg(err)
        });
        throw err;
    } finally {
        try {
            const db = getDb();
            const folderRef = db.collection("folders").doc(folderId);
            const trackerRef = folderRef.collection("completed_threads").doc(threadDocId);
            const { analysisRunId } = job.data;

            await db.runTransaction(async (transaction) => {
                const folderDoc = await transaction.get(folderRef);
                if (!folderDoc.exists) return;

                const data = folderDoc.data() || {};
                if (!analysisRunId || data.currentAnalysisRunId !== analysisRunId) return;

                const trackerDoc = await transaction.get(trackerRef);
                if (trackerDoc.exists) return;

                const newCompleted = (data.completedAnalysisCount || 0) + 1;
                const newPending = Math.max(0, (data.pendingAnalysisCount || 0) - 1);

                const update: any = {
                    completedAnalysisCount: newCompleted,
                    pendingAnalysisCount: newPending
                };

                if (newPending <= 0) {
                    update.analysisStatus = 'idle';
                    update.pendingAnalysisCount = 0;
                }

                transaction.set(trackerRef, {
                    completedAt: new Date(),
                    insights: job.data.completedInsights || null
                });
                transaction.update(folderRef, update);
            });
        } catch (finalErr) {
            logger.error({ err: finalErr, threadId }, "[GranularWorker] Error in finally block");
        }
    }
}, {
    connection: sharedConnectionConfig,
    concurrency: 3,
    drainDelay: 5,
    stalledInterval: 30000
});

export const analysisWorker = new Worker("analysis", async (job) => {
    const { threadsContext, folderContext, userUid, folderId, totalComments, threadCount } = job.data;

    try {
        const resolvedThreads = await Promise.all(threadsContext.map(async (t: any) => {
            if (t.storageUrl && !t.comments) {
                try {
                    const url = new URL(t.storageUrl);
                    const pathWithV0 = url.pathname.split('/o/')[1].split('?')[0];
                    const filePath = decodeURIComponent(pathWithV0);
                    const [fileContents] = await getAdminStorage().bucket().file(filePath).download();
                    const contentJson = JSON.parse(fileContents.toString());
                    let comments = contentJson.flattenedComments || contentJson.comments || contentJson.reviews || [];
                    if (comments.length === 0 && contentJson.content) {
                        comments = contentJson.content.flattenedComments || contentJson.content.comments || contentJson.content.reviews || [];
                    }
                    return { ...t, comments };
                } catch (fetchErr) {
                    return t;
                }
            }
            return t;
        }));

        const { analysis, usage } = await analyzeThreads(resolvedThreads, folderContext, totalComments);
        const parsedResult = { ...analysis, createdAt: new Date().toISOString() };

        await saveAnalysis(userUid, folderId, parsedResult, "gemini-2.0-flash", usage);
        await updateStats(userUid, {
            reportsGenerated: 1,
            intelligenceScanned: threadCount,
            commentsAnalyzed: totalComments,
            hoursSaved: parseFloat((threadCount * 5 / 60).toFixed(1))
        });

        return parsedResult;
    } catch (err: unknown) {
        logger.error({ err, folderId }, "[Worker] Failed analysis");
        throw err;
    }
}, {
    connection: sharedConnectionConfig,
    concurrency: 2
});

export const monitoringCronWorker = new Worker("monitoring-cron", async () => {
    const db = getDb();
    if (!db) {
        logger.error("[MonitoringWorker] Firebase DB not initialized.");
        return;
    }

    try {
        logger.info(`[MonitoringWorker] Starting cron cycle at ${new Date().toISOString()}`);
        const snapshot = await db.collection("folders")
            .where("is_monitoring_active", "==", true)
            .get();

        if (snapshot.empty) {
            logger.info("[MonitoringWorker] No active monitoring folders found. Skipping.");
            return;
        }

        for (const doc of snapshot.docs) {
            const folder = doc.data();
            const folderId = doc.id;
            const uid = folder.uid;
            
            // Prefer seed_keywords, fallback to folder name if missing
            const keyword = (folder.seed_keywords && folder.seed_keywords.length > 0) 
                ? folder.seed_keywords[0] 
                : folder.name;

            logger.info(`[MonitoringWorker] Checking delta for folder: ${folderId} | Keyword: ${keyword}`);

            // 1. Fetch current Leads to form the "seen" list
            const leadsSnap = await db.collection("folders").doc(folderId).collection("leads").get();
            const seenThreadIds = new Set<string>();
            leadsSnap.forEach(leadDoc => {
                const leadData = leadDoc.data();
                if (leadData.thread_id) seenThreadIds.add(leadData.thread_id);
                if (leadData.thread_url) seenThreadIds.add(leadData.thread_url);
            });

            // 2. Fetch new threads via Orchestrator
            // Using logic similar to discovery/start endpoint (fetch top 30)
            const plan = 'free'; // Cron runs globally; assume base features or pull from user doc if needed
            const discoveryResp = await discoveryOrchestrator.ideaDiscovery(uid, keyword, [], [], false, plan);
            const topResults = discoveryResp.results.slice(0, 30);
            
            // 3. Delta Filter
            const newThreadsBatch = topResults.filter(r => {
                const id = typeof r.id === 'string' ? r.id : r.url;
                return !seenThreadIds.has(id) && !seenThreadIds.has(r.url);
            }).slice(0, 15); // Cap to top 15 new ones for AI batching limits
            
            if (newThreadsBatch.length === 0) {
                logger.info(`[MonitoringWorker] No new unseen threads for folder: ${folderId}.`);
                // Record a "no new data" alert so the user knows the agent checked
                const noNewAlertRef = db.collection("folders").doc(folderId).collection("alerts").doc();
                await noNewAlertRef.set({
                    id: noNewAlertRef.id,
                    folderId,
                    uid,
                    type: 'discovery',
                    newLeadsCount: 0,
                    newPatternsCount: 0,
                    timestamp: new Date().toISOString(),
                    status: 'no_new',
                    keyword
                });
                continue;
            }

            logger.info(`[MonitoringWorker] Found ${newThreadsBatch.length} new threads for folder: ${folderId}. Passing to AI.`);

            // Fetch actual thread content for each result (r.url is just the URL, not content)
            const threadBatch: { id: string; title: string; text: string }[] = [];
            for (const r of newThreadsBatch) {
                try {
                    const fullThread = await discoveryOrchestrator.fetchFullThread(r.url, r.source as 'reddit' | 'hn');
                    const selftext = fullThread?.post?.selftext || fullThread?.post?.text || '';
                    const commentText = (fullThread?.comments || [])
                        .slice(0, 10)
                        .map((c: any) => c.body || c.text)
                        .filter(Boolean)
                        .join('\n');
                    threadBatch.push({
                        id: typeof r.id === 'string' ? r.id : r.url,
                        title: r.title,
                        text: selftext + (commentText ? '\n---\nTop Comments:\n' + commentText : '')
                    });
                } catch (err: unknown) {
                    logger.info(`[MonitoringWorker] Failed to fetch full thread for ${r.url}: ${errMsg(err)}. Using title as fallback.`);
                    threadBatch.push({
                        id: typeof r.id === 'string' ? r.id : r.url,
                        title: r.title,
                        text: r.title
                    });
                }
            }

            // 4. AI Processing
            const insights = await analyzeDiscoveryBatch(keyword, threadBatch);

            // 5. Update CRM Data
            const batch = db.batch();
            let newLeadsCount = 0;
            const newPatternsCount = insights.patterns?.length || 0;
            
            if (insights.patterns && Array.isArray(insights.patterns)) {
                insights.patterns.forEach((pattern: any) => {
                    const patternRef = db.collection("folders").doc(folderId).collection("patterns").doc();
                    batch.set(patternRef, {
                        ...pattern,
                        id: patternRef.id,
                        folderId: folderId,
                        createdAt: new Date().toISOString()
                    });
                });
            }

            if (insights.opportunities && Array.isArray(insights.opportunities)) {
                insights.opportunities.forEach((opp: any) => {
                    newLeadsCount++;
                    const originalThread = newThreadsBatch.find(r => (typeof r.id === 'string' ? r.id : r.url) === opp.thread_id);
                    const leadId = db.collection("folders").doc(folderId).collection("leads").doc().id;
                    
                    const leadRef = db.collection("folders").doc(folderId).collection("leads").doc(leadId);
                    const intentMarkers = [...new Set([
                        ...(opp.intent_category ? [opp.intent_category] : []),
                        ...(originalThread?.intentMarkers || [])
                    ])];
                    batch.set(leadRef, {
                        ...opp,
                        id: leadId,
                        folderId: folderId,
                        uid,
                        status: "new",
                        saved_at: new Date().toISOString(),
                        thread_url: originalThread?.url || opp.thread_id,
                        thread_title: originalThread?.title || "Unknown Thread",
                        author: originalThread?.author || 'unknown',
                        subreddit: originalThread?.subreddit || '',
                        relevance_score: opp.relevance_score || 0,
                        intent_markers: intentMarkers,
                    });
                });
            }

            // 6. Save alert record for the feed
            const alertRef = db.collection("folders").doc(folderId).collection("alerts").doc();
            batch.set(alertRef, {
                id: alertRef.id,
                folderId,
                uid,
                type: 'discovery',
                newLeadsCount,
                newPatternsCount,
                timestamp: new Date().toISOString(),
                status: 'success',
                keyword
            });

            if (newLeadsCount > 0 || newPatternsCount > 0) {
                batch.update(doc.ref, {
                    threadCount: (folder.threadCount || 0) + newLeadsCount
                });
            }
            await batch.commit();
            logger.info(`[MonitoringWorker] Updated folder ${folderId} with ${newLeadsCount} new leads, ${newPatternsCount} new patterns.`);
        }
    } catch (err: unknown) {
        logger.error({ err }, "[MonitoringWorker] Cron execution failed");
    }
}, {
    connection: sharedConnectionConfig,
    concurrency: 1
});

// Automatically inject the recurring job into the queue
monitoringCronQueue.add("monitor", {}, {
    repeat: {
        pattern: "0 */12 * * *" // Every 12 hours
    }
}).catch(err => {
    logger.error({ err }, "[MonitoringWorker] Failed to inject recurring job");
});

logger.info("[INIT] BullMQ Queues and Workers initialized in standalone module.");
