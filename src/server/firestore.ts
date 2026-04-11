import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { errMsg, errCode } from "./utils/errors.js";
import { getStorage, type Storage } from "firebase-admin/storage";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { logger } from "./utils/logger.js";

let db: Firestore;
let auth: Auth;
let storage: Storage;
const initStatus = {
    initialized: false,
    error: null as string | null,
    source: "none" as "env" | "file" | "none"
};

export function initFirebase(): void {
    const firebaseServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    let serviceAccount: ServiceAccount | null = null;

    if (firebaseServiceAccount) {
        initStatus.source = "env";
        // Check if it's a JSON string or a path
        if (firebaseServiceAccount.trim().startsWith('{')) {
            try {
                serviceAccount = JSON.parse(firebaseServiceAccount);
            } catch (err: unknown) {
                initStatus.error = `JSON Parse Error: ${errMsg(err)}`;
                console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT JSON from environment.");
            }
        } else {
            const resolved = path.resolve(firebaseServiceAccount);
            if (fs.existsSync(resolved)) {
                try {
                    serviceAccount = JSON.parse(fs.readFileSync(resolved, "utf-8"));
                } catch (err: unknown) {
                    initStatus.error = `File Parse Error: ${errMsg(err)}`;
                    console.error(`❌ Failed to parse service-account.json at ${resolved}`);
                }
            } else {
                initStatus.error = `File Not Found: ${resolved}`;
                console.warn("⚠️ Firebase service account file not found. Auth & Firestore disabled.");
            }
        }
    } else {
        // Fallback to local file
        const defaultPath = path.resolve("./service-account.json");
        if (fs.existsSync(defaultPath)) {
            initStatus.source = "file";
            try {
                serviceAccount = JSON.parse(fs.readFileSync(defaultPath, "utf-8"));
            } catch (err: unknown) {
                initStatus.error = `Default File Parse Error: ${errMsg(err)}`;
                console.error("❌ Failed to parse default service-account.json");
            }
        } else {
            initStatus.error = "FIREBASE_SERVICE_ACCOUNT env var not set and local file missing.";
            console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT env var not set and local service-account.json missing.");
        }
    }

    if (serviceAccount) {
        try {
            const BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'redditkeeperprod.firebasestorage.app';
            initializeApp({
                credential: cert(serviceAccount),
                storageBucket: BUCKET
            });
            db = getFirestore();
            auth = getAuth();
            storage = getStorage();
            initStatus.initialized = true;
            initStatus.error = null;
            console.log(`✅ Firebase initialized successfully. Project: ${serviceAccount.projectId}`);
            console.log("✅ Storage Bucket:", BUCKET);
        } catch (err: unknown) {
            initStatus.error = `Init Error: ${errMsg(err)}`;
            console.error("❌ Firebase initialization failed:", errMsg(err));
            // In production, we want to know if this fails immediately.
            if (process.env.NODE_ENV === 'production') {
                throw new Error("CRITICAL: Firebase initialization failed in production: " + errMsg(err), { cause: err });
            }
        }
    }
}

export function getFirebaseStatus() {
    return initStatus;
}

export function getDb(): Firestore {
    return db;
}

export function getAdminAuth(): Auth {
    return auth;
}

export function getAdminStorage(): Storage {
    return storage;
}

// ── Plan Config types ──────────────────────────────────────────────

export interface PlanConfig {
    commentLimit: number;           // -1 = unlimited
    rateLimit: number;              // requests per minute
    rateLimitWindow: number;        // seconds
    maxMoreCommentsBatches: number; // -1 = unlimited
    bulkDownload: boolean;
    apiAccess: boolean;
    exportHistory: boolean;
    exportHistoryDays: number;
    priorityQueue: boolean;
    discoveryLimit: number;         // monthly discovery searches
    analysisLimit: number;          // monthly AI reports
    savedThreadLimit: number;       // total saved threads
    commentDepth: number;           // max comment depth
    monitorLimit: number;           // -1 = unlimited, max active monitors
    subredditsPerMonitor: number;   // -1 = unlimited, max subreddits per monitor
    teamSeats: number;              // -1 = unlimited
    serpQueriesPerDiscovery: number; // SERP queries per discovery (free=1, pro=3)
}

export interface UserDoc {
    uid: string;
    email: string;
    plan: "free" | "trial" | "starter" | "pro" | "professional" | "beta" | "enterprise" | "past_due";
    configOverrides: Partial<PlanConfig>;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    createdAt: string;
    fetchCount: number;
    discoveryCount: number;      // Track discovery searches
    analysisCount: number;       // Track AI reports generated
    savedThreadCount: number;    // Track total saved threads across folders
}

export interface Folder {
    id: string;
    uid: string;
    name: string;
    description?: string;
    color?: string;
    createdAt: string;
    threadCount: number;
    syncStatus?: 'idle' | 'syncing';
    pendingSyncCount?: number;
    analysisStatus?: 'idle' | 'processing' | 'complete' | 'failed';
    painPointCount?: number;
    triggerCount?: number;
    outcomeCount?: number;
    failedCount?: number;
    source_url?: string; // Original website URL used for discovery
    is_monitoring_active?: boolean;
    seed_keywords?: string[];
    niche?: string;
    market_summary?: string; // AI generated strategy summary
    pendingAnalysisCount?: number;
    totalAnalysisCount?: number;
    completedAnalysisCount?: number;
    intelligence_signals?: {
        allPainPointTitles: string[];
        allSwitchTriggerTitles: string[];
        allDesiredOutcomeTitles: string[];
    };
    currentAnalysisRunId?: string;
}

export interface Pattern {
    id: string;
    folderId: string;
    title: string;
    count: number;
    quote: string;
    thread_ids: string[];
    createdAt: string;
}

export interface Lead {
    id: string; // leadId
    folderId: string;
    uid: string;
    thread_id: string;
    status: "new" | "contacted" | "ignored";
    saved_at: string;
}

export interface MonitoringAlert {
    id: string;
    folderId: string;
    uid: string;
    type: 'discovery';
    newLeadsCount: number;
    newPatternsCount: number;
    timestamp: string;
    status: 'success' | 'no_new' | 'failed';
    keyword?: string;
    errorMessage?: string;
}

