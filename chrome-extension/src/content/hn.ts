/// <reference types="chrome"/>

// chrome-extension/src/content/hn.ts
console.log("[OpinionDeck] HackerNews Extractor Loaded");

/**
 * HackerNews DOM Extractor
 * Maps HN thread structure to the OpinionDeck schema.
 */

function extractHNThread() {
    const title = document.querySelector('.titleline a')?.textContent || '';
    const author = document.querySelector('.hnuser')?.textContent || '';
    const scoreText = document.querySelector('.score')?.textContent || '0';
    const score = parseInt(scoreText.split(' ')[0]) || 0;

    // HN handles story text differently if it's a URL vs Self-Post
    const selfText = document.querySelector('.toptext')?.textContent || '';

    const comments: any[] = [];
    const commentRows = document.querySelectorAll('.comtr');

    commentRows.forEach((row: any) => {
        const id = row.id;
        const commentAuthor = row.querySelector('.hnuser')?.textContent || '';
        const body = row.querySelector('.commtext')?.textContent || '';
        const depth = parseInt(row.querySelector('.ind img')?.width || '0') / 40; // HN uses padding images for depth

        comments.push({
            id,
            author: commentAuthor,
            body,
            depth,
            createdUtc: Date.now() / 1000, // HN DOM doesn't give precise UTC easily
            replies: []
        });
    });

    return {
        id: new URLSearchParams(window.location.search).get('id') || '',
        source: 'hn',
        url: window.location.href,
        title,
        extractedAt: new Date().toISOString(),
        content: {
            post: {
                title,
                author,
                selftext: selfText,
                score,
                num_comments: comments.length,
                created_utc: Date.now() / 1000,
                permalink: window.location.pathname + window.location.search,
            },
            comments
        }
    };
}

// Listen for popup requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_DATA' && window.location.hostname === 'news.ycombinator.com') {
        const data = extractHNThread();
        sendResponse({ status: 'success', data });
    }
});
