/**
 * take-screenshots.mjs
 * Uses Puppeteer to capture docs screenshots from the running dev server.
 * Run AFTER `npm run dev` is up.
 *
 * Usage: node scripts/take-screenshots.mjs
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../marketing/public/docs');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'http://localhost:5173';
const EMAIL = process.env.SCREENSHOT_EMAIL || 'your@email.com';
const PASSWORD = process.env.SCREENSHOT_PASSWORD || 'yourpassword';

const VIEWPORT = { width: 1440, height: 900 };

// ─── helpers ─────────────────────────────────────────────────────────────────

async function shot(page, filename, opts = {}) {
    const file = path.join(OUT_DIR, filename);
    const clip = opts.clip ?? undefined;
    await page.screenshot({ path: file, clip, type: 'png' });
    console.log(`  ✓ ${filename}`);
}

async function wait(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function waitAndShot(page, filename, selector, opts = {}) {
    if (selector) {
        try {
            await page.waitForSelector(selector, { timeout: 15000 });
        } catch {
            console.warn(`  ⚠ selector not found: ${selector} — shooting anyway`);
        }
    }
    await wait(opts.delay ?? 800);
    await shot(page, filename, opts);
}

// ─── login ────────────────────────────────────────────────────────────────────

async function login(page) {
    console.log('\n→ Logging in…');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });

    // Page defaults to signup — switch to sign-in form
    const signInToggle = await page.$('button::-p-text(Sign In)');
    if (signInToggle) {
        await signInToggle.click();
        await wait(600);
    }

    await page.evaluate(() => {
        document.querySelectorAll('input[type="email"]').forEach(el => { el.value = ''; });
        document.querySelectorAll('input[type="password"]').forEach(el => { el.value = ''; });
    });
    await page.type('input[type="email"]', EMAIL, { delay: 40 });
    await page.type('input[type="password"]', PASSWORD, { delay: 40 });

    // Click whichever submit is visible and says Sign In / Login
    const submitBtn = await page.$('button[type="submit"]:not([style*="display: none"])');
    if (submitBtn) await submitBtn.click();

    // Wait until we leave /login
    await page.waitForFunction(
        () => !window.location.pathname.startsWith('/login'),
        { timeout: 25000 }
    );
    await wait(2500);
    console.log('  ✓ Logged in');
}

// ─── shots ────────────────────────────────────────────────────────────────────

async function shotSignup(page) {
    console.log('\n→ Signup form…');
    // Page defaults to signup form — just navigate and shoot
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
    await wait(1200);
    await waitAndShot(page, 'signup-form.png', 'input[type="email"]');
}

async function shotDashboard(page) {
    console.log('\n→ Dashboard overview…');
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await wait(2500);
    await shot(page, 'dashboard-overview.png');
}

async function shotDiscoverySearch(page) {
    console.log('\n→ Discovery Lab — empty search…');
    await page.goto(`${BASE}/discovery`, { waitUntil: 'networkidle2' });
    await wait(2000);
    // Type a query so the input is populated
    const input = await page.$('input[type="text"], textarea, [placeholder*="search" i], [placeholder*="idea" i], [placeholder*="competitor" i], [placeholder*="Enter" i]');
    if (input) {
        await input.click({ clickCount: 3 });
        await input.type('Calendly pain points', { delay: 40 });
    }
    await wait(600);
    await shot(page, 'discovery-search.png');
}

async function shotDiscoveryResults(page) {
    console.log('\n→ Discovery Lab — results (using history if available)…');
    await page.goto(`${BASE}/discovery`, { waitUntil: 'networkidle2' });
    await wait(1500);

    // Try to open history to get a past result fast
    const historyBtn = await page.$('button::-p-text(History), [aria-label="History"], .history-btn');
    if (historyBtn) {
        await historyBtn.click();
        await wait(800);
        // Click first history item
        const firstItem = await page.$('.history-item, .history-entry, [class*="history"] li:first-child');
        if (firstItem) {
            await firstItem.click();
            await wait(2500);
        }
    } else {
        // Fallback: submit a quick search and wait
        const input = await page.$('input[type="text"], textarea, [placeholder*="search" i], [placeholder*="idea" i], [placeholder*="competitor" i], [placeholder*="Enter" i]');
        const submitBtn = await page.$('button[type="submit"], button::-p-text(Search), button::-p-text(Discover)');
        if (input && submitBtn) {
            await input.click({ clickCount: 3 });
            await input.type('Calendly', { delay: 40 });
            await submitBtn.click();
            await page.waitForSelector('.result-card, [class*="result"], [class*="thread"], [class*="post"]', { timeout: 30000 });
            await wait(1000);
        }
    }
    await shot(page, 'discovery-results.png');
}

async function shotMonitoringDashboard(page) {
    console.log('\n→ Monitoring Dashboard…');
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await wait(2500);
    // The monitoring view is likely on the home / main dashboard
    // Try clicking Monitoring in sidebar if exists
    const monitorLink = await page.$('a[href*="monitor"], [data-nav="monitor"], nav a::-p-text(Monitor)');
    if (monitorLink) {
        await monitorLink.click();
        await wait(1500);
    }
    await shot(page, 'monitoring-dashboard.png');
}

async function shotFoldersList(page) {
    console.log('\n→ Folders / Decks list…');
    await page.goto(`${BASE}/decks`, { waitUntil: 'networkidle2' });
    await wait(2000);
    await shot(page, 'folders-view.png');
}

async function shotFolderDetail(page) {
    console.log('\n→ Folder detail — finding first deck…');
    await page.goto(`${BASE}/decks`, { waitUntil: 'networkidle2' });
    await wait(1500);

    // Click on first deck/folder
    const deckLink = await page.$('a[href*="/folders/"], .folder-card a, [class*="folder"] a, [class*="deck"] a');
    if (deckLink) {
        const href = await page.evaluate(el => el.href, deckLink);
        await page.goto(href, { waitUntil: 'networkidle2' });
        await wait(2000);
        await shot(page, 'pain-map.png');

        // Try tabs: Inbox, Strategy, Configs
        const tabs = await page.$$('[role="tab"], .tab-btn, [class*="tab-"]');
        for (const tab of tabs) {
            const text = await page.evaluate(el => el.textContent?.trim(), tab);
            if (text?.toLowerCase().includes('inbox')) {
                await tab.click(); await wait(1200);
                await shot(page, 'inbox-tab.png');
            } else if (text?.toLowerCase().includes('strategy') || text?.toLowerCase().includes('report')) {
                await tab.click(); await wait(1200);
                await shot(page, 'strategy-tab.png');
            } else if (text?.toLowerCase().includes('config') || text?.toLowerCase().includes('setting')) {
                await tab.click(); await wait(1200);
                await shot(page, 'configs-tab.png');
            }
        }
    } else {
        console.warn('  ⚠ No deck found — skipping folder detail shots');
    }
}

async function shotLeadsFeed(page) {
    console.log('\n→ Leads feed…');
    await page.goto(`${BASE}/leads`, { waitUntil: 'networkidle2' });
    await wait(2000);
    await shot(page, 'leads-feed.png');
}

// ─── main ─────────────────────────────────────────────────────────────────────

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    // Suppress console noise from the app
    page.on('pageerror', () => {});
    page.on('console', msg => {
        if (msg.type() === 'error') return;
    });

    try {
        // 1. Signup form (before login)
        await shotSignup(page);

        // 2. Login
        await login(page);

        // 3. Dashboard overview
        await shotDashboard(page);

        // 4. Discovery Lab — search state
        await shotDiscoverySearch(page);

        // 5. Discovery Lab — results
        await shotDiscoveryResults(page);

        // 6. Monitoring dashboard
        await shotMonitoringDashboard(page);

        // 7. Folders list
        await shotFoldersList(page);

        // 8. Folder detail + tabs (pain map, inbox, strategy, configs)
        await shotFolderDetail(page);

        // 9. Leads feed
        await shotLeadsFeed(page);

    } catch (err) {
        console.error('\n✗ Error:', err.message);
        await page.screenshot({ path: path.join(OUT_DIR, '_error.png') });
    } finally {
        await browser.close();
        console.log(`\nDone. Screenshots in: ${OUT_DIR}\n`);
    }
})();
