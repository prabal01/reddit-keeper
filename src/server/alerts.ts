import "dotenv/config";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Sends a high-priority alert to the administrator via Telegram.
 * Used for critical system failures like Reddit 403 blocks or AI timeouts.
 */
export async function sendAlert(
  type: "REDDIT" | "AI" | "QUEUE" | "SYSTEM",
  message: string,
  details?: any
): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("[Alerts] Skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing in .env");
    return;
  }

  const icons = {
    REDDIT: "🚫",
    AI: "🤖",
    QUEUE: "⚙️",
    SYSTEM: "🚨"
  };

  const timestamp = new Date().toLocaleString("en-US", { timeZone: "UTC" });
  const icon = icons[type] || "⚠️";
  
  let text = `${icon} *OPINIONDECK ALERT: ${type}*\n\n`;
  text += `${message}\n\n`;
  text += `🕒 *Time:* ${timestamp} UTC\n`;

  if (details) {
    const detailsStr = typeof details === "string" ? details : JSON.stringify(details, null, 2);
    text += `\n*Details:*\n\`\`\`${detailsStr.substring(0, 500)}\`\`\``;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: "Markdown"
      })
    });

    if (!response.ok) {
      const respText = await response.text();
      console.error(`[Alerts] Telegram API failed: ${response.status} - ${respText}`);
    } else {
      console.log(`[Alerts] Alert sent successfully: ${type}`);
    }
  } catch (err: any) {
    console.error(`[Alerts] Failed to send Telegram alert: ${err.message}`);
  }
}
