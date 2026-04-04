
import "dotenv/config";
import crypto from "crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
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
    incrementDiscoveryCount,
    getPlanConfig,
    logFetchEvent,
    SavedThread
} from "./server/firestore.js";
import { authMiddleware, getEffectiveConfig } from "./server/middleware/auth.js";
import { usageGuard } from "./server/middleware/usageGuard.js";
import { rateLimiterMiddleware, authRateLimiter } from "./server/middleware/rateLimiter.js";
import { adminMiddleware } from "./server/middleware/admin.js";
import { getAllUsers, getGlobalStats, getBetaTokens, getWaitlist, addWaitlistEntry, updateWaitlistStatus, getDailyStats } from "./server/admin.js";
import { createFoundingOrder, verifySignature } from "./server/payments/razorpay.js";
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
    getDb,
    getDiscoveryHistory,
    deleteDiscoveryHistory,
    saveDiscoveryHistory,
    verifyInviteCode,
    createInviteCode,
    registerUserWithInvite
} from "./server/firestore.js";
import { analyzeThreads, analyzeThreadGranular } from "./server/ai.js";
const app = express();
import { DiscoveryOrchestrator } from './server/discovery/orchestrator.js';

const discoveryOrchestrator = new DiscoveryOrchestrator();
import { sendAlert } from "./server/alerts.js";
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

app.use(helmet());

app.use(cors({
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
        // Allow requests with no origin ONLY in development (curl, etc)
        // In production, scrapers use no-origin so we block them
        if (!origin) {
            if (process.env.NODE_ENV !== 'production') return callback(null, true);
            return callback(new Error('Origin missing'), false);
        }

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
app.use(rateLimiterMiddleware); // Apply global rate limits to all routes based on auth config

// ── Helpers ────────────────────────────────────────────────────────

import marketingRouter from "./server/marketing/leads.js";
app.use("/api/admin/marketing", marketingRouter);

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
            usage: req.user.usage,
        });
    } catch (err: any) {
        console.error("GET /api/user/plan - Fatal Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ── Upgrade (stub — no payment provider yet) ───────────────────────

app.post("/api/payments/create-order", authMiddleware, async (req: express.Request, res: express.Response) => {
    if (!req.user) {
        res.status(401).json({ error: "Please sign in to upgrade." });
        return;
    }

    try {
        const order = await createFoundingOrder(req.user.uid);
        res.json(order);
    } catch (err: any) {
        console.error("[Razorpay] Create Order Error:", err);
        res.status(500).json({ error: "Failed to create payment order." });
    }
});

app.post("/api/payments/webhook", express.json(), async (req: express.Request, res: express.Response) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"] as string;

    if (secret && signature) {
        const isValid = verifySignature(JSON.stringify(req.body), signature, secret);
        if (!isValid) {
            console.error("[Razorpay] Invalid Webhook Signature");
            res.status(400).send("Invalid signature");
            return;
        }
    }

    const event = req.body.event;
    console.log(`[Razorpay] Webhook received: ${event}`);

    if (event === "order.paid") {
        const { notes } = req.body.payload.order.entity;
        const userId = notes?.userId;

        if (userId) {
            console.log(`[Razorpay] Upgrading user ${userId} to Founding Access`);
            const { updateUserPlan } = await import("./server/firestore.js");
            await updateUserPlan(userId, "pro");
        }
    }

    res.json({ status: "ok" });
});

// ── Folder Routes ──────────────────────────────────────────────────

app.get("/api/folders", async (req: express.Request, res: express.Response) => {
    console.log("GET /api/folders - Request received", { user: req.user?.uid });
    if (!req.user) {
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

const sharedConnectionConfig = {
    url: redisUrl,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
};

const analysisQueue = new Queue("analysis", {
    connection: sharedConnectionConfig,
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
    connection: sharedConnectionConfig,
    defaultJobOptions: {
        removeOnComplete: { count: 50, age: 3600 },
        removeOnFail: { count: 100, age: 24 * 3600 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 }
    }
});

const granularAnalysisQueue = new Queue("granular-analysis", {
    connection: sharedConnectionConfig,
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

        const finalThreadId = crypto.createHash('md5').update(url).digest('hex').substring(0, 16);
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
    connection: sharedConnectionConfig,
    concurrency: 1, // STRICT rate limiting (1 thread at a time per worker instance)
    limiter: {
        max: 1,
        duration: 1000 // 1 per second
    },
    drainDelay: 5, // Back to default for optimal performance
    stalledInterval: 30000 // Normal stalled job polling (30s)
});

syncWorker.on('failed', (job, err) => {
    console.error(`[SyncWorker] Job ${job?.id} failed:`, err);
    sendAlert("REDDIT", `Sync Worker Failed! Job: ${job?.id}`, {
        error: err.message,
        statusCode: (err as any).statusCode,
        responseSnippet: (err as any).responseSnippet,
        url: job?.data?.url,
        user: job?.data?.userUid,
        attempt: job?.attemptsMade,
        stack: err.stack?.split("\n").slice(0, 3).join("\n")
    });
});

const granularAnalysisWorker = new Worker("granular-analysis", async (job) => {
    const { threadId, url, folderId, userUid, title, subreddit } = job.data;
    // Use the same URL hash ID to identify the correct document
    const threadDocId = crypto.createHash('md5').update(url).digest('hex').substring(0, 16);

    try {
        // 0. Update thread status to processing
        await updateThreadInsight(userUid, folderId, {
            id: threadDocId,
            folderId,
            uid: userUid,
            threadLink: url,
            status: 'processing'
        });

        // 1. Fetch thread from Firestore (SavedThread)
        const threads = await getThreadsInFolder(userUid, folderId);
        const thread = threads.find(t => t.id === threadDocId);

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
            id: threadDocId,
            title: thread.title,
            subreddit: thread.subreddit,
            comments: comments
        });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("AI Analysis timed out after 2 minutes")), 120000)
        );

        const insights = await Promise.race([analysisPromise, timeoutPromise]) as any;

        // 4. Save to Firestore (Helper handles metric increments & thread deletion)
        console.log(`[GranularWorker] Intelligence extracted for ${threadDocId}. Saving to Firestore...`);
        await updateThreadInsight(userUid, folderId, {
            id: threadDocId,
            folderId,
            uid: userUid,
            threadLink: url || thread.source,
            status: 'success',
            insights
        });
        console.log(`[GranularWorker] Successfully processed and saved ${threadDocId}`);

        // Pass insights to finally block for siloed storage
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
    connection: sharedConnectionConfig,
    concurrency: 3, // Balanced for speed and API safety
    drainDelay: 5, // Optimal speed
    stalledInterval: 30000 // Normal stalled job polling
});

