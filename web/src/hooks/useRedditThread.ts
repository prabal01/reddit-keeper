import { useState, useCallback } from "react";
import { type FetchOptions, type FetchResult, type ThreadMetadata } from "../lib/api";
import { transformPost, extractCommentsFromListing, countComments } from "@core/reddit/tree-builder.js";
import type { Post as RedditPost, Comment as RedditComment } from "@core/reddit/types.js";

interface UseRedditThreadReturn {
    thread: FetchResult | null;
    metadata: ThreadMetadata | null;
    loading: boolean;
    error: string | null;
    fetch: (options: FetchOptions) => Promise<void>;
    clear: () => void;
}

export function useRedditThread(): UseRedditThreadReturn {
    const [thread, setThread] = useState<FetchResult | null>(null);
    const [metadata, setMetadata] = useState<ThreadMetadata | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async (options: FetchOptions) => {
        setLoading(true);
        setError(null);
        setThread(null);
        setMetadata(null);

        // 1. Try to fetch via Extension Bridge
        const requestId = Math.random().toString(36).substring(7);

        const extensionFetch = new Promise<FetchResult>((resolve, reject) => {
            let received = false;
            const timeout = setTimeout(() => {
                if (!received) {
                    window.removeEventListener('message', listener);
                    reject(new Error("Extension not found. Please install the OpinionDeck extension to extract threads."));
                }
            }, 2500);

            const listener = (event: MessageEvent) => {
                if (event.origin !== window.location.origin) return;
                if (event.data.type === 'OPINION_DECK_FETCH_RESPONSE' && event.data.id === requestId) {
                    received = true;
                    clearTimeout(timeout);
                    window.removeEventListener('message', listener);
                    if (event.data.success) {
                        // Normalize extension data to match FetchResult
                        const rawData = event.data.data;

                        let post: RedditPost;
                        let comments: RedditComment[];

                        if (options.url.includes('news.ycombinator.com')) {
                            // HackerNews Normalization
                            const hnData = rawData[0].data.children[0].data;
                            post = {
                                id: hnData.id,
                                title: hnData.title,
                                author: hnData.author,
                                subreddit: "hacker-news",
                                selftext: hnData.selftext,
                                url: options.url,
                                score: hnData.score,
                                upvoteRatio: 1, // HN doesn't have ratio
                                numComments: hnData.num_comments,
                                createdUtc: hnData.created_utc || Date.now() / 1000,
                                permalink: options.url,
                                flair: null,
                                isSelf: !!hnData.selftext,
                                isNsfw: false,
                                isSpoiler: false,
                                isLocked: false,
                                isArchived: false,
                            };

                            const transformHNComment = (c: any, depth = 0): RedditComment => ({
                                id: c.id.toString(),
                                author: c.author || "[deleted]",
                                body: c.text || "",
                                score: c.points || 0,
                                createdUtc: c.created_at_i || Date.now() / 1000,
                                parentId: c.parent_id?.toString() || "",
                                depth,
                                isSubmitter: c.author === post.author,
                                edited: false,
                                distinguished: null,
                                stickied: false,
                                replies: (c.children || []).map((child: any) => transformHNComment(child, depth + 1))
                            });

                            comments = (hnData.comments || []).map((c: any) => transformHNComment(c, 0));
                        } else if (options.url.includes('twitter.com') || options.url.includes('x.com')) {
                            // Twitter Normalization
                            const twitterData = rawData.source === 'twitter' ? rawData.content : rawData;
                            post = {
                                id: twitterData.post.id,
                                title: twitterData.post.title,
                                author: twitterData.post.author,
                                subreddit: "twitter-thread",
                                selftext: twitterData.post.selftext,
                                url: options.url,
                                score: 0,
                                upvoteRatio: 1,
                                numComments: twitterData.flattenedComments?.length || 0,
                                createdUtc: twitterData.post.createdUtc || Date.now() / 1000,
                                permalink: options.url,
                                flair: null,
                                isSelf: true,
                                isNsfw: false,
                                isSpoiler: false,
                                isLocked: false,
                                isArchived: false,
                            };

                            comments = (twitterData.flattenedComments || []).map((c: any) => ({
                                id: c.id,
                                author: c.author,
                                body: c.body,
                                score: c.score || 0,
                                createdUtc: c.createdUtc,
                                parentId: c.parentId || "",
                                depth: c.depth || 0,
                                isSubmitter: c.author === post.author,
                                edited: false,
                                distinguished: null,
                                stickied: false,
                                replies: [] // Twitter data is flattened for now
                            }));
                        } else {
                            // Reddit Normalization
                            const rawPost = rawData[0]?.data?.children[0]?.data;
                            post = transformPost(rawPost);
                            const commentListing = rawData[1];
                            const result = extractCommentsFromListing(commentListing);
                            comments = result.comments;
                        }

                        const totalComments = countComments(comments);

                        resolve({
                            post,
                            comments,
                            metadata: {
                                fetchedAt: new Date().toISOString(),
                                totalCommentsFetched: totalComments,
                                commentsReturned: totalComments,
                                truncated: false,
                                toolVersion: "1.0.0-bridge"
                            }
                        } as FetchResult);
                    } else {
                        reject(new Error(event.data.error || "Extension fetch failed"));
                    }
                }
            };

            window.addEventListener('message', listener);
            window.postMessage({ type: 'OPINION_DECK_FETCH_REQUEST', url: options.url, id: requestId }, window.location.origin);
        });

        try {
            const data = await extensionFetch;
            setThread(data);
            setMetadata(data.metadata);
        } catch (err: any) {
            // Fallback: If extension missing or fails, we might still try server-side 
            // but for this pivot, we highlight the extension error.
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const clear = useCallback(() => {
        setThread(null);
        setMetadata(null);
        setError(null);
    }, []);

    return { thread, metadata, loading, error, fetch: fetchData, clear };
}
