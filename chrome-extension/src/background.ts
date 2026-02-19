/// <reference types="chrome"/>

chrome.runtime.onInstalled.addListener(() => {
    console.log('[OpinionDeck] Extension Installed');
    // Open side panel on icon click
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch((error) => console.error(error));
});

const BUCKET = import.meta.env.VITE_STORAGE_BUCKET || 'redditkeeperprod.firebasestorage.app';
const API_URL = `${import.meta.env.VITE_API_URL}/api/extractions`;

// Global lock for parallel extractions
const processingThreads = new Set<string>();

// Firebase Storage Upload Helper
async function uploadToStorage(data: any, uid: string, token: string) {
    const filePath = `extractions/${uid}/${Date.now()}_${Math.random().toString(36).substring(7)}.json`;
    const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(filePath)}`;

    console.log(`[OpinionDeck] Uploading large payload to storage: ${filePath}`);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Storage Upload Failed: ${error.error?.message || response.statusText}`);
    }

    const result = await response.json();
    return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(filePath)}?alt=media&token=${result.downloadTokens || ''}`;
}

// Helper to recursively fetch more children from Reddit
async function fetchMoreRedditComments(linkId: string, children: string[], progressCallback: (count: number) => void): Promise<any[]> {
    if (!children || children.length === 0) return [];
    if (!linkId || linkId === 't3_undefined' || linkId === 't3_') {
        console.error("[OpinionDeck] Invalid link_id for deep fetch:", linkId);
        return [];
    }

    let allFetchedComments: any[] = [];
    let currentBatch = 0;
    const batchSize = 20; // Reduced to 20 for maximum safety and unauthenticated reliability

    for (let i = 0; i < children.length; i += batchSize) {
        const batch = children.slice(i, i + batchSize).filter(id => !!id);
        if (batch.length === 0) continue;

        const childrenParam = batch.map(id => id.startsWith('t1_') ? id : `t1_${id}`).join(',');

        console.log(`[OpinionDeck] Fetching morechildren batch ${++currentBatch} for ${linkId} (${batch.length} IDs)...`);

        // Use GET with .json - much more reliable for unauthenticated requests than POST
        const url = `https://www.reddit.com/api/morechildren.json?api_type=json&link_id=${linkId}&children=${childrenParam}&limit_children=false&raw_json=1`;

        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
            try {
                const response = await fetch(url);

                // Only retry on Rate Limit (429) or Server Errors (5xx)
                if (response.status === 429 || response.status >= 500) {
                    if (retryCount < maxRetries) {
                        const wait = (retryCount + 1) * 3000;
                        console.warn(`[OpinionDeck] Reddit busy or throttled (${response.status}). Retrying in ${wait}ms...`);
                        await new Promise(r => setTimeout(r, wait));
                        retryCount++;
                        continue;
                    }
                }

                if (!response.ok) {
                    const errorBody = await response.text();
                    console.error(`[OpinionDeck] Reddit API Error ${response.status}:`, errorBody.substring(0, 300));
                    throw new Error(`Reddit API Error: ${response.status}`);
                }

                const data = await response.json();
                const things = data.json?.data?.things || [];
                const newComments = things
                    .filter((t: any) => t.kind === 't1')
                    .map((t: any) => ({
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
                    }));

                allFetchedComments = allFetchedComments.concat(newComments);
                progressCallback(allFetchedComments.length);
                break; // Success
            } catch (err) {
                console.error("[OpinionDeck] Batch expansion failed:", err);
                if (retryCount === maxRetries) break; // Give up
                retryCount++;
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        // Rate Limit: 3.0s between requests (very safe)
        if (i + batchSize < children.length) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    return allFetchedComments;
}

// Helper to flatten an existing nested tree back into a list
function flattenTree(nodes: any[]): any[] {
    let result: any[] = [];
    if (!nodes) return result;
    for (const node of nodes) {
        const { replies, ...rest } = node;
        result.push(rest);
        if (replies && replies.length > 0) {
            result = result.concat(flattenTree(replies));
        }
    }
    return result;
}

// Utility to nest flat comments into a tree
function nestComments(fetchedComments: any[], existingComments: any[] = []): any[] {
    const map = new Map<string, any>();

    // Flatten the existing tree so we can treat everything as a single set
    const flattenedExisting = flattenTree(existingComments);
    const all = [...flattenedExisting, ...fetchedComments];

    // Normalize IDs and initialize nodes in map
    all.forEach(c => {
        if (!c.id) return;
        const cleanId = c.id.replace('t1_', '').replace('t3_', '');
        // Initialize node with current structure but clear replies for re-nesting
        map.set(cleanId, { ...c, id: cleanId, replies: [] });
    });

    const root: any[] = [];
    all.forEach(c => {
        if (!c.id) return;
        const cleanId = c.id.replace('t1_', '').replace('t3_', '');
        const node = map.get(cleanId);

        const rawParentId = c.parentId || c.parent_id;
        if (rawParentId) {
            const cleanParentId = rawParentId.replace('t1_', '').replace('t3_', '');

            // If parent is found in our set, nest it
            if (map.has(cleanParentId)) {
                const parent = map.get(cleanParentId);
                if (!parent.replies) parent.replies = [];
                if (!parent.replies.some((r: any) => r.id === node.id)) {
                    parent.replies.push(node);
                }
                return; // Nested successfully
            }
        }

        // If no parent found in current set (top-level or it's the thread itself), add to root
        if (!root.some((r: any) => r.id === node.id)) {
            root.push(node);
        }
    });

    return root;
}

