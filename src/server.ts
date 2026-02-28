
import "dotenv/config";
import express from "express";
import cors from "cors";
// Queue definitions removed (replaced by BullMQ)
import { countComments } from "./reddit/tree-builder.js";
import {
    Comment,
} from "./reddit/types.js";
import { minifyComments } from "./server/ai.js";
import {
    initFirebase,
    getFirebaseStatus,
    getAdminAuth,
    incrementFetchCount,
    getPlanConfig,
    logFetchEvent,
    SavedThread
} from "./server/firestore.js";
import { authMiddleware, getEffectiveConfig } from "./server/middleware/auth.js";
import { rateLimiterMiddleware } from "./server/middleware/rateLimiter.js";
import { initPayments, createCheckoutUrl } from "./server/stripe.js";
import {
    getFolders,
    getFolder,
    createFolder,
    deleteFolder,
    saveThreadToFolder,
    createPlaceholderThread,
    getThreadsInFolder,
    saveAnalysis,
    getLatestAnalysis, getFolderAnalyses,
    getAdminStorage,
    updateFolderSyncStatus,
    incrementPendingSyncCount,
    updateFolderAnalysisStatus,
    updateThreadInsight,
    getDb
} from "./server/firestore.js";
import { analyzeThreads, analyzeThreadGranular } from "./server/ai.js";
const app = express();
import { DiscoveryOrchestrator } from './server/discovery/orchestrator.js';

const discoveryOrchestrator = new DiscoveryOrchestrator();
const PORT = parseInt(process.env.PORT || "3001", 10);
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const TOOL_VERSION = "1.0.1";
const RATE_LIMIT_DELAY = 1000;

console.log("[INIT] Starting server.ts...");
console.log(`[INIT] Node Version: ${process.version}`);
console.log(`[INIT] PORT: ${PORT}`);

// Initialize Firebase & Payments (non-blocking — app works without them)
try {
    console.log("[INIT] Initializing Firebase...");
    initFirebase();
    console.log("[INIT] Firebase initialization call complete.");
} catch (err: any) {
    console.error("[INIT] FATAL error during Firebase init:", err);
}

try {
    console.log("[INIT] Initializing Payments...");
    initPayments();
    console.log("[INIT] Payments initialization complete.");
} catch (err: any) {
    console.error("[INIT] error during Payments init:", err);
}

process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err: Error) => {
    console.error("Uncaught Exception:", err);
});

// ── Request Queue & Diagnostics ───────────────────────────────────

// Old p-queue based fetchQueue and analysisQueue removed.
// Metrics should now track Redis queue sizes if needed.

// CORS Configuration
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:4321",
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(/[;,]/) : [
        "https://redditkeeperprod.web.app",
        "https://opiniondeck-app.web.app",
        "https://opiniondeck.com",
        "https://www.opiniondeck.com",
        "https://app.opiniondeck.com"
    ])
];

app.use(cors({
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Allow Chrome Extensions
        if (origin.startsWith('chrome-extension://')) return callback(null, true);

        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
}));
app.use(express.json({ limit: '50mb' })); // Increased limit for large threads
app.use(authMiddleware);

// ── Helpers ────────────────────────────────────────────────────────

// ── Helpers ────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}


// ── API Routes ─────────────────────────────────────────────────────

import { getUserStats, updateStats } from "./server/firestore.js";