export interface SavedThread {
    id: string; // postfullname (e.g. t3_...)
    folderId: string;
    uid: string;
    title: string;
    author: string;
    subreddit: string;
    commentCount: number;
    source: string;
    data: any; // Full thread JSON snapshot
    storageUrl?: string; // Pointer to external storage
    tokenCount?: number;
    savedAt: string;
    analysisStatus?: 'pending' | 'processing' | 'success' | 'failed';
    analysisTriggeredAt?: string;
}

export async function getPatternsInFolder(uid: string, folderId: string) {
    if (!db) return [];
    const snapshot = await db.collection("folders").doc(folderId).collection("patterns").get();
    return snapshot.docs.map(doc => doc.data() as Pattern);
}

export async function getLeadsInFolder(uid: string, folderId: string, limit = 200) {
    if (!db) return [];
    const snapshot = await db.collection("folders").doc(folderId).collection("leads")
        .orderBy("saved_at", "desc")
        .limit(limit)
        .get();
    return snapshot.docs.map(doc => doc.data() as Lead);
}

export async function getMonitoringAlerts(uid: string, folderId: string): Promise<MonitoringAlert[]> {
    if (!db) return [];
    const snapshot = await db.collection("folders").doc(folderId)
        .collection("alerts")
        .orderBy("timestamp", "desc")
        .limit(50)
        .get();
    return snapshot.docs.map(doc => doc.data() as MonitoringAlert);
}

export interface StructuredThreadInsights {
    thread_id: string;
    pain_points: { title: string; quotes: string[] }[];
    switch_triggers: { title: string; quotes: string[] }[];
    desired_outcomes: { title: string; quotes: string[] }[];
}

export interface ThreadInsight {
    id: string; // threadId
    folderId: string;
    uid: string;
    threadLink: string;
    status: 'processing' | 'success' | 'failed';
    insights?: StructuredThreadInsights;
    error?: string;
    analyzedAt?: string;
}

export interface DiscoveryHistoryEntry {
    id: string;
    uid: string;
    type: 'competitor' | 'idea' | 'bulk';
    query: string;
    params: {
        communities?: string[];
        competitors?: string[];
        platforms: ('reddit' | 'hn')[];
        useAiBrain?: boolean;
    };
    resultsCount: number;
    createdAt: string;
    topResults?: {
        title: string;
        url: string;
        source: 'reddit' | 'hn' | 'google';
        score: number;
    }[];
    savedResults?: any[];
    discoveryPlan?: any;
}

// ── Default configs (used if Firestore not available) ──────────────

const DEFAULT_FREE_CONFIG: PlanConfig = {
    commentLimit: 50,
    rateLimit: 25,
    rateLimitWindow: 60,
    maxMoreCommentsBatches: 3,
    bulkDownload: false,
    apiAccess: false,
    exportHistory: false,
    exportHistoryDays: 0,
    priorityQueue: false,
    discoveryLimit: 3,
    analysisLimit: 1,
    savedThreadLimit: 5,
    commentDepth: 50,
    monitorLimit: 0,
    subredditsPerMonitor: 0,
    teamSeats: 1,
    serpQueriesPerDiscovery: 1,
};

const DEFAULT_TRIAL_CONFIG: PlanConfig = {
    commentLimit: 50,
    rateLimit: 30,
    rateLimitWindow: 60,
    maxMoreCommentsBatches: 3,
    bulkDownload: false,
    apiAccess: false,
    exportHistory: true,
    exportHistoryDays: 3,
    priorityQueue: false,
    discoveryLimit: 3,
    analysisLimit: 1,
    savedThreadLimit: 5,
    commentDepth: 50,
    monitorLimit: 3,
    subredditsPerMonitor: 10,
    teamSeats: 1,
    serpQueriesPerDiscovery: 1,
};

const DEFAULT_STARTER_CONFIG: PlanConfig = {
    commentLimit: 50,
    rateLimit: 30,
    rateLimitWindow: 60,
    maxMoreCommentsBatches: 3,
    bulkDownload: false,
    apiAccess: false,
    exportHistory: true,
    exportHistoryDays: 7,
    priorityQueue: false,
    discoveryLimit: 3,
    analysisLimit: 1,
    savedThreadLimit: 5,
    commentDepth: 50,
    monitorLimit: 3,
    subredditsPerMonitor: 10,
    teamSeats: 1,
    serpQueriesPerDiscovery: 1,
};

const DEFAULT_PROFESSIONAL_CONFIG: PlanConfig = {
    commentLimit: 5000,
    rateLimit: 100,
    rateLimitWindow: 60,
    maxMoreCommentsBatches: -1,
    bulkDownload: true,
    apiAccess: false,
    exportHistory: true,
    exportHistoryDays: 90,
    priorityQueue: true,
    discoveryLimit: 30,
    analysisLimit: 10,
    savedThreadLimit: 500,
    commentDepth: 500,
    monitorLimit: 10,
    subredditsPerMonitor: 20,
    teamSeats: 3,
    serpQueriesPerDiscovery: 3,
};

const DEFAULT_PRO_CONFIG: PlanConfig = {
    commentLimit: 5000,
    rateLimit: 60,
    rateLimitWindow: 60,
    maxMoreCommentsBatches: -1,
    bulkDownload: true,
    apiAccess: true,
    exportHistory: true,
    exportHistoryDays: 30,
    priorityQueue: true,
    discoveryLimit: 30,
    analysisLimit: 10,
    savedThreadLimit: 500,
    commentDepth: 500,
    monitorLimit: 10,
    subredditsPerMonitor: 20,
    teamSeats: 3,
    serpQueriesPerDiscovery: 3,
};

const DEFAULT_ENTERPRISE_CONFIG: PlanConfig = {
    commentLimit: -1,
    rateLimit: 300,
    rateLimitWindow: 60,
    maxMoreCommentsBatches: -1,
    bulkDownload: true,
    apiAccess: true,
    exportHistory: true,
    exportHistoryDays: -1,
    priorityQueue: true,
    discoveryLimit: -1,
    analysisLimit: -1,
    savedThreadLimit: -1,
    commentDepth: -1,
    monitorLimit: -1,
    subredditsPerMonitor: -1,
    teamSeats: -1,
    serpQueriesPerDiscovery: 5,
};

