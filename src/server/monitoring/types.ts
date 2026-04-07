import { Timestamp } from 'firebase-admin/firestore';

export interface MonitoredSubreddit {
    name: string;
    lastFetchedAt: Timestamp | null;
    activeUserCount: number;
}

export interface UserMonitor {
    uid: string;
    websiteContext: string;
    subreddits: string[];
    createdAt: string;
    lastMatchAt: string | null;
}

export interface CachedRedditPost {
    id: string; // t3_...
    title: string;
    selftext: string;
    subreddit: string;
    author: string;
    url: string;
    num_comments: number;
    created_utc: number;
    fetchedAt: string;
}

export interface MarketingOpportunity {
    id: string; // doc ID: {uid}_{post_id}
    uid: string;
    postId: string;
    postTitle: string;
    postSubreddit: string;
    postUrl: string;
    relevanceScore: number; // 0-100
    matchReason: string;
    suggestedReply: string | null;
    status: 'new' | 'saved' | 'hidden' | 'dismissed';
    matchedAt: string;
    createdAt: number; // post creation time for sorting
}
