import { Queue, Worker } from 'bullmq';
import { MonitoringService } from './service.js';
import { DiscoveryOrchestrator } from '../discovery/orchestrator.js';
import { logger } from '../utils/logger.js';
import { redis } from '../middleware/rateLimiter.js';
import crypto from 'crypto';

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const sharedConnectionConfig = {
    url: redisUrl,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
};

// ── Queues ────────────────────────────────────────────────────────

export const monitoringScraperQueue = new Queue("monitoring-scraper", {
    connection: sharedConnectionConfig,
    defaultJobOptions: {
        removeOnComplete: { count: 20, age: 3600 * 24 },
        removeOnFail: { count: 100, age: 3600 * 24 * 7 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 }
    }
});

export const opportunityMatcherQueue = new Queue("opportunity-matcher", {
    connection: sharedConnectionConfig,
    defaultJobOptions: {
        removeOnComplete: { count: 100, age: 3600 * 24 },
        removeOnFail: { count: 500, age: 3600 * 24 * 7 },
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 }
    }
});

// ── Scraper Worker ────────────────────────────────────────────────

const discoveryOrchestrator = new DiscoveryOrchestrator();

export const monitoringScraperWorker = new Worker("monitoring-scraper", async (job) => {
    logger.info({ action: 'MONITORING_SCRAPE_START' }, `[Monitoring] Starting global scrape cycle...`);

    // 1. Get all unique subreddits across all users
    const allMonitors = await MonitoringService.getAllMonitors();
    const subredditSet = new Set<string>();
    allMonitors.forEach(m => m.subreddits.forEach(s => subredditSet.add(s.toLowerCase().trim())));
    
    const uniqueSubreddits = Array.from(subredditSet);
    logger.info({ action: 'MONITORING_SUBREDDITS_IDENTIFIED', count: uniqueSubreddits.length }, `[Monitoring] Found ${uniqueSubreddits.length} unique subreddits to monitor.`);

    for (const sub of uniqueSubreddits) {
        try {
            logger.info({ action: 'MONITORING_SUBREDDIT_FETCH', subreddit: sub }, `[Monitoring] Fetching r/${sub}...`);
            
            // Using DiscoveryOrchestrator to fetch the subreddit listing
            // We'll need a new method for "fetchSubredditNew" or similar if search is too broad
            // For now, we'll implement the fetch directly via the reddit service to stay targeted.
            const { RedditDiscoveryService } = await import('../discovery/reddit.service.js');
            const redditService = new RedditDiscoveryService();
            
            const results = await redditService.fetchSubredditNew(sub, 100);
            
            if (!results || results.length === 0) {
                logger.warn({ action: 'MONITORING_SUBREDDIT_EMPTY', subreddit: sub }, `[Monitoring] No posts found for r/${sub}`);
                continue;
            }

            // 2. Upsert posts to global cache
            for (const post of results) {
                await MonitoringService.upsertCachedPost({
                    id: post.id,
                    title: post.title,
                    selftext: post.selftext || "",
                    subreddit: sub,
                    author: post.author,
                    url: post.url,
                    num_comments: post.num_comments,
                    created_utc: post.created_utc,
                    fetchedAt: new Date().toISOString()
                });
            }

            logger.info({ action: 'MONITORING_SUBREDDIT_CACHED', subreddit: sub, count: results.length }, `[Monitoring] Cached ${results.length} posts for r/${sub}`);

        } catch (err: any) {
            logger.error({ action: 'MONITORING_SUBREDDIT_ERROR', subreddit: sub, err: err.message }, `[Monitoring] Failed to scrape r/${sub}`);
        }
    }

    // 3. Trigger Matcher jobs for all users
    // We send one job per user so they can run in parallel
    for (const monitor of allMonitors) {
        await opportunityMatcherQueue.add(`match-${monitor.uid}`, { 
            uid: monitor.uid,
            subreddits: monitor.subreddits
        });
    }

    return { subredditsCount: uniqueSubreddits.length, monitorsTriggered: allMonitors.length };

}, {
    connection: sharedConnectionConfig,
    concurrency: 1, // Only 1 global scrape cycle at a time
    limiter: {
        max: 1,
        duration: 1000 // 1 req per sec across subreddits
    }
});

// ── Matcher Worker ────────────────────────────────────────────────

export const opportunityMatcherWorker = new Worker("opportunity-matcher", async (job) => {
    const { uid, subreddits } = job.data;
    const monitor = await MonitoringService.getUserMonitor(uid);
    if (!monitor || !monitor.websiteContext) return;

    logger.info({ action: 'MONITORING_MATCH_START', uid }, `[Monitoring] Matching posts for user ${uid}...`);

    // 1. Get posts for the user's subreddits from the last 7 days
    const posts = await MonitoringService.getPostsForSubreddits(subreddits, 7);
    
    // 2. Filter out already matched or dismissed posts
    // For V1, we'll just process the latest 20 that didn't exist in opportunities.
    const existingOppDocs = await MonitoringService.getUserOpportunities(uid);
    const existingPostIds = new Set(existingOppDocs.map(o => o.postId));
    
    const newPosts = posts.filter(p => !existingPostIds.has(p.id)).slice(0, 20);
    logger.info({ action: 'MONITORING_NEW_POSTS_FOUND', uid, count: newPosts.length }, `[Monitoring] Found ${newPosts.length} new posts to score for ${uid}.`);

    const { scoreMarketingOpportunity } = await import('../ai.js');

    for (const post of newPosts) {
        try {
            const result = await scoreMarketingOpportunity(monitor.websiteContext, {
                title: post.title,
                selftext: post.selftext,
                subreddit: post.subreddit
            });

            if (result.relevanceScore >= 50) {
                await MonitoringService.saveOpportunity({
                    id: `${uid}_${post.id}`,
                    uid,
                    postId: post.id,
                    postTitle: post.title,
                    postSubreddit: post.subreddit,
                    postUrl: post.url,
                    relevanceScore: result.relevanceScore,
                    matchReason: result.matchReason,
                    suggestedReply: result.suggestedReply,
                    status: 'new',
                    matchedAt: new Date().toISOString(),
                    createdAt: post.created_utc
                });
                logger.info({ action: 'MONITORING_OPPORTUNITY_SAVED', uid, postId: post.id, score: result.relevanceScore }, `[Monitoring] Saved opportunity for ${uid}`);
            }
        } catch (err: any) {
            logger.error({ action: 'MONITORING_MATCH_ERROR', uid, postId: post.id, err: err.message }, `[Monitoring] Failed to score post ${post.id}`);
        }
    }

    return { scored: newPosts.length };

}, {
    connection: sharedConnectionConfig,
    concurrency: 2, // Allow a few concurrent users to be matched
});

// ── Initialization ────────────────────────────────────────────────

export async function initMonitoring() {
    logger.info({ action: 'MONITORING_INIT' }, `[Monitoring] Initializing background workers and cron jobs...`);
    
    // Clear existing repeatable jobs to avoid duplicates on restart
    const repeatableJobs = await monitoringScraperQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
        await monitoringScraperQueue.removeRepeatableByKey(job.key);
    }

    // Add the 8-hour sync (every 8 hours: 0 */8 * * *)
    await monitoringScraperQueue.add("global-scrape-cycle", {}, {
        repeat: {
            pattern: '0 */8 * * *'
        }
    });

    logger.info({ action: 'MONITORING_CRON_SCHEDULED' }, `[Monitoring] Global 8-hour sync scheduled (0 */8 * * *).`);
}