const DEFAULT_BETA_CONFIG: PlanConfig = {
    commentLimit: 500,
    rateLimit: 40,
    rateLimitWindow: 60,
    maxMoreCommentsBatches: 5,
    bulkDownload: true,
    apiAccess: false,
    exportHistory: true,
    exportHistoryDays: 7,
    priorityQueue: false,
    discoveryLimit: 15,
    analysisLimit: 5,
    savedThreadLimit: 30,
    commentDepth: 100,
    monitorLimit: 5,
    subredditsPerMonitor: 15,
    teamSeats: 2,
    serpQueriesPerDiscovery: 2,
};

// ── Plan config cache (5-min TTL) ──────────────────────────────────

const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const planConfigCache: Map<string, { config: PlanConfig; cachedAt: number }> = new Map();

export async function getPlanConfig(plan: string): Promise<PlanConfig> {
    const cached = planConfigCache.get(plan);
    if (cached && Date.now() - cached.cachedAt < CONFIG_CACHE_TTL) {
        return cached.config;
    }

    if (!db) {
        throw new Error("Firebase DB not initialized. Cannot fetch plan config.");
    }

    const getDefaultConfig = (p: string): PlanConfig => {
        switch (p) {
            case "trial":        return DEFAULT_TRIAL_CONFIG;
            case "starter":     return DEFAULT_STARTER_CONFIG;
            case "pro":         return DEFAULT_PRO_CONFIG;
            case "professional": return DEFAULT_PROFESSIONAL_CONFIG;
            case "enterprise":  return DEFAULT_ENTERPRISE_CONFIG;
            case "beta":        return DEFAULT_BETA_CONFIG;
            default:            return DEFAULT_FREE_CONFIG;
        }
    };

    try {
        const doc = await db.collection("plan_configs").doc(plan).get();
        if (doc.exists) {
            const config = { ...getDefaultConfig(plan), ...doc.data() } as PlanConfig;
            planConfigCache.set(plan, { config, cachedAt: Date.now() });
            return config;
        }
    } catch (err) {
        console.error(`Failed to load plan config for "${plan}":`, err);
    }

    const fallback = getDefaultConfig(plan);
    planConfigCache.set(plan, { config: fallback, cachedAt: Date.now() });
    return fallback;
}

// ── Global Config (discovery config, etc) ──────────────────────────

export interface GlobalConfig {
    // Discovery
    discovery_cache_ttl: number;                  // seconds (default: 7 days)
    discovery_enrichment_limit: number;           // default: 10

    // SERP API (Searlo)
    searlo_daily_cap: number;                     // max SERP calls/day globally (default: 50)
    searlo_response_cache_ttl: number;            // seconds (default: 86400 = 24h)
    searlo_max_retries: number;                   // retry on 5xx (default: 2)

    // Monitoring
    monitoring_scrape_interval_hours: number;     // cron interval (default: 8)
    monitoring_subreddit_cooldown_hours: number;  // Redis cooldown (default: 8)
    monitoring_freshness_threshold_hours: number; // archive freshness window before proxy fallback (default: 24)
    monitoring_min_archive_posts: number;         // min recent posts from archives before proxy fallback (default: 5)
    monitoring_scoring_batch_size: number;        // posts per AI scoring call (default: 5)
    monitoring_max_posts_to_score: number;        // per monitor per cycle (default: 20)

    // Proxy
    proxy_fallback_enabled: boolean;              // enable/disable proxy fallback (default: true)

    // AI
    embedding_cache_ttl: number;                  // seconds (default: 60 days)
    arbitration_delay_ms: number;                 // delay between dedup AI calls (default: 200)

    // Thread caching
    thread_cache_ttl: number;                     // seconds (default: 7 days)
}

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
    discovery_cache_ttl: 7 * 24 * 3600,
    discovery_enrichment_limit: 10,
    searlo_daily_cap: 50,
    searlo_response_cache_ttl: 86400,
    searlo_max_retries: 2,
    monitoring_scrape_interval_hours: 8,
    monitoring_subreddit_cooldown_hours: 8,
    monitoring_freshness_threshold_hours: 24,
    monitoring_min_archive_posts: 5,
    monitoring_scoring_batch_size: 5,
    monitoring_max_posts_to_score: 20,
    proxy_fallback_enabled: true,
    embedding_cache_ttl: 60 * 86400,
    arbitration_delay_ms: 200,
    thread_cache_ttl: 7 * 24 * 3600,
};

const GLOBAL_CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
let globalConfigCache: { config: GlobalConfig; cachedAt: number } | null = null;

export async function getGlobalConfig(): Promise<GlobalConfig> {
    if (globalConfigCache && Date.now() - globalConfigCache.cachedAt < GLOBAL_CONFIG_CACHE_TTL) {
        return globalConfigCache.config;
    }

    if (!db) {
        return DEFAULT_GLOBAL_CONFIG;
    }

    try {
        logger.info({ action: 'DB_READ', collection: 'config', doc: 'global' }, `[Firestore] Reading global config`);
        const doc = await db.collection("config").doc("global").get();
        if (doc.exists) {
            const config = { ...DEFAULT_GLOBAL_CONFIG, ...doc.data() } as GlobalConfig;
            globalConfigCache = { config, cachedAt: Date.now() };
            return config;
        }
    } catch (err) {
        logger.error({ err, action: 'DB_READ_ERROR', collection: 'config' }, `Failed to load global config`);
    }

    globalConfigCache = { config: DEFAULT_GLOBAL_CONFIG, cachedAt: Date.now() };
    return DEFAULT_GLOBAL_CONFIG;
}

// ── Resolve user's effective config (plan + overrides) ─────────────

export function resolveUserConfig(
    planConfig: PlanConfig,
    overrides: Partial<PlanConfig> = {}
): PlanConfig {
    return { ...planConfig, ...overrides };
}

// ── User cache (60s TTL) ───────────────────────────────────────────

const USER_CACHE_TTL = 60 * 1000;
const userCache: Map<string, { user: UserDoc; cachedAt: number }> = new Map();

