import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
if (!apiKey) {
    console.error("[AI] ERROR: GEMINI_API_KEY is not set in environment variables!");
}
console.log(`[AI] Initializing Google Generative AI (AI Studio SDK)... Key present: ${!!apiKey}`);

const genAI = new GoogleGenerativeAI(apiKey);

const responseSchema = {
    type: SchemaType.OBJECT,
    properties: {
        market_attack_summary: {
            type: SchemaType.OBJECT,
            properties: {
                core_frustration: { type: SchemaType.STRING },
                primary_competitor_failure: { type: SchemaType.STRING },
                immediate_opportunity: { type: SchemaType.STRING },
                confidence_basis: {
                    type: SchemaType.OBJECT,
                    properties: {
                        threads_analyzed: { type: SchemaType.INTEGER },
                        total_complaint_mentions: { type: SchemaType.INTEGER }
                    },
                    required: ["threads_analyzed", "total_complaint_mentions"]
                }
            },
            required: ["core_frustration", "primary_competitor_failure", "immediate_opportunity", "confidence_basis"]
        },
        high_intensity_pain_points: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    title: { type: SchemaType.STRING },
                    mention_count: { type: SchemaType.INTEGER },
                    threads_covered: { type: SchemaType.INTEGER },
                    intensity: { type: SchemaType.STRING, enum: ["Low", "Medium", "High"] },
                    representative_quotes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    why_it_matters: { type: SchemaType.STRING }
                },
                required: ["title", "mention_count", "threads_covered", "intensity", "representative_quotes", "why_it_matters"]
            }
        },
        switch_triggers: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    trigger: { type: SchemaType.STRING },
                    evidence_mentions: { type: SchemaType.INTEGER },
                    representative_quotes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    strategic_implication: { type: SchemaType.STRING }
                },
                required: ["trigger", "evidence_mentions", "representative_quotes", "strategic_implication"]
            }
        },
        feature_gaps: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    missing_or_weak_feature: { type: SchemaType.STRING },
                    demand_signal_strength: { type: SchemaType.STRING, enum: ["Low", "Medium", "High"] },
                    mention_count: { type: SchemaType.INTEGER },
                    context_summary: { type: SchemaType.STRING },
                    opportunity_level: { type: SchemaType.STRING, enum: ["Low", "Medium", "High"] }
                },
                required: ["missing_or_weak_feature", "demand_signal_strength", "mention_count", "context_summary", "opportunity_level"]
            }
        },
        competitive_weakness_map: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    competitor: { type: SchemaType.STRING },
                    perceived_strength: { type: SchemaType.STRING },
                    perceived_weakness: { type: SchemaType.STRING },
                    exploit_opportunity: { type: SchemaType.STRING }
                },
                required: ["competitor", "perceived_strength", "perceived_weakness", "exploit_opportunity"]
            }
        },
        ranked_build_priorities: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    priority_rank: { type: SchemaType.INTEGER },
                    initiative: { type: SchemaType.STRING },
                    justification: { type: SchemaType.STRING },
                    evidence_mentions: { type: SchemaType.INTEGER },
                    expected_impact: { type: SchemaType.STRING, enum: ["Low", "Medium", "High"] }
                },
                required: ["priority_rank", "initiative", "justification", "evidence_mentions", "expected_impact"]
            }
        },
        messaging_and_positioning_angles: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    angle: { type: SchemaType.STRING },
                    supporting_emotional_driver: { type: SchemaType.STRING },
                    supporting_evidence_quotes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
                },
                required: ["angle", "supporting_emotional_driver", "supporting_evidence_quotes"]
            }
        },
        risk_flags: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    risk: { type: SchemaType.STRING },
                    evidence_basis: { type: SchemaType.STRING }
                },
                required: ["risk", "evidence_basis"]
            }
        },
        analysis_metadata: {
            type: SchemaType.OBJECT,
            properties: {
                platform: { type: SchemaType.STRING },
                competitor_analyzed: { type: SchemaType.STRING },
                total_threads: { type: SchemaType.INTEGER },
                total_comments_analyzed: { type: SchemaType.INTEGER },
                analysis_depth: { type: SchemaType.STRING, enum: ["Lean", "Moderate", "Deep"] }
            },
            required: ["platform", "competitor_analyzed", "total_threads", "total_comments_analyzed", "analysis_depth"]
        },
        launch_velocity_90_days: {
            type: SchemaType.OBJECT,
            properties: {
                core_feature_to_ship: { type: SchemaType.STRING },
                positioning_angle: { type: SchemaType.STRING },
                target_segment: { type: SchemaType.STRING },
                pricing_strategy: { type: SchemaType.STRING },
                primary_differentiator: { type: SchemaType.STRING }
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

const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema as any
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
        console.log(`[AI] Calling Gemini AI Studio SDK with ${threads.length} threads...`);
        const result = await model.generateContent(systemPrompt);
        const response = result.response;
        const text = response.text();

        if (!text) throw new Error("No response from AI");

        console.log("[AI] Raw Response received. Parsing JSON...");
        const parsed = JSON.parse(text);
        console.log("[AI] DEBUG - Response Keys:", Object.keys(parsed));

        // Defensive check to avoid 500 error
        if (!parsed.market_attack_summary) {
            console.warn("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            console.warn("[AI] CRITICAL WARNING: market_attack_summary MISSING!");
            console.warn("[AI] Available Keys:", Object.keys(parsed));
            console.warn("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            parsed.market_attack_summary = {
                core_frustration: "Data unavailable",
                primary_competitor_failure: "Data unavailable",
                immediate_opportunity: "Data unavailable",
                confidence_basis: { threads_analyzed: threads.length, total_complaint_mentions: 0 }
            };
        }

        // Backward compatibility mapping for executive_summary
        parsed.executive_summary = parsed.market_attack_summary.core_frustration + "\n\n" + parsed.market_attack_summary.immediate_opportunity;

        return {
            analysis: parsed,
            usage: response.usageMetadata
        };
    } catch (error) {
        console.error("AI Analysis Error:", error);
        throw error;
    }
}
