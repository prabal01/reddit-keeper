import crypto from 'crypto';
import { getDb } from '../firestore.js';
import { USER_AGENT } from '../config.js';
import { errMsg } from '../utils/errors.js';
import {
    MonitoredSubreddit,
    UserMonitor,
    CachedRedditPost,
    MarketingOpportunity
} from './types.js';
import { logger } from '../utils/logger.js';
import { FieldValue } from 'firebase-admin/firestore';
import fetch from 'node-fetch';
import { vertexAI } from '../ai.js';

const summaryModel = vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash",
});

export class MonitoringService {
    private static COL_MONITORS = 'monitoring_monitors';
    private static COL_POSTS = 'monitoring_posts';
    private static COL_OPPORTUNITIES = 'monitoring_opportunities';

    private static monitorDocId(uid: string, monitorId: string): string {
        return `${uid}_${monitorId}`;
    }

    /**
     * Get all active monitors across the platform (used by worker)
     */
    static async getAllMonitors(): Promise<UserMonitor[]> {
        const db = getDb();
        const snapshot = await db.collection(this.COL_MONITORS).get();
        return snapshot.docs.map(doc => {
            const data = doc.data() as UserMonitor;
            // Back-compat: old docs keyed by uid only, monitorId defaults to 'default'
            if (!data.monitorId) data.monitorId = 'default';
            if (!data.name) data.name = 'Default Monitor';
            return data;
        });
    }

    /**
     * Get all monitors for a specific user
     */
    static async getUserMonitors(uid: string): Promise<UserMonitor[]> {
        const db = getDb();
        const snapshot = await db.collection(this.COL_MONITORS)
            .where('uid', '==', uid)
            .get();
        return snapshot.docs.map(doc => {
            const data = doc.data() as UserMonitor;
            if (!data.monitorId) data.monitorId = 'default';
            if (!data.name) data.name = 'Default Monitor';
            return data;
        });
    }

    /**
     * Count monitors for a user (for plan enforcement)
     */
    static async countUserMonitors(uid: string): Promise<number> {
        const db = getDb();
        const snapshot = await db.collection(this.COL_MONITORS)
            .where('uid', '==', uid)
            .get();
        return snapshot.size;
    }

    /**
     * Get a specific monitor by uid + monitorId
     */
    static async getUserMonitor(uid: string, monitorId: string = 'default'): Promise<UserMonitor | null> {
        const db = getDb();
        const docId = this.monitorDocId(uid, monitorId);
        const doc = await db.collection(this.COL_MONITORS).doc(docId).get();

        // Back-compat: try legacy uid-keyed doc if new doc doesn't exist and monitorId is 'default'
        if (!doc.exists && monitorId === 'default') {
            const legacyDoc = await db.collection(this.COL_MONITORS).doc(uid).get();
            if (legacyDoc.exists) {
                const data = legacyDoc.data() as UserMonitor;
                data.monitorId = 'default';
                if (!data.name) data.name = 'Default Monitor';
                return data;
            }
            return null;
        }

        if (!doc.exists) return null;
        const data = doc.data() as UserMonitor;
        if (!data.monitorId) data.monitorId = monitorId;
        if (!data.name) data.name = 'Default Monitor';
        return data;
    }

    /**
     * Save/Update a specific monitor. Creates with generated monitorId if not provided.
     * Returns the monitorId used.
     */
    static async saveUserMonitor(uid: string, monitor: Partial<UserMonitor>, monitorId?: string): Promise<string> {
        const db = getDb();
        const resolvedId = monitorId || monitor.monitorId || crypto.randomUUID().slice(0, 8);
        const docId = this.monitorDocId(uid, resolvedId);

        await db.collection(this.COL_MONITORS).doc(docId).set({
            uid,
            monitorId: resolvedId,
            name: monitor.name || 'Default Monitor',
            ...monitor,
            createdAt: monitor.createdAt || new Date().toISOString(),
        }, { merge: true });

        return resolvedId;
    }

    /**
     * Delete a specific monitor
     */
    static async deleteUserMonitor(uid: string, monitorId: string): Promise<void> {
        const db = getDb();
        const docId = this.monitorDocId(uid, monitorId);
        const docRef = db.collection(this.COL_MONITORS).doc(docId);
        const doc = await docRef.get();

        if (doc.exists && doc.data()?.uid === uid) {
            await docRef.delete();
        }
    }

    /**
     * Upsert a global cached post
     */
    static async upsertCachedPost(post: CachedRedditPost): Promise<void> {
        const db = getDb();
        await db.collection(this.COL_POSTS).doc(post.id).set({
            ...post,
            fetchedAt: new Date().toISOString()
        }, { merge: true });
    }

