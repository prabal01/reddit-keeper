import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { usageGuard } from '../middleware/usageGuard.js';
import { DiscoveryOrchestrator } from './orchestrator.js';
import { analyzeDiscoveryBatch } from '../ai.js';
import {
    createFolder, getDb,
    getDiscoveryHistory, deleteDiscoveryHistory, saveDiscoveryHistory,
    incrementDiscoveryCount
} from '../firestore.js';
import { logger } from '../utils/logger.js';
import { USER_AGENT } from '../config.js';

const router = Router();
const orchestrator = new DiscoveryOrchestrator();

// Helper to scrape and extract niche
async function getProposeIntelligence(query: string) {
    let activeQuery = query;
    let isUrl = false;
    let websiteNiche: any = null;

    // Simple URL Detection
    if (query.startsWith('http://') || query.startsWith('https://') || query.includes('.com') || query.includes('.io') || query.includes('.ai')) {
        isUrl = true;
        try {
            logger.info({ action: 'SCRAPE_URL', url: query }, 'Fetching website content for niche extraction');
            const response = await fetch(query, {
                headers: { 'User-Agent': USER_AGENT }
            });
            const html = await response.text();
            
            const { extractNicheFromWebsite } = await import('../ai.js');
            websiteNiche = await extractNicheFromWebsite(query, html);
            return {
                isUrl: true,
                niche: websiteNiche.niche,
                description: websiteNiche.description,
                suggested_keywords: websiteNiche.suggested_keywords || [query],
                target_audience: websiteNiche.target_audience
            };
        } catch (err) {
            logger.warn({ err, url: query }, 'Failed to scrape website, falling back to raw query');
        }
    }

    // If not URL or failed scraping, use Gemini for raw idea
    const { extractNicheFromWebsite } = await import('../ai.js');
    // We can reuse the same model logic but pass it as an 'idea' instead of HTML
    websiteNiche = await extractNicheFromWebsite(query, `User Idea: ${query}`);
    return {
        isUrl: false,
        niche: websiteNiche.niche,
        description: websiteNiche.description,
        suggested_keywords: websiteNiche.suggested_keywords || [query],
        target_audience: websiteNiche.target_audience
    };
}