export async function getOrCreateUser(
    uid: string,
    email: string
): Promise<UserDoc> {
    const cached = userCache.get(uid);
    if (cached && Date.now() - cached.cachedAt < USER_CACHE_TTL) {
        return cached.user;
    }

    if (!db) {
        throw new Error("Firebase DB not initialized. Cannot get or create user.");
    }

    const ref = db.collection("users").doc(uid);
    const doc = await ref.get();

    if (doc.exists) {
        const user = doc.data() as UserDoc;
        userCache.set(uid, { user, cachedAt: Date.now() });
        return user;
    }

    // Create new user doc
    const newUser: UserDoc = {
        uid,
        email,
        plan: "free",
        configOverrides: {},
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        createdAt: new Date().toISOString(),
        fetchCount: 0,
        discoveryCount: 0,
        analysisCount: 0,
        savedThreadCount: 0,
    };

    await ref.set(newUser);
    userCache.set(uid, { user: newUser, cachedAt: Date.now() });
    return newUser;
}

// ── Update user plan ───────────────────────────────────────────────

export async function updateUserPlan(
    uid: string,
    plan: UserDoc["plan"],
    stripeData?: {
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
    }
): Promise<void> {
    if (!db) return;

    const update: Record<string, any> = { plan };
    if (stripeData?.stripeCustomerId) {
        update.stripeCustomerId = stripeData.stripeCustomerId;
    }
    if (stripeData?.stripeSubscriptionId) {
        update.stripeSubscriptionId = stripeData.stripeSubscriptionId;
    }

    await db.collection("users").doc(uid).set(update, { merge: true });

    // Invalidate cache
    userCache.delete(uid);
}

// ── Increment fetch count ──────────────────────────────────────────

export async function incrementFetchCount(uid: string): Promise<void> {
    if (!db) return;

    const { FieldValue } = await import("firebase-admin/firestore");
    await db
        .collection("users")
        .doc(uid)
        .update({ fetchCount: FieldValue.increment(1) });
}

export async function incrementDiscoveryCount(uid: string): Promise<void> {
    if (!db) return;
    const { FieldValue } = await import("firebase-admin/firestore");
    await db.collection("users").doc(uid).update({
        discoveryCount: FieldValue.increment(1)
    });
}

export async function incrementAnalysisCount(uid: string): Promise<void> {
    if (!db) return;
    const { FieldValue } = await import("firebase-admin/firestore");
    await db.collection("users").doc(uid).update({
        analysisCount: FieldValue.increment(1)
    });
}

export async function incrementSavedThreadCount(uid: string): Promise<void> {
    if (!db) return;
    const { FieldValue } = await import("firebase-admin/firestore");
    await db.collection("users").doc(uid).update({
        savedThreadCount: FieldValue.increment(1)
    });
}

export async function decrementSavedThreadCount(uid: string): Promise<void> {
    if (!db) return;
    const { FieldValue } = await import("firebase-admin/firestore");
    await db.collection("users").doc(uid).update({
        savedThreadCount: FieldValue.increment(-1)
    });
}

// ── Find user by Stripe Customer ID ────────────────────────────────

export async function findUserByStripeCustomerId(
    customerId: string
): Promise<UserDoc | null> {
    if (!db) return null;

    const snapshot = await db
        .collection("users")
        .where("stripeCustomerId", "==", customerId)
        .limit(1)
        .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as UserDoc;
}

// ── Folder Management ──────────────────────────────────────────────

export async function getFolders(uid: string): Promise<Folder[]> {
    if (!db) throw new Error("Firebase DB not initialized. Cannot get folders.");
    try {
        const snapshot = await db.collection("folders")
            .where("uid", "==", uid)
            .get();
        return snapshot.docs
            .map((doc: any) => ({ id: doc.id, ...doc.data() } as Folder))
            .sort((a: Folder, b: Folder) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
        console.error("Failed to get folders:", err);
        return [];
    }
}

export async function createFolder(uid: string, name: string, description?: string, source_url?: string): Promise<Folder> {
    if (!db) throw new Error("Firebase DB not initialized");
    const ref = db.collection("folders").doc();
    const folder: Folder = {
        id: ref.id,
        uid,
        name,
        color: "#6366f1", // Default indigo
        createdAt: new Date().toISOString(),
        threadCount: 0,
        ...(description ? { description } : {}),
        ...(source_url ? { source_url } : {}),
    };
    await ref.set(folder);
    return folder;
}

export async function getFolder(uid: string, folderId: string): Promise<Folder | null> {
    if (!db) return null;
    const doc = await db.collection("folders").doc(folderId).get();
    if (doc.exists && doc.data()?.uid === uid) {
        return doc.data() as Folder;
    }
    return null;
}

export async function deleteFolder(uid: string, folderId: string): Promise<void> {
    if (!db) return;
    const ref = db.collection("folders").doc(folderId);
    const doc = await ref.get();
    if (doc.exists && doc.data()?.uid === uid) {
        // Delete all threads in folder (Batch delete)
        const threads = await db.collection("saved_threads")
            .where("folderId", "==", folderId)
            .get();

        const batch = db.batch();
        const threadCount = threads.size;
        threads.docs.forEach((d: any) => batch.delete(d.ref));
        batch.delete(ref);

        // Decrement global savedThreadCount
        const { FieldValue } = await import("firebase-admin/firestore");
        batch.update(db.collection("users").doc(uid), {
            savedThreadCount: FieldValue.increment(-threadCount)
        });

        await batch.commit();
    }
}

export async function updateFolderSyncStatus(uid: string, folderId: string, status: 'idle' | 'syncing'): Promise<void> {
    if (!db) return;
    try {
        await db.collection("folders").doc(folderId).update({ syncStatus: status });
    } catch (err) {
        console.error(`[FIRESTORE] Failed to update sync status for folder ${folderId}:`, err);
    }
}

export async function incrementPendingSyncCount(uid: string, folderId: string, delta: number): Promise<void> {
    if (!db) return;
    try {
        const folderRef = db.collection("folders").doc(folderId);

        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(folderRef);
            if (!doc.exists) return;

            const currentCount = doc.data()?.pendingSyncCount || 0;
            const newCount = Math.max(0, currentCount + delta); // Prevent negative numbers

            if (newCount === 0) {
                // Done syncing
                transaction.update(folderRef, {
                    pendingSyncCount: 0,
                    syncStatus: 'idle'
                });
            } else {
                // Still syncing
                transaction.update(folderRef, {
                    pendingSyncCount: newCount
                });
            }
        });
    } catch (err) {
        console.error(`[FIRESTORE] Failed to increment pending sync count for folder ${folderId}:`, err);
    }
}

