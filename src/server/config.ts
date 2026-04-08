/**
 * Centralized configuration — single source of truth for all env vars and constants.
 * Validates required vars at import time so the server fails fast with clear errors.
 */

// ── Constants ────────────────────────────────────────────────────────

export const USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export const RATE_LIMIT_DELAY = 1000;

export const TOOL_VERSION = "1.0.1";

// ── Environment ──────────────────────────────────────────────────────

export const config = {
    port: parseInt(process.env.PORT || "3001", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    isProd: process.env.NODE_ENV === "production",

    // Redis
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",

    // Google / AI
    googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT,
    googleCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    geminiApiKey: process.env.GEMINI_API_KEY,

    // Search
    googleSearchApiKey: process.env.GOOGLE_SEARCH_API_KEY,
    googleSearchCx: process.env.GOOGLE_SEARCH_CX,

    // Admin
    adminSecret: process.env.ADMIN_SECRET,

    // Payments
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,

    // Integrations
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,

    // CORS
    allowedOrigins: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(/[;,]/)
        : [
            "https://redditkeeperprod.web.app",
            "https://opiniondeck-app.web.app",
            "https://opiniondeck.com",
            "https://www.opiniondeck.com",
            "https://app.opiniondeck.com",
        ],
} as const;

// ── Startup Validation ───────────────────────────────────────────────

export function validateConfig(): void {
    const warnings: string[] = [];

    if (!process.env.REDIS_URL) {
        warnings.push("REDIS_URL not set — falling back to localhost:6379");
    }

    if (config.isProd) {
        const required = ["GOOGLE_APPLICATION_CREDENTIALS", "ADMIN_SECRET"];
        const missing = required.filter((k) => !process.env[k]);
        if (missing.length > 0) {
            throw new Error(
                `Missing required env vars in production: ${missing.join(", ")}`
            );
        }
    }

    for (const w of warnings) {
        console.warn(`[CONFIG] ${w}`);
    }
}
