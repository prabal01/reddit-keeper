import { VertexAI } from "@google-cloud/vertexai";
import { config } from "../config/env.js";
import { Post, TopicSelection, MarketingAnalysis } from "../types.js";
import { TONE_PROMPT, PRODUCT_CONTEXT } from "../config/topics.js";
import fs from "fs";
import path from "path";

// Lazy-loaded Vertex AI instances
let vertexAIInstance: VertexAI | null = null;
let twitterModel: any = null;
let researcherModel: any = null;

function initAI() {
  if (vertexAIInstance) return;
  
  const project = config.googleCloud.projectId;
  if (!project || project.trim() === "") {
    console.warn("⚠️ GOOGLE_CLOUD_PROJECT is missing. AI functionality will be disabled.");
  }

  vertexAIInstance = new VertexAI({
    project: project || "placeholder",
    location: config.googleCloud.location,
  });

  twitterModel = vertexAIInstance.getGenerativeModel({ model: config.gemini.model });
  researcherModel = vertexAIInstance.getGenerativeModel({ model: config.gemini.flashModel });
}

// Strategy
const knowledgeBasePth = path.resolve("./knowledge/base.md");
const strategy = fs.existsSync(knowledgeBasePth)
  ? fs.readFileSync(knowledgeBasePth, "utf-8")
  : "You are an expert Reddit Marketing Strategist.";

/**
 * ── TWITTER CONTENT ENGINE ──────────────────────────────────────────
 */

export async function generatePosts(topic: TopicSelection): Promise<Post[]> {
  initAI();
  const prompt = `${TONE_PROMPT}\n\n${PRODUCT_CONTEXT}\n\nAudience: Indie hackers, early-stage founders\n\nInstructions:\n- Write 3 tweet options (Max 220 chars each)\n- 80% value, 20% OpinionDeck soft-plug\n- Topic: ${topic.subtopic} (${topic.angle})\n\nRespond ONLY with JSON: [{ "index": 1, "content": "..." }, ...]`;

  const result = await twitterModel.generateContent(prompt);
  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleaned = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned);

  return (parsed as any[]).map(p => ({ ...p, topic: topic.subtopic }));
}

export async function regenerateTwitterPost(original: string, feedback: string, topic: string): Promise<Post> {
  initAI();
  const prompt = `${TONE_PROMPT}\n\n${PRODUCT_CONTEXT}\n\nYou wrote: "${original}"\nFeedback: "${feedback}"\nTopic: ${topic}\n\nRewrite. Keep under 280 chars. Return JSON: { "index": 1, "content": "..." }`;

  const result = await twitterModel.generateContent(prompt);
  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleaned = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return { index: 1, content: parsed.content, topic };
}

/**
 * ── REDDIT RESEARCHER (+1 METHOD) ──────────────────────────────────
 */

export async function analyzeRedditThread(threadText: string): Promise<MarketingAnalysis> {
  initAI();
  const prompt = `
  ${strategy}
  
  --- THREAD CONTENT ---
  ${threadText.slice(0, 15000)}
  
  TASK: Identify the single best user to engage with.
  Score their intensity (0-10) and provide 3 variant replies (+1 Method).
  
  RETURN JSON:
  {
    "lead": { "username": "...", "score": 8, "reason": "...", "contextBio": "..." },
    "variants": { "main": "...", "short": "...", "casual": "..." }
  }
  `;

  const result = await researcherModel.generateContent(prompt);
  const text = result.response.candidates?.[0].content.parts[0].text || "";
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}

export async function refineRedditReply(currentReply: string, instruction: string): Promise<string> {
  initAI();
  const prompt = `
  ${strategy}\n\nCURRENT REPLY: ${currentReply}\nINSTRUCTION: ${instruction}\n\nRefine based on instruction. Return only text.`;

  const result = await researcherModel.generateContent(prompt);
  return result.response.candidates?.[0].content.parts[0].text?.trim() || currentReply;
}
