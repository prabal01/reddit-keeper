/// <reference types="chrome"/>
import { ExtractedData } from '../types';

const FALLBACK_API = `${(import.meta as any).env.VITE_API_URL}/api`;
const FALLBACK_DASHBOARD = (import.meta as any).env.VITE_DASHBOARD_URL;

// Global Error Catcher
window.onerror = (message, source, lineno, colno, error) => {
    console.error('[OpinionDeck] Global Crash:', { message, source, lineno, colno, error });
};

async function getApiBase() {
    const record = await chrome.storage.local.get('opinion_deck_api_url');
    let storedApiUrl = record.opinion_deck_api_url;
    if (storedApiUrl && storedApiUrl.includes('railway.app')) {
        chrome.storage.local.remove('opinion_deck_api_url');
        storedApiUrl = null;
    }
    const base = (storedApiUrl || FALLBACK_API).replace(/\/$/, '');
    return base.endsWith('/api') ? base : `${base}/api`;
}

async function getDashboardBase() {
    const record = await chrome.storage.local.get('opinion_deck_dashboard_url');
    let storedDashboardUrl = record.opinion_deck_dashboard_url;
    if (storedDashboardUrl && storedDashboardUrl.includes('railway.app')) {
        chrome.storage.local.remove('opinion_deck_dashboard_url');
        storedDashboardUrl = null;
    }
    return storedDashboardUrl || FALLBACK_DASHBOARD;
}

async function checkBackgroundConnection() {
    const dot = document.getElementById('connection-dot');
    const text = document.getElementById('connection-text');
    try {
        const response = await chrome.runtime.sendMessage({ action: 'PING_BACKGROUND' });
        if (response && response.status === 'success') {
            if (dot) dot.className = 'dot active';
            if (text) text.innerText = 'Connected';
        }
    } catch (err) {
        if (dot) dot.className = 'dot error';
        if (text) text.innerText = 'Extension Offline';
    }
}

async function checkAuth() {
    const authRecord = await chrome.storage.local.get('opinion_deck_token');
    const token = authRecord.opinion_deck_token;
    const loginSection = document.getElementById('login-required');
    const extractionSection = document.getElementById('extraction-card');
    const historySection = document.getElementById('history-section');
    const cloudBtns = [
        document.getElementById('extract-only-btn') as HTMLButtonElement,
        document.getElementById('extract-analyse-btn') as HTMLButtonElement,
        document.getElementById('folder-select') as HTMLSelectElement
    ];

    if (!token) {
        if (loginSection) loginSection.style.display = 'block';
        if (extractionSection) extractionSection.style.display = 'block';
        if (historySection) historySection.style.display = 'none';
        cloudBtns.forEach(btn => { if (btn) btn.disabled = true; });
        return null;
    } else {
        if (loginSection) loginSection.style.display = 'none';
        if (extractionSection) extractionSection.style.display = 'block';
        if (historySection) historySection.style.display = 'block';
        return token;
    }
}

