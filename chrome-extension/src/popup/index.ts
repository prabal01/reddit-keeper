/// <reference types="chrome"/>
import { ExtractedData } from '../types';

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
        if (extractionSection) extractionSection.style.display = 'block'; // Keep visible for "Copy"
        if (historySection) historySection.style.display = 'none';
        cloudBtns.forEach(btn => { if (btn) btn.disabled = true; });
        return null;
    } else {
        if (loginSection) loginSection.style.display = 'none';
        if (extractionSection) extractionSection.style.display = 'block';
        if (historySection) historySection.style.display = 'block';
        // Buttons will be enabled by detectPage if supported
        return token;
    }
}

async function updateHistory() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    const token = await checkAuth();
    if (!token) return;

    // Fetch from Server instead of Local DB
    try {
        const response = await fetch('https://opinion-deck.onrender.com/api/extractions', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch from dashboard');

        const extractions: ExtractedData[] = await response.json();
        const displayList = extractions.slice(0, 5); // Limit to top 5

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
          <a href="https://app.opiniondeck.com" target="_blank" style="color: #6366f1; font-size: 0.75rem; text-decoration: none; font-weight: 500;">View All in Dashboard →</a>
        </div>
      ` : '') || '<p style="font-size: 0.7rem; color: #666;">No extractions yet.</p>';

        // Add click listener for navigation
        historyList.addEventListener('click', (e) => {
            const item = (e.target as HTMLElement).closest('.insight-item-wrapper') as HTMLElement;
            if (item) {
                const folderId = item.dataset.folderId;
                const threadId = item.dataset.id;
                const url = `https://app.opiniondeck.com/folders/${folderId}/threads/${threadId}`;
                chrome.tabs.create({ url });
            }
        });
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
        const response = await fetch('https://opinion-deck.onrender.com/api/folders', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return;

        const folders = await response.json();
        if (folders.length > 0) {
            select.innerHTML = folders.map((f: any) => `
                <option value="${f.id}">${f.name}</option>
            `).join('') + '<option value="default">Default Inbox</option>';
        }
    } catch (err) {
        console.error('Failed to fetch folders');
    }
}

