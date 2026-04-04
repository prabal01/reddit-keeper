import express from "express";
import { config } from "./config/env.js";
import { handleDailyGeneration, handleSessionCleanup } from "./handlers/generate.js";
import { handleTelegramWebhook } from "./handlers/webhook.js";
import { initDb } from "./db/firestore.js";

// Initialize unified bot
const app = express();
app.use(express.json());

// Initialize Firestore
try {
  initDb();
} catch (err) {
  console.error("❌ Failed to initialize DB:", err);
}

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", bot: "Unified Marketing Bot v1.0", timestamp: new Date().toISOString() });
});

/**
 * TRIGGER-BASED FLOWS (Twitter Content Engine)
 * These are hit by Cloud Scheduler
 */

app.post("/api/generate", async (req, res) => {
  const authHeader = req.headers["x-scheduler-key"];
  if (authHeader !== config.scheduler.secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const result = await handleDailyGeneration();
  res.json(result);
});

app.post("/api/cleanup", async (req, res) => {
  const authHeader = req.headers["x-scheduler-key"];
  if (authHeader !== config.scheduler.secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const result = await handleSessionCleanup();
  res.json(result);
});

/**
 * WEBHOOK-BASED FLOWS (Interactive)
 * This handles BOTH Twitter selection/editing AND Reddit Researcher URL analysis.
 */
app.post("/api/webhook/telegram", handleTelegramWebhook);

// Start server
app.listen(config.server.port, "0.0.0.0", () => {
  console.log(`🚀 Unified Marketing Bot running on port ${config.server.port}`);
  console.log(`📡 Hosting both content engine and researcher logic.`);
});