    /**
     * Get posts from specific subreddits within a timeframe
     */
    static async getPostsForSubreddits(subreddits: string[], sinceDays: number = 7): Promise<CachedRedditPost[]> {
        const db = getDb();
        const cutoff = Date.now() / 1000 - (sinceDays * 24 * 60 * 60);
        
        // Firestore 'in' query limit is 30. If more, we'd need to batch. 
        // For V1, we assume users have < 30 subreddits.
        if (subreddits.length === 0) return [];
        
        const snapshot = await db.collection(this.COL_POSTS)
            .where('subreddit', 'in', subreddits)
            .where('created_utc', '>=', cutoff)
            .get();

        return snapshot.docs.map(doc => doc.data() as CachedRedditPost);
    }

    /**
     * Save a marketing opportunity for a user
     */
    static async saveOpportunity(opportunity: MarketingOpportunity): Promise<void> {
        const db = getDb();
        await db.collection(this.COL_OPPORTUNITIES).doc(opportunity.id).set(opportunity, { merge: true });
    }

    /**
     * Get user's opportunities
     */
    static async getUserOpportunities(uid: string, limit = 200): Promise<MarketingOpportunity[]> {
        const db = getDb();
        try {
            const snapshot = await db.collection(this.COL_OPPORTUNITIES)
                .where('uid', '==', uid)
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();

            return snapshot.docs.map(doc => doc.data() as MarketingOpportunity);
        } catch (err: unknown) {
            logger.error({ err, uid }, "Failed to fetch user opportunities");
            return [];
        }
    }

    /**
     * Fetch all opportunities for a user without limit — used for CSV export only.
     */
    static async getAllUserOpportunities(uid: string): Promise<MarketingOpportunity[]> {
        const db = getDb();
        try {
            const snapshot = await db.collection(this.COL_OPPORTUNITIES)
                .where('uid', '==', uid)
                .orderBy('createdAt', 'desc')
                .get();
            return snapshot.docs.map(doc => doc.data() as MarketingOpportunity);
        } catch (err: unknown) {
            logger.error({ err, uid }, "Failed to fetch all user opportunities for export");
            return [];
        }
    }

    /**
     * Update opportunity status
     */
    static async updateOpportunityStatus(uid: string, opportunityId: string, status: MarketingOpportunity['status']): Promise<void> {
        const db = getDb();
        const docRef = db.collection(this.COL_OPPORTUNITIES).doc(opportunityId);
        const doc = await docRef.get();

        if (doc.exists && doc.data()?.uid === uid) {
            await docRef.update({ status });
        }
    }

    /**
     * Delete multiple opportunities for a user
     */
    static async deleteOpportunities(uid: string, opportunityIds: string[]): Promise<void> {
        const db = getDb();

        // Verify all opportunities belong to this user before deletion
        const snapshot = await db.collection(this.COL_OPPORTUNITIES)
            .where('uid', '==', uid)
            .where('__name__', 'in', opportunityIds)
            .get();

        const batch = db.batch();
        for (const doc of snapshot.docs) {
            batch.delete(doc.ref);
        }
        await batch.commit();
    }

