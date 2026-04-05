import { getDb } from '../firestore.js';
import { 
    MonitoredSubreddit, 
    UserMonitor, 
    CachedRedditPost, 
    MarketingOpportunity 
} from './types.js';
import { logger } from '../utils/logger.js';
import { FieldValue } from 'firebase-admin/firestore';

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
        const snapshot = await db.collection(this.COL_OPPORTUNITIES)
            .where('uid', 'uid' === uid ? '==' : '==', uid) // safety check
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();
        
        return snapshot.docs.map(doc => doc.data() as MarketingOpportunity);
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
}
