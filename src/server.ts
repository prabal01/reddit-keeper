
import "dotenv/config";
import express from "express";
import cors from "cors";
// Queue definitions removed (replaced by BullMQ)
import { countComments } from "./reddit/tree-builder.js";
import type {
    Comment,
} from "./reddit/types.js";
import {
    initFirebase,
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
    getThreadsInFolder,
    saveAnalysis,
    getLatestAnalysis, getFolderAnalyses,
    getAdminStorage
} from "./server/firestore.js";
import { analyzeThreads } from "./server/ai.js";

// ── Init ───────────────────────────────────────────────────────────

const app = express();
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

app.post("/api/folders/:id/threads", async (req: express.Request, res: express.Response) => {
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
        res.json({ success: true });
    } catch (err: any) {
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
            const threads: SavedThread[] = extractions.map(ext => ({
                id: ext.id,
                folderId: 'inbox',
                uid: req.user!.uid,
                title: ext.title,
                author: ext.content.post?.author || ext.content.author || 'Unknown',
                subreddit: ext.content.post?.subreddit || ext.source,
                savedAt: ext.extractedAt,
                data: {
                    post: ext.content.post || { title: ext.title },
                    content: ext.content,
                    metadata: {
                        fetchedAt: ext.extractedAt,
                        source: ext.source
                    }
                }
            }));
            res.json(threads);
        } else {
            const threads = await getThreadsInFolder(req.user.uid, req.params.id as string);
            res.json(threads);
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
    }
});
console.log("[INIT] BullMQ Analysis Queue initialized.");

const analysisQueueEvents = new QueueEvents("analysis", {
    connection: {
        url: redisUrl
    }
});
console.log("[INIT] BullMQ Queue Events initialized.");

// Worker Processor
const analysisWorker = new Worker("analysis", async (job) => {
    const { threadsContext, folderContext, userUid, folderId, plan } = job.data;
    console.log(`[Worker] Processing analysis for folder ${folderId} (User: ${userUid})`);

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

                    return { ...t, comments };
                } catch (fetchErr) {
                    console.error(`[Worker] Failed to fetch storage content for ${t.id}:`, fetchErr);
                    return t; // Fallback to partial data
                }
            }
            return t;
        }));

        const result = await analyzeThreads(resolvedThreads, folderContext);

        // Calculate total comments (approximate from context or passed data)
        // For simplicity in worker, we might need to pass this count or recalculate
        // Let's assume the mutation of user stats happens here or we return result

        const parsedResult = JSON.parse(result);
        parsedResult.createdAt = new Date().toISOString();

        // Save to Firestore
        await saveAnalysis(userUid, folderId, parsedResult, "gemini-flash-latest");

        // Deduct Credit (Increment Usage)
        // We need to calculate total comments again or pass it in job data
        // For now, let's pass it in job.data to avoid recalculation
        const { totalComments, threadCount } = job.data;

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
    concurrency: 5 // Process 5 AI jobs concurrently
});

analysisWorker.on('completed', (job, returnvalue) => {
    console.log(`[BullMQ] Job ${job.id} completed!`);
});

analysisWorker.on('failed', (job, err) => {
    console.error(`[BullMQ] Job ${job?.id} failed:`, err);
});

// ── API Routes ─────────────────────────────────────────────────────

app.post("/api/folders/:id/analyze", async (req: express.Request, res: express.Response) => {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    try {
        // 1. Fetch folder details for context
        const folder = await getFolder(req.user.uid, req.params.id as string);
        const folderContext = folder?.description || "";

        // 2. Fetch all threads in folder
        const savedThreads = await getThreadsInFolder(req.user.uid, req.params.id as string);

        if (savedThreads.length === 0) {
            res.status(400).json({ error: "Folder is empty" });
            return;
        }

        // Calculate total comments
        const totalComments = savedThreads.reduce((sum, thread) => {
            const count = thread.data.comments ? countComments(thread.data.comments) : 0;
            return sum + count;
        }, 0);

        // Map to simplified context for AI
        const threadsContext = savedThreads.map(t => ({
            id: t.id,
            title: t.title,
            subreddit: t.subreddit,
            comments: (t.data as any)?.comments || null,
            storageUrl: (t as any).storageUrl || null
        }));

        // 3. Add to Analysis Queue (BullMQ)
        // We await the job addition, but the processing is async
        const job = await analysisQueue.add("analyze-folder", {
            threadsContext,
            folderContext,
            userUid: req.user.uid,
            folderId: req.params.id,
            plan: req.user.plan,
            totalComments,
            threadCount: savedThreads.length
        });

        console.log(`[API] Enqueued analysis job ${job.id} for user ${req.user.uid}`);

        // For MVP: We want to wait for the job to finish to return the response to the frontend
        // In a real async architecture, we would return 202 Accepted and have the frontend poll
        // But to keep frontend changes minimal (or zero), we can wait for the job here
        // Note: serverless functions might time out, but we are on Render/Cloud Run so we have some time.

        try {
            const result = await job.waitUntilFinished(analysisQueueEvents);
            // Warning: waitUntilFinished requires QueueEvents. 
            // If we don't want to set up QueueEvents yet, we can't wait.
            // Actually, for MVP, if we switch to async, the frontend breaks.
            // Let's try to keep it pseudo-sync or return "Processing started"

            // DECISION: To avoid breaking the frontend "Analyze" button which expects a result,
            // we will implement a simple Polling mechanism or just simple "await job.finished()".
            // BullMQ job.finished() is what we want.

            const finishedResult = await job.waitUntilFinished(new QueueEvents('analysis', { connection: { url: redisUrl } }));

            let responsePayload = finishedResult;

            // Redact for Free Users immediately
            if (req.user.plan === 'free') {
                responsePayload = redactAnalysis(finishedResult);
            }

            res.json(responsePayload);

        } catch (jobErr) {
            console.error("Job Failed:", jobErr);
            res.status(500).json({ error: "Analysis failed during processing" });
        }

    } catch (err: any) {
        console.error("Analysis Error:", err);
        res.status(500).json({ error: "Analysis failed: " + err.message });
    }
});

