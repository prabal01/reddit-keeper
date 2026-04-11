/**
 * Centralized configuration — single source of truth for all env vars and constants.
 * Validates required vars at import time so the server fails fast with clear errors.
 */

// ── Constants ────────────────────────────────────────────────────────

// Rotate between realistic browser UAs to avoid static fingerprinting.
// Keep these current — Chrome auto-updates so real users have varied recent versions.
const USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

export function getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Keep a static export for places that need a stable single value (logging, etc.)
export const USER_AGENT = USER_AGENTS[0];

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

    // Payments — Razorpay
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,

    // Payments — Dodo
    dodoApiKey: process.env.DODO_PAYMENTS_API_KEY,
    dodoWebhookSecret: process.env.DODO_WEBHOOK_SECRET,
    dodoStarterProductId: process.env.DODO_STARTER_PRODUCT_ID,
    dodoProProductId: process.env.DODO_PRO_PRODUCT_ID,
    dodoEnvironment: process.env.DODO_ENVIRONMENT || 'test_mode',

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
        const required = ["ADMIN_SECRET"];
        const missing = required.filter((k) => !process.env[k]);
        if (missing.length > 0) {
            throw new Error(
                `Missing required env vars in production: ${missing.join(", ")}`
            );
        }
        if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            warnings.push("Neither FIREBASE_SERVICE_ACCOUNT nor GOOGLE_APPLICATION_CREDENTIALS set — Firebase will attempt default credentials");
        }
    }

    for (const w of warnings) {
        console.warn(`[CONFIG] ${w}`);
    }
}
