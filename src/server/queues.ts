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
import { analyzeThreadGranular, analyzeThreads } from "./ai.js";
import { sendAlert } from "./alerts.js";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
export const discoveryOrchestrator = new DiscoveryOrchestrator();

export const sharedConnectionConfig = {
    url: redisUrl,
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

// ── BullMQ Workers ────────────────────────────────────────────────

export const syncWorker = new Worker("reddit-sync", async (job) => {
    const { url, folderId, userUid } = job.data;
    console.log(`[SyncWorker] Processing thread: ${url} for folder: ${folderId}`);

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
    } catch (err: any) {
        console.error(`[SyncWorker] Failed to sync ${url}:`, err.message);
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

    } catch (err: any) {
        console.error(`[GranularWorker] Failed for ${threadDocId}:`, err.message);
        await updateThreadInsight(userUid, folderId, {
            id: threadDocId,
            folderId,
            uid: userUid,
            threadLink: url,
            status: 'failed',
            error: err.message
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
            console.error(`[GranularWorker] Error in finally block for ${threadId}:`, finalErr);
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
    } catch (err: any) {
        console.error(`[Worker] Failed analysis for ${folderId}:`, err);
        throw err;
    }
}, {
    connection: sharedConnectionConfig,
    concurrency: 2
});

console.log("[INIT] BullMQ Queues and Workers initialized in standalone module.");
