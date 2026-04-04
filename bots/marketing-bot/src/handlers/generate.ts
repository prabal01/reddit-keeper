import { selectTopic } from "../services/topic-selector.js";
import { generatePosts } from "../services/ai.js";
import { sendPostOptions, sendError } from "../services/telegram.js";
import {
  getPendingSession,
  savePendingSession,
  clearPendingSession,
} from "../db/firestore.js";
import { PendingSession } from "../types.js";

export async function handleDailyGeneration(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const existingSession = await getPendingSession();
    if (existingSession) {
      console.log("[Generate] Active session exists, skipping");
      return { success: true, message: "Skipped — active session exists" };
    }

    const topic = await selectTopic();
    const posts = await generatePosts(topic);

    const session: PendingSession = {
      posts,
      topic: topic.subtopic,
      createdAt: new Date(),
    };
    await savePendingSession(session);
    await sendPostOptions(posts);

    return { success: true, message: "Content generated" };
  } catch (error: any) {
    console.error("[Generate] Error:", error.message);
    await sendError(`Generation failed: ${error.message}`);
    return { success: false, message: error.message };
  }
}

export async function handleSessionCleanup(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const session = await getPendingSession();
    if (!session) return { success: true, message: "No stale session" };

    const createdAt = (session.createdAt as any)?.toDate?.() || new Date(session.createdAt);
    const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

    if (ageHours >= 8) {
      await clearPendingSession();
      return { success: true, message: "Stale session cleared" };
    }
    return { success: true, message: "Session still active" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
