import TelegramBot from "node-telegram-bot-api";
import { config } from "../config/env.js";
import { Post, UserAction, MarketingAnalysis } from "../types.js";

// Lazy-loaded bot instance
let botInstance: TelegramBot | null = null;

function getBot(): TelegramBot {
  if (botInstance) return botInstance;
  const token = config.telegram.botToken;
  if (!token || token.trim() === "") {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN is missing or empty. Bot functionality will be disabled.");
    // Return a dummy object to avoid crashes, but logic will fail gracefully on usage
    return new TelegramBot("DUMMY_TOKEN"); 
  }
  botInstance = new TelegramBot(token);
  return botInstance;
}

const chatId = config.telegram.chatId;

/**
 * TWITTER HELPERS
 */
export async function sendPostOptions(posts: Post[]): Promise<void> {
  const lines = posts.map(
    (p) => `*Option ${p.index}:*\n${escapeMarkdown(p.content)}`
  );

  const message = `🧵 *Daily Content Ready*\n\n${lines.join("\n\n---\n\n")}\n\n_Tap a button to approve, or reply:_\n\`edit 2: make it punchier\``;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Post 1", callback_data: "select:1" },
        { text: "✅ Post 2", callback_data: "select:2" },
        { text: "✅ Post 3", callback_data: "select:3" },
      ],
      [{ text: "⏭ Skip", callback_data: "skip" }],
    ],
  };

  await getBot().sendMessage(chatId, message, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

export async function sendEditedPost(post: Post): Promise<void> {
  const message = `✏️ *Edited Option ${post.index}:*\n\n${escapeMarkdown(post.content)}\n\n_Approve this version?_`;
  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Yes, post it", callback_data: "confirm_edit" },
        { text: "❌ No, skip", callback_data: "reject_edit" },
      ],
    ],
  };
  await getBot().sendMessage(chatId, message, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

/**
 * REDDIT RESEARCH HELPERS
 */
export async function sendAnalysisResults(analysis: MarketingAnalysis): Promise<void> {
  const message = 
    `✅ *Analysis Complete*\n\n` +
    `👤 *Top Lead:* u/${analysis.lead.username} (Score: ${analysis.lead.score}/10)\n` +
    `📝 *Reason:* ${escapeMarkdown(analysis.lead.reason)}\n\n` +
    `--- *Reply Variants* ---\n\n` +
    `🟢 *[Main]:*\n${escapeMarkdown(analysis.variants.main)}\n\n` +
    `🟡 *[Short]:*\n${escapeMarkdown(analysis.variants.short)}\n\n` +
    `🔵 *[Casual]:*\n${escapeMarkdown(analysis.variants.casual)}`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "✅ Save Lead to Dashboard", callback_data: `save_lead:${analysis.lead.username}` }],
      [{ text: "❌ Discard", callback_data: "discard" }]
    ]
  };

  await getBot().sendMessage(chatId, message, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

/**
 * COMMON HELPERS
 */
export async function sendConfirmation(content: string): Promise<void> {
  const message = `✅ *Action Confirmed!*\n\n${escapeMarkdown(content)}`;
  await getBot().sendMessage(chatId, message, { parse_mode: "Markdown" });
}

export async function sendError(error: string): Promise<void> {
  await getBot().sendMessage(chatId, `❌ *Error:* ${escapeMarkdown(error)}`, {
    parse_mode: "Markdown",
  });
}

export async function sendMessage(text: string): Promise<void> {
  await getBot().sendMessage(chatId, text);
}

export async function sendHelpMenu(hasActiveSession: boolean): Promise<void> {
  const message = 
    `🤖 *Marketing Agent Control Panel*\n\n` +
    `Select an action below to manage your pipeline:\n\n` +
    `💡 *Tip:* Paste a Reddit URL anytime to analyze a thread for leads!`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🚀 Daily Run", callback_data: "generate" },
        { text: "🎯 View Leads", callback_data: "view_leads" }
      ],
      [
        { text: "📊 System Status", callback_data: "status" },
        { text: "🕵️ Research Guide", callback_data: "guide" }
      ],
      ...(hasActiveSession ? [[{ text: "🗑️ Clear Session", callback_data: "skip" }]] : []),
    ]
  };
  await getBot().sendMessage(chatId, message, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

/**
 * PARSER
 */
export function parseUpdate(update: TelegramBot.Update): UserAction {
  // Handle callbacks
  if (update.callback_query?.data) {
    const data = update.callback_query.data;
    if (data.startsWith("select:")) return { type: "select", index: parseInt(data.split(":")[1], 10) };
    if (data.startsWith("save_lead:")) return { type: "save_lead", username: data.split(":")[1] };
    if (data === "skip") return { type: "skip" };
    if (data === "generate") return { type: "generate" };
    if (data === "status") return { type: "generate", raw: "/status" }; // Remapped
    if (data === "guide") return { type: "generate", raw: "/guide" };   // Remapped
    if (data === "confirm_edit") return { type: "confirm_edit" };
    if (data === "reject_edit") return { type: "reject_edit" };
    if (data === "view_leads") return { type: "generate", raw: "/leads" }; // Remapped
  }

  // Handle text
  const text = update.message?.text?.trim();
  if (!text) return { type: "unknown", raw: "" };

  // Reddit URLs
  if (text.includes("reddit.com/r/")) return { type: "reddit_url", url: text };

  // Commands
  if (text.toLowerCase() === "/generate") return { type: "generate" };
  if (text.toLowerCase() === "/leads") return { type: "generate", raw: "/leads" };
  if (["hi", "/start", "/help"].includes(text.toLowerCase())) return { type: "help" };

  // Edits
  const editMatch = text.match(/^edit\s+(\d+):\s*(.+)$/i);
  if (editMatch) return { type: "edit", index: parseInt(editMatch[1], 10), feedback: editMatch[2].trim() };

  return { type: "unknown", raw: text };
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

export function getBotInstance(): TelegramBot {
  return getBot();
}
