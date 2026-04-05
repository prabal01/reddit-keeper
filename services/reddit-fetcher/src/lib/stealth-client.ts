import fetch from 'node-fetch';
import Bottleneck from 'bottleneck';

/**
 * Adaptive Rate Limiter:
 * - Baseline: 60 requests/minute (1 req/sec)
 * - Jitter: 100ms - 500ms
 * - Max Concurrent: 1 (Serial execution to stay under the radar)
 */
const limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 1000, // 1 request per second
});

export class StealthRedditClient {
    private userAgent: string;

    constructor() {
        this.userAgent = process.env.REDDIT_USER_AGENT || 'macos:opiniondeck-research:v1.0.0 (by /u/anonymous)';
    }

    private getStealthHeaders() {
        return {
            'User-Agent': this.userAgent,
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Referer': 'https://www.reddit.com/',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
        };
    }

    /**
     * Fetches data from Reddit with adaptive rate limiting and stealth headers.
     */
    async fetchJson(url: string): Promise<any> {
        // Ensure we are fetching .json
        const jsonUrl = url.includes('.json') ? url : `${url.split('?')[0].replace(/\/$/, '')}.json`;
        
        return limiter.schedule(async () => {
            const jitter = Math.floor(Math.random() * 400) + 100;
            await new Promise(resolve => setTimeout(resolve, jitter));

            console.log(`[STEALTH] Fetching: ${jsonUrl}`);
            
            const response = await fetch(jsonUrl, {
                headers: this.getStealthHeaders(),
            });

            if (response.status === 429) {
                const retryAfter = response.headers.get('retry-after');
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
                console.warn(`[STEALTH] 429 Rate Limited. Waiting ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                // Recursive retry once
                return this.fetchJson(jsonUrl);
            }

            if (!response.ok) {
                const body = await response.text().catch(() => 'no body');
                throw new Error(`REDDIT_ERROR: ${response.status} - ${response.statusText}\n${body}`);
            }

            return response.json();
        });
    }
}

export const stealthClient = new StealthRedditClient();
