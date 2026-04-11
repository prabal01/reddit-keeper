import { PullPushService } from '../../discovery/pullpush.service.js';
import { vertexAI } from '../../ai.js';
import { SchemaType } from '@google-cloud/vertexai';
import { redis } from '../../middleware/rateLimiter.js';
import { logger } from '../../utils/logger.js';

const pullPush = new PullPushService();

const CACHE_TTL = 86400; // 24h
const FREE_LIMIT = 5;
const POSTS_TO_ANALYZE = 25;
const BODY_EXCERPT_LENGTH = 200;

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

    const submissions = await pullPush.searchSubmissions(product, subreddit, 100);
    if (submissions.length === 0) {
        throw new Error('NO_DATA');
    }

    // Filter out low-engagement noise (score <= 10 in PullPush = real score <= 1)
    const filtered = submissions.filter(p => (p.score || 0) > 10);

    // Mix selection: top by score + most recent for diversity
    const byScore = [...filtered].sort((a, b) => (b.score || 0) - (a.score || 0));
    const byRecent = [...filtered].sort((a, b) => (b.created_utc || 0) - (a.created_utc || 0));

    const selectedIds = new Set<string>();
    const selected: typeof submissions = [];

    // Top 15 by score
    for (const post of byScore) {
        if (selected.length >= 15) break;
        if (!selectedIds.has(post.id)) {
            selectedIds.add(post.id);
            selected.push(post);
        }
    }
    // Top 10 most recent (deduplicated)
    for (const post of byRecent) {
        if (selected.length >= POSTS_TO_ANALYZE) break;
        if (!selectedIds.has(post.id)) {
            selectedIds.add(post.id);
            selected.push(post);
        }
    }

    const postsText = selected
        .map((p, i) => {
            const score = Math.round((p.score || 0) / 10);
            let text = `[${i}] "${p.title}" (r/${p.subreddit}, score: ${score})`;
            if (p.selftext) {
                const excerpt = p.selftext.slice(0, BODY_EXCERPT_LENGTH).replace(/\n/g, ' ').trim();
                if (excerpt) text += `\nBody: ${excerpt}`;
            }
            return text;
        })
        .join('\n\n');

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
        .filter(o => o.postIndex >= 0 && o.postIndex < selected.length)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .map(o => ({
            title: selected[o.postIndex].title,
            url: selected[o.postIndex].url,
            subreddit: selected[o.postIndex].subreddit || subreddit,
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
