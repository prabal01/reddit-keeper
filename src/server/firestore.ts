import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage, type Storage } from "firebase-admin/storage";
import * as fs from "fs";
import * as path from "path";

let db: Firestore;
let auth: Auth;
let storage: Storage;
let initStatus = {
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
            } catch (err: any) {
                initStatus.error = `JSON Parse Error: ${err.message}`;
                console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT JSON from environment.");
            }
        } else {
            const resolved = path.resolve(firebaseServiceAccount);
            if (fs.existsSync(resolved)) {
                try {
                    serviceAccount = JSON.parse(fs.readFileSync(resolved, "utf-8"));
                } catch (err: any) {
                    initStatus.error = `File Parse Error: ${err.message}`;
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
            } catch (err: any) {
                initStatus.error = `Default File Parse Error: ${err.message}`;
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
            console.log("✅ Firebase initialized successfully with Storage.");
        } catch (err: any) {
            initStatus.error = `Init Error: ${err.message}`;
            console.error("❌ Firebase initialization failed:", err.message);
            // In production, we want to know if this fails immediately.
            if (process.env.NODE_ENV === 'production') {
                throw new Error("CRITICAL: Firebase initialization failed in production: " + err.message);
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
    commentLimit: number;       // -1 = unlimited
    rateLimit: number;          // requests per minute
    rateLimitWindow: number;    // seconds
    maxMoreCommentsBatches: number; // -1 = unlimited
    bulkDownload: boolean;
    apiAccess: boolean;
    exportHistory: boolean;
    exportHistoryDays: number;
    priorityQueue: boolean;
}

export interface UserDoc {
    uid: string;
    email: string;
    plan: "free" | "pro" | "past_due";
    configOverrides: Partial<PlanConfig>;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    createdAt: string;
    fetchCount: number;
}

export interface Folder {
    id: string;
    uid: string;
    name: string;
    description?: string;
    color?: string;
    createdAt: string;
    threadCount: number;
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
    savedAt: string;
}

// ── Default configs (used if Firestore not available) ──────────────

const DEFAULT_FREE_CONFIG: PlanConfig = {
    commentLimit: 50,
    rateLimit: 10,
    rateLimitWindow: 60,
    maxMoreCommentsBatches: 3,
    bulkDownload: false,
    apiAccess: false,
    exportHistory: false,
    exportHistoryDays: 0,
    priorityQueue: false,
};

const DEFAULT_PRO_CONFIG: PlanConfig = {
    commentLimit: 5000,
    rateLimit: 30,
    rateLimitWindow: 60,
    maxMoreCommentsBatches: -1,
    bulkDownload: true,
    apiAccess: true,
    exportHistory: true,
    exportHistoryDays: 30,
    priorityQueue: true,
};

// ── Plan config cache (5-min TTL) ──────────────────────────────────

const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let planConfigCache: Map<string, { config: PlanConfig; cachedAt: number }> = new Map();

export async function getPlanConfig(plan: string): Promise<PlanConfig> {
    const cached = planConfigCache.get(plan);
    if (cached && Date.now() - cached.cachedAt < CONFIG_CACHE_TTL) {
        return cached.config;
    }

    if (!db) {
        throw new Error("Firebase DB not initialized. Cannot fetch plan config.");
    }

    try {
        const doc = await db.collection("plan_configs").doc(plan).get();
        if (doc.exists) {
            const config = doc.data() as PlanConfig;
            planConfigCache.set(plan, { config, cachedAt: Date.now() });
            return config;
        }
    } catch (err) {
        console.error(`Failed to load plan config for "${plan}":`, err);
    }

    // Fallback to defaults
    const fallback = plan === "pro" ? DEFAULT_PRO_CONFIG : DEFAULT_FREE_CONFIG;
    planConfigCache.set(plan, { config: fallback, cachedAt: Date.now() });
    return fallback;
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
let userCache: Map<string, { user: UserDoc; cachedAt: number }> = new Map();

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

export async function createFolder(uid: string, name: string, description?: string): Promise<Folder> {
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
        threads.docs.forEach((d: any) => batch.delete(d.ref));
        batch.delete(ref);
        await batch.commit();
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
    const threadId = threadData.id || threadData.post?.id;
    if (!threadId) throw new Error("Invalid thread data: missing ID");

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
        savedAt: new Date().toISOString(),
    };

    const threadDoc = await threadRef.get();
    const isNew = !threadDoc.exists;
    await threadRef.set(snapshot);

    if (isNew) {
        const { FieldValue } = await import("firebase-admin/firestore");
        await folderRef.update({
            threadCount: FieldValue.increment(1)
        });
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

// ── Analysis Persistence ───────────────────────────────────────────

export interface AnalysisDoc {
    id: string;
    folderId: string;
    uid: string;
    data: any;
    model: string;
    createdAt: string;
}

export async function saveAnalysis(uid: string, folderId: string, data: any, modelName: string): Promise<void> {
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
        // Removed orderBy to avoid requiring a composite index
        const snapshot = await db.collection("folder_analyses")
            .where("uid", "==", uid)
            .where("folderId", "==", folderId)
            .get();

        if (snapshot.empty) {
            console.log("[FIRESTORE] No analysis found.");
            return null;
        }

        // Sort in memory (descending by createdAt)
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
        // Sort descending by date
        return docs.sort((a: AnalysisDoc, b: AnalysisDoc) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
        console.error("Failed to get analyses:", err);
        return [];
    }
}

// ── Analytics Logging ──────────────────────────────────────────────

export interface FetchLogEntry {
    uid: string;
    email?: string;
    url: string;
    plan: string;
    commentCount: number;
    timestamp: any; // ServerValue.timestamp
    status: "success" | "error";
    error?: string;
    userAgent?: string;
}

export async function logFetchEvent(entry: Omit<FetchLogEntry, "timestamp">): Promise<void> {
    if (!db) throw new Error("Firebase DB not initialized. Cannot log fetch event.");

    try {
        const { FieldValue } = await import("firebase-admin/firestore");
        await db.collection("fetch_analytics").add({
            ...entry,
            timestamp: FieldValue.serverTimestamp(),
        });
    } catch (err) {
        console.error("Failed to log fetch event:", err);
    }
}
// ── Extension Extractions ──────────────────────────────────────────

export interface ExtractedData {
    id: string; // generated by extension
    uid: string;
    source: 'reddit' | 'g2' | 'manual';
    url: string;
    title: string;
    content: any; // Raw platform-specific data
    post?: any; // Skeleton metadata for listing (hybrid storage)
    commentCount?: number; // Pre-calculated count (hybrid storage)
    storageUrl?: string;
    extractedAt: string;
    folderId?: string;
    isAnalyzed: boolean;
    analysisResults?: any;
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
            dbUpdates[key] = FieldValue.increment(value as number);
        }

        await ref.set(dbUpdates, { merge: true });
        console.log(`[FIRESTORE] Updated stats for ${uid}:`, updates);
    } catch (err) {
        console.error(`[FIRESTORE] Failed to update stats for ${uid}:`, err);
    }
}
