import { getDb, UserDoc, Folder, SavedThread, InviteCode } from "./firestore.js";
import { Queue } from "bullmq";

// Users
export async function getAllUsers(limit: number = 1000, lastDocId?: string) {
    const db = getDb();
    if (!db) throw new Error("Database not initialized");

    let query = db.collection("users").orderBy("createdAt", "desc").limit(limit);
    
    if (lastDocId) {
        const lastDoc = await db.collection("users").doc(lastDocId).get();
        if (lastDoc.exists) {
            query = query.startAfter(lastDoc);
        }
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => doc.data() as UserDoc);
}

// Global Stats (rough aggregations)
export async function getGlobalStats() {
    const db = getDb();
    if (!db) throw new Error("Database not initialized");

    // For large collections, fetching all docs is expensive. 
    // Usually, you should use an aggregated document. For now, we'll try to get counts.
    // Firestore now supports count() queries.
    const usersCount = (await db.collection("users").count().get()).data().count;
    const foldersCount = (await db.collection("folders").count().get()).data().count;
    const analysesCount = (await db.collection("folder_analyses").count().get()).data().count;
    
    return {
        totalUsers: usersCount,
        totalFolders: foldersCount,
        totalAnalyses: analysesCount,
    };
}

// Beta Tokens (Invite Codes)
export async function getBetaTokens() {
    const db = getDb();
    if (!db) throw new Error("Database not initialized");

    const snapshot = await db.collection("invite_codes").orderBy("createdAt", "desc").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InviteCode));
}

export async function createInviteCode(code: string, maxUses: number = 1) {
    const db = getDb();
    if (!db) throw new Error("Database not initialized");
    await db.collection("invite_codes").doc(code).set({
        code,
        maxUses,
        uses: 0,
        createdAt: new Date().toISOString()
    });
}

// Waitlist
export interface WaitlistEntry {
    id: string;
    email: string;
    status: 'pending' | 'invited';
    createdAt: string;
}

export async function getWaitlist() {
    const db = getDb();
    if (!db) throw new Error("Database not initialized");

    const snapshot = await db.collection("waitlist").orderBy("createdAt", "desc").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WaitlistEntry));
}

export async function addWaitlistEntry(email: string) {
    const db = getDb();
    if (!db) throw new Error("Database not initialized");

    const entry: Omit<WaitlistEntry, "id"> = {
        email,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    const docRef = await db.collection("waitlist").add(entry);
    return { id: docRef.id, ...entry };
}

export async function updateWaitlistStatus(id: string, status: WaitlistEntry['status']) {
    const db = getDb();
    if (!db) throw new Error("Database not initialized");

    await db.collection("waitlist").doc(id).update({ status });
}

// Daily Stats (Mock or real if tracking)
export async function getDailyStats() {
    const db = getDb();
    if (!db) throw new Error("Database not initialized");

    // For simplicity, we'll fetch recent users & analyses to build a daily chart on the fly.
    // In production, you'd want a cron job updating a `daily_stats` collection.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString();

    const usersSnapshot = await db.collection("users").where("createdAt", ">=", dateStr).get();
    const analysesSnapshot = await db.collection("folder_analyses").where("createdAt", ">=", dateStr).get();

    // Group by day
    const stats: Record<string, { newUsers: number, newAnalyses: number }> = {};
    
    // Initialize last 30 days
    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const day = d.toISOString().split('T')[0];
        stats[day] = { newUsers: 0, newAnalyses: 0 };
    }

    usersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.createdAt) {
            const day = data.createdAt.split('T')[0];
            if (stats[day]) {
                stats[day].newUsers++;
            } else {
                stats[day] = { newUsers: 1, newAnalyses: 0 };
            }
        }
    });

    analysesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.createdAt) {
            const day = data.createdAt.split('T')[0];
            if (stats[day]) {
                stats[day].newAnalyses++;
            } else {
                stats[day] = { newUsers: 0, newAnalyses: 1 };
            }
        }
    });
    
    // Convert to array and sort by date
    const sortedStats = Object.entries(stats).map(([date, counts]) => ({
        date,
        ...counts
    })).sort((a, b) => a.date.localeCompare(b.date));

    return sortedStats;
}