// Helper to redact reports for Free Users
function redactAnalysis(data: any): any {
    const redacted = { ...data };

    // Metadata for the "Unlock" UI
    redacted.locked_counts = {
        leads: data.potential_leads?.length || 0,
        intent: data.buying_intent_signals?.length || 0,
        engagement: data.engagement_opportunities?.length || 0,
        features: data.feature_requests?.length || 0
    };

    // 2. Locked Lists (Stubbed)
    if (data.themes) {
        redacted.themes = data.themes.map(() => ({
            title: "Locked Theme",
            description: "This theme analysis is available on the Pro plan.",
            confidence: 90,
            citations: [],
            isLocked: true
        }));
    }

    if (data.pain_points) {
        redacted.pain_points = data.pain_points.map(() => ({
            issue: "Hidden Pain Point",
            severity: "Critical",
            description: "This pain point analysis is exclusive to Pro users.",
            isLocked: true
        }));
    }

    // 2. Locked Lists (Stubbed)
    if (data.potential_leads) {
        redacted.potential_leads = data.potential_leads.map(() => ({
            username: "Hidden Lead",
            platform: "Social",
            intent_context: "This high-value lead is available on the Pro plan.",
            original_post_id: "locked",
            isLocked: true
        }));
    }

    if (data.buying_intent_signals) {
        redacted.buying_intent_signals = data.buying_intent_signals.map(() => ({
            signal: "Buying Signal",
            context: "This purchasing intent signal is exclusive to Pro users.",
            confidence: "High",
            isLocked: true
        }));
    }

    if (data.engagement_opportunities) {
        redacted.engagement_opportunities = data.engagement_opportunities.map(() => ({
            thread_id: "locked",
            reason: "Engagement Opportunity",
            talking_points: ["Locked talking point 1", "Locked talking point 2"],
            isLocked: true
        }));
    }

    // Feature requests can remain visible or partially locked? 
    // User said "All the themes should be visible... just locked(main content)". 
    // Let's lock features too for consistency if they are considered "High Value".
    if (data.feature_requests) {
        redacted.feature_requests = data.feature_requests.map(() => ({
            feature: "Hidden Request",
            frequency: "High",
            context: "Unlock to see specific feature requests.",
            isLocked: true
        }));
    }

    // 3. Curiosity Gaps
    // delete redacted.quality_reasoning; // User requested unlock

    // 4. Signal Flag
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
        res.json(flattened);
    } catch (err: any) {
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
        if (data.folderId && data.folderId !== 'default') {
            try {
                // Apply Plan Limits (Truncate comments if on Free plan)
                const commentLimit = req.user.config.commentLimit; // e.g. 50 or -1

                // Detect the correct array key (Reddit/Twitter use flattenedComments, G2 uses reviews)
                let arrayKey = 'flattenedComments';
                if (Array.isArray(data.content.reviews)) {
                    arrayKey = 'reviews';
                } else if (Array.isArray(data.content.comments) && !data.content.flattenedComments) {
                    arrayKey = 'comments';
                }

                let items = data.content[arrayKey] || [];
                let originalCount = items.length;
                let truncated = false;

                if (commentLimit > 0 && originalCount > commentLimit) {
                    console.log(`[Limit] Truncating ${arrayKey} from ${originalCount} to ${commentLimit} for user ${req.user.uid}`);
                    items = items.slice(0, commentLimit);
                    truncated = true;
                }

                // Update the content object with truncated array
                const updatedContent = { ...data.content };
                updatedContent[arrayKey] = items;
                updatedContent.originalCommentCount = originalCount;
                updatedContent.truncated = truncated;

                // Adapt ExtractedData to what the dashboard expects for ThreadData
                const threadPayload = {
                    post: data.content.post || { title: data.title }, // Fallback for G2 which might not have 'post' object
                    content: updatedContent,
                    metadata: {
                        fetchedAt: data.extractedAt,
                        totalCommentsFetched: items.length,
                        originalCommentCount: originalCount, // Persist for UI
                        truncated: truncated,
                        toolVersion: "ext-1.0.1",
                        source: data.source
                    }
                };
                await saveThreadToFolder(req.user.uid, data.folderId, threadPayload);
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
        firebase: !!getAdminAuth(),
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
