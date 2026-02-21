/// <reference types="chrome"/>

chrome.runtime.onInstalled.addListener(() => {
    console.log('[OpinionDeck] Extension Installed');
    // Open side panel on icon click
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch((error) => console.error(error));
});

const BUCKET = (import.meta as any).env.VITE_STORAGE_BUCKET || 'redditkeeperprod.firebasestorage.app';

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
async function saveToBackend(data: any, options: { depth?: 'shallow' | 'deep' } = {}) {
    const BASE_API = (import.meta as any).env.VITE_API_URL;

    const authRecord = await chrome.storage.local.get(['opinion_deck_token', 'opinion_deck_api_url']);
    const token = authRecord.opinion_deck_token;

    let storedApiUrl = authRecord.opinion_deck_api_url;
    if (storedApiUrl && storedApiUrl.includes('railway.app')) {
        storedApiUrl = null;
    }

    const baseUrl = (storedApiUrl || BASE_API).replace(/\/$/, '');
    const finalApiUrl = baseUrl.endsWith('/api')
        ? `${baseUrl}/extractions`
        : `${baseUrl}/api/extractions`;

    try {
        let payload = { ...data };

        const isDeep = options.depth === 'deep';
        if (data.source === 'reddit' && data.content?.pendingMore?.length > 0 && isDeep) {
            const threadId = data.id || `reddit_${data.content.linkName}`;
            if (processingThreads.has(threadId)) return { status: 'error', error: 'Extraction in progress' };

            processingThreads.add(threadId);
            try {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                const activeTab = tabs[0];
                if (activeTab?.id) {
                    const expansionResponse = await chrome.tabs.sendMessage(activeTab.id, {
                        action: 'EXPAND_COMMENTS',
                        linkId: data.content.linkName?.startsWith('t3_') ? data.content.linkName : `t3_${data.content.linkName}`,
                        children: data.content.pendingMore
                    });
                    if (expansionResponse?.comments) {
                        payload.content.comments = nestComments(expansionResponse.comments, data.content.comments);
                        delete payload.content.pendingMore;
                    }
                }
            } finally {
                processingThreads.delete(threadId);
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

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (err) {
        console.error('Failed to save:', err);
        throw err;
    }
}

// Handle internal messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'OPINION_DECK_AUTH_TOKEN') {
        chrome.storage.local.set({
            'opinion_deck_token': request.token,
            'opinion_deck_api_url': request.apiUrl || `${(import.meta as any).env.VITE_API_URL}/api`,
            'opinion_deck_dashboard_url': request.dashboardUrl || (import.meta as any).env.VITE_DASHBOARD_URL
        }, () => sendResponse({ status: 'success' }));
        return true;
    }

    if (request.action === 'OPEN_DISCOVERY_PANEL') {
        chrome.storage.local.set({
            'current_discovery_competitor': request.competitor,
            'discovery_status': 'setup'
        }, () => {
            // @ts-ignore
            chrome.sidePanel.open({ windowId: sender.tab?.windowId })
                .then(() => sendResponse({ status: 'success' }))
                .catch(err => sendResponse({ status: 'error', error: err.message }));
        });
        return true;
    }

    if (request.action === 'SAVE_EXTRACTION') {
        saveToBackend(request.data, { depth: request.depth })
            .then(res => sendResponse({ status: 'success', res }))
            .catch(err => sendResponse({ status: 'error', error: err.message }));
        return true;
    }

    if (request.action === 'FETCH_REDDIT_JSON') {
        const jsonUrl = request.url.includes('.json') ? request.url : (request.url.endsWith('/') ? request.url.slice(0, -1) : request.url) + '.json';
        fetch(jsonUrl)
            .then(async res => {
                if (!res.ok) throw new Error(`Reddit error: ${res.status}`);
                sendResponse({ status: 'success', data: await res.json() });
            })
            .catch(err => sendResponse({ status: 'error', error: err.message }));
        return true;
    }

    if (request.action === 'DISCOVERY_SEARCH') {
        const { competitor, phase } = request;
        const compLower = competitor.toLowerCase();

        const sendProgress = (stepId: string, results?: any[]) => {
            chrome.runtime.sendMessage({ type: 'OPINION_DECK_DISCOVERY_PROGRESS', stepId, results }).catch(() => { });
            chrome.tabs.query({ url: "*://*.opiniondeck.com/*" }, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'OPINION_DECK_DISCOVERY_PROGRESS', stepId, results }).catch(() => { });
                });
            });
        };

        const executeDiscoveryPhase = async (phaseId: string) => {
            const queryBuckets: Record<string, string[]> = {
                PHASE_1: [`title:${competitor} + frustrated`, `title:${competitor} + sucks`, `"${competitor}" + annoying`, `"${competitor}" + problems`, `"${competitor}" + billing`, `"${competitor}" + support`],
                PHASE_2: [`title:${competitor} + alternative`, `title:${competitor} + vs`, `"${competitor}" alternative`],
                PHASE_3: [`title:${competitor} + review`, `"${competitor}" review`, `"${competitor}"`]
            };

            const queries = queryBuckets[phaseId];
            if (!queries) return [];

            const storage = await chrome.storage.local.get(['discovery_results', 'discovery_processed_ids']);
            const allResultsMap = new Map<string, any>(Object.entries(storage.discovery_results || {}));
            const processedIds = new Set<string>(storage.discovery_processed_ids || []);
            const now = Date.now() / 1000;

            const qualitySubs = ['saas', 'productivity', 'startups', 'sysadmin', 'productmanagement', 'entrepreneur', 'webdev', 'experienceddevs', 'softwareengineering', 'devops', 'csccareerquestions', 'technology', 'salesforce', 'projectmanagement', 'video', 'videoproduction', 'filmmakers'];
            const noiseSubs = ['tifu', 'amitheasshole', 'kpop', 'wellthatsucks', 'bestofredditorupdates', 'aitah', 'relationship_advice', 'interestingasfuck', 'mildlyinfuriating', 'recruitinghell', 'superstonk', 'eagles', 'jewish', 'nvidia', 'askreddit', 'pics', 'funny', 'gaming', 'movies', 'politics', 'news', 'worldnews', 'todayilearned', 'showerthoughts', 'aww', 'dustythunder', 'twoxchromosomes', 'personalfinance', 'legaladvice', 'workplace', 'jobsearchhacks', 'hvac', 'construction', 'amioverreacting', 'motorbuzz', 'advice', 'trueoffmychest', 'rezero', 'anime', 'manga', 'sidehustle', 'affiliatemarketing', 'beermoney', 'signupsforpay', 'pennystocks'];
            const productKeywords = ['app', 'software', 'tool', 'saas', 'dashboard', 'feature', 'interface', 'integration', 'ui', 'ux', 'performance', 'slow', 'workflow', 'subscription', 'pricing', 'desktop', 'mobile', 'api', 'billing', 'cost', 'support', 'customer service', 'account', 'settings', 'sync', 'platform', 'service', 'storage', 'data', 'user'];
            const intentKeywords = ['annoying', 'frustrating', 'frustrated', 'sucks', 'hate', 'broken', 'break', 'slow', 'expensive', 'switching', 'moved to', 'anyone else', 'problems', 'bug', 'issue', 'error', 'glitch', 'failed', 'failing', 'trouble', 'overrated', 'alternatives', 'comparison', 'vs', 'recommend', 'request', 'need', 'wish', 'hope'];

            for (const query of queries) {
                const hb = await chrome.storage.local.get('discovery_sidepanel_open');
                if (hb.discovery_sidepanel_open === false) break;

                console.log(`[OpinionDeck] Discovery Phased Search: ${query}`);
                sendProgress(phaseId === 'PHASE_1' ? 'pains' : phaseId === 'PHASE_2' ? 'alts' : 'niche');

                try {
                    const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&t=year&limit=40`;
                    const res = await fetch(searchUrl);
                    if (!res.ok) continue;

                    const data = await res.json();
                    (data.data?.children || []).forEach((child: any) => {
                        const post = child.data;
                        if (processedIds.has(post.id)) return;

                        const title = (post.title || '').toLowerCase();
                        const text = (post.selftext || '').toLowerCase();
                        const combined = title + " " + text;
                        const subredditLower = (post.subreddit || '').toLowerCase();

                        const compRegex = new RegExp(`\\b${compLower}\\b`, 'i');
                        let inTitle = compRegex.test(title);
                        let inBody = compRegex.test(text);

                        if (!inTitle && !inBody) {
                            if (title.includes(compLower) || text.includes(compLower)) {
                                inTitle = title.includes(compLower);
                                inBody = text.includes(compLower);
                            } else return;
                        }

                        if (noiseSubs.includes(subredditLower)) return;
                        if (['affiliate program', 'highest paying', 'referral link', 'sign up for', 'free money'].some(p => combined.includes(p))) return;

                        let score = 0;
                        const contextMatches = productKeywords.filter(k => combined.includes(k));
                        const intentMatches = intentKeywords.filter(k => combined.includes(k));

                        const isTargetSub = subredditLower === compLower || qualitySubs.includes(subredditLower);
                        if (!isTargetSub) {
                            if (inTitle) { if (intentMatches.length === 0 && contextMatches.length === 0) return; }
                            else { if (intentMatches.length === 0 && contextMatches.length < 2) return; }
                        }

                        if (subredditLower === compLower) score += 20000;
                        else if (qualitySubs.includes(subredditLower)) score += 10000;

                        let val = (Math.min(intentMatches.length, 5) * 2000) + (Math.min(contextMatches.length, 5) * 500);
                        if (!inTitle) val *= 0.5;
                        score += val;

                        if (inTitle) {
                            score += 10000;
                            if (title.startsWith(compLower) || title.includes(` ${compLower} `)) score += 10000;
                        }

                        if (['list of', 'top 10', 'best way to'].some(m => title.includes(m))) score -= 15000;

                        score += Math.min(post.num_comments, 200) * 20;
                        const ageDays = (now - post.created_utc) / 86400;
                        if (ageDays < 30) score += 5000;
                        else if (ageDays < 90) score += 2000;

                        if (score > 10000) {
                            allResultsMap.set(post.id, {
                                id: post.id,
                                title: post.title,
                                url: `https://www.reddit.com${post.permalink}`,
                                subreddit: post.subreddit,
                                ups: post.ups,
                                num_comments: post.num_comments,
                                score: score
                            });
                        }
                        processedIds.add(post.id);
                    });
                } catch (err) { console.error(err); }
                await new Promise(r => setTimeout(r, 600));
            }

            const results = Array.from(allResultsMap.values()).sort((a, b) => b.score - a.score);
            await chrome.storage.local.set({
                discovery_results: Object.fromEntries(allResultsMap),
                discovery_processed_ids: Array.from(processedIds)
            });
            return results;
        };

        if (phase === 'START_PHASE') {
            const phaseId = request.phaseId || 'PHASE_1';
            executeDiscoveryPhase(phaseId).then(results => {
                const nextPhase = phaseId === 'PHASE_1' ? 'PHASE_2' : (phaseId === 'PHASE_2' ? 'PHASE_3' : null);
                chrome.runtime.sendMessage({ type: 'OPINION_DECK_DISCOVERY_PHASE_COMPLETE', phaseId, nextPhaseId: nextPhase, results: results.slice(0, 30) });
                if (!nextPhase) sendProgress('results_ready', results.slice(0, 30));
                sendResponse({ status: 'success', results: results.slice(0, 30), nextPhase });
            });
            return true;
        }

        if (phase === 'RESET') {
            chrome.storage.local.remove(['discovery_results', 'discovery_processed_ids', 'current_discovery_competitor']).then(() => sendResponse({ status: 'success' }));
            return true;
        }
    }

    return true;
});
