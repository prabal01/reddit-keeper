import { getDb, UserDoc, Folder, SavedThread, InviteCode } from "./firestore.js";

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
