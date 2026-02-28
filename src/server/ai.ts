import { VertexAI, SchemaType } from "@google-cloud/vertexai";
import { GoogleAuth } from "google-auth-library";

const project = process.env.GOOGLE_CLOUD_PROJECT || "redditkeeperprod";
const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

console.log(`[AI] Initializing Vertex AI... Project: ${project}, Location: ${location}`);

export const vertexAI = new VertexAI({ project, location });

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
        console.log(`[AI] Calling Vertex AI with ${threads.length} threads...`);
        const result = await model.generateContent(systemPrompt);
        const response = result.response;

        // Vertex AI SDK response format
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error("No response from Vertex AI");

        console.log("[AI] Raw Response received. Parsing JSON...");
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
        console.error("Vertex AI Analysis Error:", error);
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
        console.log(`[AI] [GRANULAR] Analyzing thread ${thread.id} via Vertex AI...`);
        const result = await granularModel.generateContent(systemPrompt);
        console.log('granual result', result)
        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error("No response from Vertex AI");
        return JSON.parse(text);
    } catch (error) {
        console.error(`[AI] [GRANULAR] Error analyzing thread ${thread.id}:`, error);
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
        const result = await arbitrationModel.generateContent(prompt);
        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("No response from Arbitration Model");
        return {
            ...JSON.parse(text),
            usage: result.response.usageMetadata
        };
    } catch (error) {
        console.error("[AI] [ARBITRATION] Error:", error);
        return { areSame: false, reasoning: "Error in arbitration", canonicalTitle: titleA };
    }
}

export async function getEmbeddings(texts: string[]) {
    try {
        console.log(`[AI] Generating embeddings for ${texts.length} items...`);

        const auth = new GoogleAuth({
            scopes: 'https://www.googleapis.com/auth/cloud-platform'
        });
        const client = await auth.getClient();
        const projectId = await auth.getProjectId();
        const location = 'us-central1';
        const model = 'text-embedding-004';

        const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

        const instances = texts.map(text => ({ content: text }));
        const response = await client.request({
            url,
            method: 'POST',
            data: { instances }
        }) as any;

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
        console.error("[AI] [EMBEDDING] Error:", error);
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
    console.log(`[AI] Starting Stage 5 Ranked Synthesis...`);

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

    const result = await synthesisModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: inputContent }] }]
    });

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
