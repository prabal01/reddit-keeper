import { VertexAI, SchemaType } from "@google-cloud/vertexai";
import { GoogleAuth } from "google-auth-library";
import { sendAlert } from "./alerts.js";
import { logger } from "./utils/logger.js";

const project = process.env.GOOGLE_CLOUD_PROJECT || "redditkeeperprod";
const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

logger.info(`[AI] Initializing Vertex AI... Project: ${project}, Location: ${location}`);

export const vertexAI = new VertexAI({ project, location });

/**
 * Robust retry wrapper for Vertex AI calls to handle 429 Resource Exhausted errors.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5, baseDelay = 5000): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (err: unknown) {
            lastError = err;
            const errObj = err as Record<string, any>;
            const errorText = JSON.stringify(err).toLowerCase() + ((errObj?.message as string) || '').toLowerCase();
            const isRateLimit = errorText.includes('429') ||
                errorText.includes('resource_exhausted') ||
                errObj?.status === 429 ||
                errObj?.response?.status === 429;

            if (isRateLimit && i < maxRetries - 1) {
                // Exponential backoff: 5s, 10s, 20s, 40s...
                const delay = baseDelay * Math.pow(2, i) + (Math.random() * 2000);
                logger.warn(`[AI] Rate limit hit (429). Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw err;
        }
    }
    const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
    await sendAlert("AI", `Vertex AI Failed after ${maxRetries} attempts!`, { error: errMsg });
    throw lastError;
}

// Schema Definitions using Vertex AI format ('object', 'string', etc.)
const granularThreadInsightSchema: any = {
    type: 'object',
    properties: {
        thread_id: { type: 'string' },
        pain_points: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    quotes: { type: 'array', items: { type: 'string' } }
                },
                required: ["title", "quotes"]
            }
        },
        switch_triggers: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    quotes: { type: 'array', items: { type: 'string' } }
                },
                required: ["title", "quotes"]
            }
        },
        desired_outcomes: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    quotes: { type: 'array', items: { type: 'string' } }
                },
                required: ["title", "quotes"]
            }
        }
    },
    required: ["thread_id", "pain_points", "switch_triggers", "desired_outcomes"]
};

const responseSchema: any = {
    type: 'object',
    properties: {
        market_attack_summary: {
            type: 'object',
            properties: {
                core_frustration: { type: 'string' },
                primary_competitor_failure: { type: 'string' },
                immediate_opportunity: { type: 'string' },
                confidence_basis: {
                    type: 'object',
                    properties: {
                        threads_analyzed: { type: 'integer' },
                        total_complaint_mentions: { type: 'integer' }
                    },
                    required: ["threads_analyzed", "total_complaint_mentions"]
                }
            },
            required: ["core_frustration", "primary_competitor_failure", "immediate_opportunity", "confidence_basis"]
        },
        high_intensity_pain_points: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    mention_count: { type: 'integer' },
                    threads_covered: { type: 'integer' },
                    intensity: { type: 'string', enum: ["Low", "Medium", "High"] },
                    representative_quotes: { type: 'array', items: { type: 'string' } },
                    why_it_matters: { type: 'string' }
                },
                required: ["title", "mention_count", "threads_covered", "intensity", "representative_quotes", "why_it_matters"]
            }
        },
        switch_triggers: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    trigger: { type: 'string' },
                    evidence_mentions: { type: 'integer' },
                    representative_quotes: { type: 'array', items: { type: 'string' } },
                    strategic_implication: { type: 'string' }
                },
                required: ["trigger", "evidence_mentions", "representative_quotes", "strategic_implication"]
            }
        },
        feature_gaps: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    missing_or_weak_feature: { type: 'string' },
                    demand_signal_strength: { type: 'string', enum: ["Low", "Medium", "High"] },
                    mention_count: { type: 'integer' },
                    context_summary: { type: 'string' },
                    opportunity_level: { type: 'string', enum: ["Low", "Medium", "High"] }
                },
                required: ["missing_or_weak_feature", "demand_signal_strength", "mention_count", "context_summary", "opportunity_level"]
            }
        },
        competitive_weakness_map: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    competitor: { type: 'string' },
                    perceived_strength: { type: 'string' },
                    perceived_weakness: { type: 'string' },
                    exploit_opportunity: { type: 'string' }
                },
                required: ["competitor", "perceived_strength", "perceived_weakness", "exploit_opportunity"]
            }
        },
        ranked_build_priorities: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    priority_rank: { type: 'integer' },
                    initiative: { type: 'string' },
                    justification: { type: 'string' },
                    evidence_mentions: { type: 'integer' },
                    expected_impact: { type: 'string', enum: ["Low", "Medium", "High"] }
                },
                required: ["priority_rank", "initiative", "justification", "evidence_mentions", "expected_impact"]
            }
        },
        messaging_and_positioning_angles: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    angle: { type: 'string' },
                    supporting_emotional_driver: { type: 'string' },
                    supporting_evidence_quotes: { type: 'array', items: { type: 'string' } }
                },
                required: ["angle", "supporting_emotional_driver", "supporting_evidence_quotes"]
            }
        },
        risk_flags: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    risk: { type: 'string' },
                    evidence_basis: { type: 'string' }
                },
                required: ["risk", "evidence_basis"]
            }
        },
        analysis_metadata: {
            type: 'object',
            properties: {
                platform: { type: 'string' },
                competitor_analyzed: { type: 'string' },
                total_threads: { type: 'integer' },
                total_comments_analyzed: { type: 'integer' },
                analysis_depth: { type: 'string', enum: ["Lean", "Moderate", "Deep"] }
            },
            required: ["platform", "competitor_analyzed", "total_threads", "total_comments_analyzed", "analysis_depth"]
        },
        launch_velocity_90_days: {
            type: 'object',
            properties: {
                core_feature_to_ship: { type: 'string' },
                positioning_angle: { type: 'string' },
                target_segment: { type: 'string' },
                pricing_strategy: { type: 'string' },
                primary_differentiator: { type: 'string' }
            },
            required: ["core_feature_to_ship", "positioning_angle", "target_segment", "pricing_strategy", "primary_differentiator"]
        }
    },
    required: [
        "market_attack_summary", "high_intensity_pain_points", "switch_triggers",
        "feature_gaps", "competitive_weakness_map", "ranked_build_priorities",
        "messaging_and_positioning_angles", "risk_flags", "analysis_metadata",
        "launch_velocity_90_days"
    ]
};

const model = vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema
    }
});

const granularModel = vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: granularThreadInsightSchema
    }
});

const ideaDiscoverySchema: any = {
    type: SchemaType.OBJECT,
    properties: {
        queries: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
        }
    },
    required: ["queries"]
};

const ideaModel = vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: ideaDiscoverySchema
    }
});

const nicheExtractionSchema: any = {
    type: SchemaType.OBJECT,
    properties: {
        niche: { type: SchemaType.STRING },
        description: { type: SchemaType.STRING },
        target_audience: { type: SchemaType.STRING },
        suggested_keywords: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
        }
    },
    required: ["niche", "description", "target_audience", "suggested_keywords"]
};

const nicheModel = vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: nicheExtractionSchema
    }
});

const opportunitySchema: any = {
    type: SchemaType.OBJECT,
    properties: {
        relevanceScore: { type: SchemaType.NUMBER },
        matchReason: { type: SchemaType.STRING },
        suggestedReply: { type: SchemaType.STRING, nullable: true }
    },
    required: ["relevanceScore", "matchReason"]
};

const arbitrationModel = vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
                areSame: { type: SchemaType.BOOLEAN },
                reasoning: { type: SchemaType.STRING },
                canonicalTitle: { type: SchemaType.STRING }
            },
            required: ["areSame", "reasoning", "canonicalTitle"]
        }
    }
});

const opportunityModel = vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: opportunitySchema
    }
});

export interface IdeaExpansion {
    intent: {
        persona: string;
        pain: string;
        domain: string;
    };
    queries: string[];
}

export async function expandIdeaToQueries(idea: string, communities?: string[], competitors?: string[], numQueries = 1): Promise<IdeaExpansion> {
    const communityContext = communities && communities.length > 0
        ? `Focus on these subreddits if relevant: ${communities.join(', ')}.`
        : "";

    const competitorContext = competitors && competitors.length > 0
        ? `Existing competitors in this space: ${competitors.join(', ')}.`
        : "";

    const prompt = `
    You are a search expert. Analyze the following idea and prepare a structured search plan.
    
    IDEA: "${idea}"
    ${communityContext}
    ${competitorContext}
    
    STEP 1: Problem Distillation
    1.1 Root Problem: Extract the underlying problem in 2-3 words (e.g., "Budgeting", "Expense Tracking", "Habit Building").
    1.2 Core Pain: What is the specific emotional struggle? (e.g., "feels like a chore", "hard to stay consistent").
    
    STEP 2: Generate Search Queries
    Generate exactly ${numQueries} distinct search angles to find high-signal discussions.
    
    PATTERN for each query:
    [Root Problem/Angle] (site:reddit.com OR site:news.ycombinator.com) [Intent Word]
    
    EXAMPLES OF INTENT WORDS: frustrating, sucks, annoying, alternative, "how to", "is it worth it"
    
    RULES:
    - Return EXACTLY ${numQueries} queries.
    - Each query must be unique and cover a different angle (e.g. pain point, competitor comparison, desired transition).
    - Use the exact platform filtering (site:reddit.com OR site:news.ycombinator.com).
    
    Return JSON format: 
    { 
      "intent": { "persona": "...", "pain": "...", "domain": "..." },
      "queries": ["Query 1", "Query 2", ...] 
    }
    `;

    try {
        const result = await withRetry(() => ideaModel.generateContent(prompt));
        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("No response from Idea Expansion Model");

        // Clean up markdown if present
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch ? jsonMatch[0] : text;
        const parsed = JSON.parse(cleanJson);

        // Final cleaning of queries to ensure no '+' or weird stuff
        const finalQueries = (parsed.queries || []).map((q: string) =>
            q.replace(/\+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
        ).slice(0, 6);

        const finalIntent = parsed.intent || { persona: "general users", pain: idea, domain: "software" };

        logger.info({ intent: finalIntent }, `[AI] [IDEA_EXPANSION] Intent Detected`);
        logger.info(`[AI] [IDEA_EXPANSION] Generated ${finalQueries.length} queries`);
        finalQueries.forEach((q: string, i: number) => logger.info(`  Query ${i + 1}: ${q}`));

        return {
            intent: finalIntent,
            queries: finalQueries
        };
    } catch (error) {
        logger.error({ err: error }, "[AI] [IDEA_EXPANSION] Error");
        return {
            intent: { persona: "unknown", pain: "unknown", domain: "unknown" },
            queries: [idea]
        };
    }
}

interface ThreadContext {
    id: string;
    title: string;
    subreddit: string;
    comments: any[];
}

// Helper to minify comments and save tokens
export function minifyComments(comments: any[], depth = 0): string {
    if (!comments || comments.length === 0) return "";

    return comments.map((c: any) => {
        const indent = "  ".repeat(depth);
        const header = `${indent}[ID:${c.id}] u/${c.author}:`;
        const body = c.body ? c.body.replace(/\n/g, " ") : "[deleted]";
        const replies = c.replies ? "\n" + minifyComments(c.replies, depth + 1) : "";
        return `${header} ${body}${replies}`;
    }).join("\n");
}

export async function analyzeThreads(threads: ThreadContext[], context?: string, totalComments: number = 0) {
    const threadData = threads.map(t => ({
        title: t.title,
        subreddit: t.subreddit,
        id: t.id,
        content: minifyComments(t.comments)
    }));

    const systemPrompt = `
You are a competitive intelligence analyst.
Your job is to transform raw customer discussion threads into a strategic competitive advantage blueprint.

You must return a JSON object that EXACTLY follows this structure:
{
  "market_attack_summary": {
    "core_frustration": "string",
    "primary_competitor_failure": "string",
    "immediate_opportunity": "string",
    "confidence_basis": { "threads_analyzed": number, "total_complaint_mentions": number }
  },
  "high_intensity_pain_points": [],
  "switch_triggers": [],
  "feature_gaps": [],
  "competitive_weakness_map": [],
  "ranked_build_priorities": [],
  "messaging_and_positioning_angles": [],
  "risk_flags": [],
  "analysis_metadata": { "platform": "Reddit", "competitor_analyzed": "${context || 'Unknown'}", "total_threads": ${threads.length}, "total_comments_analyzed": ${totalComments}, "analysis_depth": "Deep" },
  "launch_velocity_90_days": {
    "core_feature_to_ship": "string",
    "positioning_angle": "string",
    "target_segment": "string",
    "pricing_strategy": "string",
    "primary_differentiator": "string"
  }
}

You are extracting:
- Emotional pain -> high_intensity_pain_points
- Repeated complaints -> market_attack_summary.total_complaint_mentions
- Switching triggers -> switch_triggers
- Feature gaps -> feature_gaps
- Strategic opportunities -> immediate_opportunity
- Launch roadmap -> launch_velocity_90_days (Actionable, tactical 90-day strike plan)
- Messaging leverage -> messaging_and_positioning_angles

You must ONLY use the provided threads as evidence.
Quotes must be copied verbatim.
Keep language strategic, decisive, and actionable.

INPUT
Competitor Name: ${context || "Unknown"}
Platform: Reddit
Total Threads Provided: ${threads.length}

Thread Data:
${threadData.map(t => `--- THREAD START ---\nTitle: ${t.title}\nSubreddit: r/${t.subreddit}\n${t.content}\n--- THREAD END ---`).join("\n\n")}
`;

    try {
        logger.info(`[AI] Calling Vertex AI with ${threads.length} threads...`);
        const result = await withRetry(() => model.generateContent(systemPrompt));
        const response = result.response;

        // Vertex AI SDK response format
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error("No response from Vertex AI");

        logger.info("[AI] Raw Response received. Parsing JSON...");
        const parsed = JSON.parse(text);

        // Defensive check
        if (!parsed.market_attack_summary) {
            parsed.market_attack_summary = {
                core_frustration: "Data unavailable",
                primary_competitor_failure: "Data unavailable",
                immediate_opportunity: "Data unavailable",
                confidence_basis: { threads_analyzed: threads.length, total_complaint_mentions: 0 }
            };
        }

        // Backward compatibility mapping
        parsed.executive_summary = parsed.market_attack_summary.core_frustration + "\n\n" + parsed.market_attack_summary.immediate_opportunity;

        return {
            analysis: parsed,
            usage: response.usageMetadata
        };
    } catch (error) {
        logger.error({ err: error }, "Vertex AI Analysis Error");
        await sendAlert("AI", `Main Analysis Report Generation Failed!`, { error: error instanceof Error ? error.message : String(error) });
        throw error;
    }
}

export async function analyzeThreadGranular(thread: ThreadContext) {
    const threadContent = minifyComments(thread.comments);

    const systemPrompt = `
You are a competitive intelligence analyst.
Your job is to transform a SINGLE raw customer discussion thread into highly granular, structured intent signals.

Return a JSON object that EXACTLY follows this structure:
{
  "thread_id": "${thread.id}",
  "pain_points": [
    {
      "title": "string (lowercase, concrete, no adjectives, problem-focused, max 6 words)",
      "quotes": ["string (verbatim)"]
    }
  ],
  "switch_triggers": [
    {
      "title": "string (lowercase, concrete, situational, max 6 words)",
      "quotes": ["string (verbatim)"]
    }
  ],
  "desired_outcomes": [
    {
      "title": "string (lowercase, result-oriented, max 6 words)",
      "quotes": ["string (verbatim)"]
    }
  ]
}

STRICT CONSTRAINTS:
1. TITLES: Must be lowercase, concrete, max 6 words. No adjectives. No ranking.
2. QUOTES: Must be 100% verbatim from the text.
3. NO SPECULATION: If a signal is not explicitly present, return an empty array for that category.
4. CONCRETE: Focused on the specific problem described.

INPUT:
Thread Title: ${thread.title}
Subreddit: r/${thread.subreddit}

Thread Data:
${threadContent}
`;

    try {
        logger.info(`[AI] [GRANULAR] Analyzing thread ${thread.id} via Vertex AI...`);
        const result = await withRetry(() => granularModel.generateContent(systemPrompt));
        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error("No response from Vertex AI");
        return JSON.parse(text);
    } catch (error: unknown) {
        logger.error({ err: error, threadId: thread.id }, `[AI] [GRANULAR] Error analyzing thread ${thread.id}`);
        await sendAlert("AI", `Granular Thread Analysis Failed!`, {
            error: error instanceof Error ? error.message : String(error),
            threadId: thread.id,
            title: thread.title
        });
        throw error;
    }
}

export async function arbitrateSimilarity(titleA: string, titleB: string) {
    const prompt = `
    You are a linguistics expert. Compare two market research insights.
    Decide if they are "nuances of the same core problem" OR "distinctly different issues".
    
    Category Example: Pain Point
    Title A: "${titleA}"
    Title B: "${titleB}"
    
    Rules:
    - Return areSame: true if they describe the same underlying user frustration.
    - provide a brief reasoning.
    - provide a canonicalTitle that best represents both.
    
    Return JSON.
    `;

    try {
        const result = await withRetry(() => arbitrationModel.generateContent(prompt));
        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("No response from Arbitration Model");
        return {
            ...JSON.parse(text),
            usage: result.response.usageMetadata
        };
    } catch (error) {
        logger.error({ err: error }, "[AI] [ARBITRATION] Error");
        return { areSame: false, reasoning: "Error in arbitration", canonicalTitle: titleA };
    }
}

export async function getEmbeddings(texts: string[]) {
    try {
        logger.info(`[AI] Generating embeddings for ${texts.length} items...`);

        const auth = new GoogleAuth({
            scopes: 'https://www.googleapis.com/auth/cloud-platform'
        });
        const client = await auth.getClient();
        const projectId = await auth.getProjectId();
        const location = 'us-central1';
        const model = 'text-embedding-004';

        const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

        const instances = texts.map(text => ({ content: text }));
        const response = await withRetry(() => client.request({
            url,
            method: 'POST',
            data: { instances }
        })) as any;

        if (!response.data?.predictions) {
            throw new Error("No predictions returned from Vertex AI Embeddings");
        }

        const totalCharacters = texts.reduce((sum, text) => sum + text.length, 0);

        return {
            embeddings: response.data.predictions.map((p: any) => ({
                values: p.embeddings.values
            })),
            billableCharacters: totalCharacters
        };
    } catch (error) {
        logger.error({ err: error }, "[AI] [EMBEDDING] Error");
        throw error;
    }
}

// ── Stage 5: Ranked Synthesis ────────────────────────────────────────────────────────

const synthesisSchema = {
    type: SchemaType.OBJECT,
    properties: {
        ranked_build_priorities: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    rank: { type: SchemaType.INTEGER },
                    initiative: { type: SchemaType.STRING },
                    source_title: { type: SchemaType.STRING },
                    justification: { type: SchemaType.STRING },
                    evidence_mentions: { type: SchemaType.INTEGER },
                    threads_covered: { type: SchemaType.INTEGER }
                },
                required: ["rank", "initiative", "source_title", "justification", "evidence_mentions", "threads_covered"]
            }
        },
        market_attack_summary: { type: SchemaType.STRING },
        top_switch_triggers: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
        },
        top_desired_outcomes: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
        },
        high_intensity_pain_points: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
        },
        metadata: {
            type: SchemaType.OBJECT,
            properties: {
                total_threads: { type: SchemaType.INTEGER },
                total_comments: { type: SchemaType.INTEGER },
                generated_at: { type: SchemaType.STRING }
            },
            required: ["total_threads", "total_comments", "generated_at"]
        }
    },
    required: ["ranked_build_priorities", "market_attack_summary", "top_switch_triggers", "top_desired_outcomes", "high_intensity_pain_points", "metadata"]
};

const synthesisModel = vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: synthesisSchema
    },
    systemInstruction: {
        role: "system",
        parts: [{
            text: `You are an expert product strategist. Your task is to perform Stage 5: Ranked Synthesis.
You will be provided with three arrays of aggregated, clustered signals: pain_points, switch_triggers, and desired_outcomes.

STRICT INSTRUCTIONS:
1. Rank build priorities from pain_points ONLY.
2. Extract strongest switching signals from switch_triggers ONLY.
3. Extract aspiration signals from desired_outcomes ONLY.
4. NEVER mix categories.
5. NEVER fabricate counts (mention_count, threads_covered). You must extract numbers STRICTLY from the provided input data blocks. If you reference a cluster, pass through its exact counts.
6. Provide brief justification referencing frequency and the provided data metrics.
7. Return empty arrays if there is insufficient evidence for a category.
8. For ranked_build_priorities, YOU MUST SET \`source_title\` exactly to the original 'title' provided in the \`pain_points\` input cluster this initiative stems from.`
        }]
    }
});

export async function synthesizeReport(categories: { painPoints: any[], triggers: any[], outcomes: any[] }, totalThreads: number, totalComments: number) {
    logger.info(`[AI] Starting Stage 5 Ranked Synthesis...`);

    // We only pass the necessary data to the LLM to save tokens and prevent confusion
    const inputContent = JSON.stringify({
        pain_points: categories.painPoints.map(p => ({ title: p.canonicalTitle, mention_count: p.mentionCount, threads_covered: p.threadCount, intensity_score: p.intensityScore })),
        switch_triggers: categories.triggers.map(t => ({ title: t.canonicalTitle, mention_count: t.mentionCount, threads_covered: t.threadCount, intensity_score: t.intensityScore })),
        desired_outcomes: categories.outcomes.map(o => ({ title: o.canonicalTitle, mention_count: o.mentionCount, threads_covered: o.threadCount, intensity_score: o.intensityScore })),
        metadata: {
            total_threads: totalThreads,
            total_comments: totalComments
        }
    });

    const result = await withRetry(() => synthesisModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: inputContent }] }]
    }));

    const response = result.response;
    if (!response.candidates || response.candidates.length === 0) {
        throw new Error("No synthesis generated by AI");
    }

    const jsonString = response.candidates[0].content.parts[0].text || "{}";

    return {
        parsedResult: JSON.parse(jsonString),
        usage: response.usageMetadata
    };
}

export async function scoreMarketingOpportunity(productContext: string, post: { title: string; selftext: string; subreddit: string }) {
    const prompt = `
    You are a growth marketing expert. Evaluate if the following Reddit post is a "Marketing Opportunity" for a specific product.
    
    PRODUCT CONTEXT:
    "${productContext}"
    
    REDDIT POST:
    Title: ${post.title}
    Subreddit: r/${post.subreddit}
    Content: ${post.selftext}
    
    YOUR TASK:
    1. Relevance Score (0-100): How relevant is this post to the product? Is the user expressing a pain point the product solves? Are they asking for recommendations? 
    - 0-30: No relevance.
    - 31-70: Tangential or related domain but no immediate intent.
    - 71-100: High relevance. Direct pain point or category search.
    
    2. Match Reason: A 1-sentence explanation of why this matches (e.g., "User is frustrated with manual research time - fits your automated solution").
    
    3. Suggested Reply: A SHORT (1-2 sentence) non-spammy, helpful reply that mentions the product naturally. If relevance is < 70, return null.
    
    Return JSON.
    `;

    try {
        const result = await withRetry(() => opportunityModel.generateContent(prompt));
        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("No response from Opportunity Model");
        return JSON.parse(text);
    } catch (error) {
        logger.error({ err: error }, "[AI] [OPPORTUNITY_SCORE] Error");
        return { relevanceScore: 0, matchReason: "Failed to analyze", suggestedReply: null };
    }
}

// ── MVP Monitoring Discovery ──────────────────────────────────────

const discoveryBatchSchema: any = {
    type: SchemaType.OBJECT,
    properties: {
        patterns: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    title: { type: SchemaType.STRING },
                    count: { type: SchemaType.INTEGER },
                    quote: { type: SchemaType.STRING },
                    thread_ids: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
                },
                required: ["title", "count", "quote", "thread_ids"]
            }
        },
        opportunities: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    thread_id: { type: SchemaType.STRING },
                    relevance_score: { type: SchemaType.NUMBER },
                    intent_category: { type: SchemaType.STRING }
                },
                required: ["thread_id", "relevance_score", "intent_category"]
            }
        }
    },
    required: ["patterns", "opportunities"]
};

const discoveryBatchModel = vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: discoveryBatchSchema
    }
});

export async function analyzeDiscoveryBatch(niche: string, threads: { id: string, title: string, text: string }[]) {
    const prompt = `
    You are a product strategist analyzing Reddit threads about a specific niche.
    NICHE: "${niche}"
    
    You are given a batch of threads. Your task:
    1. Identify recurring user complaints or pain points (Patterns) across these threads. Group them, give them a title, count how many threads mention it, provide a representative verbatim quote, and list the thread_ids.
    2. Score each thread as an Opportunity (0-100) based on how immediate the intent/pain is. High scores imply strong buying intent or desperate need for a solution. Also assign an intent_category (e.g. "complaint", "question", "recommendation request").
    
    THREADS:
    ${threads.map(t => `ID: ${t.id}\nTitle: ${t.title}\nContent: ${t.text}`).join('\n---\n')}
    
    Return the JSON directly according to the schema.
    `;
    
    try {
        logger.info(`[AI] [DISCOVERY_BATCH] Analyzing ${threads.length} threads...`);
        const result = await withRetry(() => discoveryBatchModel.generateContent(prompt));
        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("No response from Discovery Batch Model");
        return JSON.parse(text);
    } catch (error) {
        logger.error({ err: error }, "[AI] [DISCOVERY_BATCH] Error");
        return { patterns: [], opportunities: [] };
    }
}

export async function extractNicheFromWebsite(url: string, html: string) {
    const prompt = `
    You are a market intelligence expert. 
    Analyze the following website content for "${url}" and extract the core product niche, description, and target audience.
    
    WEBSITE CONTENT (SNIPPET):
    ${html.substring(0, 5000)}
    
    YOUR TASK:
    1. niche: A 2-4 word summary of the market (e.g. "CRM for Agencies", "Developer Tools").
    2. description: 1 sentence explaining what they do.
    3. target_audience: 1 sentence on who uses this.
    4. suggested_keywords: 5-8 highly targetted search terms to find users with pain points this product solves on Reddit/HN. 
       (e.g. "budgeting app sucks", "alternative to quicken", "how to save more money").
    
    Return JSON.
    `;
    
    try {
        logger.info(`[AI] [NICHE_EXTRACTION] Analyzing website for ${url}...`);
        const result = await withRetry(() => nicheModel.generateContent(prompt));
        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("No response from Niche Extraction Model");
        return JSON.parse(text);
    } catch (error) {
        logger.error({ err: error }, "[AI] [NICHE_EXTRACTION] Error");
        return {
            niche: "Website Insight",
            description: `Extracted from ${url}`,
            target_audience: "unknown",
            suggested_keywords: [url]
        };
    }
}