export async function updateFolderAnalysisStatus(uid: string, folderId: string, status: Folder['analysisStatus'], analysisRunId?: string): Promise<void> {
    if (!db) return;
    try {
        const update: any = { analysisStatus: status };
        if (analysisRunId) {
            update.currentAnalysisRunId = analysisRunId;
        }
        await db.collection("folders").doc(folderId).update(update);
    } catch (err) {
        console.error(`[FIRESTORE] Failed to update analysis status for folder ${folderId}:`, err);
    }
}


export async function updateThreadInsight(uid: string, folderId: string, insight: ThreadInsight): Promise<void> {
    if (!db || !insight.id) {
        console.warn(`[FIRESTORE] updateThreadInsight skipped: Missing DB or Insight ID`);
        return;
    }
    try {
        console.log(`[FIRESTORE] Processing intelligence aggregation for thread ${insight.id} in folder ${folderId}...`);
        const { FieldValue } = await import("firebase-admin/firestore");
        const folderRef = db.collection("folders").doc(folderId);
        const threadRef = db.collection("saved_threads").doc(`${folderId}_${insight.id}`);

        // 1. If success, aggregate titles into folder-level master object
        if (insight.status === 'success' && insight.insights) {
            console.log(`[FIRESTORE] Aggregating signals for success ${insight.id}`);

            await db.runTransaction(async (transaction) => {
                const folderDoc = await transaction.get(folderRef);
                if (!folderDoc.exists) return;

                const folderData = folderDoc.data() as Folder;
                const signals = folderData.intelligence_signals || {
                    allPainPointTitles: [],
                    allSwitchTriggerTitles: [],
                    allDesiredOutcomeTitles: []
                };

                const newPainPoints = insight.insights!.pain_points || [];
                const newTriggers = insight.insights!.switch_triggers || [];
                const newOutcomes = insight.insights!.desired_outcomes || [];

                const addedPainPoints: string[] = [];
                const addedTriggers: string[] = [];
                const addedOutcomes: string[] = [];

                newPainPoints.forEach(p => {
                    const title = p.title.trim().toLowerCase();
                    if (title && !signals.allPainPointTitles.includes(title)) {
                        signals.allPainPointTitles.push(title);
                        addedPainPoints.push(title);
                    }
                });

                newTriggers.forEach(t => {
                    const title = t.title.trim().toLowerCase();
                    if (title && !signals.allSwitchTriggerTitles.includes(title)) {
                        signals.allSwitchTriggerTitles.push(title);
                        addedTriggers.push(title);
                    }
                });

                newOutcomes.forEach(o => {
                    const title = o.title.trim().toLowerCase();
                    if (title && !signals.allDesiredOutcomeTitles.includes(title)) {
                        signals.allDesiredOutcomeTitles.push(title);
                        addedOutcomes.push(title);
                    }
                });

                transaction.update(folderRef, {
                    intelligence_signals: signals,
                    painPointCount: signals.allPainPointTitles.length,
                    triggerCount: signals.allSwitchTriggerTitles.length,
                    outcomeCount: signals.allDesiredOutcomeTitles.length
                });

                // Preserve thread metadata but delete heavy content data to save storage
                transaction.update(threadRef, {
                    analysisStatus: 'success',
                    extractedPainPoints: addedPainPoints,
                    analysisCompletedAt: FieldValue.serverTimestamp(),
                    data: FieldValue.delete()
                });
            });

            console.log(`[FIRESTORE] Aggregation complete and thread preserved for ${insight.id}`);
        } else if (insight.status === 'success') {
            // Success but missing insights - treat as failed to prevent stuck processing
            await threadRef.update({
                analysisStatus: 'failed',
                error: 'Analysis completed but no insights were returned.',
                analysisTriggeredAt: FieldValue.serverTimestamp()
            }).catch(() => { });
        } else if (insight.status === 'failed') {
            await folderRef.update({
                failedCount: FieldValue.increment(1)
            });
            await threadRef.update({
                analysisStatus: 'failed',
                analysisTriggeredAt: FieldValue.serverTimestamp()
            }).catch(() => { });
        } else if (insight.status === 'processing') {
            await threadRef.update({
                analysisStatus: 'processing',
                analysisTriggeredAt: FieldValue.serverTimestamp()
            }).catch(() => { });
        }
    } catch (err) {
        console.error(`[FIRESTORE] Failed to update and aggregate thread insight ${insight.id}:`, err);
    }
}

// ── Saved Threads Management ───────────────────────────────────────

export async function saveThreadToFolder(uid: string, folderId: string, threadData: any): Promise<void> {
    if (!db) throw new Error("Firebase DB not initialized");

    const folderRef = db.collection("folders").doc(folderId);
    const folderDoc = await folderRef.get();

    if (!folderDoc.exists || folderDoc.data()?.uid !== uid) {
        throw new Error("Folder not found or access denied");
    }

    // threadData might be the direct object or a stub with storageUrl
    // We use a unique hash of the URL as the document ID to ensure placeholders 
    // and real threads share the same identity.
    const url = threadData.source || threadData.post?.url || threadData.url;
    if (!url) throw new Error("Invalid thread data: missing URL for ID generation");
    
    // Use a unique hash of the URL as the document ID to ensure placeholders 
    // and real threads share the same identity.
    const threadId = createHash('md5').update(url).digest('hex').substring(0, 16);
    const threadRef = db.collection("saved_threads").doc(`${folderId}_${threadId}`);

    const snapshot: SavedThread = {
        id: threadId,
        folderId,
        uid,
        title: threadData.title || threadData.post?.title || "Untitled",
        author: threadData.author || threadData.post?.author || "anonymous",
        subreddit: threadData.subreddit || threadData.post?.subreddit || "r/unknown",
        commentCount: threadData.commentCount || 0,
        source: threadData.source || "reddit",
        data: threadData.storageUrl ? null : threadData,
        storageUrl: threadData.storageUrl || null,
        tokenCount: threadData.tokenCount || 0,
        savedAt: new Date().toISOString(),
    };

    const threadDoc = await threadRef.get();
    const isNew = !threadDoc.exists;
    await threadRef.set({
        ...snapshot,
        analysisStatus: 'pending' // Default to pending for auto-trigger
    });

    if (isNew) {
        const { FieldValue } = await import("firebase-admin/firestore");
        await folderRef.update({
            threadCount: FieldValue.increment(1),
            totalAnalysisCount: FieldValue.increment(1),
            pendingAnalysisCount: FieldValue.increment(1)
        });
        // Increment global savedThreadCount
        await db.collection("users").doc(uid).update({
            savedThreadCount: FieldValue.increment(1)
        });
    }
}

