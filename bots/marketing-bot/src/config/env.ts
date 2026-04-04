import dotenv from "dotenv";
import path from "path";

// Load from root .env
dotenv.config({ path: path.resolve("../../.env") });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.warn(`⚠️ Missing environment variable: ${key}`);
    return "";
  }
  return value;
}

export const config = {
  server: {
    port: parseInt(process.env.PORT || "8080", 10),
    nodeEnv: process.env.NODE_ENV || "development",
  },
  telegram: {
    botToken: requireEnv("TELEGRAM_BOT_TOKEN"),
    chatId: requireEnv("TELEGRAM_CHAT_ID"),
  },
  googleCloud: {
    projectId: requireEnv("GOOGLE_CLOUD_PROJECT"),
    location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
  },
  gemini: {
    model: "gemini-2.5-flash", // Used for Twitter
    flashModel: "gemini-2.0-flash-001", // Used for Reddit Researcher
  },
  buffer: {
    apiKey: requireEnv("BUFFER_API_KEY"),
    profileId: requireEnv("BUFFER_PROFILE_ID"),
  },
  scheduler: {
    secret: requireEnv("SCHEDULER_SECRET"),
  },
  reddit: {
    userAgent: "OpinionDeck-Researcher-v1.0",
  }
};
