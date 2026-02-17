/// <reference types="chrome"/>
/* eslint-disable @typescript-eslint/no-explicit-any */
console.log("[OpinionDeck] Twitter Extractor Loaded");

async function extractTwitterThread() {
    const url = window.location.href;

    try {
        // Twitter/X is a heavy SPA; wait a bit for hydration
        await new Promise(resolve => setTimeout(resolve, 1500));

        const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        if (articles.length === 0) throw new Error("No tweets found. Make sure you are on a status page.");

        const mainTweetEl = articles[0]; // Assuming the first one is the main post or focusing on it
        const mainId = url.split('/').pop() || Date.now().toString();

        const extractTweetData = (article: Element) => {
            const textEl = article.querySelector('[data-testid="tweetText"]');
            const authorEl = article.querySelector('[data-testid="User-Name"]');
            const timeEl = article.querySelector('time');

            // Extract author info
            const authorText = authorEl?.textContent || "";
            const authorMatch = authorText.match(/@(\w+)/);
            const author = authorMatch ? authorMatch[1] : (authorText.split('·')[0].trim() || "unknown");

            return {
                id: article.getAttribute('aria-labelledby') || Math.random().toString(36),
                author: author,
                body: textEl?.textContent || "",
                createdUtc: timeEl ? new Date(timeEl.getAttribute('datetime') || Date.now()).getTime() / 1000 : Date.now() / 1000,
                score: 0, // Twitter score (likes) is harder to parse consistently, leave for now or basic scrape
            };
        };

        const mainPost = extractTweetData(mainTweetEl);
        const replies = articles.slice(1).map(article => ({
            ...extractTweetData(article),
            depth: 1, // Basic flattening for now
            parentId: mainPost.id
        }));

        return {
            id: `twitter_${mainId}`,
            source: 'twitter',
            url,
            title: mainPost.body.substring(0, 100) + (mainPost.body.length > 100 ? '...' : ''),
            content: {
                post: {
                    id: mainId,
                    title: mainPost.body.substring(0, 70), // Use snippet as title
                    author: mainPost.author,
                    createdUtc: mainPost.createdUtc,
                    selftext: mainPost.body,
                    subreddit: "twitter-thread", // Mapping to our schema
                    isSelf: true,
                    url: url
                },
                comments: replies,
                raw_json_dump: JSON.stringify({ url, tweetCount: articles.length })
            },
            extractedAt: new Date().toISOString(),
            isAnalyzed: false
        };
    } catch (err: any) {
        console.error("[OpinionDeck] Twitter Extraction Failed", err);
        return {
            id: `twitter_fallback_${Date.now()}`,
            source: 'twitter',
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
        extractTwitterThread().then(data => sendResponse({ data }));
        return true;
    }

    if (request.action === 'GET_METADATA') {
        const textEl = document.querySelector('[data-testid="tweetText"]') as HTMLElement;
        const title = textEl?.innerText.substring(0, 50) + "..." || document.title;
        sendResponse({ title, snippet: textEl?.innerText || '' });
    }
    return true;
});