export async function getStats(q: Queue) {
    const counts = await q.getJobCounts();
    return counts;
}

// ── KPI helpers ────────────────────────────────────────────────────

// Simple in-memory TTL cache (5 minutes)
const kpiCache = new Map<string, { data: unknown; ts: number }>();
const KPI_TTL_MS = 5 * 60 * 1000;

function cacheGet<T>(key: string): T | null {
    const entry = kpiCache.get(key);
    if (entry && Date.now() - entry.ts < KPI_TTL_MS) return entry.data as T;
    return null;
}

function cacheSet(key: string, data: unknown): void {
    kpiCache.set(key, { data, ts: Date.now() });
}

export async function getPlanDistribution(): Promise<Record<string, number>> {
    const cached = cacheGet<Record<string, number>>('planDist');
    if (cached) return cached;

    const db = getDb();
    const plans = ["free", "trial", "starter", "pro", "professional", "beta", "enterprise", "past_due"];
    const result: Record<string, number> = {};
    await Promise.all(plans.map(async (plan) => {
        const count = (await db.collection("users").where("plan", "==", plan).count().get()).data().count;
        result[plan] = count;
    }));

    cacheSet('planDist', result);
    return result;
}

export async function getEngagementStats(): Promise<{
    usersWithAnalysis: number;
    usersWithDiscovery: number;
    usersWithMonitor: number;
    totalMonitors: number;
    totalDiscoveries: number;
    totalAnalyses: number;
    avgAnalysesPerUser: number;
    avgDiscoveriesPerUser: number;
}> {
    const cached = cacheGet<ReturnType<typeof getEngagementStats> extends Promise<infer T> ? T : never>('engagement');
    if (cached) return cached;

    const db = getDb();

    const [
        usersWithAnalysisCount,
        usersWithDiscoveryCount,
        totalMonitorsCount,
        allUsersSnapshot,
    ] = await Promise.all([
        db.collection("users").where("analysisCount", ">", 0).count().get(),
        db.collection("users").where("discoveryCount", ">", 0).count().get(),
        db.collection("monitoring_monitors").count().get(),
        db.collection("users").select("analysisCount", "discoveryCount").get(),
    ]);

    // Count users with monitors (via monitoring_monitors unique uids)
    const monitorUids = new Set<string>();
    (await db.collection("monitoring_monitors").select("uid").get()).forEach(doc => {
        const uid = doc.data().uid as string | undefined;
        if (uid) monitorUids.add(uid);
    });

    let totalAnalyses = 0;
    let totalDiscoveries = 0;
    const totalUsers = allUsersSnapshot.size;
    allUsersSnapshot.forEach(doc => {
        const d = doc.data();
        totalAnalyses += (d.analysisCount as number) || 0;
        totalDiscoveries += (d.discoveryCount as number) || 0;
    });

    const result = {
        usersWithAnalysis: usersWithAnalysisCount.data().count,
        usersWithDiscovery: usersWithDiscoveryCount.data().count,
        usersWithMonitor: monitorUids.size,
        totalMonitors: totalMonitorsCount.data().count,
        totalDiscoveries,
        totalAnalyses,
        avgAnalysesPerUser: totalUsers > 0 ? Math.round((totalAnalyses / totalUsers) * 10) / 10 : 0,
        avgDiscoveriesPerUser: totalUsers > 0 ? Math.round((totalDiscoveries / totalUsers) * 10) / 10 : 0,
    };

    cacheSet('engagement', result);
    return result;
}

