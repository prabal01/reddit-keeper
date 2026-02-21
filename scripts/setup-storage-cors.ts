import { initializeApp, cert } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const serviceAccountPath = path.resolve("./service-account.json");
const BUCKET_NAME = process.env.FIREBASE_STORAGE_BUCKET || 'redditkeeperprod.firebasestorage.app';
const EXTENSION_ORIGIN = "chrome-extension://cmccgfodgcbdeogecakekhindchdhedd";

async function setupCORS() {
    if (!fs.existsSync(serviceAccountPath)) {
        console.error("❌ service-account.json not found in root.");
        return;
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));

    initializeApp({
        credential: cert(serviceAccount),
        storageBucket: BUCKET_NAME
    });

    const bucket = getStorage().bucket();

    console.log(`[CORS] Setting CORS for bucket: ${BUCKET_NAME}`);

    await bucket.setCorsConfiguration([
        {
            origin: [EXTENSION_ORIGIN, "http://localhost:5173"],
            method: ["GET", "POST", "PUT", "DELETE", "HEAD"],
            responseHeader: ["Content-Type", "Authorization", "x-goog-resumable"],
            maxAgeSeconds: 3600
        }
    ]);

    console.log("✅ CORS configuration updated successfully.");
}

setupCORS().catch(console.error);
