import { PullPushService } from '../../discovery/pullpush.service.js';
import { vertexAI } from '../../ai.js';
import { SchemaType } from '@google-cloud/vertexai';
import { redis } from '../../middleware/rateLimiter.js';
import { logger } from '../../utils/logger.js';
import crypto from 'crypto';

const pullPush = new PullPushService();

const CACHE_TTL = 86400; // 24h
const FREE_LIMIT = 5;

const keywordSchema: any = {
    type: SchemaType.OBJECT,
    properties: {
        keywords: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
        },
    },
    required: ['keywords'],
};

const keywordModel = vertexAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: keywordSchema,
    },
});

interface SubredditMatch {
    name: string;
    relevance: 'high' | 'medium';
    mentionCount: number;
    samplePost: string;
}

interface SubredditFinderResult {
    description: string;
    subreddits: SubredditMatch[];
    totalFound: number;
    locked: boolean;
    freeCount: number;
}

export async function findSubreddits(
    description: string,
    isAuthenticated: boolean
): Promise<SubredditFinderResult> {
    const hash = crypto.createHash('md5').update(description.toLowerCase().trim()).digest('hex').slice(0, 12);
    const cacheKey = `tools:subfinder:${hash}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached) as SubredditFinderResult;
            if (!isAuthenticated && parsed.subreddits.length > FREE_LIMIT) {
                return {
                    ...parsed,
                    subreddits: parsed.subreddits.slice(0, FREE_LIMIT),
                    locked: true,
                    freeCount: FREE_LIMIT,
                };
            }
            return { ...parsed, locked: false, freeCount: parsed.subreddits.length };
        }
    } catch (err) {
        logger.warn({ err }, 'Subreddit-finder cache read failed');
    }

    // Step 1: Extract search keywords from the description
    const keywordPrompt = `Extract 5 specific search keywords or phrases that people would use on Reddit when discussing a product described as:

"${description}"

Return short, concrete search terms (1-3 words each) that would appear in Reddit post titles. Focus on the problem the product solves, the target audience, and common use cases.`;

    const kwResult = await keywordModel.generateContent(keywordPrompt);
    const kwText = kwResult.response?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let keywords: string[];

    try {
        const parsed = JSON.parse(kwText);
        keywords = (parsed.keywords || []).slice(0, 5);
    } catch {
        throw new Error('LLM_PARSE_ERROR');
    }

    if (keywords.length === 0) {
        throw new Error('NO_DATA');
    }

    // Step 2: Search PullPush for each keyword globally
    const allResults = await Promise.all(
        keywords.map(kw => pullPush.searchSubmissions(kw, undefined, 50))
    );

    // Step 3: Group by subreddit and rank
    const subMap: Record<string, { count: number; samplePost: string; totalScore: number }> = {};

    for (const results of allResults) {
        for (const post of results) {
            const sub = post.subreddit;
            if (!sub) continue;
            if (!subMap[sub]) {
                subMap[sub] = { count: 0, samplePost: post.title, totalScore: 0 };
            }
            subMap[sub].count++;
            subMap[sub].totalScore += (post.score || 0);
            // Keep the highest-scoring post as sample
            if ((post.score || 0) > subMap[sub].totalScore / subMap[sub].count) {
                subMap[sub].samplePost = post.title;
            }
        }
    }

    // Filter out very generic subreddits and sort by count
    const genericSubs = new Set(['askreddit', 'all', 'popular', 'pics', 'funny', 'memes', 'videos']);
    const ranked = Object.entries(subMap)
        .filter(([name]) => !genericSubs.has(name.toLowerCase()))
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 20);

    if (ranked.length === 0) {
        throw new Error('NO_DATA');
    }

    const maxCount = ranked[0][1].count;
    const subreddits: SubredditMatch[] = ranked.map(([name, data]) => ({
        name,
        relevance: data.count >= maxCount * 0.5 ? 'high' : 'medium',
        mentionCount: data.count,
        samplePost: data.samplePost,
    }));

    const fullResult: SubredditFinderResult = {
        description,
        subreddits,
        totalFound: subreddits.length,
        locked: false,
        freeCount: subreddits.length,
    };

    try {
        await redis.set(cacheKey, JSON.stringify(fullResult), 'EX', CACHE_TTL);
    } catch (err) {
        logger.warn({ err }, 'Subreddit-finder cache write failed');
    }

    if (!isAuthenticated && subreddits.length > FREE_LIMIT) {
        return {
            ...fullResult,
            subreddits: subreddits.slice(0, FREE_LIMIT),
            locked: true,
            freeCount: FREE_LIMIT,
        };
    }

    return fullResult;
}
