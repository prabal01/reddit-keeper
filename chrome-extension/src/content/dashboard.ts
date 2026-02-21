console.log("[OpinionDeck] Content Script Loaded on Dashboard");

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request) => {
    if (request.type === "OPINION_DECK_DISCOVERY_PROGRESS") {
        window.postMessage({
            type: "OPINION_DECK_DISCOVERY_PROGRESS",
            stepId: request.stepId,
            results: request.results,
            phase: request.phase
        }, window.location.origin);
    }
});

// Listen for messages from the Web App (App.tsx)
window.addEventListener("message", (event) => {
    // We only accept messages from ourselves
    if (event.source !== window) return;

    // Handle Auth Token
    if (event.data.type === "OPINION_DECK_AUTH_TOKEN") {
        console.log("[OpinionDeck] Bridge received auth token from Web App");

        chrome.runtime.sendMessage({
            action: "OPINION_DECK_AUTH_TOKEN",
            ...event.data
        }, (response) => {
            console.log("[OpinionDeck] Background response:", response);
        });
    }

    // Handle Fetch Requests (useRedditThread.ts)
    if (event.data.type === "OPINION_DECK_FETCH_REQUEST") {
        console.log("[OpinionDeck] Bridge received fetch request:", event.data.url);

        chrome.runtime.sendMessage({
            action: "FETCH_REDDIT_JSON",
            url: event.data.url
        }, (response) => {
            console.log("[OpinionDeck] Background fetch response:", response);

            // Send result back to Web App
            window.postMessage({
                type: "OPINION_DECK_FETCH_RESPONSE",
                id: event.data.id, // Correlate request
                success: response && response.status === 'success',
                data: response ? response.data : null,
                error: response ? response.error : "Unknown error"
            }, window.location.origin);
        });
    }

    // Handle Saving Extraction
    if (event.data.type === "OPINION_DECK_SAVE_REQUEST") {
        console.log("[OpinionDeck] Bridge received save request:", event.data.data?.url);

        chrome.runtime.sendMessage({
            action: "SAVE_EXTRACTION",
            data: event.data.data
        }, (response) => {
            window.postMessage({
                type: "OPINION_DECK_SAVE_RESPONSE",
                id: event.data.id,
                success: response && response.status === 'success',
                error: response ? response.error : "Unknown error"
            }, window.location.origin);
        });
    }

    // Handle Discovery Search Trigger (Request Side Panel)
    if (event.data.type === "OPINION_DECK_DISCOVERY_REQUEST") {
        console.log("[OpinionDeck] Bridge received discovery request:", event.data.competitor);

        chrome.runtime.sendMessage({
            action: "OPEN_DISCOVERY_PANEL",
            competitor: event.data.competitor
        }, (response) => {
            // Dashboard now expects side panel to take over
            console.log("[OpinionDeck] Side panel request response:", response);

            // Critical: Send response back to Web App to clear "Checking extension" loader
            window.postMessage({
                type: "OPINION_DECK_DISCOVERY_RESPONSE",
                id: event.data.id,
                success: response && response.status === 'success',
                error: (response && response.status === 'success') ? null : (response ? response.error : "Unknown error"),
                results: [], // Crucial: Always provide array to satisfy Web App's discovery mode
                sidepanel: true
            }, window.location.origin);
        });
    }

    // Handle Batch Save (delegating to extension's saving logic)
    if (event.data.type === "OPINION_DECK_SAVE_BATCH_REQUEST") {
        const { threads, folderId } = event.data;
        console.log("[OpinionDeck] Bridge received batch save request for", threads.length, "threads");

        // Note: Batch saving will be orchestrated by the dashboard calling 
        // the existing save extraction bridge multiple times OR we can add a batch helper here.
    }

    // Handle Ping
    if (event.data.type === "OPINION_DECK_PING_REQUEST") {
        console.log("[OpinionDeck] Bridge received ping");
        window.postMessage({
            type: "OPINION_DECK_PING_RESPONSE",
            id: event.data.id,
            success: true,
            version: "1.0.0"
        }, window.location.origin);
    }
});