granularAnalysisWorker.on('failed', (job, err) => {
    console.error(`[GranularWorker] Job ${job?.id} failed:`, err);
    sendAlert("AI", `Granular Analysis Failed! Job: ${job?.id}`, {
        error: err.message,
        thread: job?.data?.title || job?.data?.threadId,
        user: job?.data?.userUid
    });
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
    connection: sharedConnectionConfig,
    concurrency: 2, // Analysis is more resource heavy
    drainDelay: 5,
    stalledInterval: 30000
});

analysisWorker.on('failed', (job, err) => {
    console.error(`[AnalysisWorker] Job ${job?.id} failed:`, err);
    sendAlert("AI", `Main Analysis Report Failed! Job: ${job?.id}`, {
        error: err.message,
        folderId: job?.data?.folderId,
        userUid: job?.data?.userUid,
        attempt: job?.attemptsMade,
        stack: err.stack?.split("\n").slice(0, 3).join("\n")
    });
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

app.post("/api/folders/:id/analyze", authMiddleware, usageGuard('ANALYSIS'), async (req: express.Request, res: express.Response) => {
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

        await firestore.saveAnalysis(req.user.uid, folderId, finalReport, "gemini-2.0-flash", synthesisResult.usage);

        // Increment usage count
        await firestore.incrementAnalysisCount(req.user.uid);

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

app.post("/api/extractions", authMiddleware, usageGuard('SAVED_THREADS'), async (req: express.Request, res: express.Response) => {
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

app.post("/api/discovery/compare", authMiddleware, usageGuard('DISCOVERY'), async (req: express.Request, res: express.Response) => {
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required for Discovery Lab" });
    }
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Query is required" });

    try {
        console.log(`[Discovery] [LAB] Starting comparison for: ${query}`);

        // Run Baseline (Always skip cache in Lab for testing)
        const baseline = await discoveryOrchestrator.search(req.user.uid, query, 'all', false, true);

        // Run AI-Brain (Always skip cache in Lab for testing)
        const enhanced = await discoveryOrchestrator.search(req.user.uid, query, 'all', true, true);

        // Increment usage count (counts as 1 discovery)
        await incrementDiscoveryCount(req.user.uid);

        res.json({
            baseline: baseline.results,
            enhanced: enhanced.results
        });
    } catch (err: any) {
        console.error(`[Discovery] Lab error:`, err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/discovery/search", authMiddleware, usageGuard('DISCOVERY'), async (req: express.Request, res: express.Response) => {
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required for Discovery Search" });
    }
    const { query, platform = 'all' } = req.body;
    if (!query) {
        return res.status(400).json({ error: "Query is required" });
    }

    try {
        console.log(`[Discovery] Starting search for: ${query} (Platform: ${platform})`);

        const platforms: ('reddit' | 'hn')[] | 'all' = platform === 'all' ? 'all' : [platform as 'reddit' | 'hn'];
        const { results, discoveryPlan } = await discoveryOrchestrator.search(req.user.uid, query, platforms, false, false, req.user.plan === 'past_due' ? 'free' : req.user.plan);

        // Increment usage count for authorized user
        await incrementDiscoveryCount(req.user.uid);

        res.json({ results, discoveryPlan });
    } catch (err: any) {
        console.error(`[Discovery] Search error:`, err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/discovery/idea", authMiddleware, usageGuard('DISCOVERY'), async (req: express.Request, res: express.Response) => {
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required for Idea Discovery" });
    }
    const { idea, communities, competitors, skipCache = false } = req.body;
    if (!idea) {
        return res.status(400).json({ error: "Idea is required" });
    }

    try {
        console.log(`[Discovery] Starting Idea Discovery for: ${idea}`);
        const { results, discoveryPlan } = await discoveryOrchestrator.ideaDiscovery(req.user.uid, idea, communities, competitors, skipCache, req.user.plan === 'past_due' ? 'free' : req.user.plan);

        // Increment usage count for authorized user
        await incrementDiscoveryCount(req.user.uid);

        res.json({ results, discoveryPlan });
    } catch (err: any) {
        console.error(`[Discovery] Idea Search error:`, err);
        res.status(500).json({ error: "Discovery failed" });
    }
});

// ── Discovery History ─────────────────────────────────────────────

app.get("/api/discovery/history", authMiddleware, async (req: express.Request, res: express.Response) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    try {
        const history = await getDiscoveryHistory(req.user.uid);
        res.json(history);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/discovery/history/:id", authMiddleware, async (req: express.Request, res: express.Response) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    try {
        await deleteDiscoveryHistory(req.user.uid, req.params.id as string);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/discovery/history/:id/results", authMiddleware, async (req: express.Request, res: express.Response) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    try {
        const entry = await import("./server/firestore.js").then(m => m.getDiscoveryHistoryFull(req.user!.uid, req.params.id as string));
        if (!entry) {
            return res.status(404).json({ error: "History entry not found" });
        }
        res.json({ savedResults: entry.savedResults || [], discoveryPlan: entry.discoveryPlan || null });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Bulk Import Metadata Enrichment
app.post("/api/discovery/metadata", authMiddleware, usageGuard('DISCOVERY'), async (req: express.Request, res: express.Response) => {
    const { url, source, urls } = req.body;

    // Handle both single URL and bulk array as sent by frontend
    const urlList = urls || (url ? [url] : []);
    
    if (urlList.length === 0) {
        return res.status(400).json({ error: "URLs are required" });
    }

    try {
        const orchestrator = discoveryOrchestrator;
        
        // Process in parallel with concurrency limit if needed, but for now just map
        const results = await Promise.all(urlList.map(async (targetUrl: string) => {
            const detectedSource = targetUrl.includes('news.ycombinator.com') ? 'hn' : 'reddit';
            try {
                const fullData = await orchestrator.fetchFullThread(targetUrl, detectedSource);
                if (!fullData || !fullData.post) return null;
                
                return {
                    id: Buffer.from(targetUrl).toString('base64'),
                    title: fullData.post.title || "Unknown Title",
                    author: fullData.post.author || "unknown",
                    subreddit: fullData.post.subreddit || (detectedSource === 'hn' ? 'Hacker News' : 'unknown'),
                    num_comments: fullData.post.num_comments || 0,
                    created_utc: fullData.post.created_utc || Math.floor(Date.now() / 1000),
                    url: targetUrl,
                    source: detectedSource,
                    score: 0,
                    isCached: true
                };
            } catch (err) {
                console.warn(`[Discovery] Failed to enrich metadata for ${targetUrl}:`, err);
                return null;
            }
        }));

        const validResults = results.filter(Boolean);

        // Save to History for bulk imports too
        if (validResults.length > 0) {
            await saveDiscoveryHistory(req.user!.uid, {
                type: 'bulk',
                query: urlList.join('\n'),
                params: { platforms: ['reddit', 'hn'] },
                resultsCount: validResults.length,
                topResults: validResults.slice(0, 5).map(r => ({
                    title: r!.title,
                    url: r!.url,
                    source: r!.source as any,
                    score: 0
                }))
            }).catch(err => console.error("Failed to save bulk history:", err));
        }

        res.json({ results: validResults });
    } catch (err: any) {
        console.error(`[Discovery] Failed bulk enrichment:`, err);
        res.status(500).json({ error: "Failed to enrich metadata" });
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

// ── Diagnostics ──────────────────────────────────────────────────
app.get("/api/admin/invite-codes", async (req: express.Request, res: express.Response) => {
    const { secret } = req.query;
    if (secret !== (process.env.ADMIN_SECRET || "deck-dev-secret")) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const db = getDb();
        const snapshot = await db.collection("invite_codes").get();
        const codes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(codes);
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
// ── Admin: Invite Generator ────────────────────────────────────────
app.get("/api/admin/invite-gen", (req: express.Request, res: express.Response) => {
    // Relax CSP just for this single page to allow inline scripts/styles for the tool
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;");
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invite Generator | Opinion Deck</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg: #0b0b12;
                --card: #131320;
                --input: rgba(255,255,255,0.04);
                --primary: #ff4500;
                --primary-glow: rgba(255,69,0,0.3);
                --text: #ffffff;
                --text-dim: #8e92a4;
                --success: #22c55e;
            }
            body { 
                font-family: 'Inter', sans-serif; 
                background: var(--bg); 
                background-image: radial-gradient(circle at 50% -20%, #1a1a2e 0%, var(--bg) 80%);
                color: var(--text); 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                height: 100vh; 
                margin: 0; 
                overflow: hidden;
            }
            .card { 
                background: var(--card); 
                padding: 48px; 
                border-radius: 32px; 
                box-shadow: 0 40px 100px rgba(0,0,0,0.6); 
                width: 90%; 
                max-width: 440px; 
                border: 1px solid rgba(255,255,255,0.08);
                position: relative;
                backdrop-filter: blur(10px);
            }
            h1 { font-size: 1.8rem; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.03em; }
            p { color: var(--text-dim); font-size: 1rem; margin-bottom: 40px; font-weight: 400; }
            .form-group { margin-bottom: 24px; position: relative; }
            label { display: block; font-size: 0.75rem; font-weight: 700; color: #6e6e88; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
            input { 
                width: 100%; 
                padding: 16px 20px; 
                background: var(--input); 
                border: 1.5px solid rgba(255,255,255,0.08); 
                border-radius: 16px; 
                color: white; 
                font-size: 1rem; 
                box-sizing: border-box;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                font-weight: 500;
            }
            input:focus { outline: none; border-color: var(--primary); background: rgba(255,255,255,0.06); box-shadow: 0 0 20px rgba(255,69,0,0.1); }
            button.main-btn { 
                width: 100%; 
                padding: 18px; 
                background: var(--primary); 
                color: white; 
                border: none; 
                border-radius: 16px; 
                font-weight: 800; 
                cursor: pointer; 
                font-size: 1.1rem;
                margin-top: 16px;
                transition: all 0.2s ease;
                box-shadow: 0 8px 30px var(--primary-glow);
            }
            button.main-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 40px var(--primary-glow); filter: brightness(1.1); }
            button.main-btn:active { transform: translateY(0); }
            
            /* Modal / Overlay */
            #modal {
                position: absolute;
                inset: 0;
                background: var(--card);
                border-radius: 32px;
                padding: 48px;
                display: none;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
                z-index: 20;
                animation: fadeIn 0.4s ease;
            }
            @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            
            .success-icon {
                width: 64px;
                height: 64px;
                background: rgba(34, 197, 94, 0.15);
                color: var(--success);
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 2rem;
                margin-bottom: 24px;
            }
            .code-display {
                background: rgba(255,255,255,0.03);
                padding: 20px;
                border-radius: 16px;
                border: 1px dashed rgba(255,255,255,0.2);
                width: 100%;
                margin: 24px 0;
                font-family: monospace;
                font-size: 1.2rem;
                color: var(--primary);
                font-weight: 800;
                box-sizing: border-box;
                word-break: break-all;
            }
            .secondary-btn {
                background: transparent;
                color: var(--text-dim);
                border: 1px solid rgba(255,255,255,0.1);
                padding: 12px 24px;
                border-radius: 12px;
                cursor: pointer;
                font-weight: 600;
                margin-top: 12px;
                transition: all 0.2s;
            }
            .secondary-btn:hover { background: rgba(255,255,255,0.05); color: white; border-color: rgba(255,255,255,0.2); }
            
            #error-msg { 
                margin-top: 20px; 
                color: #ef4444; 
                font-size: 0.9rem; 
                text-align: center; 
                font-weight: 500;
                display: none;
            }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>Beta Access</h1>
            <p>Generate invitation codes for new testers.</p>
            
            <div id="main-form">
                <div class="form-group">
                    <label>Admin Secret</label>
                    <input type="password" id="secret" placeholder="Enter secret key..." autofocus>
                </div>
                <div class="form-group">
                    <label>Invite Code</label>
                    <input type="text" id="code" placeholder="ALPHA-2026-X">
                </div>
                <div class="form-group">
                    <label>Usage Limit</label>
                    <input type="number" id="maxUses" value="1">
                </div>
                
                <button id="gen-btn" class="main-btn">Generate Link</button>
                <div id="error-msg"></div>
            </div>

            <div id="modal">
                <div class="success-icon">✓</div>
                <h2 style="margin: 0; font-weight: 800;">Code Created!</h2>
                <p style="margin: 8px 0 0 0; font-size: 0.9rem;">Copy the code or the direct signup link.</p>
                
                <div id="generated-link" class="code-display"></div>
                
                <button id="copy-btn" class="main-btn">Copy Direct Link</button>
                <button id="reset-btn" class="secondary-btn">Create Another</button>
            </div>
        </div>

        <script>
            let currentCode = '';
            
            document.addEventListener('DOMContentLoaded', () => {
                const btn = document.getElementById('gen-btn');
                if (btn) btn.addEventListener('click', generate);
                
                const cBtn = document.getElementById('copy-btn');
                if (cBtn) cBtn.addEventListener('click', copyLink);
                
                const rBtn = document.getElementById('reset-btn');
                if (rBtn) rBtn.addEventListener('click', resetForm);
            });

            async function generate() {
                const secret = document.getElementById('secret').value;
                const codeNode = document.getElementById('code');
                const code = codeNode.value.trim().toUpperCase() || 'BETA-' + Math.random().toString(36).substring(2, 9).toUpperCase();
                const maxUses = parseInt(document.getElementById('maxUses').value);
                const errorNode = document.getElementById('error-msg');
                
                if (errorNode) {
                    errorNode.textContent = '';
                    errorNode.style.display = 'none';
                }
                
                try {
                    const res = await fetch('/api/admin/create-invite', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ secret, code, maxUses })
                    });
                    
                    const data = await res.json();
                    if (res.ok && data.success) {
                        currentCode = code;
                        const link = window.location.origin + '/login?invite=' + code;
                        document.getElementById('generated-link').textContent = code;
                        document.getElementById('modal').style.display = 'flex';
                    } else {
                        if (errorNode) {
                            errorNode.textContent = data.error || 'Invalid secret or code';
                            errorNode.style.display = 'block';
                        }
                    }
                } catch (err) {
                    console.error('Error generating code:', err);
                    if (errorNode) {
                        errorNode.textContent = 'Connection error. Check console.';
                        errorNode.style.display = 'block';
                    }
                }
            }

            function copyLink() {
                const link = window.location.origin + '/login?invite=' + currentCode;
                navigator.clipboard.writeText(link).then(() => {
                    const btn = document.getElementById('copy-btn');
                    const originalText = btn.textContent;
                    btn.textContent = '📋 Copied Link!';
                    btn.style.background = '#22c55e';
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.background = '';
                    }, 2000);
                });
            }

            function resetForm() {
                document.getElementById('modal').style.display = 'none';
                document.getElementById('code').value = '';
                const errorNode = document.getElementById('error-msg');
                if (errorNode) errorNode.style.display = 'none';
            }
        </script>
    </body>
    </html>
    `);
});

// ── Admin Routes ───────────────────────────────────────────────────

app.get("/api/admin/metrics", adminMiddleware, async (req: express.Request, res: express.Response) => {
    try {
        const stats = await getGlobalStats();
        const daily = await getDailyStats();
        res.json({ counts: stats, daily });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/admin/users", adminMiddleware, async (req: express.Request, res: express.Response) => {
    try {
        const lastDocId = req.query.lastDocId as string | undefined;
        const users = await getAllUsers(50, lastDocId);
        res.json(users);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/admin/users/:uid/plan", adminMiddleware, async (req: express.Request, res: express.Response) => {
    try {
        const { plan } = req.body;
        const { updateUserPlan } = await import("./server/firestore.js");
        await updateUserPlan(req.params.uid as string, plan as any);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/admin/tokens", adminMiddleware, async (req: express.Request, res: express.Response) => {
    try {
        const tokens = await getBetaTokens();
        res.json(tokens);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/admin/tokens", adminMiddleware, async (req: express.Request, res: express.Response) => {
    try {
        const { code, maxUses } = req.body;
        await createInviteCode(code, maxUses || 1);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/admin/waitlist", adminMiddleware, async (req: express.Request, res: express.Response) => {
    try {
        const wlist = await getWaitlist();
        res.json(wlist);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/admin/waitlist/:id/status", adminMiddleware, async (req: express.Request, res: express.Response) => {
    try {
        await updateWaitlistStatus(req.params.id as string, req.body.status);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── Test Alerting System ──────────────────────────────────────────
app.get("/api/admin/test-alert", adminMiddleware, async (req: express.Request, res: express.Response) => {
    try {
        await sendAlert("SYSTEM", "Manual Trigger Test from Admin Terminal", { 
            executedBy: req.user?.email,
            ip: req.ip,
            timestamp: new Date().toISOString()
        });
        res.json({ success: true, message: "Alert sent to Telegram" });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/waitlist", async (req: express.Request, res: express.Response) => {
    // Public endpoint for beta access requests
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });
        await addWaitlistEntry(email);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/admin/bullmq-stats", adminMiddleware, async (req: express.Request, res: express.Response) => {
    try {
        const getStats = async (q: Queue) => {
            const counts = await q.getJobCounts();
            return counts;
        };

        const db = await import("./server/firestore.js").then(m => m.getDb());
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
                delayed: 0,
                paused: 0
            }
        };
        res.json(stats);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});


app.post("/api/auth/verify-invite", authRateLimiter, async (req: express.Request, res: express.Response) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Code is required" });
    
    try {
        const result = await verifyInviteCode(code);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/auth/register", authRateLimiter, async (req: express.Request, res: express.Response) => {
    const { email, password, inviteCode } = req.body;
    
    if (!email || !password || !inviteCode) {
        return res.status(400).json({ error: "Email, password, and invite code are required." });
    }

    try {
        const result = await registerUserWithInvite(email, password, inviteCode);
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (err: any) {
        console.error("[API] Registration error:", err);
        res.status(500).json({ error: err.message || "Internal server error." });
    }
});

// Final error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled Error:", err);
    res.status(500).json({ error: "Internal server error" });
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