function detectPage(url: string) {
    const statusEl = document.getElementById('page-status');
    const saveOnlyBtn = document.getElementById('extract-only-btn') as HTMLButtonElement | null;
    const saveAnalyseBtn = document.getElementById('extract-analyse-btn') as HTMLButtonElement | null;
    const copyGptBtn = document.getElementById('copy-gpt-btn') as HTMLButtonElement | null;
    const previewArea = document.getElementById('snapshot-preview');

    const isSupported = (url.includes('reddit.com/r/') && url.includes('/comments/')) ||
        (url.includes('g2.com/products/') && url.includes('/reviews')) ||
        (url.includes('news.ycombinator.com/item')) ||
        (url.includes('x.com') && url.includes('/status/')) ||
        (url.includes('twitter.com') && url.includes('/status/'));

    if (isSupported) {
        if (statusEl) {
            if (url.includes('reddit')) statusEl.innerText = 'Reddit Thread Detected';
            else if (url.includes('g2.com')) statusEl.innerText = 'G2 Product Detected';
            else if (url.includes('news.ycombinator.com')) statusEl.innerText = 'HackerNews Thread Detected';
            else if (url.includes('x.com') || url.includes('twitter.com')) statusEl.innerText = 'Twitter/X Thread Detected';
            statusEl.classList.add('status-active');
        }

        // Always enable copy button for supported pages
        if (copyGptBtn) copyGptBtn.disabled = false;

        chrome.storage.local.get('opinion_deck_token').then(record => {
            if (record.opinion_deck_token) {
                if (saveOnlyBtn) saveOnlyBtn.disabled = false;
                if (saveAnalyseBtn) saveAnalyseBtn.disabled = false;
            }
        });

        if (url.includes('reddit')) return 'reddit';
        if (url.includes('g2.com')) return 'g2';
        if (url.includes('news.ycombinator.com')) return 'hn';
        if (url.includes('x.com') || url.includes('twitter.com')) return 'twitter';
        return 'supported';
    } else {
        if (statusEl) {
            statusEl.innerText = 'Unsupported Page';
            statusEl.classList.remove('status-active');
        }
        if (saveOnlyBtn) saveOnlyBtn.disabled = true;
        if (saveAnalyseBtn) saveAnalyseBtn.disabled = true;
        if (copyGptBtn) copyGptBtn.disabled = true;
        if (previewArea) previewArea.style.display = 'none';
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
    } catch (err) {
        console.warn('Could not prefetch metadata', err);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const saveOnlyBtn = document.getElementById('extract-only-btn') as HTMLButtonElement;
    const saveAnalyseBtn = document.getElementById('extract-analyse-btn') as HTMLButtonElement;
    const statusEl = document.getElementById('page-status');
    const errorEl = document.getElementById('error-message');

    // Folder Creation Logic
    const addFolderToggle = document.getElementById('add-folder-toggle');
    const newFolderGroup = document.getElementById('new-folder-input-group');
    const createFolderBtn = document.getElementById('create-folder-btn');
    const newFolderNameInput = document.getElementById('new-folder-name') as HTMLInputElement;

    addFolderToggle?.addEventListener('click', () => {
        newFolderGroup!.style.display = newFolderGroup!.style.display === 'none' ? 'flex' : 'none';
        if (newFolderGroup!.style.display === 'flex') newFolderNameInput.focus();
    });

    createFolderBtn?.addEventListener('click', async () => {
        const name = newFolderNameInput.value.trim();
        if (!name) return;

        const token = await checkAuth();
        if (!token) return;

        createFolderBtn.innerText = '...';
        try {
            const response = await fetch('https://opinion-deck.onrender.com/api/folders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name })
            });
            if (response.ok) {
                const newFolder = await response.json();
                await fetchFolders();
                (document.getElementById('folder-select') as HTMLSelectElement).value = newFolder.id;
                newFolderGroup!.style.display = 'none';
                newFolderNameInput.value = '';
            }
        } catch (err) {
            console.error('Failed to create folder');
        } finally {
            createFolderBtn.innerText = 'Create';
        }
    });

    // Initial State - Detect page
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
        const type = detectPage(tab.url);
        if (type && tab.id) {
            prefetchMetadata(tab.id);
        }
    }

    await checkAuth(); // Ensure visibility is set immediately
    await fetchFolders();
    await updateHistory();

    document.getElementById('login-btn')?.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://app.opiniondeck.com' });
    });

    const performSave = async (shouldRedirect: boolean) => {
        const activeBtn = shouldRedirect ? saveAnalyseBtn : saveOnlyBtn;
        const originalText = activeBtn.innerText;

        saveOnlyBtn.disabled = true;
        saveAnalyseBtn.disabled = true;
        activeBtn.innerText = 'Saving...';
        if (errorEl) errorEl.style.display = 'none';

        try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!activeTab.id) throw new Error('No active tab');

            const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'EXTRACT_DATA' });

            if (response && response.data) {
                const folderId = (document.getElementById('folder-select') as HTMLSelectElement)?.value;

                const extractionData = {
                    ...response.data,
                    folderId: folderId === 'default' ? undefined : folderId,
                    shouldAnalyze: shouldRedirect // Auto-trigger analysis if redirecting
                };

                const saveResponse = await chrome.runtime.sendMessage({
                    action: 'SAVE_EXTRACTION',
                    data: extractionData
                });

                if (saveResponse.status === 'success') {
                    if (statusEl) statusEl.innerText = 'Saved to Cloud!';
                    await updateHistory();

                    if (shouldRedirect) {
                        // Redirect to the deep-linked thread view
                        const fid = folderId === 'default' ? 'inbox' : folderId;
                        const dashboardUrl = `https://app.opiniondeck.com/folders/${fid}/threads/${response.data.id}`;
                        chrome.tabs.create({ url: dashboardUrl });
                    }
                } else {
                    throw new Error(saveResponse.error || 'Server rejected extraction');
                }
            } else {
                throw new Error('Extraction failed (Is the page loaded?)');
            }
        } catch (err: any) {
            if (errorEl) {
                errorEl.innerText = err.message;
                errorEl.style.display = 'block';
            }
        } finally {
            saveOnlyBtn.disabled = false;
            saveAnalyseBtn.disabled = false;
            activeBtn.innerText = originalText;
        }
    };

    saveOnlyBtn?.addEventListener('click', () => performSave(false));
    saveAnalyseBtn?.addEventListener('click', () => performSave(true));

    document.getElementById('copy-gpt-btn')?.addEventListener('click', async () => {
        const copyBtn = document.getElementById('copy-gpt-btn') as HTMLButtonElement;
        const originalText = copyBtn.innerText;
        copyBtn.innerText = 'Extracting...';

        try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!activeTab.id) throw new Error('No active tab');

            const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'EXTRACT_DATA' });
            if (response && response.data) {
                const data = response.data;
                const comments = data.content?.comments || data.comments || [];
                const md = `# ${data.title || 'Untitled'}\nSource: ${data.url}\n\n## Post\n${data.content?.post?.title || 'No Title'}\n\n## Insights\n${comments.map((c: any) => `### ${c.author || 'Anonymous'} (${c.score || 0})\n${c.body || ''}`).join('\n\n')}`;

                await navigator.clipboard.writeText(md);
                copyBtn.innerText = '📋 Copied to Clipboard!';
                copyBtn.style.color = '#fff';
                copyBtn.style.background = '#2ecc71';
                setTimeout(() => {
                    copyBtn.innerText = originalText;
                    copyBtn.style.color = '#2ecc71';
                    copyBtn.style.background = 'rgba(46, 204, 113, 0.1)';
                }, 2000);
            }
        } catch (err: any) {
            if (errorEl) {
                errorEl.innerText = 'Copy failed: ' + err.message;
                errorEl.style.display = 'block';
            }
        } finally {
            if (copyBtn.innerText === 'Extracting...') copyBtn.innerText = originalText;
        }
    });
});
