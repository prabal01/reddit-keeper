/// <reference types="chrome"/>
console.log("[OpinionDeck] Reddit Extractor Loaded");

async function extractRedditThread() {
    const url = window.location.href;
    const jsonUrl = url.split('?')[0].replace(/\/$/, "") + ".json";

    try {
        const response = await fetch(jsonUrl + "?limit=100"); // Lower limit for stability
        if (!response.ok) throw new Error("Failed to fetch JSON from Reddit");
        const data = await response.json();

        // Reddit returns an array: [postData, commentListing]
        let postData = data[0]?.data?.children[0]?.data;
        const commentListing = data[1]?.data?.children;

        // Robust ID find: If postData is missing from standard location, look for it
        if (!postData && Array.isArray(data[0]?.data?.children)) {
            postData = data[0].data.children.find((c: any) => c.kind === 't3')?.data;
        }

        // Fallback: Extract ID from URL if still missing
        if (!postData?.name) {
            const match = url.match(/\/comments\/([a-z0-9]+)\//i);
            if (match && match[1]) {
                console.warn("[OpinionDeck] linkName missing from JSON, extracted from URL:", match[1]);
                if (!postData) postData = {};
                postData.name = `t3_${match[1]}`;
            }
        }

        // Recursive mapper to build a clean nested tree
        const mapNestedComments = (children: any[]): { comments: any[], more: string[] } => {
            let comments: any[] = [];
            let more: string[] = [];

            if (!children) return { comments, more };

            for (const child of children) {
                if (child.kind === 't1') {
                    const nested = mapNestedComments(child.data.replies?.data?.children || []);
                    comments.push({
                        id: child.data.id,
                        author: child.data.author,
                        body: child.data.body,
                        score: child.data.score,
                        depth: child.data.depth,
                        createdUtc: child.data.created_utc,
                        isSubmitter: child.data.is_submitter,
                        distinguished: child.data.distinguished,
                        stickied: child.data.stickied,
                        replies: nested.comments
                    });
                    more = more.concat(nested.more);
                } else if (child.kind === 'more') {
                    // Identify pending children for deep fetching
                    if (child.data.children && child.data.children.length > 0) {
                        more = more.concat(child.data.children);
                    }
                }
            }
            return { comments, more };
        };

        const { comments, more } = mapNestedComments(commentListing);

        return {
            id: postData?.id ? `reddit_${postData.id}` : `reddit_ext_${Date.now()}`,
            source: 'reddit',
            url,
            title: postData?.title || document.title,
            content: {
                post: {
                    id: postData?.id,
                    title: postData?.title,
                    author: postData?.author,
                    ups: postData?.ups,
                    num_comments: postData?.num_comments,
                    subreddit: postData?.subreddit,
                    upvoteRatio: postData?.upvote_ratio,
                    createdUtc: postData?.created_utc,
                    permalink: postData?.permalink,
                    selftext: postData?.selftext,
                    isSelf: postData?.is_self,
                    url: postData?.url
                },
                comments: comments,
                pendingMore: more, // For background deep fetch
                linkName: postData?.name // t3_... ID for api/morechildren
            },
            extractedAt: new Date().toISOString(),
            isAnalyzed: false
        };
    } catch (err) {
        console.error("[OpinionDeck] JSON Extraction Failed, falling back to basic scrape", err);
        return {
            id: `reddit_fallback_${Date.now()}`,
            source: 'reddit',
            url,
            title: document.title,
            content: { post: { title: document.title }, comments: [] },
            extractedAt: new Date().toISOString(),
        };
    }
}

// Helper to recursively fetch more children from Reddit (running from Content Script for Session context)
async function fetchMoreRedditComments(linkId: string, initialChildren: string[], progressCallback: (count: number) => void): Promise<any[]> {
    if (!initialChildren || initialChildren.length === 0) return [];

    let allFetchedComments: any[] = [];
    const queue = [...initialChildren];
    const seenMore = new Set<string>(initialChildren);
    const batchSize = 100;
    const postId = linkId.replace('t3_', '');

    while (queue.length > 0) {
        const batch = queue.splice(0, batchSize).filter(id => !!id);
        if (batch.length === 0) continue;

        console.log(`[OpinionDeck] Deep Fetching batch (${batch.length} items, ${queue.length} remaining in queue)...`);

        const url = `https://www.reddit.com/api/morechildren.json`;
        const params = new URLSearchParams();
        params.append('api_type', 'json');
        params.append('link_id', linkId);
        params.append('children', batch.join(','));
        params.append('limit_children', 'false');
        params.append('raw_json', '1');

        try {
            const response = await fetch(url, { method: 'POST', body: params });

            if (response.ok) {
                const data = await response.json();
                const things = data.json?.data?.things || [];

                things.forEach((t: any) => {
                    if (t.kind === 't1') {
                        allFetchedComments.push({
                            id: t.data.id,
                            parentId: t.data.parent_id,
                            author: t.data.author,
                            body: t.data.body,
                            score: t.data.score,
                            depth: t.data.depth,
                            createdUtc: t.data.created_utc,
                            isSubmitter: t.data.is_submitter,
                            distinguished: t.data.distinguished,
                            stickied: t.data.stickied,
                            replies: []
                        });
                    } else if (t.kind === 'more') {
                        // RECURSION: Add newly discovered "more" items to our queue
                        const newChildren = t.data.children || [];
                        newChildren.forEach((childId: string) => {
                            if (!seenMore.has(childId)) {
                                seenMore.add(childId);
                                queue.push(childId);
                            }
                        });
                    }
                });

                progressCallback(allFetchedComments.length);
            } else {
                console.warn(`[OpinionDeck] Batch failed (${response.status}). Falling back to subtree fetch...`);
                // Fallback: Fetch each ID in this batch one by one using the subtree method
                for (const commentId of batch) {
                    const subtreeUrl = `https://www.reddit.com/comments/${postId}/_/${commentId}.json?limit=100&raw_json=1`;
                    try {
                        const subRes = await fetch(subtreeUrl);
                        if (subRes.ok) {
                            const subData = await subRes.json();
                            const subThings = subData[1]?.data?.children || [];

                            const mapSubtree = (nodes: any[]): any[] => {
                                let flattened: any[] = [];
                                for (const node of nodes) {
                                    if (node.kind === 't1') {
                                        flattened.push({
                                            id: node.data.id,
                                            parentId: node.data.parent_id,
                                            author: node.data.author,
                                            body: node.data.body,
                                            score: node.data.score,
                                            depth: node.data.depth,
                                            createdUtc: node.data.created_utc,
                                            isSubmitter: node.data.is_submitter,
                                            distinguished: node.data.distinguished,
                                            stickied: node.data.stickied,
                                            replies: []
                                        });
                                        if (node.data.replies?.data?.children) {
                                            flattened = flattened.concat(mapSubtree(node.data.replies.data.children));
                                        }
                                    } else if (node.kind === 'more') {
                                        // Also handle nested more items discovered in subtree
                                        (node.data.children || []).forEach((cid: string) => {
                                            if (!seenMore.has(cid)) {
                                                seenMore.add(cid);
                                                queue.push(cid);
                                            }
                                        });
                                    }
                                }
                                return flattened;
                            };
                            allFetchedComments = allFetchedComments.concat(mapSubtree(subThings));
                            progressCallback(allFetchedComments.length);
                        }
                    } catch (e) {
                        console.error(`[OpinionDeck] Fallback failed for ${commentId}`, e);
                    }
                    // Delay during fallback one-by-one is CRITICAL to avoid block
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        } catch (err) {
            console.error("[OpinionDeck] Batch request error:", err);
        }

        // Sequential Rate Limit: 2s between batches
        if (queue.length > 0) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    return allFetchedComments;
}

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_DATA') {
        extractRedditThread().then(data => sendResponse({ data }));
        return true;
    }

    if (request.action === 'EXPAND_COMMENTS') {
        const { linkId, children } = request;
        console.log(`[OpinionDeck] Received EXPAND_COMMENTS for ${children.length} items`);

        fetchMoreRedditComments(linkId, children, (count) => {
            // Report progress back to background (which forwards to popup)
            chrome.runtime.sendMessage({
                type: 'DEEP_FETCH_PROGRESS',
                count,
                total: children.length
            });
        }).then(comments => {
            sendResponse({ comments });
        }).catch(err => {
            sendResponse({ error: err.message });
        });
        return true; // Keep open for async response
    }

    if (request.action === 'GET_METADATA') {
        const titleEl = document.querySelector('h1') as HTMLElement;
        const title = titleEl?.innerText || document.title;
        const snippetEl = document.querySelector('div[id$="-post-rtjson-content"] p') as HTMLElement;
        const snippet = snippetEl?.innerText || '';
        sendResponse({ title, snippet });
    }
    return true;
});