// Helper to save to backend
async function saveToBackend(data: any) {
    // Base API URL from environment
    const BASE_API = import.meta.env.VITE_API_URL;

    const authRecord = await chrome.storage.local.get(['opinion_deck_token', 'opinion_deck_api_url']);
    const token = authRecord.opinion_deck_token;

    // Safety check: Ignore stale Railway.app URLs if they exist in storage
    let storedApiUrl = authRecord.opinion_deck_api_url;
    if (storedApiUrl && storedApiUrl.includes('railway.app')) {
        console.log(`[OpinionDeck] Ignoring stale API URL override: ${storedApiUrl}`);
        storedApiUrl = null;
    }

    // Construct final URL - ALWAYS ensure it ends with /api/extractions
    const baseUrl = (storedApiUrl || BASE_API).replace(/\/$/, '');
    const finalApiUrl = baseUrl.endsWith('/api')
        ? `${baseUrl}/extractions`
        : `${baseUrl}/api/extractions`;

    try {
        let payload = { ...data };

        // DEEP FETCH: If Reddit and has pending comments
        if (data.source === 'reddit' && data.content?.pendingMore?.length > 0) {
            const threadId = data.id || `reddit_${data.content.linkName}`;
            if (processingThreads.has(threadId)) {
                console.warn(`[OpinionDeck] Thread ${threadId} is already being processed. Aborting parallel task.`);
                return { status: 'error', error: 'Extraction already in progress for this thread.' };
            }

            processingThreads.add(threadId);
            console.log(`[OpinionDeck] Starting Deep Fetch Delegation for ${data.content.pendingMore.length} comments...`);

            try {
                // Determine the active tab to send the delegation message
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                const activeTab = tabs[0];

                if (!activeTab || !activeTab.id) {
                    throw new Error("No active tab found to delegate fetching.");
                }

                // Settle Delay: Wait 1s before hitting the tab
                await new Promise(r => setTimeout(r, 1000));

                const linkId = data.content.linkName?.startsWith('t3_')
                    ? data.content.linkName
                    : `t3_${data.content.linkName}`;

                // Delegate to Content Script (rides on user session)
                const expansionResponse = await chrome.tabs.sendMessage(activeTab.id, {
                    action: 'EXPAND_COMMENTS',
                    linkId,
                    children: data.content.pendingMore
                });

                if (expansionResponse?.error) {
                    throw new Error(expansionResponse.error);
                }

                const extraComments = expansionResponse?.comments || [];

                // Integrate into nested structure
                payload.content.comments = nestComments(extraComments, data.content.comments);
                delete payload.content.pendingMore;
                console.log(`[OpinionDeck] Deep Fetch Complete (via Delegation). Total items: ${extraComments.length}`);
            } catch (err: any) {
                console.error("[OpinionDeck] Deep Fetch Delegation Failed:", err);
                // We proceed with what we have (partial thread)
            } finally {
                processingThreads.delete(threadId);
            }
        }

        // Calculate final counts and metadata before potential storage offload
        const countNestedComments = (nodes: any[]): number => {
            if (!nodes) return 0;
            let count = 0;
            for (const n of nodes) {
                count += 1 + countNestedComments(n.replies || []);
            }
            return count;
        };

        const finalCommentCount = (payload.source === 'reddit' && payload.content?.comments)
            ? countNestedComments(payload.content.comments)
            : (payload.content?.flattenedComments?.length || payload.content?.comments?.length || 0);

        const postMetadata = payload.content?.post || { title: payload.title };

        const dataSize = JSON.stringify(payload).length;
        console.log(`[OpinionDeck] Payload size: ${dataSize} bytes`);

        // HYBRID STORAGE: Enforce for Reddit (fix nesting) OR if payload > 500KB
        const shouldOffload = (payload.source === 'reddit') || (dataSize > 500 * 1024);

        if (shouldOffload && token) {
            try {
                const tokenParts = token.split('.');
                const payloadStr = atob(tokenParts[1]);
                const tokenData = JSON.parse(payloadStr);
                const uid = tokenData.user_id || tokenData.uid || 'anon';

                const storageUrl = await uploadToStorage(payload.content, uid, token);
                console.log(`[OpinionDeck] Hybrid Storage Success (Offloaded due to ${payload.source === 'reddit' ? 'Nesting' : 'Size'}): ${storageUrl}`);

                // Replace content with storageUrl stub, but keep skeleton metadata
                // CRITICAL: Preserve these for the backend "Folder Bridge" to work
                const skeleton = {
                    id: payload.id,
                    source: payload.source,
                    title: payload.title,
                    url: payload.url,
                    extractedAt: payload.extractedAt,
                    folderId: payload.folderId,
                    post: postMetadata,
                    commentCount: finalCommentCount,
                    storageUrl: storageUrl,
                    content: null
                };

                payload = skeleton;
                console.log(`[OpinionDeck] Offloaded payload prepared with metadata:`, {
                    id: payload.id,
                    source: payload.source,
                    folderId: payload.folderId
                });
            } catch (storageErr: any) {
                console.error("[OpinionDeck] Hybrid Storage Upload failed:", storageErr);
                throw new Error(`Cloud storage upload failed: ${storageErr.message || 'Unknown error'}`);
            }
        }

        const response = await fetch(finalApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : { 'X-OpinionDeck-Dev': 'true' })
            },
            body: JSON.stringify({ data: payload })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (err) {
        console.error('Failed to save to backend:', err);
        throw err;
    }
}

