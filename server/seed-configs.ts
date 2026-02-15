/**
 * One-time script to seed the plan_configs collection in Firestore.
 * Run: npx tsx server/seed-configs.ts
 */
import "dotenv/config";
import { initFirebase, getDb } from "./firestore.js";

async function seed() {
    initFirebase();
    const db = getDb();

    if (!db) {
        console.error("❌ Firestore not available. Check your service account.");
        process.exit(1);
    }

    const freeConfig = {
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

    const proConfig = {
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

    await db.collection("plan_configs").doc("free").set(freeConfig, { merge: true });
    console.log("✅ Seeded plan_configs/free");

    await db.collection("plan_configs").doc("pro").set(proConfig, { merge: true });
    console.log("✅ Seeded plan_configs/pro");

    console.log("\n🎉 Config seeding complete. You can edit these from the Firebase console.");
    process.exit(0);
}

seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
