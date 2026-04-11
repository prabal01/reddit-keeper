import { getSubredditStats } from './subreddit-stats.service.js';

interface ComparisonEntry {
    subreddit: string;
    sampleSize: number;
    avgScore: number;
    avgComments: number;
    postsPerDay: number;
    topAuthors: { author: string; count: number }[];
    scoreDistribution: { range: string; count: number }[];
}

interface SubredditCompareResult {
    comparisons: ComparisonEntry[];
}

export async function getSubredditComparison(subreddits: string[]): Promise<SubredditCompareResult> {
    // Fetch stats for each subreddit in parallel (reuses sub-stats cache)
    const results = await Promise.all(
        subreddits.map(sub => getSubredditStats(sub))
    );

    return {
        comparisons: results.map(r => ({
            subreddit: r.subreddit,
            sampleSize: r.sampleSize,
            avgScore: r.avgScore,
            avgComments: r.avgComments,
            postsPerDay: r.postsPerDay,
            topAuthors: r.topAuthors.slice(0, 5),
            scoreDistribution: r.scoreDistribution,
        })),
    };
}
