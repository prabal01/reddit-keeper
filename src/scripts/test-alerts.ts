import { sendAlert } from "../server/alerts.js";

async function test() {
  console.log("🚀 Sending test alert to Telegram...");
  await sendAlert("SYSTEM", "Monitoring system activated successfully! You will now receive alerts for all critical core product failures.");
  console.log("✅ Done.");
  process.exit(0);
}

test();
