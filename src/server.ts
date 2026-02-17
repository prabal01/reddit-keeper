
import "dotenv/config";
import express from "express";
import cors from "cors";
import { default as PQueue } from "p-queue";
import { parseRedditUrl, buildJsonUrl } from "./reddit/parser.js";
import {
    transformPost,
    transformComment,
    extractCommentsFromListing,
    mergeIntoTree,
    countComments,
} from "./reddit/tree-builder.js";
import type {
    RedditThing,
    RedditListing,
    RedditPostData,
    RedditCommentData,
    RedditMoreData,
    Comment,
} from "./reddit/types.js";
import { initFirebase, incrementFetchCount, getPlanConfig, logFetchEvent } from "./server/firestore.js";
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
} from "./server/firestore.js";
import { analyzeThreads } from "./server/ai.js";

// ── Init ───────────────────────────────────────────────────────────

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const TOOL_VERSION = "1.0.1";
const RATE_LIMIT_DELAY = 1000;

// Initialize Firebase & Payments (non-blocking — app works without them)
console.log("Initializing Firebase...");
initFirebase();
console.log("Initializing Payments...");
initPayments();

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
});

// ── Request Queue (max 20 concurrent Reddit fetches) ───────────────

const fetchQueue = new PQueue({ concurrency: 20, timeout: 30_000 });

// ── Analysis Queue (max 5 concurrent AI jobs) ─────────────────────

const analysisQueue = new PQueue({ concurrency: 5, timeout: 60_000 });

// ── Middleware ──────────────────────────────────────────────────────

// CORS Configuration
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:4321",
    "https://redditkeeperprod.web.app",
    "https://opiniondeck-app.web.app",
    "https://opiniondeck.com",
    "https://www.opiniondeck.com",
    "https://app.opiniondeck.com"
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
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

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Fetch] Attempt ${attempt}/${maxRetries}: ${url}`);
            const response = await fetch(url, {
                headers: {
                    "User-Agent": USER_AGENT,
                    Accept: "application/json",
                },
            });

            console.log(`[Fetch] Status: ${response.status} ${response.statusText}`);

            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get("retry-after") || "5");
                await sleep(retryAfter * 1000);
                continue;
            }

            if (response.status === 503 || response.status === 500) {
                await sleep(Math.pow(2, attempt) * 1000);
                continue;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error: any) {
            console.error(`[Fetch] Error on attempt ${attempt}:`, error.message);
            if (attempt === maxRetries) {
                throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
            }
            await sleep(Math.pow(2, attempt) * 1000);
        }
    }
}

async function resolveMoreComments(
    tree: Comment[],
    moreIds: string[],
    linkId: string,
    maxBatches: number
): Promise<void> {
    const batchSize = 100;
    let batchCount = 0;

    for (let i = 0; i < moreIds.length; i += batchSize) {
        if (maxBatches !== -1 && batchCount >= maxBatches) break;
        batchCount++;

        const batch = moreIds.slice(i, i + batchSize);
        const childrenParam = batch.join(",");
        const url = `https://www.reddit.com/api/morechildren.json?api_type=json&link_id=${linkId}&children=${childrenParam}`;

        try {
            const response = await fetchWithRetry(url);
            if (response?.json?.data?.things) {
                const things = response.json.data.things;
                const newComments: Comment[] = [];

                for (const thing of things) {
                    if (thing.kind === "t1") {
                        newComments.push(transformComment(thing.data));
                    }
                }

                if (newComments.length > 0) {
                    mergeIntoTree(tree, newComments);
                }
            }
        } catch {
            // Continue on error — partial data is better than none
        }

        if (i + batchSize < moreIds.length) {
            await sleep(RATE_LIMIT_DELAY);
        }
    }
}

// ── Truncate comment tree ──────────────────────────────────────────

function truncateComments(comments: Comment[], limit: number): Comment[] {
    if (limit === -1) return comments;

    let count = 0;
    function truncateLevel(nodes: Comment[]): Comment[] {
        const result: Comment[] = [];
        for (const node of nodes) {
            if (count >= limit) break;
            count++;
            result.push({
                ...node,
                replies: truncateLevel(node.replies),
            });
        }
        return result;
    }

    return truncateLevel(comments);
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
        res.status(500).json({ error: err.message, stack: err.stack });
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
        await deleteFolder(req.user.uid, req.params.id);
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
        await saveThreadToFolder(req.user.uid, req.params.id, threadData);
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
        const threads = await getThreadsInFolder(req.user.uid, req.params.id);
        res.json(threads);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── AI Analysis Route ─────────────────────────────────────────────

app.post("/api/folders/:id/analyze", async (req: express.Request, res: express.Response) => {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    try {
        // 1. Fetch folder details for context
        const folder = await getFolder(req.user.uid, req.params.id);
        const folderContext = folder?.description || "";

        // 2. Fetch all threads in folder
        const savedThreads = await getThreadsInFolder(req.user.uid, req.params.id);

        if (savedThreads.length === 0) {
            res.status(400).json({ error: "Folder is empty" });
            return;
        }

        // 3. Add to Analysis Queue
        const analysisResult = await analysisQueue.add(async () => {
            console.log(`[AI] Starting analysis for folder ${req.params.id} (${savedThreads.length} threads)`);

            // Map to simplified context for AI
            const threadsContext = savedThreads.map(t => ({
                id: t.id,
                title: t.title,
                subreddit: t.subreddit,
                comments: t.data.comments // Full comment tree
            }));

            return await analyzeThreads(threadsContext, folderContext);
        });

        // 3. Save & Return
        const parsedResult = JSON.parse(analysisResult);
        // Inject timestamp for immediate frontend display
        parsedResult.createdAt = new Date().toISOString();

        // Save to Firestore (Fire & Forget)
        saveAnalysis(req.user.uid, req.params.id, parsedResult, "gemini-flash-latest");

        // Deduct Credit (Increment Usage)
        await updateStats(req.user.uid, {
            reportsGenerated: 1,
            intelligenceScanned: savedThreads.length,
            // Estimate hours saved (approx 5 mins per thread manual reading)
            hoursSaved: parseFloat((savedThreads.length * 5 / 60).toFixed(1))
        });

        res.json(parsedResult);

    } catch (err: any) {
        console.error("Analysis Error:", err);
        if (err.message?.includes("GEMINI_API_KEY")) {
            res.status(500).json({ error: "AI Service not configured (missing key)" });
        } else if (err.message?.includes("timed out")) {
            res.status(503).json({ error: "Analysis timed out. Try analyzing fewer threads." });
        } else {
            res.status(500).json({ error: "Analysis failed: " + err.message });
        }
    }
});

app.get("/api/folders/:id/analysis", async (req: express.Request, res: express.Response) => {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const analyses = await getFolderAnalyses(req.user.uid, req.params.id);
        // Flatten the structure for the frontend
        const flattened = analyses.map(a => ({
            ...a.data,
            id: a.id,
            createdAt: a.createdAt || new Date().toISOString()
        }));
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

app.get("/api/health", (_req: express.Request, res: express.Response) => {
    res.json({
        status: "ok",
        version: TOOL_VERSION,
        queueSize: fetchQueue.size,
        queuePending: fetchQueue.pending,
        analysisQueueSize: analysisQueue.size,
        analysisQueuePending: analysisQueue.pending,
    });
});

// ── Error Handler ─────────────────────────────────────────────────

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("GLOBAL ERROR HANDLER:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
});

// ── Start ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`🚀 OpinionDeck Platform Server running on http://localhost:${PORT}`);
    console.log(`   Fetch Queue: 20 concurrent | Analysis Queue: 5 concurrent`);
});
