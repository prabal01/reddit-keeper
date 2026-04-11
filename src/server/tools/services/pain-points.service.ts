import { PullPushService } from '../../discovery/pullpush.service.js';
import { vertexAI } from '../../ai.js';
import { SchemaType } from '@google-cloud/vertexai';
import { redis } from '../../middleware/rateLimiter.js';
import { logger } from '../../utils/logger.js';

const pullPush = new PullPushService();

const CACHE_TTL = 86400; // 24h
const FREE_LIMIT = 3;

const painPointSchema: any = {
    type: SchemaType.OBJECT,
    properties: {
        painPoints: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    title: { type: SchemaType.STRING },
                    quote: { type: SchemaType.STRING },
                    severity: { type: SchemaType.STRING },
                    postIndex: { type: SchemaType.INTEGER },
                },
                required: ['title', 'quote', 'severity', 'postIndex'],
            },
        },
    },
    required: ['painPoints'],
};

const model = vertexAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: painPointSchema,
    },
});

interface PainPoint {
    title: string;
    quote: string;
    postUrl: string;
    severity: 'high' | 'medium' | 'low';
}

interface PainPointsResult {
    keyword: string;
    subreddit: string;
    painPoints: PainPoint[];
    totalFound: number;
    locked: boolean;
    freeCount: number;
}

export async function getPainPoints(
    keyword: string,
    subreddit: string,
    isAuthenticated: boolean
): Promise<PainPointsResult> {
    const cacheKey = `tools:pain:${keyword.toLowerCase()}:${subreddit.toLowerCase()}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached) as PainPointsResult;
            if (!isAuthenticated && parsed.painPoints.length > FREE_LIMIT) {
                return {
                    ...parsed,
                    painPoints: parsed.painPoints.slice(0, FREE_LIMIT),
                    locked: true,
                    freeCount: FREE_LIMIT,
                };
            }
            return { ...parsed, locked: false, freeCount: parsed.painPoints.length };
        }
    } catch (err) {
        logger.warn({ err }, 'Pain-points cache read failed');
    }

    // Fetch relevant posts
    const submissions = await pullPush.searchSubmissions(keyword, subreddit, 50);
    if (submissions.length === 0) {
        throw new Error('NO_DATA');
    }

    // Pick top posts by score for LLM analysis
    const topPosts = submissions
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 15);

    const postsText = topPosts
        .map((p, i) => `[${i}] "${p.title}" (score: ${Math.round((p.score || 0) / 10)})`)
        .join('\n');

    const prompt = `Analyze these Reddit posts from r/${subreddit} about "${keyword}" and extract specific pain points that users are experiencing.

Posts:
${postsText}

For each pain point found:
- title: A short, clear description of the pain point (1 sentence)
- quote: The most relevant phrase or sentence from the post title that illustrates this pain point
- severity: "high" if many people share this frustration or it's a serious problem, "medium" if it's a common annoyance, "low" if it's minor
- postIndex: The index number of the post this came from

Find as many distinct pain points as you can (up to 15). Focus on real user frustrations, not general observations.`;

    const result = await model.generateContent(prompt);
    const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let parsed: { painPoints: { title: string; quote: string; severity: string; postIndex: number }[] };

    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error('LLM_PARSE_ERROR');
    }

    const painPoints: PainPoint[] = (parsed.painPoints || []).map(pp => ({
        title: pp.title,
        quote: pp.quote,
        postUrl: topPosts[pp.postIndex]?.url || '',
        severity: (['high', 'medium', 'low'].includes(pp.severity) ? pp.severity : 'medium') as 'high' | 'medium' | 'low',
    }));

    const fullResult: PainPointsResult = {
        keyword,
        subreddit,
        painPoints,
        totalFound: painPoints.length,
        locked: false,
        freeCount: painPoints.length,
    };

    try {
        await redis.set(cacheKey, JSON.stringify(fullResult), 'EX', CACHE_TTL);
    } catch (err) {
        logger.warn({ err }, 'Pain-points cache write failed');
    }

    if (!isAuthenticated && painPoints.length > FREE_LIMIT) {
        return {
            ...fullResult,
            painPoints: painPoints.slice(0, FREE_LIMIT),
            locked: true,
            freeCount: FREE_LIMIT,
        };
    }

    return fullResult;
}
