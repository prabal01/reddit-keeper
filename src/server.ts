
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import { redis } from "./server/middleware/rateLimiter.js";
import { initFirebase, getFirebaseStatus } from "./server/firestore.js";
import {
    syncQueue,
    granularAnalysisQueue,
    syncWorker,
    granularAnalysisWorker,
} from "./server/queues.js";
import { authMiddleware } from "./server/middleware/auth.js";
import { rateLimiterMiddleware } from "./server/middleware/rateLimiter.js";
import { config, validateConfig, TOOL_VERSION } from "./server/config.js";

// ── Feature Routers ───────────────────────────────────────────────
import marketingRouter from "./server/marketing/leads.js";
import adminRouter from "./server/admin/router.js";
import monitoringRouter from "./server/monitoring/router.js";
import discoveryRouter from "./server/discovery/router.js";
import userRouter from "./server/user/router.js";
import paymentsRouter from "./server/payments/router.js";
import foldersRouter from "./server/folders/router.js";
import extractionsRouter from "./server/extractions/router.js";
import authRouter from "./server/auth/router.js";
import toolsRouter from "./server/tools/router.js";
import { addWaitlistEntry } from "./server/admin.js";

import { initMonitoring, monitoringScraperWorker, opportunityMatcherWorker } from "./server/monitoring/worker.js";

const PORT = config.port;

console.log("[INIT] Starting server.ts...");
console.log(`[INIT] Node Version: ${process.version}`);
console.log(`[INIT] PORT: ${PORT}`);
validateConfig();

// Initialize Firebase (non-blocking)
try {
    initFirebase();
} catch (err) {
    console.error("[INIT] FATAL: Firebase init failed:", err);
}

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
});

// ── App Setup ──────────────────────────────────────────────────────

const app = express();

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:4321",
    "https://admin.opiniondeck.com",
    ...config.allowedOrigins,
];

app.use(helmet());
app.use(cors({
    origin(origin, callback) {
        if (!origin) {
            if (!config.isProd) return callback(null, true);
            return callback(new Error("Origin missing"), false);
        }
        if (origin.startsWith("chrome-extension://")) return callback(null, true);
        if (
            allowedOrigins.includes(origin) ||
            origin.startsWith("http://127.0.0.1:") ||
            origin.startsWith("http://localhost:")
        ) {
            return callback(null, true);
        }
        callback(new Error(`CORS: origin not allowed: ${origin}`), false);
    },
    credentials: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(authMiddleware);
app.use(rateLimiterMiddleware);

// ── Route Mounting ────────────────────────────────────────────────

app.use("/api/admin/marketing", marketingRouter);
app.use("/api/admin", adminRouter);
app.use("/api/monitoring", monitoringRouter);
app.use("/api/discovery", discoveryRouter);
app.use("/api/user", userRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/folders", foldersRouter);
app.use("/api/extractions", extractionsRouter);
app.use("/api/auth", authRouter);
app.use("/api/tools", toolsRouter);

// Public waitlist signup — frontend calls POST /api/waitlist directly
app.post("/api/waitlist", async (req, res) => {
    const { email } = req.body;
    if (!email) return void res.status(400).json({ error: "Email is required" });
    try {
        await addWaitlistEntry(email);
        res.json({ success: true });
    } catch (err) {
        console.error("[Waitlist] Failed:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── Health Check ───────────────────────────────────────────────────

app.get("/api/health", async (_req, res) => {
    const checks: Record<string, { status: string; detail?: string }> = {};

    try {
        const pong = await redis.ping();
        checks.redis = { status: pong === "PONG" ? "healthy" : "degraded", detail: redis.status };
    } catch {
        checks.redis = { status: "unhealthy", detail: redis.status };
    }

    const fbStatus = getFirebaseStatus();
    checks.firestore = { status: fbStatus.initialized ? "healthy" : "unhealthy", detail: fbStatus.error || undefined };

    let queueCounts;
    try {
        queueCounts = await syncQueue.getJobCounts();
        checks.queue = { status: "healthy" };
    } catch {
        checks.queue = { status: "unhealthy" };
    }

    const allHealthy = Object.values(checks).every(c => c.status === "healthy");
    res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? "ok" : "degraded",
        version: TOOL_VERSION,
        uptime: Math.floor(process.uptime()),
        checks,
        queue: queueCounts,
    });
});

// ── Global Error Handler ──────────────────────────────────────────

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled Error:", err);
    res.status(500).json({ error: "Internal server error" });
});

// ── Start ──────────────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 OpinionDeck running on port ${PORT}`);
    console.log(`   Redis: ${redis.status}`);
    initMonitoring().catch(err => console.error("[INIT] Monitoring init failed:", err));
});

// ── Graceful Shutdown ──────────────────────────────────────────────

async function gracefulShutdown(signal: string) {
    console.log(`[SHUTDOWN] ${signal} received. Closing...`);
    const forceExit = setTimeout(() => process.exit(1), 10000);
    forceExit.unref();
    try {
        await Promise.all([
            syncWorker.close(),
            granularAnalysisWorker.close(),
            monitoringScraperWorker.close(),
            opportunityMatcherWorker.close(),
        ]);
        await Promise.all([
            syncQueue.close(),
            granularAnalysisQueue.close(),
        ]);
        await redis.quit();
        process.exit(0);
    } catch (err) {
        console.error("[SHUTDOWN] Error:", err);
        process.exit(1);
    }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
