import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import * as fs from "fs";
import * as path from "path";

let db: Firestore;
let auth: Auth;

export function initFirebase(): void {
    const saPath = process.env.FIREBASE_SERVICE_ACCOUNT || "./service-account.json";
    const resolved = path.resolve(saPath);

    if (!fs.existsSync(resolved)) {
        console.warn(
            `⚠️  Firebase service account not found at ${resolved}. Auth & Firestore disabled.`
        );
        return;
    }

    const serviceAccount = JSON.parse(
        fs.readFileSync(resolved, "utf-8")
    ) as ServiceAccount;

    initializeApp({ credential: cert(serviceAccount) });
    db = getFirestore();
    auth = getAuth();
}

export function getDb(): Firestore {
    return db;
}

export function getAdminAuth(): Auth {
    return auth;
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
    data: any; // Full thread JSON snapshot
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
    commentLimit: -1,
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
        return plan === "pro" ? DEFAULT_PRO_CONFIG : DEFAULT_FREE_CONFIG;
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
        // No Firestore → return a default free user
        return {
            uid,
            email,
            plan: "free",
            configOverrides: {},
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            createdAt: new Date().toISOString(),
            fetchCount: 0,
        };
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
    if (!db) return [];
    try {
        const snapshot = await db.collection("folders")
            .where("uid", "==", uid)
            .orderBy("createdAt", "desc")
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Folder));
    } catch (err) {
        console.error("Failed to get folders:", err);
        return [];
    }
}

export async function createFolder(uid: string, name: string, description?: string): Promise<Folder> {
    if (!db) throw new Error("Database not initialized");
    const ref = db.collection("folders").doc();
    const folder: Folder = {
        id: ref.id,
        uid,
        name,
        description,
        color: "#6366f1", // Default indigo
        createdAt: new Date().toISOString(),
        threadCount: 0,
    };
    await ref.set(folder);
    return folder;
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
        threads.docs.forEach(d => batch.delete(d.ref));
        batch.delete(ref);
        await batch.commit();
    }
}

// ── Saved Threads Management ───────────────────────────────────────

export async function saveThreadToFolder(uid: string, folderId: string, threadData: any): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    const folderRef = db.collection("folders").doc(folderId);
    const folderDoc = await folderRef.get();

    if (!folderDoc.exists || folderDoc.data()?.uid !== uid) {
        throw new Error("Folder not found or access denied");
    }

    const threadId = threadData.post.id; // t3_...
    const threadRef = db.collection("saved_threads").doc(`${folderId}_${threadId}`);

    const snapshot: SavedThread = {
        id: threadId,
        folderId,
        uid,
        title: threadData.post.title,
        author: threadData.post.author,
        subreddit: threadData.post.subreddit,
        data: threadData,
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
    if (!db) return [];
    try {
        const snapshot = await db.collection("saved_threads")
            .where("uid", "==", uid)
            .where("folderId", "==", folderId)
            .orderBy("savedAt", "desc")
            .get();
        return snapshot.docs.map(doc => doc.data() as SavedThread);
    } catch (err) {
        console.error("Failed to get threads:", err);
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
    if (!db) return;

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