export async function createPlaceholderThread(uid: string, folderId: string, url: string, meta?: any): Promise<void> {
    if (!db) return;

    // Use a unique hash of the URL as the ID
    const tempId = createHash('md5').update(url).digest('hex').substring(0, 16);
    const threadRef = db.collection("saved_threads").doc(`${folderId}_${tempId}`);

    const snapshot: SavedThread = {
        id: tempId,
        folderId,
        uid,
        title: meta?.title || "Fetching Thread Data...",
        author: meta?.author || "unknown",
        subreddit: meta?.subreddit || (url.includes('news.ycombinator.com') ? 'Hacker News' : 'Reddit'),
        commentCount: meta?.num_comments || 0,
        source: url,
        data: null,
        tokenCount: 0,
        savedAt: new Date().toISOString(),
        analysisStatus: 'pending' // pending is a valid status type
    };

    const threadDoc = await threadRef.get();
    if (!threadDoc.exists) {
        await threadRef.set(snapshot);
        // Note: We don't increment metrics here. We wait for the real saveThreadToFolder call to do that 
        // to avoid double counting or messing up actual analysis tracking.
    }
}

export async function getThreadsInFolder(uid: string, folderId: string): Promise<SavedThread[]> {
    if (!db) throw new Error("Firebase DB not initialized. Cannot get threads.");
    try {
        const snapshot = await db.collection("saved_threads")
            .where("uid", "==", uid)
            .where("folderId", "==", folderId)
            .get();
        return snapshot.docs
            .map((doc: any) => doc.data() as SavedThread)
            .sort((a: SavedThread, b: SavedThread) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    } catch (err) {
        console.error("Failed to get threads:", err);
        return [];
    }
}

export async function getFolderIntelligenceSignals(uid: string, folderId: string) {
    if (!db) throw new Error("Firebase DB not initialized.");

    try {
        console.log(`[FIRESTORE] [SIGNALS] Fetching signals for folder: ${folderId}`);
        const signals = {
            painPoints: [] as any[],
            triggers: [] as any[],
            outcomes: [] as any[]
        };

        let snapshot: any;
        if (folderId === 'inbox') {
            // Inbox uses users/{uid}/extractions
            snapshot = await db.collection("users").doc(uid).collection("extractions").where("isAnalyzed", "==", true).get();
            console.log(`[FIRESTORE] [SIGNALS] Found ${snapshot.size} analyzed extractions for inbox`);
        } else {
            const folderRef = db.collection("folders").doc(folderId);
            snapshot = await folderRef.collection("completed_threads").get();
            console.log(`[FIRESTORE] [SIGNALS] Found ${snapshot.size} docs in completed_threads subcollection`);
        }

        snapshot.docs.forEach((doc: any) => {
            const data = doc.data();
            // In extractions, the field is analysisResults. In completed_threads, it's insights
            const insights = folderId === 'inbox' ? data.analysisResults : data.insights;

            if (!insights) {
                console.warn(`[FIRESTORE] [SIGNALS] No insights found for doc ${doc.id}`);
                return;
            }

            if (insights.pain_points) {
                insights.pain_points.forEach((p: any) => signals.painPoints.push({ ...p, thread_id: doc.id }));
            }
            if (insights.switch_triggers) {
                insights.switch_triggers.forEach((t: any) => signals.triggers.push({ ...t, thread_id: doc.id }));
            }
            if (insights.desired_outcomes) {
                insights.desired_outcomes.forEach((o: any) => signals.outcomes.push({ ...o, thread_id: doc.id }));
            }
        });

        return signals;
    } catch (err) {
        console.error("Failed to get folder intelligence signals:", err);
        throw err;
    }
}

export async function saveAggregatedInsights(folderId: string, clusters: any[]) {
    if (!db) throw new Error("Firebase DB not initialized.");
    const batch = db.batch();
    const collectionRef = db.collection("folders").doc(folderId).collection("aggregated_insights");

    // Clear old
    const old = await collectionRef.get();
    old.docs.forEach(doc => batch.delete(doc.ref));

    // Save new
    clusters.forEach((cluster, idx) => {
        const ref = collectionRef.doc(`cluster_${idx}`);
        batch.set(ref, {
            ...cluster,
            updatedAt: new Date().toISOString()
        });
    });

    await batch.commit();
    console.log(`[FIRESTORE] Saved ${clusters.length} clusters for folder ${folderId}`);
}

export async function updateUserAicost(uid: string, updates: { totalInputTokens?: number, totalOutputTokens?: number, totalAiCost?: number }) {
    return updateStats(uid, updates);
}

// ── Analysis Persistence ───────────────────────────────────────────

export interface AnalysisDoc {
    id: string;
    folderId: string;
    uid: string;
    data: any;
    model: string;
    createdAt: string;
}

export async function saveAnalysis(uid: string, folderId: string, data: any, modelName: string, usage?: any): Promise<void> {
    if (!db) {
        console.error("[FIRESTORE] DB not initialized. Cannot save analysis.");
        return;
    }
    try {
        console.log(`[FIRESTORE] Saving analysis for folder ${folderId} (User: ${uid})`);
        const res = await db.collection("folder_analyses").add({
            folderId,
            uid,
            data,
            usage, // Private usage metadata (tokens, etc.)
            model: modelName,
            createdAt: new Date().toISOString()
        });
        console.log(`[FIRESTORE] Analysis saved with ID: ${res.id}`);
    } catch (err) {
        console.error("Failed to save analysis:", err);
    }
}

export async function getLatestAnalysis(uid: string, folderId: string): Promise<AnalysisDoc | null> {
    if (!db) {
        throw new Error("[FIRESTORE] DB not initialized. Cannot fetch analysis.");
    }
    try {
        console.log(`[FIRESTORE] Fetching latest analysis for folder ${folderId}`);
        const snapshot = await db.collection("folder_analyses")
            .where("uid", "==", uid)
            .where("folderId", "==", folderId)
            .get();

        if (snapshot.empty) {
            console.log("[FIRESTORE] No analysis found.");
            return null;
        }

        const docs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as AnalysisDoc));
        docs.sort((a: AnalysisDoc, b: AnalysisDoc) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const doc = docs[0];
        console.log(`[FIRESTORE] Found analysis: ${doc.id}`);
        return doc;
    } catch (err) {
        console.error("Failed to get analysis:", err);
        return null;
    }
}

