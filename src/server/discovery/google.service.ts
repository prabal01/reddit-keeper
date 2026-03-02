import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';
import { DiscoveryResult } from './types.js';

export class GoogleDiscoveryService {
    private API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
    private CX = process.env.GOOGLE_SEARCH_CX;

    async search(query: string, limit = 10, idea?: string): Promise<{ results: DiscoveryResult[]; scannedCount: number }> {
        if (!this.API_KEY || !this.CX) {
            logger.warn({ action: 'GOOGLE_SEARCH_CONFIG_MISSING' }, "Google Search API Key or CX missing");
            return { results: [], scannedCount: 0 };
        }

        const url = `https://www.googleapis.com/customsearch/v1?key=${this.API_KEY}&cx=${this.CX}&q=${encodeURIComponent(query)}&num=${limit}`;

        try {
            logger.info({ action: 'GOOGLE_API_FETCH', query, url }, "Fetching from Google Search API");
            const response = await fetch(url);

            if (!response.ok) {
                const errBody = await response.text();
                logger.error({ status: response.status, body: errBody }, "Google Search API error");
                return { results: [], scannedCount: 0 };
            }

            const data: any = await response.json();
            const items = data.items || [];

            const results: DiscoveryResult[] = items.map((item: any) => {
                const source = this.inferSource(item.link);
                return {
                    id: item.link,
                    title: item.title,
                    author: 'Unknown',
                    subreddit: this.extractSubreddit(item.link),
                    ups: 0, // Google doesn't provide these
                    num_comments: 0,
                    created_utc: this.parseSnippetDate(item.snippet) || Math.floor(Date.now() / 1000),
                    url: item.link,
                    source,
                    score: this.calculateBasicScore(item, idea),
                    intentMarkers: []
                };
            });

            return {
                results,
                scannedCount: items.length
            };
        } catch (err) {
            logger.error({ err }, "Google Search failed");
            return { results: [], scannedCount: 0 };
        }
    }

    private inferSource(link: string): 'reddit' | 'hn' | 'google' {
        if (link.includes('reddit.com')) return 'reddit';
        if (link.includes('news.ycombinator.com')) return 'hn';
        return 'google';
    }

    private extractSubreddit(link: string): string {
        if (link.includes('/r/')) {
            const match = link.match(/\/r\/([^/]+)/);
            return match ? `r/${match[1]}` : 'r/unknown';
        }
        if (link.includes('news.ycombinator.com')) return 'Hacker News';
        return 'Web';
    }

    private parseSnippetDate(snippet: string): number | null {
        // Very basic extract: "Jan 1, 2024 ... snippet text"
        const dateMatch = snippet.match(/^(\w{3}\s\d{1,2},\s\d{4})/);
        if (dateMatch) {
            const date = new Date(dateMatch[1]);
            return isNaN(date.getTime()) ? null : Math.floor(date.getTime() / 1000);
        }
        return null;
    }

    private calculateBasicScore(item: any, idea?: string): number {
        // High basic score if idea is in title
        let score = 5000;
        const link = (item.link || '').toLowerCase();

        // Boost discussions (Reddit/HN) as they are high signal for "discovery"
        if (link.includes('reddit.com') || link.includes('news.ycombinator.com')) {
            score += 3000;
        }

        if (idea) {
            const title = (item.title || '').toLowerCase();
            const ideaLower = idea.toLowerCase();
            if (title.includes(ideaLower)) score += 5000;

            // Proximity check in title
            const words = ideaLower.split(/\s+/).filter(w => w.length > 3);
            let matchCount = 0;
            words.forEach(w => {
                if (title.includes(w)) {
                    score += 1500;
                    matchCount++;
                }
            });

            // Extreme boost for matching multiple keywords in title
            if (matchCount >= 2) score += 5000;
        }
        return score;
    }
}
