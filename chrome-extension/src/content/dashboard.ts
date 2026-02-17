/// <reference types="chrome"/>

/**
 * OpinionDeck Dashboard Auth Bridge
 * This script runs on the web dashboard (localhost / app.opiniondeck.com)
 * and bridges the Firebase ID Token to the extension's local storage.
 */

console.log("[OpinionDeck] Dashboard Content Script loaded on:", window.location.origin);


window.addEventListener("message", (event) => {
    // Only trust messages from our own origin
    if (event.origin !== window.location.origin) return;

    if (event.data && event.data.type === "OPINION_DECK_AUTH_TOKEN") {
        const token = event.data.token;
        console.log("[OpinionDeck] Received token from Web app. Length:", token ? token.length : 0);

        // Safety check for extension context
        if (!chrome.runtime?.id) {
            console.warn("[OpinionDeck] Extension context invalidated - Please refresh the page.");
            return;
        }

        if (token) {
            chrome.storage.local.set({ 'opinion_deck_token': token }, () => {
                console.log("[OpinionDeck] Extension Auth Sync: Success (Token Stored)");
            });
        } else if (token === null) {
            chrome.storage.local.remove('opinion_deck_token', () => {
                console.log("[OpinionDeck] Extension Auth Sync: Logged Out (Token Removed)");
            });
        }
    }

    // New: Handle Dashboard Fetch Requests
    if (event.data && event.data.type === "OPINION_DECK_FETCH_REQUEST") {
        const { url, id } = event.data;

        if (!chrome.runtime?.id) {
            window.postMessage({ type: "OPINION_DECK_FETCH_RESPONSE", id, success: false, error: "Extension context invalidated" }, window.location.origin);
            return;
        }

        chrome.runtime.sendMessage({ action: 'FETCH_REDDIT_JSON', url }, (response) => {
            window.postMessage({
                type: "OPINION_DECK_FETCH_RESPONSE",
                id,
                success: response?.status === 'success',
                data: response?.data,
                error: response?.error
            }, window.location.origin);
        });
    }

    // Ping/Pong for instant detection
    if (event.data && event.data.type === "OPINION_DECK_PING") {
        window.postMessage({ type: "OPINION_DECK_PONG" }, window.location.origin);
    }
});

// Listen for manual sync requests from the extension popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'REQUEST_AUTH_SYNC') {
        console.log("[OpinionDeck] Manual Auth Sync requested by popup");
        window.postMessage({ type: "OPINION_DECK_EXTENSION_READY" }, window.location.origin);
        sendResponse({ status: 'success' });
    }
    return true;
});

// Notify the web app that the extension is ready
window.postMessage({ type: "OPINION_DECK_EXTENSION_READY" }, window.location.origin);
