import { SchemaType } from "@google-cloud/vertexai";
import { vertexAI } from "../ai.js";

const queryExpansionSchema = {
    type: SchemaType.OBJECT,
    properties: {
        queries: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "List of 10-15 high-intent search queries"
        },
        reasoning: { type: SchemaType.STRING }
    },
    required: ["queries"]
};

export class DiscoveryBrain {
    private model = vertexAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: queryExpansionSchema
        },
        systemInstruction: {
            role: "system",
            parts: [{
                text: `You are an expert at finding high-intent B2B SaaS and productivity discussions on Reddit and Hacker News.
Your goal is to find threads where actual users are expressing "buying intent", "competitor gaps", or "professional frustration".

CRITICAL - AVOID SELF-PROMOTION & DEVELOPER SPAM:
- DO NOT generate queries that will find developers promoting their own apps (e.g., avoid "I built", "just launched", "my SaaS").
- AVOID personal life, relationship, or creative writing contexts.
- If the target is a generic category (e.g., "budget app", "CRM"), focus entirely on users ASKING for recommendations or COMPLAINING about existing tools.

Instead of generic searches, generate targeted queries that look for:
1. Alternatives & Recommendations (e.g., "best [competitor/category] alternative", "switching from [competitor]", "what [category] do you use")
2. Pain points & Complaints (e.g., "[competitor] too expensive", "[category] that doesn't suck", "frustrated with [competitor]")
3. Comparisons (e.g., "[competitor] vs [alternative] for teams", "best [category] for small business")

Generate 10-15 unique, highly targeted queries. Keep them concise and focused on the END USER'S perspective, not the developer's.`
            }]
        }
    });

    async expandQuery(competitor: string): Promise<string[]> {
        const result = await this.model.generateContent({
            contents: [{ role: 'user', parts: [{ text: `Competitor: ${competitor}` }] }]
        });

        const response = result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return [];

        try {
            const parsed = JSON.parse(text);
            return parsed.queries || [];
        } catch (e) {
            console.error("[DiscoveryBrain] Failed to parse queries:", e);
            return [];
        }
    }
}