// Handle external messages from Web App (Auth Sync)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    if (request.type === 'OPINION_DECK_AUTH_TOKEN') {
        const { token, apiUrl, dashboardUrl } = request;

        console.log('[OpinionDeck] Received Auth Token from Web App');

        chrome.storage.local.set({
            'opinion_deck_token': token,
            'opinion_deck_api_url': apiUrl,
            'opinion_deck_dashboard_url': dashboardUrl
        }, () => {
            console.log("[OpinionDeck] Extension Auth Sync: Success");
            sendResponse({ status: 'success' });
        });
        return true; // async response
    }
});

// Handle internal messages (Content Scripts -> Background)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 0. Handle Auth Token Sync (from dashboard.ts bridge)
    if (request.type === 'OPINION_DECK_AUTH_TOKEN') {
        const { token, apiUrl, dashboardUrl } = request; // Properties from event.data

        console.log('[OpinionDeck] Received Auth Token from Dashboard Bridge');

        chrome.storage.local.set({
            'opinion_deck_token': token,
            // Fallback defaults from environment if not provided
            'opinion_deck_api_url': apiUrl || `${import.meta.env.VITE_API_URL}/api`,
            'opinion_deck_dashboard_url': dashboardUrl || import.meta.env.VITE_DASHBOARD_URL
        }, () => {
            console.log("[OpinionDeck] Extension Auth Sync: Success");
            sendResponse({ status: 'success' });
        });
        return true;
    }

    if (request.action === 'SAVE_EXTRACTION') {
        saveToBackend(request.data)
            .then(res => sendResponse({ status: 'success', res }))
            .catch(err => sendResponse({ status: 'error', error: err.message }));
        return true;
    }

    // ANALYZE_DATA handler removed (dead code)

    if (request.action === 'FETCH_REDDIT_JSON') {
        const { url } = request;

        // 1. HackerNews Handling
        if (url.includes('news.ycombinator.com')) {
            const urlObj = new URL(url);
            const hnId = urlObj.searchParams.get('id');
            if (!hnId) {
                sendResponse({ status: 'error', error: 'Invalid HackerNews URL (missing ID)' });
                return true;
            }

            const algoliaUrl = `https://hn.algolia.com/api/v1/items/${hnId}`;
            console.log('[OpinionDeck] HN Remote Fetch:', algoliaUrl);

            fetch(algoliaUrl)
                .then(async response => {
                    if (!response.ok) throw new Error(`HN/Algolia error: ${response.status}`);
                    const data = await response.json();

                    // Basic normalization to match our schema expectations
                    const normalized = {
                        title: data.title,
                        author: data.author,
                        selftext: data.text || '',
                        score: data.points || 0,
                        num_comments: data.children ? data.children.length : 0,
                        id: data.id.toString(),
                        comments: data.children || []
                    };

                    sendResponse({ status: 'success', data: [{ data: { children: [{ data: normalized }] } }] });
                })
                .catch(err => {
                    console.error('[OpinionDeck] HN Remote Fetch Failed:', err);
                    sendResponse({ status: 'error', error: err.message });
                });
            return true;
        }

        // 2. Twitter/X Handling (Remote fetch not supported yet)
        if (url.includes('twitter.com') || url.includes('x.com')) {
            sendResponse({
                status: 'error',
                error: 'Twitter extraction requires the OpinionDeck extension to be active on that tab. Please open the X/Twitter thread directly and use the extension popup.'
            });
            return true;
        }

        // 3. Reddit Handling
        // Construct .json URL
        const jsonUrl = url.includes('.json') ? url : (url.endsWith('/') ? url.slice(0, -1) : url) + '.json';

        console.log('[OpinionDeck] Remote Fetching:', jsonUrl);

        fetch(jsonUrl)
            .then(async response => {
                const contentType = response.headers.get("content-type");
                if (!response.ok) throw new Error(`Reddit error: ${response.status}`);
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Received non-JSON response. Reddit might be blocking this request.");
                }
                const data = await response.json();
                sendResponse({ status: 'success', data });
            })
            .catch(err => {
                console.error('[OpinionDeck] Remote Fetch Failed:', err);
                sendResponse({ status: 'error', error: err.message });
            });
        return true;
    }

    if (request.action === 'PING_BACKGROUND') {
        sendResponse({ status: 'success', version: '1.0.0' });
        return true;
    }

    return true; // Keep channel open for any other potential listeners
});
