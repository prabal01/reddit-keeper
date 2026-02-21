
/**
 * REDDIT RELEVANCE R&D SCRIPT - ITERATION 5.4
 * 
 * Focus: 
 * 1. Broad Discovery (Add non-title, non-operator queries for niche recovery)
 * 2. Calibrated Density Penalty (Targeting mega-threads, sparing self-posts)
 * 3. Softened Mandatory Signals (Recover passing mentions in high-quality subs)
 */

const competitor = process.argv[2] || 'slack';
const compLower = competitor.toLowerCase();

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runRD() {
    console.log(`\n🚀 Starting R&D Iteration 5.4 for: ${competitor}`);
    console.log(`-----------------------------------`);

    const queries = [
        `title:${competitor} + frustrated`,
        `title:${competitor} + alternative`,
        `title:${competitor} + vs`,
        `title:${competitor} + review`,
        `title:${competitor} + sucks`,
        `"${competitor}" + annoying`,
        `"${competitor}" + problems`,
        `"${competitor}" + billing`,
        `"${competitor}" + support`,
        // BROAD FALLBACKS (Crucial for Niche brands)
        `"${competitor}" alternative`,
        `"${competitor}" suck`,
        `"${competitor}" annoying`,
        `"${competitor}" review`,
        `"${competitor}"` // Pure name search in quality subs
    ];

    const allResultsMap = new Map<string, any>();
    const now = Date.now() / 1000;
    const TWELVE_MONTHS = 12 * 30 * 24 * 60 * 60;

    for (const query of queries) {
        console.log(`\n🔍 Searching: ${query}...`);
        const queryResults: any[] = [];
        try {
            const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&t=year&limit=100`;
            const res = await fetch(searchUrl, {
                headers: { 'User-Agent': 'OpinionDeck-RD/4.0.0' }
            });

            if (!res.ok) continue;
            const data: any = await res.json();
            const children = data.data?.children || [];

            children.forEach((child: any) => {
                const post = child.data;
                const title = (post.title || '').toLowerCase();
                const text = (post.selftext || '').toLowerCase();
                const combined = title + " " + text;
                const subredditLower = (post.subreddit || '').toLowerCase();

                // 1. HARD FILTER: Competitor Presence (More Strict)
                // Try word boundary first, then fall back to simple inclusion for short/niche names
                const compRegex = new RegExp(`\\b${compLower}\\b`, 'i');
                let inTitle = compRegex.test(title);
                let inBody = compRegex.test(text);

                if (!inTitle && !inBody) {
                    // Fallback for Gumlet-like niche names that might be in URLs or weirdly formatted
                    const contains = title.includes(compLower) || text.includes(compLower);
                    if (contains) {
                        inTitle = title.includes(compLower);
                        inBody = text.includes(compLower);
                    } else {
                        return;
                    }
                }

                // 2. HARD FILTER: Idiom & Promo Killers (Cleaned)
                const forbiddenPhrases = [
                    'affiliate program', 'highest paying', 'join my', 'referral link',
                    'sign up for', 'free money', 'make money', 'passive income',
                    'giveaway', 'win a free'
                ];
                // Add Slack specific killers only if testing Slack
                if (compLower === 'slack') {
                    forbiddenPhrases.push('cut slack', 'slack on', 'slack off', 'slack in my');
                }
                if (forbiddenPhrases.some(p => combined.includes(p))) return;

                // 3. HARD FILTER: Subreddit Blacklist (Expanded)
                const qualitySubs = ['saas', 'productivity', 'startups', 'sysadmin', 'productmanagement', 'entrepreneur', 'webdev', 'experienceddevs', 'softwareengineering', 'devops', 'csccareerquestions', 'technology', 'salesforce', 'projectmanagement', 'video', 'videoproduction', 'filmmakers'];
                const noiseSubs = [
                    'tifu', 'amitheasshole', 'kpop', 'wellthatsucks', 'bestofredditorupdates',
                    'aitah', 'relationship_advice', 'interestingasfuck', 'mildlyinfuriating',
                    'recruitinghell', 'superstonk', 'eagles', 'jewish', 'nvidia', 'askreddit',
                    'pics', 'funny', 'gaming', 'movies', 'politics', 'news', 'worldnews',
                    'todayilearned', 'showerthoughts', 'aww', 'dustythunder', 'twoxchromosomes',
                    'personalfinance', 'legaladvice', 'workplace', 'jobsearchhacks', 'hvac', 'construction',
                    'amioverreacting', 'motorbuzz', 'advice', 'trueoffmychest', 'rezero', 'anime', 'manga',
                    'sidehustle', 'affiliatemarketing', 'beermoney', 'signupsforpay', 'pennystocks'
                ];
                if (noiseSubs.includes(subredditLower)) return;

                // --- SCORING ENGINE ---
                let score = 0;
                let logs: string[] = [];

                // A. QUALITY SIGNALS (Generic & Category Aware)
                const productKeywords = [
                    'app', 'software', 'tool', 'saas', 'dashboard', 'feature', 'interface',
                    'integration', 'ui', 'ux', 'performance', 'slow', 'workflow',
                    'subscription', 'pricing', 'desktop', 'mobile', 'api', 'billing', 'cost',
                    'support', 'customer service', 'account', 'settings', 'sync',
                    'platform', 'service', 'storage', 'data', 'user'
                ];
                const intentKeywords = [
                    'annoying', 'frustrating', 'frustrated', 'sucks', 'hate', 'broken', 'break',
                    'slow', 'expensive', 'switching', 'moved to', 'anyone else', 'problems',
                    'bug', 'issue', 'error', 'glitch', 'failed', 'failing', 'trouble',
                    'overrated', 'alternatives', 'comparison', 'vs', 'recommend'
                ];

                const contextMatches = productKeywords.filter(k => combined.includes(k));
                const intentMatches = intentKeywords.filter(k => combined.includes(k));

                // B. MANDATORY SIGNAL FOR NON-TARGET SUBS
                const isTargetSub = subredditLower === compLower || qualitySubs.includes(subredditLower);
                if (!isTargetSub) {
                    const hasIntent = intentMatches.length > 0;
                    const hasContext = contextMatches.length > 0;

                    if (inTitle) {
                        // In Title: Accept if ANY keyword matches
                        if (!hasIntent && !hasContext) return;
                    } else {
                        // In Body: Require 1 Intent OR 2 Context
                        if (!hasIntent && contextMatches.length < 2) return;
                    }
                }

                // C. BASE SCORING
                if (subredditLower === compLower) {
                    score += 20000;
                    logs.push(`Exact Sub: +20000`);
                } else if (qualitySubs.includes(subredditLower)) {
                    score += 10000;
                    logs.push(`Quality Sub: +10000`);
                }

                let keywordScore = 0;
                // Cap matches to prevent mega-threads from winning by sheer volume
                const cappedIntent = Math.min(intentMatches.length, 5);
                const cappedContext = Math.min(contextMatches.length, 5);

                let intentVal = cappedIntent * 2000; // Increased from 1500
                let contextVal = cappedContext * 500;

                // Title Primacy: Keywords are worth more if the brand is in the title
                if (!inTitle) {
                    intentVal *= 0.5;
                    contextVal *= 0.5;
                    logs.push(`BodyWeight: 0.5x`);
                }

                keywordScore += intentVal;
                keywordScore += contextVal;
                score += keywordScore;

                if (intentMatches.length > 0) logs.push(`Intent (${cappedIntent}/${intentMatches.length}): +${intentVal}`);
                if (contextMatches.length > 0) logs.push(`Context (${cappedContext}/${contextMatches.length}): +${contextVal}`);

                // NEGATIVE SIGNALS: Listicle & Promo Detection
                const listicleMarkers = [
                    'list of', 'collection of', 'top 10', 'top 5', 'top 20', 'best way to',
                    'highest paying', 'make $', 'how to earn', 'deals', 'giveaway', '247'
                ];
                if (listicleMarkers.some(m => title.includes(m))) {
                    score -= 15000;
                    logs.push(`ListiclePenalty: -15000`);
                }

                if (inTitle) {
                    score += 10000;
                    logs.push(`Title: +10000`);

                    const startsWithBrand = title.startsWith(compLower) || title.startsWith(`"${compLower}"`);
                    if (startsWithBrand || title.includes(` ${compLower} `)) {
                        score += 10000;
                        logs.push(`SubjectMatch: +10000`);
                    }
                }

                // Density Penalty for Mega-threads (Calibrated)
                const compCount = combined.split(compLower).length - 1;
                // Only penalize if it's very long AND brand frequency is low AND it's not in title
                if (combined.length > 3000 && compCount < 3 && !inTitle) {
                    score -= 5000;
                    logs.push(`DensityPenalty: -5000`);
                }

                // D. ENGAGEMENT CAPPING
                // We use comments but cap them so viral posts don't win on volume alone
                const engagementScore = Math.min(post.num_comments, 200) * 20;
                score += engagementScore;
                logs.push(`Engagement (Capped): +${engagementScore}`);

                // E. RECENCY
                const ageDays = (now - post.created_utc) / 86400;
                if (ageDays < 30) {
                    score += 5000;
                    logs.push(`Fresh (30d): +5000`);
                } else if (ageDays < 90) {
                    score += 2000;
                    logs.push(`Recent (90d): +2000`);
                }

                const result = {
                    id: post.id,
                    title: post.title,
                    subreddit: post.subreddit,
                    ups: post.ups,
                    comments: post.num_comments,
                    score,
                    logs: logs.join(' | ')
                };

                queryResults.push(result);

                // Track globally too
                if (!allResultsMap.has(post.id) || allResultsMap.get(post.id).score < score) {
                    allResultsMap.set(post.id, result);
                }
            });

            // Log top 10 for this specific query
            const topForQuery = queryResults
                .sort((a, b) => b.score - a.score)
                .slice(0, 10);

            if (topForQuery.length > 0) {
                console.log(`   ✨ Top 10 for this query:`);
                topForQuery.forEach((p, i) => {
                    console.log(`   ${i + 1}. [${p.score}] r/${p.subreddit} | ${p.title}`);
                });
            } else {
                console.log(`   ⚠️ No quality results found for this query.`);
            }

            await delay(1000);
        } catch (err) {
            await delay(2000);
        }
    }

    const sorted = Array.from(allResultsMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);

    console.log(`\n🏆 TOP 30 RESULTS (ITERATION 5.4):`);
    console.log(`===================================`);
    sorted.forEach((p, i) => {
        console.log(`${i + 1}. [${p.score.toString().padStart(6)}] r/${p.subreddit.padEnd(15)} | ${p.title}`);
        console.log(`   💡 ${p.logs}`);
        console.log(`---`);
    });
}

runRD();
