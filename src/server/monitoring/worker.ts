import { Queue, Worker } from 'bullmq';
import { MonitoringService } from './service.js';
import { DiscoveryOrchestrator } from '../discovery/orchestrator.js';
import { RedditDiscoveryService } from '../discovery/reddit.service.js';
import { PullPushService } from '../discovery/pullpush.service.js';
import { ArcticShiftService } from '../discovery/arctic-shift.service.js';
import { getGlobalConfig } from '../firestore.js';
import { logger } from '../utils/logger.js';
import { errMsg } from '../utils/errors.js';
import { redis } from '../middleware/rateLimiter.js';
import crypto from 'crypto';
import { config } from '../config.js';

const sharedConnectionConfig = {
    url: config.redisUrl,
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

// ── Shared Service Instances ──────────────────────────────────────

const discoveryOrchestrator = new DiscoveryOrchestrator();
const redditService = new RedditDiscoveryService();
const pullPushService = new PullPushService();
const arcticShiftService = new ArcticShiftService();

// ── Scraper Worker ────────────────────────────────────────────────

export const monitoringScraperWorker = new Worker("monitoring-scraper", async (job) => {
    logger.info({ action: 'MONITORING_SCRAPE_START' }, `[Monitoring] Starting global scrape cycle...`);
    const globalConfig = await getGlobalConfig();
    const cooldownHours = globalConfig.monitoring_subreddit_cooldown_hours;
    const freshnessThreshold = globalConfig.monitoring_freshness_threshold_hours;
    const minArchivePosts = globalConfig.monitoring_min_archive_posts;

    // 1. Get all unique subreddits across all users
    const allMonitors = await MonitoringService.getAllMonitors();
    const subredditSet = new Set<string>();
    allMonitors.forEach(m => m.subreddits.forEach(s => subredditSet.add(s.toLowerCase().trim())));

    const uniqueSubreddits = Array.from(subredditSet);
    logger.info({ action: 'MONITORING_SUBREDDITS_IDENTIFIED', count: uniqueSubreddits.length }, `[Monitoring] Found ${uniqueSubreddits.length} unique subreddits to monitor.`);

    for (const sub of uniqueSubreddits) {
        try {
            // 1. Check Redis cooldown to avoid redundant fetches
            const cooldownKey = `monitoring:cooldown:${sub}`;
            const onCooldown = await redis.get(cooldownKey);

            if (onCooldown) {
                logger.info({ action: 'MONITORING_SUBREDDIT_SKIP', subreddit: sub }, `[Monitoring] skipping r/${sub} - on cooldown.`);
                continue;
            }

            logger.info({ action: 'MONITORING_SUBREDDIT_FETCH', subreddit: sub }, `[Monitoring] Fetching r/${sub}...`);

            // ── Three-Tier Fetch: Archive First, Proxy Fallback ──
            let posts: any[] = [];

            // Tier 1: PullPush (free, works from datacenter IPs)
            try {
                const ppResults = await pullPushService.searchSubmissions('', sub, 100);
                if (ppResults && ppResults.length > 0) {
                    posts = ppResults.map(r => ({
                        id: r.id, title: r.title, selftext: '',
                        subreddit: r.subreddit || sub, author: r.author || 'unknown',
                        url: r.url, num_comments: r.num_comments || 0,
                        created_utc: r.created_utc || Math.floor(Date.now() / 1000)
                    }));
                    logger.info({ action: 'MONITORING_TIER1_PULLPUSH', subreddit: sub, count: posts.length }, `[Monitoring] PullPush returned ${posts.length} posts`);
                }
            } catch (err: unknown) {
                logger.warn({ subreddit: sub, err: errMsg(err) }, '[Monitoring] PullPush failed, trying Arctic Shift');
            }

            // Tier 2: ArcticShift supplement (free, different archive)
            if (posts.length < minArchivePosts) {
                try {
                    const asResults = await arcticShiftService.searchPosts('', sub, 100);
                    if (asResults && asResults.length > 0) {
                        const existingIds = new Set(posts.map(p => p.id));
                        const newFromArctic = asResults
                            .filter(r => !existingIds.has(r.id))
                            .map(r => ({
                                id: r.id, title: r.title, selftext: '',
                                subreddit: r.subreddit || sub, author: r.author || 'unknown',
                                url: r.url, num_comments: r.num_comments || 0,
                                created_utc: r.created_utc || Math.floor(Date.now() / 1000)
                            }));
                        posts = [...posts, ...newFromArctic];
                        logger.info({ action: 'MONITORING_TIER2_ARCTICSHIFT', subreddit: sub, added: newFromArctic.length }, `[Monitoring] Arctic Shift added ${newFromArctic.length} posts`);
                    }
                } catch (err: unknown) {
                    logger.warn({ subreddit: sub, err: errMsg(err) }, '[Monitoring] Arctic Shift failed');
                }
            }

            // Tier 3: Check freshness - proxy fallback only if archives seem stale
            const now = Math.floor(Date.now() / 1000);
            const recentCutoff = now - (freshnessThreshold * 3600);
            const recentPosts = posts.filter(p => p.created_utc > recentCutoff);

            if (recentPosts.length < minArchivePosts && globalConfig.proxy_fallback_enabled) {
                logger.info({ action: 'MONITORING_TIER3_PROXY', subreddit: sub, archiveRecent: recentPosts.length },
                    `[Monitoring] Archives stale (${recentPosts.length} recent), falling back to proxy for r/${sub}`);
                try {
                    const proxyResults = await redditService.fetchSubredditNew(sub, 100);
                    if (proxyResults && proxyResults.length > 0) {
                        posts = proxyResults.map((p: any) => ({
                            id: p.id, title: p.title, selftext: p.selftext || '',
                            subreddit: sub, author: p.author || 'unknown',
                            url: p.url, num_comments: p.num_comments || 0,
                            created_utc: p.created_utc || Math.floor(Date.now() / 1000)
                        }));
                        logger.info({ action: 'MONITORING_PROXY_SUCCESS', subreddit: sub, count: posts.length }, `[Monitoring] Proxy returned ${posts.length} posts`);
                    }
                } catch (err: unknown) {
                    logger.error({ subreddit: sub, err: errMsg(err) }, '[Monitoring] Proxy fallback also failed');
                }
            }

            logger.info({ action: 'MONITORING_SUBREDDIT_FETCH_COUNT', subreddit: sub, count: posts.length }, `[Monitoring] Total ${posts.length} posts for r/${sub}`);

            if (posts.length === 0) {
                await redis.set(cooldownKey, 'empty', 'EX', 3600);
                continue;
            }

            // 2. Upsert posts to global cache
            for (const post of posts) {
                await MonitoringService.upsertCachedPost({
                    id: post.id,
                    title: post.title,
                    selftext: post.selftext || "",
                    subreddit: sub,
                    author: post.author,
                    url: post.url,
                    num_comments: post.num_comments,
                    created_utc: post.created_utc,
                    fetchedAt: new Date().toISOString(),
                    source: 'archive_first'
                });
            }

            // 3. Set cooldown after successful fetch
            await redis.set(cooldownKey, 'cached', 'EX', cooldownHours * 3600);

            logger.info({ action: 'MONITORING_SUBREDDIT_CACHED', subreddit: sub, count: posts.length }, `[Monitoring] Cached ${posts.length} posts for r/${sub}`);

        } catch (err: unknown) {
            logger.error({ action: 'MONITORING_SUBREDDIT_ERROR', subreddit: sub, err: errMsg(err) }, `[Monitoring] Failed to scrape r/${sub}`);
            await redis.set(`monitoring:cooldown:${sub}`, 'error', 'EX', 3600).catch(() => {});
        }
    }

    // 3. Trigger Matcher jobs per monitor (one job per monitor, not per user)
    for (const monitor of allMonitors) {
        const jobId = `match-${monitor.uid}-${monitor.monitorId}`;
        await opportunityMatcherQueue.add(jobId, {
            uid: monitor.uid,
            monitorId: monitor.monitorId,
            subreddits: monitor.subreddits
        }, { jobId });
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
    const { uid, monitorId = 'default', subreddits } = job.data;
    const monitor = await MonitoringService.getUserMonitor(uid, monitorId);
    if (!monitor || !monitor.websiteContext) return;

    logger.info({ action: 'MONITORING_MATCH_START', uid, monitorId }, `[Monitoring] Matching posts for monitor ${monitorId} of user ${uid}...`);

    // 1. Get posts for the user's subreddits from the last 7 days
    const posts = await MonitoringService.getPostsForSubreddits(subreddits, 7);
    
    // 2. Filter out already matched or dismissed posts
    // For V1, we'll just process the latest 20 that didn't exist in opportunities.
    const existingOppDocs = await MonitoringService.getUserOpportunities(uid);
    const existingPostIds = new Set(existingOppDocs.map(o => o.postId));
    
    const globalConfig = await getGlobalConfig();
    const maxToScore = globalConfig.monitoring_max_posts_to_score;
    const batchSize = globalConfig.monitoring_scoring_batch_size;

    const newPosts = posts.filter(p => !existingPostIds.has(p.id)).slice(0, maxToScore);
    logger.info({ action: 'MONITORING_NEW_POSTS_FOUND', uid, monitorId, count: newPosts.length }, `[Monitoring] Found ${newPosts.length} new posts to score for monitor ${monitorId} of ${uid}.`);

    const { scoreMarketingOpportunityBatch } = await import('../ai.js');

    let scored = 0;
    for (let i = 0; i < newPosts.length; i += batchSize) {
        const batch = newPosts.slice(i, i + batchSize);
        try {
            const results = await scoreMarketingOpportunityBatch(
                monitor.websiteContext,
                batch.map(p => ({ id: p.id, title: p.title, selftext: p.selftext || '', subreddit: p.subreddit }))
            );

            for (const result of results) {
                const post = batch.find(p => p.id === result.id);
                if (!post) continue;

                logger.info({
                    action: 'MONITORING_SCORING_RESULT', uid,
                    subreddit: post.subreddit, score: result.relevanceScore, reason: result.matchReason
                }, `[Monitoring] Scored r/${post.subreddit} post: ${result.relevanceScore}% match.`);

                if (result.relevanceScore >= 50) {
                    await MonitoringService.saveOpportunity({
                        id: `${uid}_${monitorId}_${post.id}`,
                        uid,
                        postId: post.id,
                        postTitle: post.title,
                        postSubreddit: post.subreddit,
                        postAuthor: post.author,
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
                scored++;
            }
        } catch (err: unknown) {
            logger.error({ action: 'MONITORING_MATCH_BATCH_ERROR', uid, batchStart: i, err: errMsg(err) }, `[Monitoring] Failed to score batch starting at ${i}`);
        }
    }

    return { scored };

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

    // Drain any waiting manual jobs to prevent "zombie" runs on restart
    await monitoringScraperQueue.drain();
    await opportunityMatcherQueue.drain();

    // 3. Add the 8-hour sync (every 8 hours: 0 */8 * * *)
    // Use a stable jobId for the repeatable job to prevent duplicates
    await monitoringScraperQueue.add("global-scrape-cycle", {}, {
        repeat: {
            pattern: '0 */8 * * *',
            // prevents it from firing immediately if the server starts mid-window
            immediately: false 
        }
    });

    logger.info({ action: 'MONITORING_INIT_COMPLETE' }, "[Monitoring] Pipeline initialized. Background scrape scheduled for every 8 hours.");
}
