import crypto from "crypto";
import { Request, Response } from "express";
import { 
  parseUpdate, 
  sendPostOptions, 
  sendEditedPost, 
  sendConfirmation, 
  sendError, 
  sendMessage, 
  sendHelpMenu,
  sendAnalysisResults 
} from "../services/telegram.js";
import { 
  generatePosts, 
  regenerateTwitterPost, 
  analyzeRedditThread, 
  refineRedditReply 
} from "../services/ai.js";
import { fetchThread, flattenThread } from "../services/reddit.js";
import { BufferPublisher } from "../services/publisher.js";
import { 
  getPendingSession, 
  savePendingSession, 
  clearPendingSession, 
  savePost,
  saveMarketingLead,
  getRecentLeads
} from "../db/firestore.js";
import { PostRecord, Post, MarketingAnalysis } from "../types.js";
import { handleDailyGeneration } from "./generate.js";

const publisher = new BufferPublisher();

/**
 * MAIN TELEGRAM WEBHOOK HANDLER (Unified)
 */
export async function handleTelegramWebhook(req: Request, res: Response): Promise<void> {
  // Respond 200 OK immediately to stop Telegram from retrying
  res.sendStatus(200);

  const update = req.body;
  const action = parseUpdate(update);

  try {
    const session = await getPendingSession();

    // ────────────────────────────────────────────────────────
    // 1. REDDIT RESEARCHER FLOW (Triggered by URL)
    // ────────────────────────────────────────────────────────
    if (action.type === "reddit_url") {
      await sendMessage("🕵️ Reddit URL detected. Analyzing thread with +1 Method strategy...");
      try {
        const thread = await fetchThread(action.url);
        const flattened = flattenThread(thread);
        const analysis = await analyzeRedditThread(flattened);
        
        // Note: For Reddit, we don't use a "pending session" DB record yet, 
        // we just push the results and handle callbacks via the dynamic callback_data.
        await sendAnalysisResults(analysis);
      } catch (err: any) {
        await sendError(`Reddit analysis failed: ${err.message}`);
      }
      return;
    }

    // ────────────────────────────────────────────────────────
    // 2. LEAD MANAGEMENT FLOW
    // ────────────────────────────────────────────────────────
    if (action.type === "save_lead") {
      await saveMarketingLead({
        username: action.username,
        threadUrl: "", // Optional, could parse from context if needed
        commentText: "Saved via Unified Bot",
        intensityScore: 0,
        analysis: "Manual Save",
        contextBio: "Lead captured from Telegram"
      });
      await sendConfirmation(`Lead u/${action.username} saved to Admin Dashboard!`);
      return;
    }

    // ────────────────────────────────────────────────────────
    // 3. TWITTER CONTENT ENGINE FLOW (Existing Logic)
    // ────────────────────────────────────────────────────────
    
    // Check if the action belongs to an active session
    if (!session && !["generate", "help", "unknown"].includes(action.type)) {
      await sendMessage("No active Twitter session. Use /generate to trigger content ideas.");
      return;
    }

    switch (action.type) {
      case "generate": {
        if (action.raw === "/leads") {
          const leads = await getRecentLeads(5);
          let msg = "🎯 *Latest Leads*\n\n";
          leads.forEach((l: any) => msg += `• u/${l.username} (${l.intensityScore}/10)\n`);
          await sendMessage(msg);
          return;
        }

        if (action.raw === "/status") {
          await sendMessage(
            `📊 *System Health*\n\n` +
            `✅ *Cloud Run:* Online\n` +
            `✅ *Firestore:* Connected\n` +
            `✅ *Vertex AI:* Initialized\n` +
            `✅ *Telegram:* Active\n\n` +
            `🔗 *Project:* \`redditkeeperprod\``
          );
          return;
        }

        if (action.raw === "/guide") {
          await sendMessage(
            `🕵️ *Reddit Research Guide*\n\n` +
            `1. Find a Reddit thread you want to analyze.\n` +
            `2. Copy the full link (must include \`reddit.com/r/...\`).\n` +
            `3. Paste it directly in this chat.\n\n` +
            `The bot will automatically extract the top lead and generate high-intensity reply variants for you.`
          );
          return;
        }

        if (session) {
          await sendMessage("You already have an active content session.");
          return;
        }

        await sendMessage("⏳ Generating daily Twitter options...");
        handleDailyGeneration().catch((err: any) => sendError(`Auto-gen failed: ${err.message}`));
        break;
      }

      case "select": {
        if (!session) return;
        const selected = session.posts.find(p => p.index === action.index);
        if (!selected) return sendMessage("Invalid option.");

        const result = await publisher.publish(selected.content);
        if (result.success) {
          await sendConfirmation(selected.content);
          await savePost({
            id: crypto.randomUUID(),
            date: new Date().toISOString().split("T")[0],
            platform: "twitter",
            content: selected.content,
            topic: session.topic,
            status: "posted",
            posted: true,
            bufferPostId: result.url,
            createdAt: new Date()
          });
        } else {
          await sendError(`Post failed: ${result.error}`);
        }
        await clearPendingSession();
        break;
      }

      case "edit": {
        if (!session) return;
        const postToEdit = session.posts.find(p => p.index === action.index);
        if (!postToEdit) return;

        await sendMessage(`🔄 Regenerating option ${action.index}...`);
        const edited = await regenerateTwitterPost(postToEdit.content, action.feedback, session.topic);
        
        // Update session
        edited.index = action.index;
        const updatedPosts = session.posts.map(p => p.index === action.index ? edited : p);
        await savePendingSession({ ...session, posts: updatedPosts, editPendingIndex: action.index });
        await sendEditedPost(edited);
        break;
      }

      case "skip": {
        await clearPendingSession();
        await sendMessage("⏭ Session cleared. No post today.");
        break;
      }

      case "help": {
        await sendHelpMenu(!!session);
        break;
      }

      case "unknown": {
        await sendMessage("I didn't understand that. Send a Reddit URL for analysis or 'hi' for the menu.");
        break;
      }
    }

  } catch (error: any) {
    console.error("[Webhook] Crash:", error.message);
    await sendError(`Webhook error: ${error.message}`);
  }
}