export async function getFolderAnalyses(uid: string, folderId: string): Promise<AnalysisDoc[]> {
    if (!db) throw new Error("Firebase DB not initialized. Cannot get analyses.");
    try {
        const snapshot = await db.collection("folder_analyses")
            .where("uid", "==", uid)
            .where("folderId", "==", folderId)
            .get();

        if (snapshot.empty) return [];

        const docs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as AnalysisDoc));
        return docs.sort((a: AnalysisDoc, b: AnalysisDoc) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
        console.error("Failed to get analyses:", err);
        return [];
    }
}

// ── Analytics Logging ──────────────────────────────────────────────

export async function logFetchEvent(uid: string, type: string, count: number) {
    if (!db) return;
    try {
        await db.collection("fetch_analytics").add({
            uid,
            type,
            count,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error("Failed to log fetch event:", err);
    }
}

// ── Data Extraction ───────────────────────────────────────────────

export interface ExtractedData {
    id: string;
    uid: string;
    title: string;
    source: string;
    extractedAt: string;
    commentCount: number;
    isAnalyzed: boolean;
    analysisResults?: any;
    author?: string;
    subreddit?: string;
    content?: any;
    post?: any;
}

export async function saveExtractedData(uid: string, data: Omit<ExtractedData, "uid">): Promise<void> {
    if (!db) throw new Error("Firebase DB not initialized");

    const ref = db.collection("users").doc(uid).collection("extractions").doc(data.id);
    await ref.set({
        ...data,
        uid,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

export async function listExtractions(uid: string): Promise<ExtractedData[]> {
    if (!db) throw new Error("Firebase DB not initialized. Cannot list extractions.");
    const snapshot = await db.collection("users").doc(uid).collection("extractions")
        .orderBy("extractedAt", "desc")
        .limit(50)
        .get();

    return snapshot.docs.map((doc: any) => doc.data() as ExtractedData);
}

// ── User Statistics (Dashboard Metrics) ─────────────────────────────

export interface UserStats {
    threadsSaved: number;
    reportsGenerated: number;
    leadsIdentified: number;
    hoursSaved: number;
    intelligenceScanned: number;
    commentsAnalyzed: number;
    totalAiCost?: number;
    totalInputTokens?: number;
    totalOutputTokens?: number;
}

export async function getUserStats(uid: string): Promise<UserStats> {
    if (!db) {
        throw new Error("Firebase DB not initialized. Cannot get user stats.");
    }
    const doc = await db.collection("users").doc(uid).collection("stats").doc("summary").get();
    if (doc.exists) {
        return doc.data() as UserStats;
    }
    return { threadsSaved: 0, reportsGenerated: 0, leadsIdentified: 0, hoursSaved: 0, intelligenceScanned: 0, commentsAnalyzed: 0 };
}

export async function updateStats(uid: string, updates: Partial<UserStats>): Promise<void> {
    if (!db) throw new Error("Firebase DB not initialized. Cannot update stats.");
    try {
        const { FieldValue } = await import("firebase-admin/firestore");
        const ref = db.collection("users").doc(uid).collection("stats").doc("summary");

        const dbUpdates: Record<string, any> = {};
        for (const [key, value] of Object.entries(updates)) {
            if (typeof value === 'number') {
                dbUpdates[key] = FieldValue.increment(value);
            } else {
                dbUpdates[key] = value;
            }
        }

        await ref.set(dbUpdates, { merge: true });

        // If a report was generated, increment the global analysisCount
        if (updates.reportsGenerated) {
            await db.collection("users").doc(uid).update({
                analysisCount: FieldValue.increment(updates.reportsGenerated)
            });
        }

        console.log(`[FIRESTORE] Updated stats for ${uid}:`, updates);
    } catch (err) {
        console.error(`[FIRESTORE] Failed to update stats for ${uid}:`, err);
    }
}

// ── Discovery History ─────────────────────────────────────────────

export async function saveDiscoveryHistory(uid: string, entry: Omit<DiscoveryHistoryEntry, 'id' | 'uid' | 'createdAt'>): Promise<string> {
    if (!db) throw new Error("Firebase DB not initialized.");
    try {
        console.log(`[FIRESTORE] Saving discovery history for ${uid}:`, entry.query);
        const ref = db.collection("discovery_history").doc();
        const fullEntry: DiscoveryHistoryEntry = {
            id: ref.id,
            uid,
            ...entry,
            createdAt: new Date().toISOString()
        };
        await ref.set(fullEntry);
        return ref.id;
    } catch (err) {
        console.error("[FIRESTORE] Failed to save discovery history:", err);
        throw err;
    }
}

export async function getDiscoveryHistory(uid: string, limit: number = 30): Promise<DiscoveryHistoryEntry[]> {
    if (!db) throw new Error("Firebase DB not initialized.");
    try {
        console.log(`[FIRESTORE] getDiscoveryHistory for ${uid}...`);
        const snapshot = await db.collection("discovery_history")
            .where("uid", "==", uid)
            .select("id", "uid", "type", "query", "params", "resultsCount", "createdAt", "topResults")
            .limit(limit)
            .get();

        const results = snapshot.docs.map(doc => {
            const data = doc.data();
            // id isn't naturally in data when using select if we use doc.id, but we saved it as a field.
            return { id: doc.id, ...data } as DiscoveryHistoryEntry;
        });
        
        // Sort in memory to avoid needing a composite index
        results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        console.log(`[FIRESTORE] getDiscoveryHistory for ${uid}: found ${results.length} items (Sorted manually)`);
        return results;
    } catch (err) {
        console.error("[FIRESTORE] Failed to get discovery history:", err);
        return [];
    }
}

export async function deleteDiscoveryHistory(uid: string, id: string): Promise<void> {
    if (!db) throw new Error("Firebase DB not initialized.");
    try {
        const ref = db.collection("discovery_history").doc(id);
        const doc = await ref.get();
        if (doc.exists && doc.data()?.uid === uid) {
            await ref.delete();
        }
    } catch (err) {
        console.error("[FIRESTORE] Failed to delete discovery history:", err);
        throw err;
    }
}

export async function getDiscoveryHistoryFull(uid: string, id: string): Promise<DiscoveryHistoryEntry | null> {
    if (!db) throw new Error("Firebase DB not initialized.");
    try {
        const doc = await db.collection("discovery_history").doc(id).get();
        if (doc.exists && doc.data()?.uid === uid) {
            return doc.data() as DiscoveryHistoryEntry;
        }
        return null;
    } catch (err) {
        console.error("[FIRESTORE] Failed to get full discovery history:", err);
        throw err;
    }
}

// ── Invite Codes Management ─────────────────────────────────────────
export interface InviteCode {
    id: string;
    maxUses: number;
    currentUses: number;
    usedBy: string[];
}

export async function verifyInviteCode(code: string): Promise<{ valid: boolean; error?: string; usesRemaining?: number }> {
    if (!db) return { valid: false, error: "Database not initialized" };
    
    try {
        const cleanCode = code.trim().toUpperCase();
        if (!cleanCode) return { valid: false, error: "Please enter an invitation code." };

        const ref = db.collection("invite_codes").doc(cleanCode);
        const doc = await ref.get();
        
        if (!doc.exists) {
            return { valid: false, error: "This code doesn't look quite right. Please check it again." };
        }
        
        const data = doc.data() as InviteCode;
        const usesRemaining = (data.maxUses || 1) - (data.currentUses || 0);
        
        if (usesRemaining <= 0) {
            return { valid: false, error: "This code has already been claimed." };
        }
        
        return { valid: true, usesRemaining };
    } catch (err) {
        console.error("Failed to verify invite code:", err);
        return { valid: false, error: "Something went wrong. Give it another shot." };
    }
}

export async function createInviteCode(code: string, maxUses: number): Promise<{ success: boolean; error?: string }> {
    if (!db) return { success: false, error: "Database not initialized" };
    
    try {
        const cleanCode = code.trim().toUpperCase();
        if (!cleanCode) return { success: false, error: "Code cannot be empty" };

        const ref = db.collection("invite_codes").doc(cleanCode);
        
        await ref.set({
            id: cleanCode,
            maxUses: maxUses || 1,
            currentUses: 0,
            usedBy: [],
            createdAt: new Date().toISOString()
        }, { merge: true });

        return { success: true };
    } catch (err) {
        console.error("Failed to create invite code:", err);
        return { success: false, error: "Database error" };
    }
}

// ── Open Registration (Trial Plan) ─────────────────────────────────────────────

export async function registerUser(email: string, password: string): Promise<{ success: boolean; customToken?: string; error?: string }> {
    if (!db || !auth) return { success: false, error: "Firebase services not initialized." };

    try {
        let userRecord;
        try {
            userRecord = await auth.createUser({
                email,
                password,
                emailVerified: false,
                disabled: false,
            });
        } catch (err: unknown) {
            if (errCode(err) === 'auth/email-already-exists') {
                return { success: false, error: "An account with this email already exists." };
            }
            throw err;
        }

        const userRef = db.collection("users").doc(userRecord.uid);
        const userDoc: UserDoc = {
            uid: userRecord.uid,
            email: email.toLowerCase(),
            plan: "trial",
            configOverrides: {},
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            createdAt: new Date().toISOString(),
            fetchCount: 0,
            discoveryCount: 0,
            analysisCount: 0,
            savedThreadCount: 0
        };

        await userRef.set(userDoc);
        const customToken = await auth.createCustomToken(userRecord.uid);
        return { success: true, customToken };
    } catch (err: unknown) {
        console.error("[FIRESTORE] Registration failed:", err);
        return { success: false, error: errMsg(err) || "An unexpected error occurred during registration." };
    }
}

// NOTE: Invite code system is preserved for future use as discount coupons.
// Not currently exposed in the user-facing signup flow.
// Admin endpoints to manage codes remain active in /api/admin/tokens.

/**
 * atomicRegistration is a helper to ensure invite code usage and user creation are synchronized.
 */
export async function registerUserWithInvite(email: string, password: string, inviteCode: string): Promise<{ success: boolean; customToken?: string; error?: string }> {
    if (!db || !auth) return { success: false, error: "Firebase services not initialized." };

    try {
        const cleanCode = inviteCode.trim().toUpperCase();
        const inviteRef = db.collection("invite_codes").doc(cleanCode);

        // Run as a transaction to ensure atomic usage decrement
        const result = await db.runTransaction(async (transaction) => {
            const inviteDoc = await transaction.get(inviteRef);
            
            if (!inviteDoc.exists) {
                return { success: false, error: "Invalid invitation code." };
            }

            const inviteData = inviteDoc.data() as InviteCode;
            const currentUses = inviteData.currentUses || 0;
            const maxUses = inviteData.maxUses || 1;

            if (currentUses >= maxUses) {
                return { success: false, error: "This invitation code has already been fully used." };
            }

            // 1. Create the Firebase User (Admin SDK)
            let userRecord;
            try {
                userRecord = await auth.createUser({
                    email,
                    password,
                    emailVerified: false,
                    disabled: false,
                });
            } catch (err: unknown) {
                if (errCode(err) === 'auth/email-already-exists') {
                    return { success: false, error: "An account with this email already exists." };
                }
                throw err; 
            }

            // 2. Initialize User Document in Firestore
            const userRef = db.collection("users").doc(userRecord.uid);
            const userDoc: UserDoc = {
                uid: userRecord.uid,
                email: email.toLowerCase(),
                plan: "beta",
                configOverrides: {},
                stripeCustomerId: null,
                stripeSubscriptionId: null,
                createdAt: new Date().toISOString(),
                fetchCount: 0,
                discoveryCount: 0,
                analysisCount: 0,
                savedThreadCount: 0
            };
            
            transaction.set(userRef, userDoc);

            // 3. Update Invite Code Usage
            transaction.update(inviteRef, {
                currentUses: currentUses + 1,
                usedBy: [...(inviteData.usedBy || []), userRecord.uid]
            });

            // 4. Generate Custom Token for immediate login
            const customToken = await auth.createCustomToken(userRecord.uid);

            return { success: true, customToken };
        });

        return result;
    } catch (err: unknown) {
        console.error("[FIRESTORE] Registration transaction failed:", err);
        return { success: false, error: errMsg(err) || "An unexpected error occurred during registration." };
    }
}