export async function getActivationFunnel(): Promise<{
    signups: number;
    hasFolder: number;
    hasSavedThread: number;
    hasAnalysis: number;
    hasMonitor: number;
}> {
    const cached = cacheGet<ReturnType<typeof getActivationFunnel> extends Promise<infer T> ? T : never>('funnel');
    if (cached) return cached;

    const db = getDb();

    const [
        totalUsersCount,
        usersWithFolderCount,
        usersWithSavedThreadCount,
        usersWithAnalysisCount,
    ] = await Promise.all([
        db.collection("users").count().get(),
        db.collection("users").where("savedThreadCount", ">", 0).count().get(),
        db.collection("users").where("savedThreadCount", ">", 0).count().get(),
        db.collection("users").where("analysisCount", ">", 0).count().get(),
    ]);

    // Count users with at least one folder (distinct uids in folders collection)
    const folderUids = new Set<string>();
    (await db.collection("folders").select("uid").get()).forEach(doc => {
        const uid = doc.data().uid as string | undefined;
        if (uid) folderUids.add(uid);
    });

    // Count users with monitors
    const monitorUids = new Set<string>();
    (await db.collection("monitoring_monitors").select("uid").get()).forEach(doc => {
        const uid = doc.data().uid as string | undefined;
        if (uid) monitorUids.add(uid);
    });

    const result = {
        signups: totalUsersCount.data().count,
        hasFolder: folderUids.size,
        hasSavedThread: usersWithFolderCount.data().count,
        hasAnalysis: usersWithAnalysisCount.data().count,
        hasMonitor: monitorUids.size,
    };

    cacheSet('funnel', result);
    return result;
}

export async function getDailyActiveUsers(days: number = 30): Promise<{ date: string; dau: number }[]> {
    const cacheKey = `dau_${days}`;
    const cached = cacheGet<{ date: string; dau: number }[]>(cacheKey);
    if (cached) return cached;

    const db = getDb();
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();

    const snapshot = await db.collection("discovery_history")
        .where("createdAt", ">=", sinceStr)
        .select("uid", "createdAt")
        .get();

    // Group distinct uids per day
    const dayMap: Record<string, Set<string>> = {};
    for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dayMap[d.toISOString().split('T')[0]] = new Set();
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        const day = (data.createdAt as string)?.split('T')[0];
        const uid = data.uid as string | undefined;
        if (day && uid && dayMap[day]) dayMap[day].add(uid);
    });

    const result = Object.entries(dayMap)
        .map(([date, uids]) => ({ date, dau: uids.size }))
        .sort((a, b) => a.date.localeCompare(b.date));

    cacheSet(cacheKey, result);
    return result;
}

export async function getCohortPlanStats(): Promise<{
    week: string;
    total: number;
    plans: Record<string, number>;
}[]> {
    const cached = cacheGet<{ week: string; total: number; plans: Record<string, number> }[]>('cohorts');
    if (cached) return cached;

    const db = getDb();
    const snapshot = await db.collection("users").select("plan", "createdAt").get();

    const weeks: Record<string, { total: number; plans: Record<string, number> }> = {};

    snapshot.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt as string | undefined;
        const plan = (data.plan as string) || "free";
        if (!createdAt) return;

        const date = new Date(createdAt);
        // ISO week start (Monday)
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(date.setDate(diff));
        const week = weekStart.toISOString().split('T')[0];

        if (!weeks[week]) weeks[week] = { total: 0, plans: {} };
        weeks[week].total++;
        weeks[week].plans[plan] = (weeks[week].plans[plan] || 0) + 1;
    });

    const result = Object.entries(weeks)
        .map(([week, data]) => ({ week, ...data }))
        .sort((a, b) => b.week.localeCompare(a.week))
        .slice(0, 12); // last 12 weeks

    cacheSet('cohorts', result);
    return result;
}

export async function getSystemHealth(): Promise<{
    totalFolders: number;
    processingFolders: number;
    failedFolders: number;
    completedFolders: number;
    successRate: number;
}> {
    const db = getDb();

    const [totalCount, processingCount, failedCount, completedCount] = await Promise.all([
        db.collection("folders").count().get(),
        db.collection("folders").where("analysisStatus", "==", "processing").count().get(),
        db.collection("folders").where("analysisStatus", "==", "failed").count().get(),
        db.collection("folders").where("analysisStatus", "==", "complete").count().get(),
    ]);

    const total = totalCount.data().count;
    const completed = completedCount.data().count;
    const failed = failedCount.data().count;
    const processed = completed + failed;

    return {
        totalFolders: total,
        processingFolders: processingCount.data().count,
        failedFolders: failed,
        completedFolders: completed,
        successRate: processed > 0 ? Math.round((completed / processed) * 100) : 100,
    };
}