app.get("/api/user/stats", async (req: express.Request, res: express.Response) => {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const stats = await getUserStats(req.user.uid);
        res.json(stats);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── User Plan endpoint ─────────────────────────────────────────────

app.get("/api/user/plan", async (req: express.Request, res: express.Response) => {
    try {
        if (!req.user) {
            const freeConfig = await getPlanConfig("free");
            res.json({
                plan: "free",
                authenticated: false,
                config: freeConfig,
            });
            return;
        }

        res.json({
            plan: req.user.plan,
            authenticated: true,
            config: req.user.config,
        });
    } catch (err: any) {
        console.error("GET /api/user/plan - Fatal Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ── Upgrade (stub — no payment provider yet) ───────────────────────

app.post("/api/create-checkout-session", async (req: express.Request, res: express.Response) => {
    if (!req.user) {
        res.status(401).json({ error: "Please sign in to upgrade." });
        return;
    }

    try {
        const { interval } = req.body;
        console.log(`[Checkout] Creating session for user ${req.user.uid} (Interval: ${interval || 'month'})`);
        const url = await createCheckoutUrl(req.user.uid, req.user.email);
        res.json({ url });
    } catch (err: any) {
        res.status(503).json({
            error: err.message,
            hint: "Payment provider not configured. Set plan manually in Firestore.",
        });
    }
});

// ── Folder Routes ──────────────────────────────────────────────────

app.get("/api/folders", async (req: express.Request, res: express.Response) => {
    console.log("GET /api/folders - Request received", { user: req.user?.uid });
    if (!req.user) {
        console.warn("GET /api/folders - Unauthorized");
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const folders = await getFolders(req.user.uid);
        console.log(`GET /api/folders - Found ${folders.length} folders`);
        res.json(folders);
    } catch (err: any) {
        console.error("GET /api/folders - Error:", err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

app.post("/api/folders", async (req: express.Request, res: express.Response) => {
    // console.log("POST /api/folders - Request received", { user: req.user?.uid, body: req.body });
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const { name, description } = req.body;
    if (!name) {
        res.status(400).json({ error: "Folder name is required" });
        return;
    }
    try {
        const folder = await createFolder(req.user.uid, name, description);
        res.json(folder);
    } catch (err: any) {
        console.error("POST /api/folders - Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/folders/:id", async (req: express.Request, res: express.Response) => {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        await deleteFolder(req.user.uid, req.params.id as string);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── Saved Thread Routes ───────────────────────────────────────────

app.post("/api/folders/:id/threads", authMiddleware, async (req: express.Request, res: express.Response) => {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const { threadData } = req.body;
    if (!threadData?.post?.id) {
        res.status(400).json({ error: "Invalid thread data" });
        return;
    }
    try {
        await saveThreadToFolder(req.user.uid, req.params.id as string, threadData);

        // Auto-trigger analysis
        const folderId = req.params.id as string;
        const folder = await getFolder(req.user.uid, folderId);
        let analysisRunId = folder?.currentAnalysisRunId;
        if (!analysisRunId || folder?.analysisStatus !== 'processing') {
            analysisRunId = `auto_${Date.now()}`;
            await updateFolderAnalysisStatus(req.user.uid, folderId, 'processing', analysisRunId);
        }

        const threadId = threadData.id || threadData.post?.id;
        await granularAnalysisQueue.add("granular-analyze", {
            threadId,
            url: threadData.source || threadData.post?.url,
            folderId,
            userUid: req.user.uid,
            title: threadData.title || threadData.post?.title,
            subreddit: threadData.subreddit || threadData.post?.subreddit,
            analysisRunId
        });

        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/folders/:id/sync", authMiddleware, async (req: express.Request, res: express.Response) => {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const { urls, items } = req.body;
    const folderId = req.params.id as string;

    // Support either a simple string array (URLs) or rich objects (Items)
    const hasUrls = Array.isArray(urls) && urls.length > 0;
    const hasItems = Array.isArray(items) && items.length > 0;

    if (!hasUrls && !hasItems) {
        res.status(400).json({ error: "Invalid URLs or Items provided" });
        return;
    }

    const payloadList = hasItems ? items : urls.map((url: string) => ({ url }));

    try {
        console.log(`[SyncAPI] Initiating sync for folder ${folderId} with ${payloadList.length} threads.`);
        // 1. Set folder status to syncing
        await updateFolderSyncStatus(req.user.uid, folderId, 'syncing');

        // 2. Increment pending count & Create Placeholders
        await incrementPendingSyncCount(req.user.uid, folderId, payloadList.length);

        await Promise.all(payloadList.map((item: any) =>
            createPlaceholderThread(req.user!.uid, folderId, item.url, item)
        ));

        // 3. Enqueue jobs with Priority based on Plan
        const priority = req.user.plan === 'free' ? 10 : 3;

        const jobs = payloadList.map((item: any) => ({
            name: "sync",
            data: { url: item.url, folderId, userUid: req.user!.uid },
            opts: { priority }
        }));

        await syncQueue.addBulk(jobs);

        res.json({ success: true, count: payloadList.length });
    } catch (err: any) {
        console.error(`[SyncAPI] Failed to initiate sync for folder ${folderId}:`, err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/folders/:id/threads", async (req: express.Request, res: express.Response) => {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        if (req.params.id === 'inbox') {
            console.log(`GET /api/folders/inbox/threads - Fetching uncategorized extractions`);
            const extractions = await listExtractions(req.user.uid);

            // Map ExtractedData -> SavedThread
            const threads: SavedThread[] = extractions.map(ext => {
                const commentCount = ext.commentCount || (ext.content?.comments ? countComments(ext.content.comments) : (ext.content?.flattenedComments?.length || 0));

                return {
                    id: ext.id,
                    folderId: 'inbox',
                    uid: req.user!.uid,
                    title: ext.title,
                    author: ext.content?.post?.author || ext.post?.author || ext.content?.author || 'Unknown',
                    subreddit: ext.content?.post?.subreddit || ext.post?.subreddit || ext.source,
                    commentCount: commentCount,
                    source: ext.source,
                    savedAt: ext.extractedAt,
                    data: {
                        post: ext.content?.post || ext.post || { title: ext.title },
                        content: ext.content,
                        metadata: {
                            fetchedAt: ext.extractedAt,
                            source: ext.source
                        }
                    }
                };
            });
            res.json(threads);
        } else {
            const folderId = req.params.id as string;
            const uid = req.user.uid;
            const [threads, folder] = await Promise.all([
                getThreadsInFolder(uid, folderId),
                getFolder(uid, folderId)
            ]);

            // AUTO-RECOVERY: Check for stale processing threads (> 5 mins)
            const STALE_MS = 5 * 60 * 1000;
            const now = Date.now();
            const recoveryJobs: any[] = [];
            const recoveryRunId = folder?.currentAnalysisRunId || `auto_${now}`;
            for (const thread of threads) {
                const isStuck = (thread.analysisStatus === 'pending' || thread.analysisStatus === 'processing');
                const lastActivity = thread.analysisTriggeredAt || thread.savedAt;
                const triggerTime = lastActivity ? new Date(lastActivity).getTime() : 0;

                if (isStuck && (now - triggerTime > STALE_MS)) {
                    console.log(`[AutoRecovery] Re-triggering stuck analysis for thread ${thread.id}`);

                    // Pre-emptively mark as processing
                    await updateThreadInsight(uid, folderId, {
                        id: thread.id,
                        folderId,
                        uid,
                        threadLink: thread.source,
                        status: 'processing'
                    });

                    recoveryJobs.push({
                        name: "granular-analyze",
                        data: {
                            threadId: thread.id,
                            url: thread.source,
                            folderId,
                            userUid: uid,
                            title: thread.title,
                            subreddit: thread.subreddit,
                            analysisRunId: recoveryRunId
                        }
                    });
                }
            }

            if (recoveryJobs.length > 0) {
                if (!folder?.currentAnalysisRunId) {
                    await updateFolderAnalysisStatus(uid, folderId, 'processing', recoveryRunId);
                }
                await granularAnalysisQueue.addBulk(recoveryJobs);
                console.log(`[AutoRecovery] Re-queued ${recoveryJobs.length} stale analysis jobs via Bulk for folder ${folderId}`);
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
        }
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── AI Analysis Route ─────────────────────────────────────────────

// ── Analysis Queue (BullMQ) ────────────────────────────────────────

import { Queue, Worker, QueueEvents } from "bullmq";
import { redis } from "./server/middleware/rateLimiter.js"; // Reuse Redis connection

// Reuse the ioredis instance from rateLimiter for the Queue connection
// Note: BullMQ requires a specific connection structure, but usually accepts ioredis instance or config
// Ideally we pass connection config. Let's use the Redis URL from env directly for BullMQ to be safe
// as it manages its own connections for blocking/non-blocking.
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const analysisQueue = new Queue("analysis", {
    connection: {
        url: redisUrl
    },
    defaultJobOptions: {
        removeOnComplete: {
            count: 100, // Keep last 100 jobs to avoid race conditions with waitUntilFinished
            age: 24 * 3600 // or keep for 24 hours
        },
        removeOnFail: {
            count: 1000,
            age: 7 * 24 * 3600
        },
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 10000
        }
    }
});
console.log("[INIT] BullMQ Analysis Queue initialized.");

// ── Reddit Sync Queue (BullMQ) ───────────────────────────────────

const syncQueue = new Queue("reddit-sync", {
    connection: { url: redisUrl },
    defaultJobOptions: {
        removeOnComplete: { count: 50, age: 3600 },
        removeOnFail: { count: 100, age: 24 * 3600 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 }
    }
});

const granularAnalysisQueue = new Queue("granular-analysis", {
    connection: { url: redisUrl },
    defaultJobOptions: {
        removeOnComplete: { count: 100, age: 3600 },
        removeOnFail: { count: 100, age: 24 * 3600 },
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 }
    }
});
console.log("[INIT] BullMQ Reddit Sync Queue initialized.");

const syncWorker = new Worker("reddit-sync", async (job) => {
    const { url, folderId, userUid } = job.data;
    console.log(`[SyncWorker] Processing thread: ${url} for folder: ${folderId}`);

    try {
        // Detect source platform
        const source: 'reddit' | 'hn' = url.includes('news.ycombinator.com') ? 'hn' : 'reddit';
        const fullData = await discoveryOrchestrator.fetchFullThread(url, source);

        if (!fullData) throw new Error(`Failed to fetch thread data from ${source.toUpperCase()}`);

        const savedThread = await saveThreadToFolder(userUid, folderId, fullData);
        console.log(`[SyncWorker] Successfully synced thread: ${url}`);

        // 4. Auto-trigger Granular Analysis
        // Ensure folder status is processing so UI shows metrics bar
        const folder = await getFolder(userUid, folderId);
        const analysisRunId = folder?.currentAnalysisRunId || `auto_${Date.now()}`;
        await updateFolderAnalysisStatus(userUid, folderId, 'processing', analysisRunId);

        const finalThreadId = fullData.id || fullData.post?.id;
        if (finalThreadId) {
            await granularAnalysisQueue.add("granular-analyze", {
                threadId: finalThreadId,
                url: url,
                folderId,
                userUid,
                title: fullData.title || fullData.post?.title,
                subreddit: fullData.subreddit || fullData.post?.subreddit,
                analysisRunId
            });
        } else {
            console.warn(`[SyncWorker] Could not trigger analysis: No thread ID found for ${url}`);
        }
    } catch (err: any) {
        console.error(`[SyncWorker] Failed to sync ${url}:`, err.message);
        throw err; // Allow BullMQ to retry
    } finally {
        // Decrease pending count and handle status update
        await incrementPendingSyncCount(userUid, folderId, -1);
    }
}, {
    connection: { url: redisUrl },
    concurrency: 1, // STRICT rate limiting (1 thread at a time per worker instance)
    limiter: {
        max: 1,
        duration: 1000 // 1 per second
    },
    drainDelay: 10000 // Only poll Redis every 10s if idle to save Upstash quota
});

syncWorker.on('failed', (job, err) => {
    console.error(`[SyncWorker] Job ${job?.id} failed:`, err);
});

const granularAnalysisWorker = new Worker("granular-analysis", async (job) => {
    const { threadId, url, folderId, userUid, title, subreddit } = job.data;
    console.log(`[GranularWorker] Analyzing thread: ${threadId} for folder: ${folderId}`);

    try {
        // 0. Update thread status to processing
        await updateThreadInsight(userUid, folderId, {
            id: threadId,
            folderId,
            uid: userUid,
            threadLink: url,
            status: 'processing'
        });

        // 1. Fetch thread from Firestore (SavedThread)
        const threads = await getThreadsInFolder(userUid, folderId);
        const thread = threads.find(t => t.id === threadId);

        if (!thread) throw new Error(`Thread ${threadId} not found in folder ${folderId}`);

        // 2. Resolve content (Storage or local)
        let comments = (thread.data as any)?.comments || [];
        if (thread.storageUrl && comments.length === 0) {
            const url = new URL(thread.storageUrl);
            const pathWithV0 = url.pathname.split('/o/')[1].split('?')[0];
            const filePath = decodeURIComponent(pathWithV0);
            const [fileContents] = await getAdminStorage().bucket().file(filePath).download();
            const contentJson = JSON.parse(fileContents.toString());
            comments = contentJson.flattenedComments || contentJson.comments || contentJson.reviews || [];
        }

        // 3. Call AI with Timeout protection (2 minutes)
        const analysisPromise = analyzeThreadGranular({
            id: threadId,
            title: thread.title,
            subreddit: thread.subreddit,
            comments: comments
        });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("AI Analysis timed out after 2 minutes")), 120000)
        );

        const insights = await Promise.race([analysisPromise, timeoutPromise]) as any;

        // 4. Save to Firestore (Helper handles metric increments & thread deletion)
        console.log(`[GranularWorker] Intelligence extracted for ${threadId}. Saving to Firestore...`);
        await updateThreadInsight(userUid, folderId, {
            id: threadId,
            folderId,
            uid: userUid,
            threadLink: url || thread.source,
            status: 'success',
            insights
        });
        console.log(`[GranularWorker] Successfully processed and saved ${threadId}`);

        // Pass insights to finally block for siloed storage
        (job.data as any).completedInsights = insights;

    } catch (err: any) {
        console.error(`[GranularWorker] Failed for ${threadId}:`, err.message);
        await updateThreadInsight(userUid, folderId, {
            id: threadId,
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
            const trackerRef = folderRef.collection("completed_threads").doc(threadId);
            const { analysisRunId } = job.data;

            await db.runTransaction(async (transaction) => {
                const folderDoc = await transaction.get(folderRef);
                if (!folderDoc.exists) return;

                const data = folderDoc.data() || {};

                // Siloing: ONLY accept updates from the CURRENT analysis run accurately.
                // If the job has no runId or it doesn't match, it's a zombie from a previous incarnation/reset.
                if (!analysisRunId || data.currentAnalysisRunId !== analysisRunId) {
                    console.log(`[GranularWorker] Ignoring zombie/untracked job ${threadId} (Job Run: ${analysisRunId}, Folder Run: ${data.currentAnalysisRunId})`);
                    return;
                }

                const trackerDoc = await transaction.get(trackerRef);
                if (trackerDoc.exists) return; // Already counted this thread in THIS run

                const newCompleted = (data.completedAnalysisCount || 0) + 1;
                const newPending = Math.max(0, (data.pendingAnalysisCount || 0) - 1);

                const update: any = {
                    completedAnalysisCount: newCompleted,
                    pendingAnalysisCount: newPending
                };

                if (newPending <= 0) {
                    console.log(`[GranularWorker] All threads analyzed for folder ${folderId}. Setting status to idle.`);
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
    connection: { url: redisUrl },
    concurrency: 3, // Balanced for speed and API safety
    drainDelay: 10000 // Save Upstash quota
});

// Worker Processor (Analysis)
const analysisWorker = new Worker("analysis", async (job) => {
    console.log(">>>>>>>>>>>>>>>>>>>> WORKER PICKED UP JOB:", job.id);
    const { threadsContext, folderContext, userUid, folderId, plan, totalComments } = job.data;
    console.log(`[Worker] Processing analysis for folder ${folderId} (User: ${userUid}) with ${totalComments} comments.`);

    try {
        // HYBRID STORAGE: Resolve external content before analysis
        const resolvedThreads = await Promise.all(threadsContext.map(async (t: any) => {
            if (t.storageUrl && !t.comments) {
                try {
                    console.log(`[Worker] Fetching external content for thread ${t.id}: ${t.storageUrl}`);

                    // Parse bucket and path from URL
                    // Example: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?alt=media
                    const url = new URL(t.storageUrl);
                    const pathWithV0 = url.pathname.split('/o/')[1].split('?')[0];
                    const filePath = decodeURIComponent(pathWithV0);

                    const [fileContents] = await getAdminStorage().bucket().file(filePath).download();
                    const contentJson = JSON.parse(fileContents.toString());

                    // Extract comments from content JSON
                    // The structure depends on the platform
                    let comments = contentJson.flattenedComments || contentJson.comments || contentJson.reviews || [];

                    // If it's a Reddit tree, it might be nested under contentJson.post or similar if the structure matches SavedThread.data
                    if (comments.length === 0 && contentJson.content) {
                        comments = contentJson.content.flattenedComments || contentJson.content.comments || contentJson.content.reviews || [];
                    }

                    return { ...t, comments };
                } catch (fetchErr) {
                    console.error(`[Worker] Failed to fetch storage content for ${t.id}:`, fetchErr);
                    return t; // Fallback to partial data
                }
            }
            return t;
        }));

        // IMPORTANT: DO NOT break this token tracking logic as it is used for billing and usage monitoring.
        const { analysis, usage } = await analyzeThreads(resolvedThreads, folderContext, totalComments);
        console.log(`[Worker] AI Analysis Result received for ${folderId}. Keys:`, Object.keys(analysis));
        console.log(`[Worker] Token Usage:`, usage);

        // Calculate total comments (approximate from context or passed data)
        // For simplicity in worker, we might need to pass this count or recalculate
        // Let's assume the mutation of user stats happens here or we return result

        const parsedResult = analysis;
        parsedResult.createdAt = new Date().toISOString();

        // Save to Firestore (Private usage metadata included)
        await saveAnalysis(userUid, folderId, parsedResult, "gemini-2.0-flash", usage);

        // Deduct Credit (Increment Usage)
        // threadCount is also available in job.data as threadCount
        const threadCount = job.data.threadCount;

        await updateStats(userUid, {
            reportsGenerated: 1,
            intelligenceScanned: threadCount,
            commentsAnalyzed: totalComments,
            hoursSaved: parseFloat((threadCount * 5 / 60).toFixed(1))
        });

        console.log(`[Worker] Analysis complete for ${folderId}`);
        return parsedResult;

    } catch (err: any) {
        console.error(`[Worker] Failed analysis for ${folderId}:`, err);
        throw err;
    }
}, {
    connection: {
        url: redisUrl
    },
    concurrency: 5, // Process 5 AI jobs concurrently
    drainDelay: 10000 // Save Upstash quota
});

analysisWorker.on('completed', (job, returnvalue) => {
    console.log(`[BullMQ] Job ${job.id} completed!`);
});

analysisWorker.on('failed', (job, err) => {
    console.error(`[BullMQ] Job ${job?.id} failed:`, err);
});

// ── API Routes ─────────────────────────────────────────────────────

app.post("/api/folders/:id/status", async (req: express.Request, res: express.Response) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    try {
        const { status } = req.body;
        const folderId = req.params.id as string;
        await updateFolderAnalysisStatus(req.user.uid, folderId, status);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/folders/:id/analyze", async (req: express.Request, res: express.Response) => {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    try {
        const folderId = req.params.id as string;
        console.log(`[SERVER] [ANALYZE] Triggered for folder: ${folderId} (User: ${req.user.uid})`);

        const folder = folderId === 'inbox'
            ? { id: 'inbox', name: 'Inbox' }
            : await getFolder(req.user.uid, folderId);

        if (!folder) {
            console.warn(`[SERVER] [ANALYZE] Folder not found: ${folderId}`);
            res.status(404).json({ error: "Folder not found" });
            return;
        }

        // 1. Fetch all raw insights (Pain Points, Triggers, Outcomes) from completed threads
        const firestore = await import("./server/firestore.js");
        const signals = await firestore.getFolderIntelligenceSignals(req.user.uid, folderId);
        console.log(`[SERVER] [ANALYZE] Retrieved signals - Pain: ${signals.painPoints.length}, Triggers: ${signals.triggers.length}, Outcomes: ${signals.outcomes.length}`);

        const totalSignals = signals.painPoints.length + signals.triggers.length + signals.outcomes.length;
        if (totalSignals === 0) {
            res.status(400).json({ error: "No analyzed insights found in this folder. Please analyze some threads first." });
            return;
        }

        // 2. Run Clustering Engine
        const { ClusterEngine } = await import("./server/clustering.js");
        const engine = new ClusterEngine(folderId, req.user.uid);

        // We run all categories
        const painPoints = await engine.aggregate(signals.painPoints, "pain_point");
        const triggers = await engine.aggregate(signals.triggers, "switch_trigger");
        const outcomes = await engine.aggregate(signals.outcomes, "desired_outcome");

        // 3. Save aggregated clusters to the subcollection
        const allClusters = [...painPoints, ...triggers, ...outcomes];
        await firestore.saveAggregatedInsights(folderId, allClusters);

        // 4. Run Final LLM Synthesis
        console.log(`[SERVER] [ANALYZE] Running Stage 5 Ranked Synthesis for folder ${folderId}`);
        const { synthesizeReport } = await import("./server/ai.js");

        const uniqueThreadIds = new Set([
            ...signals.painPoints.map((s: any) => s.thread_id),
            ...signals.triggers.map((s: any) => s.thread_id),
            ...signals.outcomes.map((s: any) => s.thread_id)
        ]);
        const totalThreads = uniqueThreadIds.size;
        const totalComments = (folder as any)?.metrics?.commentsAnalyzed || 0;

        const synthesisResult = await synthesizeReport({ painPoints, triggers, outcomes }, totalThreads, totalComments);

        // Track Synthesis Cost
        if (synthesisResult.usage) {
            const inputTokens = synthesisResult.usage.promptTokenCount || 0;
            const outputTokens = synthesisResult.usage.candidatesTokenCount || 0;
            const inputCost = (inputTokens / 1000000) * 0.0375;
            const outputCost = (outputTokens / 1000000) * 0.15;
            await firestore.updateUserAicost(req.user.uid, {
                totalInputTokens: inputTokens,
                totalOutputTokens: outputTokens,
                totalAiCost: inputCost + outputCost
            });
        }

        // 5. Zero-Hallucination Quote Injection
        // We map the LLM summary titles back to the raw clusters to extract a genuine verbatim quote.
        const injectContext = (llmTitles: string[] | undefined, clusters: any[]) => {
            if (!llmTitles) return [];
            return llmTitles.map(title => {
                const matchedCluster = clusters.find(c => c.canonicalTitle === title);
                // Extract just the first valid quote to keep the UI clean
                let quote = "";
                if (matchedCluster && matchedCluster.rawInsights && matchedCluster.rawInsights.length > 0) {
                    const firstInsight = matchedCluster.rawInsights.find((i: any) => i.quotes && i.quotes.length > 0);
                    if (firstInsight) {
                        quote = firstInsight.quotes[0];
                    }
                }
                return {
                    title: title,
                    context_quote: quote
                };
            });
        };

        const injectPriorityContext = (priorities: any[] | undefined, clusters: any[]) => {
            if (!priorities) return [];
            return priorities.map(p => {
                // Priorities are mapped from pain points. The LLM is instructed to return the exact 'source_title'
                // which matches the canonicalTitle of the original cluster.
                const cleanInitiative = (p.source_title || p.initiative || "").toLowerCase().trim();
                const matchedCluster = clusters.find(c => {
                    const cleanTitle = (c.canonicalTitle || "").toLowerCase().trim();
                    return cleanTitle === cleanInitiative;
                });

                let quote = "";
                if (matchedCluster && matchedCluster.rawInsights && matchedCluster.rawInsights.length > 0) {
                    const firstInsight = matchedCluster.rawInsights.find((i: any) => i.quotes && i.quotes.length > 0);
                    if (firstInsight) {
                        quote = firstInsight.quotes[0];
                    }
                }
                return {
                    ...p,
                    context_quote: quote
                };
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

        // 5. Save the final report
        await firestore.saveAnalysis(req.user.uid, folderId, finalReport, "gemini-2.0-flash", synthesisResult.usage);

        res.json({
            success: true,
            folderId,
            aggregates: {
                painPoints,
                triggers,
                outcomes
            },
            synthesis: finalReport
        });
    } catch (err: any) {
        console.error("Aggregation Error:", err);
        res.status(500).json({ error: "Failed to aggregate insights: " + err.message });
    }
});

// Helper to redact reports for Free Users
function redactAnalysis(data: any): any {
    console.log("[SERVER] Redacting analysis for free user...");
    const redacted = {
        ...data,
        market_attack_summary: data.market_attack_summary // Explicitly preserve
    };

    // Metadata for the "Unlock" UI
    redacted.locked_counts = {
        pain_points: data.high_intensity_pain_points?.length || 0,
        triggers: data.switch_triggers?.length || 0,
        gaps: data.feature_gaps?.length || 0,
        roadmap: data.ranked_build_priorities?.length || 0
    };

    // 1. Redact High-Intensity Pain Points
    if (data.high_intensity_pain_points) {
        redacted.high_intensity_pain_points = data.high_intensity_pain_points.map((p: any) => ({
            title: "Locked Pain Point",
            context_quote: "Unlock the Pro plan to see full details of this high-intensity pain point."
        }));
    }

    // 2. Redact Switch Triggers
    if (data.switch_triggers) {
        redacted.switch_triggers = data.switch_triggers.map((s: any) => ({
            title: "Locked Switch Trigger",
            context_quote: "This switching trigger is available on the Pro plan."
        }));
    }

    // 3. Redact Feature Gaps (Unchanged from original logic for now)
    if (data.feature_gaps) {
        redacted.feature_gaps = data.feature_gaps.map((f: any) => ({
            ...f,
            missing_or_weak_feature: "Locked Feature Deficiency",
            context_summary: "Unlock to see specific feature gaps and demand signals.",
            isLocked: true
        }));
    }

    // 4. Redact Weakness Map
    if (data.competitive_weakness_map) {
        redacted.competitive_weakness_map = data.competitive_weakness_map.map((w: any) => ({
            ...w,
            competitor: "Locked Competitor",
            perceived_weakness: "Hidden",
            exploit_opportunity: "This strike plan is exclusive to Pro users.",
            isLocked: true
        }));
    }

    // 5. Redact Build Priorities
    if (data.ranked_build_priorities) {
        redacted.ranked_build_priorities = data.ranked_build_priorities.map((b: any) => ({
            ...b,
            initiative: "Locked Strategy Initiative",
            justification: "Unlock to see the full reasoning for this roadmap priority.",
            isLocked: true
        }));
    }

    // 6. Redact Messaging Angles
    if (data.messaging_and_positioning_angles) {
        redacted.messaging_and_positioning_angles = data.messaging_and_positioning_angles.map((m: any) => ({
            ...m,
            angle: "Locked Messaging Angle",
            supporting_emotional_driver: "This emotional lever is available on the Pro plan.",
            supporting_evidence_quotes: ["Locked..."],
            isLocked: true
        }));
    }

    // 7. Redact Risk Flags
    if (data.risk_flags) {
        redacted.risk_flags = data.risk_flags.map((r: any) => ({
            ...r,
            risk: "Locked Risk",
            evidence_basis: "Unlock to see intelligence risks and validation signals.",
            isLocked: true
        }));
    }

    redacted.isLocked = true;
    return redacted;
}

app.get("/api/folders/:id/analysis", async (req: express.Request, res: express.Response) => {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const analyses = await getFolderAnalyses(req.user.uid, req.params.id as string);
        const isFree = req.user.plan === 'free';

        // Flatten the structure for the frontend
        const flattened = analyses.map(a => {
            let cleanData = { ...a.data };

            // Apply Redaction if Free Plan
            if (isFree) {
                cleanData = redactAnalysis(cleanData);
            }

            return {
                ...cleanData,
                id: a.id,
                createdAt: a.createdAt || new Date().toISOString()
            };
        });

        console.log(`[GET /analysis] Returning ${flattened.length} reports for folder ${req.params.id}. Latest keys:`, flattened[0] ? Object.keys(flattened[0]) : "none");
        res.json(flattened);
    } catch (err: any) {
        console.error("[GET /analysis] Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ── Extension Extractions Routes ───────────────────────────────────

import { saveExtractedData, listExtractions } from "./server/firestore.js";

app.post("/api/extractions", async (req: express.Request, res: express.Response) => {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const { data } = req.body;
        if (!data?.id) throw new Error("Invalid extraction data");

        await saveExtractedData(req.user.uid, data);

        // BRIDGE: If a folderId is provided, also save it to the folder's thread list
        // so it appears in the dashboard folder view immediately.
        if (data.folderId) {
            try {
                console.log(`[Bridge] Attempting to link extraction ${data.id} to folder ${data.folderId}`);
                let threadPayload;

                if (data.content) {
                    // Apply Plan Limits (Truncate comments if on Free plan)
                    const commentLimit = req.user.config.commentLimit;

                    // Detect the correct array key
                    let arrayKey = 'flattenedComments';
                    if (Array.isArray(data.content.reviews)) {
                        arrayKey = 'reviews';
                    } else if (Array.isArray(data.content.comments)) {
                        arrayKey = 'comments';
                    }

                    console.log(`[Bridge] Detected content type: ${arrayKey}`);
                    let items = data.content[arrayKey] || [];
                    const originalCount = items.length;
                    let truncated = false;

                    if (commentLimit > 0 && originalCount > commentLimit) {
                        console.log(`[Limit] Truncating ${arrayKey} from ${originalCount} to ${commentLimit} for user ${req.user.uid}`);
                        items = items.slice(0, commentLimit);
                        truncated = true;
                    }

                    // Calculate accurate count (recursive for nested structures)
                    const totalCount = (arrayKey === 'comments')
                        ? countComments(data.content.comments)
                        : items.length;

                    // Calculate estimated token count
                    const minifiedChars = minifyComments(items).length;
                    const titleChars = data.title?.length || 0;
                    const tokenCount = Math.ceil((minifiedChars + titleChars) / 4);

                    // Update the content object with truncated array
                    const updatedContent = { ...data.content };
                    updatedContent[arrayKey] = items;
                    updatedContent.originalCommentCount = totalCount;
                    updatedContent.truncated = truncated;

                    threadPayload = {
                        id: data.id,
                        title: data.title,
                        post: data.content.post || { title: data.title },
                        content: updatedContent,
                        commentCount: truncated ? items.length : totalCount,
                        tokenCount,
                        source: data.source,
                        metadata: {
                            fetchedAt: data.extractedAt || new Date().toISOString(),
                            totalCommentsFetched: truncated ? items.length : totalCount,
                            originalCommentCount: totalCount,
                            truncated: truncated,
                            toolVersion: "ext-1.1.0",
                            source: data.source
                        }
                    };
                } else {
                    // Hybrid Storage case (content is already in storage)
                    const source = data.source || 'reddit';
                    const subreddit = data.post?.subreddit || (source === 'reddit' ? 'r/unknown' : source);

                    console.log(`[Bridge] Hybrid Storage link for thread: ${data.id} (Source: ${source}, Folder: ${data.folderId})`);

                    threadPayload = {
                        id: data.id,
                        title: data.title,
                        post: data.post || {
                            title: data.title,
                            author: data.author || 'anonymous',
                            subreddit: subreddit
                        },
                        content: null,
                        commentCount: data.commentCount || 0,
                        tokenCount: data.tokenCount || 0,
                        source: source,
                        storageUrl: data.storageUrl,
                        metadata: {
                            fetchedAt: data.extractedAt || new Date().toISOString(),
                            totalCommentsFetched: data.commentCount || 0,
                            toolVersion: "ext-1.1.0",
                            source: source
                        }
                    };
                }

                await saveThreadToFolder(req.user.uid, data.folderId, threadPayload);
                console.log(`[Bridge] SUCCESS: Thread ${data.id} linked to folder ${data.folderId}`);
            } catch (bridgeErr) {
                console.error("[Bridge] Failed to link extraction to folder:", bridgeErr);
            }
        }

        // If 'shouldAnalyze' is passed, trigger a background analysis job
        if (data.shouldAnalyze) {
            console.log(`[AI] Auto-analysis triggered for extraction: ${data.id}`);
            // Logic to perform single extraction analysis would go here
            // For now, we just mark that it was requested in the logs
        }

        res.json({ success: true, id: data.id });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/discovery/compare", authMiddleware, async (req: express.Request, res: express.Response) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Query is required" });

    try {
        console.log(`[Discovery] [LAB] Starting comparison for: ${query}`);

        // Run Baseline (Always skip cache in Lab for testing)
        const baseline = await discoveryOrchestrator.search(query, 'all', false, true);

        // Run AI-Brain (Always skip cache in Lab for testing)
        const enhanced = await discoveryOrchestrator.search(query, 'all', true, true);

        res.json({
            baseline: baseline.results,
            enhanced: enhanced.results
        });
    } catch (err: any) {
        console.error(`[Discovery] Lab error:`, err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/discovery/search", authMiddleware, async (req: express.Request, res: express.Response) => {
    const { query, platform = 'all' } = req.body;
    if (!query) {
        return res.status(400).json({ error: "Query is required" });
    }

    try {
        console.log(`[Discovery] Starting search for: ${query} (Platform: ${platform})`);

        const platforms: ('reddit' | 'hn')[] | 'all' = platform === 'all' ? 'all' : [platform as 'reddit' | 'hn'];
        const { results, discoveryPlan } = await discoveryOrchestrator.search(query, platforms);

        res.json({ results, discoveryPlan });
    } catch (err: any) {
        console.error(`[Discovery] Search error:`, err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/extractions", async (req: express.Request, res: express.Response) => {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const data = await listExtractions(req.user.uid);
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── Health Check ───────────────────────────────────────────────────

app.get("/api/health", async (_req: express.Request, res: express.Response) => {
    const counts = await analysisQueue.getJobCounts();
    res.json({
        status: "ok",
        version: TOOL_VERSION,
        redis: redis.status,
        firebase: getFirebaseStatus(),
        queue: counts
    });
});

// ── Error Handler ─────────────────────────────────────────────────

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("GLOBAL ERROR HANDLER:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
});

// ── Start ──────────────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 OpinionDeck Platform Server running on port ${PORT}`);
    console.log(`   Host: 0.0.0.0 (Required for Cloud Run)`);
    console.log(`   Redis Status: ${redis.status}`);
});

// ── Graceful Shutdown ──────────────────────────────────────────────

async function gracefulShutdown(signal: string) {
    console.log(`[SHUTDOWN] Received ${signal}. Closing BullMQ components...`);

    try {
        // 1. Close Workers first (stop picking up new jobs)
        await Promise.all([
            syncWorker.close(),
            granularAnalysisWorker.close(),
            analysisWorker.close()
        ]);
        console.log("[SHUTDOWN] BullMQ Workers closed.");

        // 2. Close Queues
        await Promise.all([
            analysisQueue.close(),
            syncQueue.close(),
            granularAnalysisQueue.close()
        ]);
        console.log("[SHUTDOWN] BullMQ Queues closed.");

        // 3. Close Redis
        await redis.quit();
        console.log("[SHUTDOWN] Redis connection closed.");

        process.exit(0);
    } catch (err) {
        console.error("[SHUTDOWN] Error during graceful shutdown:", err);
        process.exit(1);
    }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