router.post('/propose', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    try {
        const intel = await getProposeIntelligence(query);
        res.json(intel);
    } catch (err: unknown) {
        logger.error({ err, query }, 'Failed to generate proposal');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/start', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        const uid = req.user.uid;
        const { niche, suggested_keywords } = req.body; // Allow passing confirmed niche/keywords
        
        logger.info({ action: 'DISCOVERY_START', uid, query }, 'Starting immediate discovery fetch');

        let activeQuery = query;
        if (suggested_keywords && suggested_keywords.length > 0) {
            // Use the most relevant keywords for the initial Reddit search
            activeQuery = suggested_keywords.slice(0, 3).join(' OR ');
        }

        const plan = req.user.plan === 'past_due' ? 'free' : req.user.plan;
        const discoveryResp = await orchestrator.ideaDiscovery(uid, activeQuery, [], [], false, plan);
        const topResults = discoveryResp.results.slice(0, 30); // limit to top 30 to not overwhelm LLM
        
        // 2. Map to format needed by AI
        const threadBatch = topResults.map(r => ({
            id: typeof r.id === 'string' ? r.id : r.url,
            title: r.title,
            text: r.url // Sending URL or snippet. Ideally we'd send full text, but snippets/URLs give enough context for a fast MVP initial pass. 
        }));

        // 3. AI Processing
        const insights = await analyzeDiscoveryBatch(query, threadBatch);

        // 4. Create Folder & save data
        const isUrl = query.startsWith('http') || query.includes('.com') || query.includes('.io') || query.includes('.ai');
        const folder = await createFolder(uid, query, "Monitoring Job", isUrl ? query : undefined);
        
        // 4.1 Update folder to mark as active monitoring
        const db = getDb();
        if (db) {
            await db.collection("folders").doc(folder.id).update({
                is_monitoring_active: true,
                seed_keywords: suggested_keywords || [query],
                niche: niche || "User Generated",
                threadCount: insights.opportunities?.length || 0,
                source_url: isUrl ? query : undefined
            });

            const batch = db.batch();
            
            // 4.2 Save Patterns
            if (insights.patterns && Array.isArray(insights.patterns)) {
                insights.patterns.forEach((pattern: any) => {
                    const patternRef = db.collection("folders").doc(folder.id).collection("patterns").doc();
                    batch.set(patternRef, {
                        ...pattern,
                        id: patternRef.id,
                        folderId: folder.id,
                        createdAt: new Date().toISOString()
                    });
                });
            }

            // 4.3 Save Opportunities (Leads)
            if (insights.opportunities && Array.isArray(insights.opportunities)) {
                insights.opportunities.forEach((opp: any) => {
                    // Match with original thread to get url/title
                    const originalThread = topResults.find(r => (typeof r.id === 'string' ? r.id : r.url) === opp.thread_id);
                    const leadId = db.collection("folders").doc(folder.id).collection("leads").doc().id;
                    const leadData = {
                        ...opp,
                        id: leadId,
                        folderId: folder.id,
                        uid,
                        status: "new",
                        saved_at: new Date().toISOString(),
                        thread_url: originalThread?.url || opp.thread_id,
                        thread_title: originalThread?.title || "Unknown Thread"
                    };
                    
                    const leadRef = db.collection("folders").doc(folder.id).collection("leads").doc(leadId);
                    batch.set(leadRef, leadData);
                });
            }
            
            await batch.commit();
        }

        res.json({ success: true, folderId: folder.id, patterns: insights.patterns, opportunities: insights.opportunities });
    } catch (err: unknown) {
        logger.error({ err, query }, 'Failed to run discovery start');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Search & Idea Discovery ────────────────────────────────────────

router.post('/compare', authMiddleware, usageGuard('DISCOVERY'), async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Authentication required' });
    const { query } = req.body;
    if (!query) return void res.status(400).json({ error: 'Query is required' });
    try {
        const baseline = await orchestrator.search(req.user.uid, query, 'all', false, true);
        const enhanced = await orchestrator.search(req.user.uid, query, 'all', true, true);
        await incrementDiscoveryCount(req.user.uid);
        res.json({ baseline: baseline.results, enhanced: enhanced.results });
    } catch (err: unknown) {
        logger.error({ err, query }, 'Discovery compare failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/search', authMiddleware, usageGuard('DISCOVERY'), async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Authentication required' });
    const { query, platform = 'all' } = req.body;
    if (!query) return void res.status(400).json({ error: 'Query is required' });
    try {
        const platforms: ('reddit' | 'hn')[] | 'all' = platform === 'all' ? 'all' : [platform as 'reddit' | 'hn'];
        const plan = req.user.plan === 'past_due' ? 'free' : req.user.plan;
        const { results, discoveryPlan } = await orchestrator.search(req.user.uid, query, platforms, false, false, plan);
        await incrementDiscoveryCount(req.user.uid);
        res.json({ results, discoveryPlan });
    } catch (err: unknown) {
        logger.error({ err, query }, 'Discovery search failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/idea', authMiddleware, usageGuard('DISCOVERY'), async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Authentication required' });
    const { idea, communities, competitors, skipCache = false } = req.body;
    if (!idea) return void res.status(400).json({ error: 'Idea is required' });
    try {
        const plan = req.user.plan === 'past_due' ? 'free' : req.user.plan;
        const { results, discoveryPlan } = await orchestrator.ideaDiscovery(req.user.uid, idea, communities, competitors, skipCache, plan);
        await incrementDiscoveryCount(req.user.uid);
        res.json({ results, discoveryPlan });
    } catch (err: unknown) {
        logger.error({ err, idea }, 'Discovery idea search failed');
        res.status(500).json({ error: 'Discovery failed' });
    }
});

// ── Metadata Enrichment ────────────────────────────────────────────

router.post('/metadata', authMiddleware, usageGuard('DISCOVERY'), async (req: Request, res: Response) => {
    const { url, urls } = req.body;
    const urlList = urls || (url ? [url] : []);
    if (urlList.length === 0) return void res.status(400).json({ error: 'URLs are required' });
    try {
        const results = await Promise.all(urlList.map(async (targetUrl: string) => {
            const detectedSource = targetUrl.includes('news.ycombinator.com') ? 'hn' : 'reddit';
            try {
                const fullData = await orchestrator.fetchFullThread(targetUrl, detectedSource);
                if (!fullData?.post) return null;
                return {
                    id: Buffer.from(targetUrl).toString('base64'),
                    title: fullData.post.title || 'Unknown Title',
                    author: fullData.post.author || 'unknown',
                    subreddit: fullData.post.subreddit || (detectedSource === 'hn' ? 'Hacker News' : 'unknown'),
                    num_comments: fullData.post.num_comments || 0,
                    created_utc: fullData.post.created_utc || Math.floor(Date.now() / 1000),
                    url: targetUrl, source: detectedSource, score: 0, isCached: true
                };
            } catch (err) {
                logger.warn({ err, url: targetUrl }, 'Failed to enrich metadata');
                return null;
            }
        }));
        const validResults = results.filter(Boolean);
        if (validResults.length > 0 && req.user) {
            await saveDiscoveryHistory(req.user.uid, {
                type: 'bulk', query: urlList.join('\n'),
                params: { platforms: ['reddit', 'hn'] },
                resultsCount: validResults.length,
                topResults: validResults.slice(0, 5).map(r => ({ title: r!.title, url: r!.url, source: r!.source as any, score: 0 }))
            }).catch(err => logger.error({ err }, 'Failed to save bulk discovery history'));
        }
        res.json({ results: validResults });
    } catch (err: unknown) {
        logger.error({ err }, 'Discovery metadata enrichment failed');
        res.status(500).json({ error: 'Failed to enrich metadata' });
    }
});

// ── Discovery History ──────────────────────────────────────────────

router.get('/history', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        const history = await getDiscoveryHistory(req.user.uid);
        res.json(history);
    } catch (err: unknown) {
        logger.error({ err }, 'GET /api/discovery/history failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/history/:id', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        await deleteDiscoveryHistory(req.user.uid, req.params.id as string);
        res.json({ success: true });
    } catch (err: unknown) {
        logger.error({ err }, 'DELETE /api/discovery/history/:id failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/history/:id/results', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        const { getDiscoveryHistoryFull } = await import('../firestore.js');
        const entry = await getDiscoveryHistoryFull(req.user.uid, req.params.id as string);
        if (!entry) return void res.status(404).json({ error: 'History entry not found' });
        res.json({ savedResults: entry.savedResults || [], discoveryPlan: entry.discoveryPlan || null });
    } catch (err: unknown) {
        logger.error({ err }, 'GET /api/discovery/history/:id/results failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
