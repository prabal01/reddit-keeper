import { initializeApp, cert } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const serviceAccountPath = path.resolve("./service-account.json");

async function diagnose() {
    if (!fs.existsSync(serviceAccountPath)) {
        console.error("❌ service-account.json not found.");
        return;
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
    console.log(`[Diagnostic] Project ID from Service Account: ${serviceAccount.project_id}`);

    initializeApp({
        credential: cert(serviceAccount)
    });

    const storage = getStorage();

    try {
        console.log("[Diagnostic] Attempting to list buckets...");
        const [buckets] = await storage.bucket().getFiles(); // This is wrong, need storage.getBuckets()
        // No, getStorage() returns a Storage object containing bucket() which returns a Bucket.
        // To list buckets we need the underlying @google-cloud/storage client.
    } catch (e) {
        // ...
    }

    try {
        const [buckets] = await storage.bucket().getMetadata();
        console.log("[Diagnostic] Default bucket metadata retrieved for project's default bucket.");
    } catch (e: any) {
        console.log(`[Diagnostic] Failed to get default bucket metadata: ${e.message}`);
    }

    const commonNames = [
        `${serviceAccount.project_id}.appspot.com`,
        `${serviceAccount.project_id}.firebasestorage.app`,
        `opiniondeck-app.appspot.com`
    ];

    for (const name of commonNames) {
        try {
            const bucket = storage.bucket(name);
            const [exists] = await bucket.exists();
            console.log(`[Diagnostic] Bucket ${name} exists: ${exists}`);
        } catch (e: any) {
            console.log(`[Diagnostic] Error checking ${name}: ${e.message}`);
        }
    }
}

diagnose().catch(console.error);
