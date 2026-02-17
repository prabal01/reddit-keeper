/// <reference types="chrome"/>
console.log("[OpinionDeck] Reddit Extractor Loaded");

async function extractRedditThread() {
    const url = window.location.href;
    const jsonUrl = url.split('?')[0].replace(/\/$/, "") + ".json";

    try {
        const response = await fetch(jsonUrl);
        if (!response.ok) throw new Error("Failed to fetch JSON from Reddit");
        const data = await response.json();

        // Reddit returns an array: [postData, commentListing]
        const postData = data[0]?.data?.children[0]?.data;
        const commentListing = data[1]?.data?.children;

        // Recursive flattener to keep 100% of quality and structure without the nesting depth
        const flattenComments = (children: any[], parentId: string | null = null): any[] => {
            let result: any[] = [];
            if (!children) return result;
            for (const child of children) {
                if (child.kind === 't1') {
                    result.push({
                        author: child.data.author,
                        body: child.data.body,
                        score: child.data.score,
                        id: child.data.id,
                        parentId: parentId,
                        depth: child.data.depth,
                        createdUtc: child.data.created_utc,
                        isSubmitter: child.data.is_submitter,
                        distinguished: child.data.distinguished,
                        stickied: child.data.stickied
                    });
                    if (child.data.replies?.data?.children) {
                        result = result.concat(flattenComments(child.data.replies.data.children, child.data.id));
                    }
                }
            }
            return result;
        };

        const comments = flattenComments(commentListing);

        return {
            id: `reddit_${postData?.id || Date.now()}`,
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
                comments: comments, // Standardized key
                raw_json_dump: JSON.stringify(data) // 100% fidelity backup
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

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_DATA') {
        extractRedditThread().then(data => sendResponse({ data }));
        return true; // Keep channel open for async
    }

    if (request.action === 'GET_METADATA') {
        const titleEl = document.querySelector('h1') as HTMLElement;
        const title = titleEl?.innerText || document.title;
        // Grab first paragraph of post if possible
        const snippetEl = document.querySelector('div[id$="-post-rtjson-content"] p') as HTMLElement;
        const snippet = snippetEl?.innerText || '';
        sendResponse({ title, snippet });
    }
    return true;
});