async function updateHistory() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    const token = await checkAuth();
    if (!token) return;

    try {
        const apiBase = await getApiBase();
        const response = await fetch(`${apiBase}/extractions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Offline');
        const extractions: ExtractedData[] = await response.json();
        const displayList = extractions.slice(0, 5);

        historyList.innerHTML = displayList.map(item => `
        <div class="insight-item-wrapper" style="margin-bottom: 8px; cursor: pointer;" data-id="${item.id}" data-folder-id="${(item as any).folderId || 'inbox'}">
          <div class="insight-item">
            <div>
              <strong>${item.title}</strong><br/>
              <span style="opacity: 0.6; font-size: 0.7rem;">${item.source} • ${new Date(item.extractedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      `).join('') + (extractions.length > 5 ? `
        <div style="text-align: center; margin-top: 10px;">
          <a href="#" class="view-all-link" style="color: #6366f1; font-size: 0.75rem; text-decoration: none; font-weight: 500;">View All in Dashboard →</a>
        </div>
      ` : '') || '<p style="font-size: 0.7rem; color: #666;">No extractions yet.</p>';
    } catch (err) {
        historyList.innerHTML = '<p style="color: #6e6e88; font-size: 0.7rem; text-align: center; padding: 20px;">Dashboard offline.</p>';
    }
}

async function fetchFolders() {
    const select = document.getElementById('folder-select') as HTMLSelectElement;
    if (!select) return;
    const token = await checkAuth();
    if (!token) return;

    try {
        const apiBase = await getApiBase();
        const response = await fetch(`${apiBase}/folders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return;
        const folders = await response.json();
        if (folders.length > 0) {
            select.innerHTML = folders.map((f: any) => `<option value="${f.id}">${f.name}</option>`).join('');
            const storage = await chrome.storage.local.get('lastUsedFolderId');
            if (storage.lastUsedFolderId && folders.some((f: any) => f.id === storage.lastUsedFolderId)) {
                select.value = storage.lastUsedFolderId;
            }
        }
    } catch (err) { }
}

let currentPhase: 'PAIN_POINTS' | 'ALTERNATIVES' = 'PAIN_POINTS';
let researchDepth: 'shallow' | 'deep' = 'shallow';

function detectPage(url: string) {
    const statusEl = document.getElementById('page-status');
    const saveOnlyBtn = document.getElementById('extract-only-btn') as HTMLButtonElement | null;
    const saveAnalyseBtn = document.getElementById('extract-analyse-btn') as HTMLButtonElement | null;
    const copyGptBtn = document.getElementById('copy-gpt-btn') as HTMLButtonElement | null;

    const isSupported = (url.includes('reddit.com/r/') && url.includes('/comments/')) ||
        (url.includes('g2.com/products/') && url.includes('/reviews')) ||
        (url.includes('news.ycombinator.com/item')) ||
        (url.includes('x.com') && url.includes('/status/')) ||
        (url.includes('twitter.com') && url.includes('/status/'));

    if (isSupported) {
        if (statusEl) {
            if (url.includes('reddit')) statusEl.innerText = 'Reddit Thread Detected';
            else if (url.includes('g2.com')) statusEl.innerText = 'G2 Product Detected';
            else statusEl.innerText = 'Supported Thread';
            statusEl.classList.add('status-active');
        }
        if (copyGptBtn) copyGptBtn.disabled = false;
        chrome.storage.local.get('opinion_deck_token').then(record => {
            if (record.opinion_deck_token) {
                if (saveOnlyBtn) saveOnlyBtn.disabled = false;
                if (saveAnalyseBtn) saveAnalyseBtn.disabled = false;
            }
        });
        return 'supported';
    } else {
        if (saveOnlyBtn) saveOnlyBtn.disabled = true;
        if (saveAnalyseBtn) saveAnalyseBtn.disabled = true;
        if (copyGptBtn) copyGptBtn.disabled = true;
        return null;
    }
}

async function prefetchMetadata(tabId: number) {
    const previewArea = document.getElementById('snapshot-preview');
    const titleEl = document.getElementById('preview-title');
    const snippetEl = document.getElementById('preview-snippet');
    try {
        const response = await chrome.tabs.sendMessage(tabId, { action: 'GET_METADATA' });
        if (response && response.title) {
            if (previewArea) previewArea.style.display = 'block';
            if (titleEl) titleEl.innerText = response.title;
            if (snippetEl) snippetEl.innerText = response.snippet || 'Ready to capture insights...';
        }
    } catch (err) { }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[OpinionDeck] Side Panel Init Start');

    // folder creation logic
    const addFolderToggle = document.getElementById('add-folder-toggle');
    const newFolderGroup = document.getElementById('new-folder-input-group');
    const createFolderBtn = document.getElementById('create-folder-btn');
    const newFolderNameInput = document.getElementById('new-folder-name') as HTMLInputElement;

    addFolderToggle?.addEventListener('click', () => {
        if (newFolderGroup) {
            newFolderGroup.style.display = newFolderGroup.style.display === 'none' ? 'block' : 'none';
            if (newFolderGroup.style.display === 'block') newFolderNameInput?.focus();
        }
    });

    document.getElementById('cancel-folder-btn')?.addEventListener('click', () => {
        if (newFolderGroup) newFolderGroup.style.display = 'none';
        if (newFolderNameInput) newFolderNameInput.value = '';
    });

    createFolderBtn?.addEventListener('click', async () => {
        const name = newFolderNameInput?.value.trim();
        if (!name) return;
        const token = await checkAuth();
        if (!token) return;
        if (createFolderBtn) createFolderBtn.innerText = '...';
        try {
            const apiBase = await getApiBase();
            const response = await fetch(`${apiBase}/folders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name })
            });
            if (response.ok) {
                const newFolder = await response.json();
                await fetchFolders();
                const sel = document.getElementById('folder-select') as HTMLSelectElement;
                if (sel) sel.value = newFolder.id;
                if (newFolderGroup) newFolderGroup.style.display = 'none';
                if (newFolderNameInput) newFolderNameInput.value = '';
            }
        } catch (err) { } finally {
            if (createFolderBtn) createFolderBtn.innerText = 'Create';
        }
    });

    // Extraction Logic
    const saveOnlyBtn = document.getElementById('extract-only-btn') as HTMLButtonElement;
    const saveAnalyseBtn = document.getElementById('extract-analyse-btn') as HTMLButtonElement;

    const performSave = async (shouldRedirect: boolean) => {
        const activeBtn = shouldRedirect ? saveAnalyseBtn : saveOnlyBtn;
        const originalText = activeBtn?.innerText || 'Save';
        if (saveOnlyBtn) saveOnlyBtn.disabled = true;
        if (saveAnalyseBtn) saveAnalyseBtn.disabled = true;
        if (activeBtn) activeBtn.innerText = 'Saving...';

        try {
            const folderId = (document.getElementById('folder-select') as HTMLSelectElement)?.value;
            if (!folderId) throw new Error('Select a folder first.');

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) throw new Error('No active tab');

            const response = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_DATA' });
            if (!response?.data) throw new Error('Extraction failed');

            chrome.storage.local.set({ lastUsedFolderId: folderId });
            const extractionData = { ...response.data, folderId, shouldAnalyze: shouldRedirect };
            // Pass the current researchDepth preference
            const saveResponse = await chrome.runtime.sendMessage({
                action: 'SAVE_EXTRACTION',
                data: extractionData,
                depth: researchDepth
            });

            if (saveResponse.status === 'success') {
                if (activeBtn) activeBtn.innerText = '✓ Saved!';
                await updateHistory();
                await new Promise(r => setTimeout(r, 1500));
                if (shouldRedirect) {
                    const base = await getDashboardBase();
                    const fid = folderId === 'default' ? 'inbox' : folderId;
                    chrome.tabs.create({ url: `${base}/folders/${fid}/threads/${response.data.id}` });
                }
            } else {
                throw new Error(saveResponse.error || 'Save failed');
            }
        } catch (err: any) {
            if (errorEl) {
                errorEl.innerText = err.message;
                errorEl.style.display = 'block';
            }
        } finally {
            if (saveOnlyBtn) saveOnlyBtn.disabled = false;
            if (saveAnalyseBtn) saveAnalyseBtn.disabled = false;
            if (activeBtn) activeBtn.innerText = originalText;
        }
    };

    saveOnlyBtn?.addEventListener('click', () => performSave(false));
    saveAnalyseBtn?.addEventListener('click', () => performSave(true));

    document.getElementById('copy-gpt-btn')?.addEventListener('click', async () => {
        const copyBtn = document.getElementById('copy-gpt-btn') as HTMLButtonElement;
        const originalText = copyBtn.innerText;
        copyBtn.innerText = 'Extracting...';
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) throw new Error();
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_DATA' });
            if (response?.data) {
                const data = response.data;
                const comments = data.content?.comments || [];
                const md = `# ${data.title}\nSource: ${data.url}\n\n## Insights\n${comments.map((c: any) => `### ${c.author}\n${c.body}`).join('\n\n')}`;
                await navigator.clipboard.writeText(md);
                copyBtn.innerText = '📋 Copied!';
                setTimeout(() => { copyBtn.innerText = originalText; }, 2000);
            }
        } catch (e) {
            if (errorEl) errorEl.innerText = 'Copy failed';
        } finally {
            if (copyBtn.innerText === 'Extracting...') copyBtn.innerText = originalText;
        }
    });

    // Discovery UI Handlers
    const startDiscoveryBtn = document.getElementById('start-discovery-btn');
    const abortDiscoveryBtn = document.getElementById('abort-discovery-btn');
    const nextPhaseBtn = document.getElementById('next-phase-btn');
    const finishDiscoveryBtn = document.getElementById('finish-discovery-btn');
    const cancelDiscoveryBtn = document.getElementById('cancel-discovery-btn');

    // Depth Toggles
    const depthShallowBtn = document.getElementById('depth-shallow-btn');
    const depthDeepBtn = document.getElementById('depth-deep-btn');
    const depthDesc = document.getElementById('depth-desc');

    depthShallowBtn?.addEventListener('click', () => {
        researchDepth = 'shallow';
        depthShallowBtn.classList.add('active');
        depthDeepBtn?.classList.remove('active');
        if (depthDesc) depthDesc.innerText = 'Analyzes titles and snippets only. (Fast)';
    });

    depthDeepBtn?.addEventListener('click', () => {
        researchDepth = 'deep';
        depthDeepBtn.classList.add('active');
        depthShallowBtn?.classList.remove('active');
        if (depthDesc) depthDesc.innerText = 'Deep fetch: Recursively collects all nested comments. (Slower)';
    });

    // UI Elements
    const extractView = document.getElementById('extract-view');
    const discoveryView = document.getElementById('discovery-view');
    const discoverySetup = document.getElementById('discovery-setup');
    const discoveryProgress = document.getElementById('discovery-progress-card');
    const discoveryResults = document.getElementById('discovery-phase-results');
    const compNameHeader = document.getElementById('discovery-comp-name');
    const errorEl = document.getElementById('error-message');

    // State management moved to global scope

    const showDiscoveryStep = (step: 'setup' | 'progress' | 'results') => {
        console.log(`[OpinionDeck] Discovery step: ${step}`);
        if (!discoveryView || !extractView) return;
        discoveryView.style.display = 'block';
        extractView.style.display = 'none';
        if (discoverySetup) discoverySetup.style.display = step === 'setup' ? 'block' : 'none';
        if (discoveryProgress) discoveryProgress.style.display = step === 'progress' ? 'block' : 'none';
        if (discoveryResults) discoveryResults.style.display = step === 'results' ? 'block' : 'none';
    };

    const initDiscovery = async () => {
        const data = await chrome.storage.local.get('current_discovery_competitor');
        if (data.current_discovery_competitor) {
            const comp = data.current_discovery_competitor;
            if (compNameHeader) compNameHeader.innerText = `Researching ${comp}`;
            const label = document.getElementById('comp-label');
            if (label) label.innerText = comp;
            showDiscoveryStep('setup');
            return true;
        }
        return false;
    };

    const start = async () => {
        const inDiscovery = await initDiscovery();
        if (!inDiscovery) {
            if (extractView) extractView.style.display = 'block';
            if (discoveryView) discoveryView.style.display = 'none';
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.url) {
                detectPage(tab.url);
                if (tab.id) prefetchMetadata(tab.id);
            }
        }
        checkBackgroundConnection().catch(() => { });
        checkAuth().catch(() => { });
        fetchFolders().catch(() => { });
        updateHistory().catch(() => { });
    };

    start().catch(e => console.error(e));

    // Listeners
    document.getElementById('open-dashboard-btn')?.addEventListener('click', async () => {
        const base = await getDashboardBase();
        chrome.tabs.create({ url: base });
    });

    document.getElementById('refresh-auth-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('refresh-auth-btn') as HTMLButtonElement;
        btn.style.animation = 'spin 1s linear infinite';
        const dashboardTabs = await chrome.tabs.query({ url: `${FALLBACK_DASHBOARD}/*` });
        await Promise.all(dashboardTabs.map(t => t.id ? chrome.tabs.sendMessage(t.id, { action: 'REQUEST_AUTH_SYNC' }).catch(() => { }) : Promise.resolve()));
        await new Promise(r => setTimeout(r, 800));
        await checkAuth();
        await fetchFolders();
        await updateHistory();
        btn.style.animation = 'none';
    });

    document.getElementById('depth-shallow-btn')?.addEventListener('click', () => {
        researchDepth = 'shallow';
        document.getElementById('depth-shallow-btn')?.classList.add('active');
        document.getElementById('depth-deep-btn')?.classList.remove('active');
        const d = document.getElementById('depth-desc');
        if (d) d.innerText = 'Analyzes ~100 comments across 15 threads.';
    });

    document.getElementById('depth-deep-btn')?.addEventListener('click', () => {
        researchDepth = 'deep';
        document.getElementById('depth-deep-btn')?.classList.add('active');
        document.getElementById('depth-shallow-btn')?.classList.remove('active');
        const d = document.getElementById('depth-desc');
        if (d) d.innerText = 'Deep dive into 50+ threads using recursive expansion.';
    });

    document.getElementById('cancel-discovery-btn')?.addEventListener('click', () => {
        chrome.storage.local.remove(['current_discovery_competitor', 'discovery_status']);
        window.location.reload();
    });

    document.getElementById('start-discovery-btn')?.addEventListener('click', async () => {
        const data = await chrome.storage.local.get('current_discovery_competitor');
        if (!data.current_discovery_competitor) return;
        currentPhase = 'PAIN_POINTS';
        showDiscoveryStep('progress');
        chrome.runtime.sendMessage({
            action: 'DISCOVERY_SEARCH',
            competitor: data.current_discovery_competitor,
            phase: 'START_PHASE',
            phaseId: 'PHASE_1',
            depth: researchDepth
        });
    });

    document.getElementById('next-phase-btn')?.addEventListener('click', async () => {
        const data = await chrome.storage.local.get('current_discovery_competitor');
        const nextPhaseId = (document.getElementById('next-phase-btn') as any).dataset.nextPhaseId;
        if (!nextPhaseId) return;

        showDiscoveryStep('progress');
        chrome.runtime.sendMessage({
            action: 'DISCOVERY_SEARCH',
            competitor: data.current_discovery_competitor,
            phase: 'START_PHASE',
            phaseId: nextPhaseId,
            depth: researchDepth
        });
    });

    document.getElementById('abort-discovery-btn')?.addEventListener('click', () => {
        showDiscoveryStep('setup');
    });

    document.getElementById('finish-discovery-btn')?.addEventListener('click', async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];

        if (activeTab?.id) {
            const resultsData = await chrome.storage.local.get('discovery_results');
            const results = Object.values(resultsData.discovery_results || {}).sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

            // Explicitly sync to the tab that (likely) started this
            chrome.tabs.sendMessage(activeTab.id, {
                type: 'OPINION_DECK_DISCOVERY_PROGRESS',
                stepId: 'results_ready',
                results: results.slice(0, 50)
            }).catch(() => { });
        }

        chrome.storage.local.remove(['current_discovery_competitor', 'discovery_status']);
        window.close();
    });

    chrome.runtime.onMessage.addListener((message) => {
        console.log('[OpinionDeck] Side Panel Received Message:', message);
        if (message.type === 'DEEP_FETCH_PROGRESS') {
            const progressArea = document.getElementById('extraction-progress');
            const progressText = document.getElementById('progress-text');
            if (progressArea) progressArea.style.display = 'block';
            if (progressText) progressText.innerText = `${message.count} comments collected`;
        }
        if (message.type === 'OPINION_DECK_DISCOVERY_PHASE_COMPLETE') {
            console.log('[OpinionDeck] Phase complete, showing results...');
            showDiscoveryStep('results');

            const titleEl = document.getElementById('phase-result-title');
            const descEl = document.getElementById('phase-result-desc');
            const resultList = document.getElementById('phase-results-list');
            const nextBtn = document.getElementById('next-phase-btn') as HTMLButtonElement;
            const finishBtn = document.getElementById('finish-discovery-btn') as HTMLButtonElement;

            if (titleEl) {
                if (message.phaseId === 'PHASE_1') titleEl.innerText = "Phase 1: Pain Points & Grievances";
                else if (message.phaseId === 'PHASE_2') titleEl.innerText = "Phase 2: Alternatives & Comparisons";
                else titleEl.innerText = "Phase 3: General Sentiment & Reviews";
            }

            if (descEl) {
                descEl.innerText = `Identified ${message.results?.length || 0} high-signal discussions. Review before proceeding.`;
            }

            if (resultList) {
                resultList.innerHTML = (message.results || []).slice(0, 5).map((r: any) => `
                    <div class="insight-item" style="padding: 8px; margin-bottom: 5px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                        <div style="font-size: 0.75rem; font-weight: 600; color: #fff;">${r.title.substring(0, 60)}${r.title.length > 60 ? '...' : ''}</div>
                        <div style="font-size: 0.65rem; color: #aaa;">r/${r.subreddit} • Score: ${r.score}</div>
                    </div>
                `).join('');
            }

            if (nextBtn) {
                if (message.nextPhaseId) {
                    nextBtn.style.display = 'block';
                    nextBtn.innerText = `Approve & Start ${message.nextPhaseId.replace('_', ' ')}`;
                    (nextBtn as any).dataset.nextPhaseId = message.nextPhaseId;
                    if (finishBtn) finishBtn.style.display = 'none';
                } else {
                    nextBtn.style.display = 'none';
                    if (finishBtn) {
                        finishBtn.style.display = 'block';
                        finishBtn.innerText = "Complete Research & Sync Dashboard";
                    }
                }
            }
        }

        if (message.type === 'OPINION_DECK_DISCOVERY_PROGRESS') {
            const subStatus = document.getElementById('discovery-sub-status');
            if (subStatus) {
                if (message.stepId === 'pains') subStatus.innerText = 'Analyzing recurring complaints...';
                else if (message.stepId === 'alts') subStatus.innerText = 'Identifying alternative tools...';
                else if (message.stepId === 'niche') subStatus.innerText = 'Scoping general sentiment...';
                else if (message.stepId === 'results_ready') subStatus.innerText = 'Finalizing report...';
            }
        }
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.current_discovery_competitor?.newValue) {
            console.log('[OpinionDeck] Competitor changed in storage:', changes.current_discovery_competitor.newValue);
            initDiscovery();
        }
    });

    chrome.storage.local.set({ 'discovery_sidepanel_open': true });
});
