import { initializeApp, cert, type ServiceAccount, getApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { config } from "../config/env.js";
import { PendingSession, PostRecord, MarketingLead } from "../types.js";

let db: any;

/**
 * Initialize Firestore with root service-account.json
 */
export function initDb() {
  if (getApps().length > 0) {
    db = getFirestore(getApp());
    return;
  }

  const rootServiceAccountPath = path.resolve("../../service-account.json");
  let serviceAccount: ServiceAccount | null = null;

  if (fs.existsSync(rootServiceAccountPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(rootServiceAccountPath, "utf-8"));
  }

  if (serviceAccount) {
    console.log(`✅ Firestore initialized with service account: ${serviceAccount.projectId}`);
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    // Standard initialization for Cloud Run (Application Default Credentials)
    console.log("ℹ️ No service-account.json found. Using Application Default Credentials.");
    initializeApp();
  }
  db = getFirestore();
}

/**
 * TWITTER SESSION MANAGEMENT
 */
export async function getPendingSession(): Promise<PendingSession | null> {
  if (!db) initDb();
  const doc = await db.collection("pending_sessions").doc("current").get();
  return doc.exists ? (doc.data() as PendingSession) : null;
}

export async function savePendingSession(session: PendingSession) {
  if (!db) initDb();
  await db.collection("pending_sessions").doc("current").set({
    ...session,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function clearPendingSession() {
  if (!db) initDb();
  await db.collection("pending_sessions").doc("current").delete();
}

/**
 * POST RECORDS (Twitter)
 */
export async function savePost(record: PostRecord) {
  if (!db) initDb();
  await db.collection("posts").doc(record.id).set({
    ...record,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * MARKETING LEADS (Reddit)
 */
export async function saveMarketingLead(lead: Omit<MarketingLead, 'id' | 'createdAt' | 'status'>) {
  if (!db) initDb();
  const id = `${lead.username}_${Date.now()}`;
  const record: MarketingLead = {
    id,
    ...lead,
    status: 'new',
    createdAt: FieldValue.serverTimestamp(),
  };
  await db.collection("marketing_leads_v1").doc(id).set(record);
  return id;
}

export async function getRecentLeads(limit = 5) {
  if (!db) initDb();
  const snapshot = await db.collection("marketing_leads_v1")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snapshot.docs.map((doc: any) => doc.data() as MarketingLead);
}
