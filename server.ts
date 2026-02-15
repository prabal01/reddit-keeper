import "dotenv/config";
import express from "express";
import cors from "cors";
import { default as PQueue } from "p-queue";
import { parseRedditUrl, buildJsonUrl } from "./src/reddit/parser.js";
import {
    transformPost,
    transformComment,
    extractCommentsFromListing,
    mergeIntoTree,
    countComments,
} from "./src/reddit/tree-builder.js";
import type {
    RedditThing,
    RedditListing,
    RedditPostData,
    RedditCommentData,
    RedditMoreData,
    Comment,
} from "./src/reddit/types.js";
import { initFirebase, incrementFetchCount, getPlanConfig, logFetchEvent } from "./server/firestore.js";
import { authMiddleware, getEffectiveConfig } from "./server/middleware/auth.js";
import { rateLimiterMiddleware } from "./server/middleware/rateLimiter.js";
import { initPayments, createCheckoutUrl } from "./server/stripe.js";
import {
    getFolders,
    createFolder,
    deleteFolder,
    saveThreadToFolder,
    getThreadsInFolder
} from "./server/firestore.js";

// ── Init ───────────────────────────────────────────────────────────

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);
const USER_AGENT = "reddit-dl/1.0.0";
const TOOL_VERSION = "1.0.0";
const RATE_LIMIT_DELAY = 1000;

// Initialize Firebase & Payments (non-blocking — app works without them)
initFirebase();
initPayments();

// ── Request Queue (max 20 concurrent Reddit fetches) ───────────────

const fetchQueue = new PQueue({ concurrency: 20, timeout: 30_000 });

// ── Middleware ──────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(authMiddleware);

// ── Helpers ────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": USER_AGENT,
                    Accept: "application/json",
                },
            });

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

app.post("/api/fetch", rateLimiterMiddleware, async (req, res) => {
    try {
        const { url, sort = "confidence" } = req.body;

        if (!url) {
            res.status(400).json({ error: "URL is required" });
            return;
        }

        const config = await getEffectiveConfig(req);

        const result = await fetchQueue.add(async () => {
            const urlInfo = parseRedditUrl(url);
            const jsonUrl = buildJsonUrl(urlInfo, sort);
            const data = await fetchWithRetry(jsonUrl);

            if (!Array.isArray(data) || data.length < 2) {
                throw new Error("Invalid Reddit post URL.");
            }

            const postListing = data[0] as RedditThing<RedditListing<RedditPostData>>;
            const rawPost = postListing.data.children[0].data;
            const post = transformPost(rawPost);

            if (!urlInfo.subreddit) urlInfo.subreddit = post.subreddit;

            const commentListing = data[1] as RedditThing<
                RedditListing<RedditCommentData | RedditMoreData>
            >;
            const { comments, moreIds } = extractCommentsFromListing(commentListing);
            const postFullname = rawPost.name;

            if (moreIds.length > 0) {
                await resolveMoreComments(
                    comments,
                    moreIds,
                    postFullname,
                    config.maxMoreCommentsBatches
                );
            }

            return { post, comments, urlInfo };
        });

        if (!result) {
            res.status(503).json({ error: "Server busy. Please try again." });
            return;
        }

        const { post, comments } = result;
        const totalCommentsFetched = countComments(comments);

        const commentLimit = config.commentLimit;
        const truncated = commentLimit !== -1 && totalCommentsFetched > commentLimit;
        const finalComments = truncateComments(comments, commentLimit);

        if (req.user?.uid) {
            incrementFetchCount(req.user.uid).catch(() => { });
        }

        // Log analytics event (non-blocking)
        logFetchEvent({
            uid: req.user?.uid || "anonymous",
            email: req.user?.email,
            url,
            plan: req.user?.plan || "free",
            commentCount: totalCommentsFetched,
            status: "success",
            userAgent: req.headers["user-agent"],
        }).catch(() => { });

        res.json({
            post,
            comments: finalComments,
            metadata: {
                fetchedAt: new Date().toISOString(),
                totalCommentsFetched,
                commentsReturned: countComments(finalComments),
                truncated,
                commentLimit: truncated ? commentLimit : undefined,
                toolVersion: TOOL_VERSION,
            },
        });
    } catch (error: any) {
        // Log failure event
        logFetchEvent({
            uid: req.user?.uid || "anonymous",
            email: req.user?.email,
            url: req.body?.url || "unknown",
            plan: "unknown",
            commentCount: 0,
            status: "error",
            error: error.message,
            userAgent: req.headers["user-agent"],
        }).catch(() => { });

        if (error.message?.includes("timed out")) {
            res.status(503).json({
                error: "Server is busy. Please try again in a moment.",
            });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// ── User Plan endpoint ─────────────────────────────────────────────

app.get("/api/user/plan", async (req, res) => {
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
});

// ── Upgrade (stub — no payment provider yet) ───────────────────────

app.post("/api/create-checkout-session", async (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: "Please sign in to upgrade." });
        return;
    }

    try {
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

app.get("/api/folders", async (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const folders = await getFolders(req.user.uid);
        res.json(folders);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/folders", async (req, res) => {
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
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/folders/:id", async (req, res) => {
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

app.post("/api/folders/:id/threads", async (req, res) => {
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

app.get("/api/folders/:id/threads", async (req, res) => {
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

// ── Health Check ───────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
    res.json({
        status: "ok",
        version: TOOL_VERSION,
        queueSize: fetchQueue.size,
        queuePending: fetchQueue.pending,
    });
});

// ── Start ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`🚀 Reddit proxy server running on http://localhost:${PORT}`);
    console.log(`   Queue concurrency: 20 | Timeout: 30s`);
});
