import { getDb } from '../firestore.js';
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

    /**
     * Get all active monitors across the platform
     */
    static async getAllMonitors(): Promise<UserMonitor[]> {
        const db = getDb();
        const snapshot = await db.collection(this.COL_MONITORS).get();
        return snapshot.docs.map(doc => doc.data() as UserMonitor);
    }

    /**
     * Get a specific user's monitor config
     */
    static async getUserMonitor(uid: string): Promise<UserMonitor | null> {
        const db = getDb();
        const doc = await db.collection(this.COL_MONITORS).doc(uid).get();
        if (!doc.exists) return null;
        return doc.data() as UserMonitor;
    }

    /**
     * Save/Update user's monitor config
     */
    static async saveUserMonitor(uid: string, monitor: Partial<UserMonitor>): Promise<void> {
        const db = getDb();
        await db.collection(this.COL_MONITORS).doc(uid).set({
            uid,
            ...monitor,
            createdAt: monitor.createdAt || new Date().toISOString(),
        }, { merge: true });
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
    static async getUserOpportunities(uid: string): Promise<MarketingOpportunity[]> {
        const db = getDb();
        try {
            const snapshot = await db.collection(this.COL_OPPORTUNITIES)
                .where('uid', '==', uid)
                .get();
            
            const docs = snapshot.docs.map(doc => doc.data() as MarketingOpportunity);
            // Sort in memory for V1 to avoid index requirement errors
            return docs.sort((a, b) => b.createdAt - a.createdAt);
        } catch (err: any) {
            logger.error({ err, uid }, "Failed to fetch user opportunities");
            return []; // Fail gracefully with empty array
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
     * Scrape a URL and summarize it into a product description
     */
    static async scrapeAndSummarize(url: string): Promise<string> {
        try {
            logger.info({ action: 'SCRAPE_URL', url }, `Scraping URL for context...`);
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                }
            });

            if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
            const html = await response.text();

            // Strip HTML tags for cleaner context (simple version)
            const textContent = html.replace(/<[^>]*>?/gm, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 10000); // 10k chars is enough for a summary

            const prompt = `
                You are a product marketing expert. Analyze the following website content and provide a concise, single-paragraph summary (max 50 words) of what the product does, who it's for, and what pain points it solves.
                
                WEBSITE CONTENT:
                ${textContent}
                
                FORMAT:
                Return ONLY the summary text. No headers, no markdown, just the description.
                Be extremely punchy and direct.
            `;

            const result = await summaryModel.generateContent(prompt);
            const summary = result.response.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!summary) throw new Error("AI failed to generate summary");
            return summary.trim();

        } catch (err: any) {
            logger.error({ err, url }, "Failed to scrape and summarize URL");
            throw new Error(`Failed to extract context from URL: ${err.message}`);
        }
    }

    /**
     * Real-time search for subreddits using AI brainstorming for high relevance.
     */
    static async searchSubreddits(context: string): Promise<any[]> {
        try {
            logger.info({ action: 'BRAINSTORM_SUBREDDITS' }, `AI Brainstorming relevant subreddits...`);
            
            // 1. Ask Gemini for 8-10 high-value subreddit names with reasons
            const brainstormPrompt = `
                Analyze this product: "${context}"
                
                List 10 specific subreddits where users discuss these problems OR where the target audience hangs out.
                
                RULES:
                - Return ONLY a JSON array of objects: { "name": "string", "reason": "string" }
                - NO r/ prefix.
                - NO noisy subreddits (e.g. japan, sonos, bumble) UNLESS they are a perfect match.
                - Focus on: startups, saas, indiehackers, and niche interest groups.
            `;

            const brainstormResult = await summaryModel.generateContent(brainstormPrompt);
            const rawText = brainstormResult.response.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
            
            let brainstormed: any[] = [];
            try {
                // Strip markdown backticks if present
                const cleanJson = rawText.replace(/```json|```/g, '').trim();
                brainstormed = JSON.parse(cleanJson);
            } catch {
                brainstormed = [{ name: 'saas', reason: 'SaaS discussion' }, { name: 'startups', reason: 'Founder community' }];
            }

            // 2. Fetch metadata and perform Metadata-based Relevance Check
            const suggestions = await Promise.all(brainstormed.slice(0, 10).map(async (item) => {
                try {
                    const url = `https://www.reddit.com/r/${item.name}/about.json`;
                    const res = await fetch(url);
                    if (!res.ok) return null;
                    const json = await res.json();
                    const sub = json.data;
                    
                    // Basic heuristic relevance check on description
                    const desc = (sub.public_description || '').toLowerCase();
                    const title = (sub.title || '').toLowerCase();
                    const keywords = context.toLowerCase().split(' ');
                    const matches = keywords.filter(k => k.length > 3 && (desc.includes(k) || title.includes(k)));

                    // If it's a tiny sub or completely unrelated title, skip
                    if (sub.subscribers < 100) return null;

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

        } catch (err: any) {
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
