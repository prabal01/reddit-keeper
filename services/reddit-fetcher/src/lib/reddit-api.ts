import fetch from 'node-fetch';
import { Buffer } from 'node:buffer';

interface RedditToken {
    access_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
    expires_at: number;
}

export class RedditApiClient {
    private token: RedditToken | null = null;
    private clientId: string;
    private clientSecret: string;
    private username: string;
    private password: string;
    private userAgent: string;

    constructor() {
        this.clientId = process.env.REDDIT_CLIENT_ID || '';
        this.clientSecret = process.env.REDDIT_CLIENT_SECRET || '';
        this.username = process.env.REDDIT_USERNAME || '';
        this.password = process.env.REDDIT_PASSWORD || '';
        // Template: linux:opiniondeck:v1.0.0 (by /u/username)
        this.userAgent = process.env.REDDIT_USER_AGENT || 'linux:opiniondeck-fetcher:v1.0.0';

        if (!this.clientId || !this.clientSecret || !this.username || !this.password) {
            console.warn('[REDDIT] Missing credentials. API will fail.');
        }
    }

    private async getToken(): Promise<string> {
        if (this.token && Date.now() < this.token.expires_at) {
            return this.token.access_token;
        }

        console.log('[REDDIT] Refreshing Access Token...');
        const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
        const params = new URLSearchParams({
            grant_type: 'password',
            username: this.username,
            password: this.password
        });

        const response = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'User-Agent': this.userAgent,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`REDDIT_AUTH_FAILED: ${response.status} - ${body}`);
        }

        const data = await response.json() as any;
        this.token = {
            ...data,
            expires_at: Date.now() + (data.expires_in - 60) * 1000 // Buffer for safety
        };

        return this.token!.access_token;
    }

    async fetch(url: string, options: any = {}): Promise<any> {
        const token = await this.getToken();
        
        // Ensure URL uses oauth subdomain for API calls
        const oauthUrl = url.replace('www.reddit.com', 'oauth.reddit.com').replace('old.reddit.com', 'oauth.reddit.com');

        const res = await fetch(oauthUrl, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `bearer ${token}`,
                'User-Agent': this.userAgent,
                'Accept': 'application/json'
            }
        });

        if (res.status === 401) {
            // Token might have expired unexpectedly, force refresh once
            this.token = null;
            const newToken = await this.getToken();
            const retryRes = await fetch(oauthUrl, {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `bearer ${newToken}`,
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json'
                }
            });
            return this.handleResponse(retryRes);
        }

        return this.handleResponse(res);
    }

    private async handleResponse(res: any) {
        // Log rate limit headers for monitoring
        const remaining = res.headers.get('x-ratelimit-remaining');
        const reset = res.headers.get('x-ratelimit-reset');
        if (remaining && parseInt(remaining) < 10) {
            console.warn(`[REDDIT] Low Rate Limit Remaining: ${remaining} (Resets in ${reset}s)`);
        }

        if (!res.ok) {
            const body = await res.text();
            const err: any = new Error(`REDDIT_API_ERROR: ${res.status} - ${res.statusText}`);
            err.status = res.status;
            err.body = body;
            throw err;
        }

        return res.json();
    }
}

export const reddit = new RedditApiClient();
