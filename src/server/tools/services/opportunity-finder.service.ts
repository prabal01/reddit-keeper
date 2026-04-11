import { PullPushService } from '../../discovery/pullpush.service.js';
import { vertexAI } from '../../ai.js';
import { SchemaType } from '@google-cloud/vertexai';
import { redis } from '../../middleware/rateLimiter.js';
import { logger } from '../../utils/logger.js';

const pullPush = new PullPushService();

const CACHE_TTL = 86400; // 24h
const FREE_LIMIT = 3;

const opportunitySchema: any = {
    type: SchemaType.OBJECT,
    properties: {
        opportunities: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    postIndex: { type: SchemaType.INTEGER },
                    relevanceScore: { type: SchemaType.INTEGER },
                    intentType: { type: SchemaType.STRING },
                    snippet: { type: SchemaType.STRING },
                },
                required: ['postIndex', 'relevanceScore', 'intentType', 'snippet'],
            },
        },
    },
    required: ['opportunities'],
};

const model = vertexAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: opportunitySchema,
    },
});

interface Opportunity {
    title: string;
    url: string;
    subreddit: string;
    relevanceScore: number;
    intentType: string;
    snippet: string;
}

interface OpportunityFinderResult {
    product: string;
    subreddit: string;
    opportunities: Opportunity[];
    totalFound: number;
    locked: boolean;
    freeCount: number;
}

export async function getOpportunities(
    product: string,
    subreddit: string,
    isAuthenticated: boolean
): Promise<OpportunityFinderResult> {
    const cacheKey = `tools:opp:${product.toLowerCase()}:${subreddit.toLowerCase()}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached) as OpportunityFinderResult;
            if (!isAuthenticated && parsed.opportunities.length > FREE_LIMIT) {
                return {
                    ...parsed,
                    opportunities: parsed.opportunities.slice(0, FREE_LIMIT),
                    locked: true,
                    freeCount: FREE_LIMIT,
                };
            }
            return { ...parsed, locked: false, freeCount: parsed.opportunities.length };
        }
    } catch (err) {
        logger.warn({ err }, 'Opportunity-finder cache read failed');
    }

    const submissions = await pullPush.searchSubmissions(product, subreddit, 50);
    if (submissions.length === 0) {
        throw new Error('NO_DATA');
    }

    const topPosts = submissions
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 15);

    const postsText = topPosts
        .map((p, i) => `[${i}] "${p.title}" (r/${p.subreddit}, score: ${Math.round((p.score || 0) / 10)})`)
        .join('\n');

    const prompt = `You are a marketing opportunity analyst. Analyze these Reddit posts and find threads where "${product}" (or a product like it) could genuinely help people.

Posts:
${postsText}

For each opportunity:
- postIndex: The index number of the post
- relevanceScore: 1-100 how relevant this post is for "${product}" marketing
- intentType: One of "asking_for_help", "comparing_options", "sharing_frustration", "looking_for_alternatives", "general_discussion"
- snippet: A short explanation of why this is an opportunity (1-2 sentences)

Only include posts with relevanceScore >= 40. Sort by relevanceScore descending. Find up to 15 opportunities.`;

    const result = await model.generateContent(prompt);
    const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let parsed: { opportunities: { postIndex: number; relevanceScore: number; intentType: string; snippet: string }[] };

    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error('LLM_PARSE_ERROR');
    }

    const opportunities: Opportunity[] = (parsed.opportunities || [])
        .filter(o => o.postIndex >= 0 && o.postIndex < topPosts.length)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .map(o => ({
            title: topPosts[o.postIndex].title,
            url: topPosts[o.postIndex].url,
            subreddit: topPosts[o.postIndex].subreddit || subreddit,
            relevanceScore: Math.min(100, Math.max(0, o.relevanceScore)),
            intentType: o.intentType,
            snippet: o.snippet,
        }));

    const fullResult: OpportunityFinderResult = {
        product,
        subreddit,
        opportunities,
        totalFound: opportunities.length,
        locked: false,
        freeCount: opportunities.length,
    };

    try {
        await redis.set(cacheKey, JSON.stringify(fullResult), 'EX', CACHE_TTL);
    } catch (err) {
        logger.warn({ err }, 'Opportunity-finder cache write failed');
    }

    if (!isAuthenticated && opportunities.length > FREE_LIMIT) {
        return {
            ...fullResult,
            opportunities: opportunities.slice(0, FREE_LIMIT),
            locked: true,
            freeCount: FREE_LIMIT,
        };
    }

    return fullResult;
}