    /**
     * Scrape a URL and summarize it into a product description
     */
    static async scrapeAndSummarize(url: string): Promise<string> {
        try {
            logger.info({ action: 'SCRAPE_URL', url }, `Scraping URL for context...`);
            const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
            if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
            const html = await response.text();

            // Tier 1: Extract meta tags — cheapest, most accurate, no LLM needed
            const metaDesc =
                html.match(/<meta\s+name=["']description["']\s+content=["']([^"']{50,})["']/i)?.[1] ||
                html.match(/<meta\s+content=["']([^"']{50,})["']\s+name=["']description["']/i)?.[1] ||
                html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']{50,})["']/i)?.[1] ||
                html.match(/<meta\s+content=["']([^"']{50,})["']\s+property=["']og:description["']/i)?.[1];

            if (metaDesc) {
                logger.info({ action: 'SCRAPE_META_HIT', url }, 'Using meta description — no LLM needed');
                return metaDesc.trim();
            }

            // Tier 2: Extract structured content (h1/h2/p/li) after removing script/style noise
            const stripped = html
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '');

            const structuredParts: string[] = [];
            const tagPattern = /<(h1|h2|h3|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
            let match: RegExpExecArray | null;
            while ((match = tagPattern.exec(stripped)) !== null && structuredParts.join(' ').length < 2000) {
                const text = match[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                if (text.length > 20) structuredParts.push(text);
            }

            const structuredText = structuredParts.join(' ').slice(0, 2000);

            // Tier 3: Plain text fallback (JS-heavy sites with no visible semantic tags)
            const fallbackText = structuredText.length > 100
                ? structuredText
                : stripped.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);

            const prompt = `You are a product marketing expert. In one sentence (max 40 words), describe what this product does, who it's for, and what problem it solves. Return ONLY the sentence.

WEBSITE CONTENT:
${fallbackText}`;

            const result = await summaryModel.generateContent(prompt);
            const summary = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!summary) throw new Error("AI failed to generate summary");
            return summary.trim();

        } catch (err: unknown) {
            logger.error({ err, url }, "Failed to scrape and summarize URL");
            throw new Error(`Failed to extract context from URL: ${errMsg(err)}`, { cause: err });
        }
    }

    /**
     * Real-time search for subreddits using AI brainstorming for high relevance.
     */
    static async searchSubreddits(context: string): Promise<any[]> {
        try {
            logger.info({ action: 'BRAINSTORM_SUBREDDITS' }, `AI Brainstorming relevant subreddits...`);
            
            // 1. Ask Gemini for 8-10 high-value subreddit names with reasons
            const brainstormPrompt = `You are a Reddit community expert. Analyze this product description and identify the most relevant subreddits.

PRODUCT: "${context}"

STEP 1 — Identify the product category (e.g. fitness app, parenting tool, game, B2B SaaS, e-commerce, travel, finance, etc.)
STEP 2 — List 10 subreddits where the TARGET USERS (not founders) naturally hang out and discuss the problem this product solves.

RULES:
- Return ONLY a JSON array of objects: [{ "name": "string", "reason": "string" }]
- NO r/ prefix. Exact subreddit name only.
- Match subreddits to the product's actual audience (e.g. fitness app → r/fitness, r/loseit, NOT r/startups)
- Include a mix: large general communities + small niche ones
- DO NOT default to startup/SaaS communities unless the product is explicitly for founders or developers
- NO generic noise (e.g. AskReddit, funny, pics)`;

            const brainstormResult = await summaryModel.generateContent(brainstormPrompt);
            const rawText = brainstormResult.response.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
            
            let brainstormed: any[] = [];
            try {
                // Strip markdown backticks if present
                const cleanJson = rawText.replace(/```json|```/g, '').trim();
                brainstormed = JSON.parse(cleanJson);
            } catch {
                brainstormed = [];
            }

            const contextKeywords = context.toLowerCase().split(/\s+/).filter(k => k.length > 3);

            // 2. Fetch metadata, validate existence, and apply relevance check
            const suggestions = await Promise.all(brainstormed.slice(0, 10).map(async (item) => {
                try {
                    const url = `https://www.reddit.com/r/${item.name}/about.json`;
                    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
                    // Sub doesn't exist or is private/banned
                    if (!res.ok) return null;
                    const json = await res.json() as any;
                    const sub = json?.data;
                    if (!sub?.display_name) return null;

                    // Skip tiny or quarantined subs
                    if (sub.subscribers < 500) return null;

                    // Relevance gate: at least 1 context keyword must appear in title/description
                    // OR the AI reason is strong enough (item.reason exists and sub is large)
                    const desc = (sub.public_description || '').toLowerCase();
                    const title = (sub.title || '').toLowerCase();
                    const matches = contextKeywords.filter(k => desc.includes(k) || title.includes(k));
                    const isLargeSub = sub.subscribers >= 50000;

                    // Reject if no keyword match AND not a large well-known community
                    if (matches.length === 0 && !isLargeSub) return null;

                    return {
                        name: sub.display_name,
                        members: this.formatMembers(sub.subscribers),
                        signal: sub.active_user_count > 100 ? 'High' : 'Medium',
                        reason: item.reason || sub.title
                    };
                } catch {
                    return null;
                }
            }));

            return suggestions.filter(Boolean);

        } catch (err: unknown) {
            logger.error({ err, context }, "Failed to search subreddits with AI");
            return []; 
        }
    }

    /**
     * Helper to summarize context directly if it's already text (ensures clean format)
     */
    static async summarizeContext(text: string): Promise<string> {
        const prompt = `
            Clean up and refine the following product description to be concise (2 paragraphs max).
            TEXT: "${text}"
        `;
        const result = await summaryModel.generateContent(prompt);
        return result.response.candidates?.[0]?.content?.parts?.[0]?.text || text;
    }

    private static formatMembers(count: number): string {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
        return count.toString();
    }
}
