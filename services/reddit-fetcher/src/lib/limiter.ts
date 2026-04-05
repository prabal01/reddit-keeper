import Bottleneck from 'bottleneck';

/**
 * Strict 100req/min limiter for Reddit API.
 */
export const limiter = new Bottleneck({
    reservoir: 100, // Initial tokens
    reservoirRefreshAmount: 100,
    reservoirRefreshInterval: 60 * 1000, // Every 60 seconds
    maxConcurrent: 5, // Concurrent requests to the same service
    minTime: 250, // Minimum time between requests (4 per second max burst)
});

// Listener for failed jobs to handle retries if needed
limiter.on('failed', async (error, jobInfo) => {
    const id = jobInfo.options.id;
    console.warn(`[LIMITER] Job ${id} failed: ${error.message}`);
    
    if (jobInfo.retryCount < 2) {
        console.log(`[LIMITER] Retrying job ${id} (Attempt ${jobInfo.retryCount + 1})...`);
        return 1000; // Retry after 1s
    }
});
