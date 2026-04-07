# OpinionDeck — Reddit Data Acquisition Plan
> Technical brief for Claude Code. Covers the full data strategy for OpinionDeck's Reddit monitoring pipeline — from MVP to production. Read this entire document before writing any data fetching code.

---

## 1. Product Context

OpinionDeck is a Reddit monitoring and lead discovery platform with these core features:

- **Keyword/URL/Competitor monitoring** across Reddit
- **AI-powered pattern detection** (Gemini) — clusters recurring complaints and themes
- **Opportunity scoring & lightweight CRM** — identifies high-intent threads ("Leads") and manages follow-ups
- **Automated background monitoring** — cron-based queue workers, alerts/digests
- **Multi-mode discovery workbench** — surfaces both patterns and actionable threads

---

## 2. The Core Problem

Reddit data is needed at scale, but:

- **Reddit's official API** is too expensive ($0.24/1,000 requests) and requires approval
- **RSS feeds and JSON endpoints** are blocked by Reddit for all datacenter IPs (GCP, AWS, Azure, etc.)
- **Residential proxies** work but are expensive at high volume
- **SERP APIs** (JustSERP etc.) work but cost money per query
- **SearXNG self-hosted** gets blocked immediately — GCP IPs get CAPTCHA'd by Google instantly

---

## 3. The Overall Strategy — 4 Layers

```
Layer 1 → Arctic Shift + PullPush   (free, historical, never blocked)
Layer 2 → SERP APIs                 (thread discovery, free tiers first)
Layer 3 → Residential Proxies       (live data only, minimize GB)
Layer 4 → Cache Everything          (Firestore on GCP, never hit any source twice)
```

**The golden rule**: Every request must pass through cache first. If cached → serve it. If not → go Layer 1, then Layer 2, then Layer 3 in that strict order.

---

## 4. Layer 1: Arctic Shift + PullPush (Co-Primary, Mutual Fallbacks)

> Both are used **together** as co-primary historical sources. Both are single-developer projects and go down periodically. When one is down, the other takes over automatically. Implement both from day one — neither is optional.

### 4a. Arctic Shift

**Base URL**: `https://arctic-shift.photon-reddit.com`

**Data freshness**: Latest dump is January 2026, released monthly, ~2-3 months behind current date. 2024 and 2025 fully covered with 2.5B items.

**Key endpoints**:
```
# Search posts by keyword within a subreddit
GET /api/posts/search?q=KEYWORD&subreddit=SUBREDDIT&limit=100&after=TIMESTAMP&before=TIMESTAMP

# Search comments
GET /api/comments/search?q=KEYWORD&subreddit=SUBREDDIT&limit=100

# Get post by ID
GET /api/posts/ids?ids=POST_ID1,POST_ID2

# Get comments tree for a post
GET /api/comments/tree?link_id=POST_ID

# Subreddit metadata
GET /api/subreddits/search?q=KEYWORD

# Time series — great for pattern frequency analysis
GET /api/posts/search/aggregate?q=KEYWORD&subreddit=SUBREDDIT&frequency=week
```

**Limitations**:
- No Reddit-wide full-text search — must specify a subreddit
- Rate limit: ~2,000 req/min soft limit — be respectful
- No SLA, one developer runs this

**Best for**: Historical pattern detection, onboarding new users with instant insights, competitor analysis, training Gemini clustering models.

---

### 4b. PullPush

**Base URL**: `https://api.pullpush.io`

**Data freshness**: Up to May 2025 — more stale than Arctic Shift but still valuable.

**Key advantage over Arctic Shift**: Supports **Reddit-wide full-text search** without specifying a subreddit.

**Key endpoints**:
```
GET https://api.pullpush.io/reddit/search/submission/?q=KEYWORD&size=100&after=TIMESTAMP

GET https://api.pullpush.io/reddit/search/comment/?q=KEYWORD&subreddit=SUBREDDIT&size=100
```

**Usage pattern**:
- Arctic Shift first (more recent data)
- Switch to PullPush when Arctic Shift is down OR for Reddit-wide FTS without a subreddit specified

---

## 5. Layer 2: SERP APIs for Thread Discovery

This layer discovers Reddit thread URLs via search engines — no Reddit IP blocking involved. Purpose is **URL discovery only**, not fetching thread content.

> **Critical rule**: Always try in strict priority order. Only move to the next level when current is exhausted or rate-limited. **JustSERP is always the last resort — never the default.**

### Priority Order — Enforce in Code

```
function discoverRedditThreads(keyword):

  STEP 0 → Check Firestore cache first
           Same keyword searched in last 24hrs → return cached results, STOP

  STEP 1 → Arctic Shift / PullPush
           Free, never blocked, no cost
           If results found → cache in Firestore, STOP

  STEP 2 → Google CSE (free: 100 queries/day → ~3,000/month)
           query: site:reddit.com + keyword
           Check quota counter in Firestore before calling
           If daily quota not exhausted → call, cache results, STOP

  STEP 3 → Brave Search API (~1,000 queries/month via $5 monthly credit)
           query: site:reddit.com + keyword
           Check monthly quota counter in Firestore before calling
           If monthly credit not exhausted → call, cache results, STOP

  STEP 4 → JustSERP (paid — last resort only)
           Only call if ALL above steps are exhausted or returned nothing
           Log every call to serp_usage Firestore collection
           Check daily cap before calling — fail gracefully if cap hit
```

### Source Comparison

| Source | Cost | Free Limit | Gets Blocked? |
|---|---|---|---|
| Arctic Shift / PullPush | Free | ~Unlimited | Never |
| Google CSE | Free then $5/1K | 3,000/month | Never — official API |
| Brave Search API | $5 credit/month | ~1,000/month | Never — official API |
| JustSERP | Paid per query | None | Never |

### Google CSE Integration
```python
# Configure your Google CSE to only search site:reddit.com
params = {
    "key": GOOGLE_CSE_API_KEY,
    "cx": GOOGLE_CSE_ID,
    "q": f"{keyword} site:reddit.com",
    "num": 10,
    "sort": "date"
}
response = requests.get("https://www.googleapis.com/customsearch/v1", params=params)
```

### Brave Search API Integration
```python
headers = {
    "Accept": "application/json",
    "Accept-Encoding": "gzip",
    "X-Subscription-Token": BRAVE_API_KEY
}
params = {
    "q": f"site:reddit.com {keyword}",
    "count": 20,
    "freshness": "pw"    # past week
}
response = requests.get(
    "https://api.search.brave.com/res/v1/web/search",
    headers=headers, params=params
)
```

### JustSERP Hard Rules — Enforce in Code
- **Never call if Google CSE or Brave quota still available**
- **Always check Firestore cache before calling** — same keyword within 24hrs = serve cache, no call
- **Never call for background cron jobs** — only for user-triggered real-time searches
- **Log every call** to `serp_usage/{date}` Firestore document with keyword, timestamp, cost
- **Hard daily cap** via `JUSTSERP_DAILY_CAP` env var — return stale cache if cap hit, never exceed

---

## 6. Layer 3: Residential Proxies (Live Data Only)

Only use proxies for data newer than Arctic Shift's last dump (~2-3 months). This is the primary cost control lever.

### What Proxies Are Used For
- Fetching `/r/SUBREDDIT/new.json` for posts from the last 60 days
- Fetching full thread content for high-scored leads only
- URL-specific monitoring

### Recommended Provider
**FloppyData** — `$1/GB`, pay-as-you-go, traffic never expires, ~95% clean IP rate. No monthly commitment.

**Backup**: IPRoyal — similar pricing, also no expiry.

### Integration Pattern
```python
proxies = {
    "http": "socks5://user:pass@proxy.floppydata.io:PORT",
    "https": "socks5://user:pass@proxy.floppydata.io:PORT"
}
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}
response = requests.get(
    "https://www.reddit.com/r/startups/new.json?limit=100",
    proxies=proxies,
    headers=headers,
    timeout=10
)
```

### Proxy Cost Optimization Rules
1. **Cache check first** — never re-fetch a thread already in Firestore
2. **Arctic Shift check** — if post older than 60 days, never use proxy
3. **Title-first scoring** — fetch titles, score with Gemini on title only, full thread fetch only if score > 70
4. **Batch always** — `?limit=100`, never individual fetches
5. **Jitter requests** — 2-3 second delay + random jitter between requests

**Target**: under 5GB/month at MVP scale = ~$5/month.

---

## 7. Layer 4: Caching Strategy (GCP Stack)

> Cache is the single most important cost lever. Every GB not fetched via proxy = money saved. Every SERP query served from cache = JustSERP call avoided. Cache everything, aggressively.

### Recommended GCP Database Stack

All infrastructure is on GCP — use native GCP services only, no external DBs needed.

#### Primary Store: **Cloud Firestore**
- Fully managed, serverless, zero ops
- Perfect for document-style Reddit post storage and cache
- **Free tier**: 1GB storage, 50K reads/day, 20K writes/day — covers MVP entirely at zero cost
- Use for: post cache, search result cache, lead/CRM data, quota counters, SERP usage logs

#### Cache Layer: **Cloud Memorystore (Redis)** — Add Later
- Managed Redis on GCP, ~$35/month for 1GB
- Use for: sub-second quota counter checks, rate limiting, hot search result caching
- **Skip for MVP** — Firestore TTL fields are sufficient at early scale. Add Memorystore when you have paying users and need sub-millisecond cache reads.

#### Analytics: **BigQuery** — Future Option
- Use for running Gemini pattern clustering across large historical Arctic Shift datasets
- Pay-per-query, cheap for batch analysis
- Not needed for MVP

### Firestore Collection Structure
```
/posts/{post_id}
    content, title, subreddit, score, fetched_at, source, expires_at

/search_cache/{hash(keyword+subreddit)}
    results[], keyword, subreddit, fetched_at, expires_at, source_used

/leads/{user_id}/{lead_id}
    post_id, score, keyword, status, notes, created_at

/patterns/{user_id}/{pattern_id}
    theme, frequency, example_posts[], generated_at, expires_at

/quota_counters/google_cse/{YYYY-MM-DD}
    count, cap=90, resets_at=midnight_utc

/quota_counters/brave_api/{YYYY-MM}
    count, cap=900, resets_at=first_of_month_utc

/quota_counters/justserp/{YYYY-MM-DD}
    count, cap=JUSTSERP_DAILY_CAP

/serp_usage/{auto_id}
    source, keyword, timestamp, cost_estimate
```

### Cache TTL by Data Type

| Data Type | TTL | Reason |
|---|---|---|
| Reddit post content | 7 days | Posts don't change after 24hrs |
| SERP search results | 24 hours | New threads appear daily |
| Pattern clusters | 48 hours | Gemini analysis is expensive |
| Lead scores | 72 hours | Periodic rescore is fine |
| Subreddit metadata | 7 days | Rarely changes |
| Quota counters | Until reset period | Daily or monthly resets |

### Cache-First Code Pattern
```python
def get_reddit_threads(keyword, subreddit=None):

    # Step 0: Cache
    cache_key = hash(f"{keyword}:{subreddit}")
    cached = firestore.get(f"search_cache/{cache_key}")
    if cached and cached["expires_at"] > now():
        return cached["results"]                      # free, instant

    # Step 1: Arctic Shift
    results = arctic_shift.search(keyword, subreddit)
    if not results:
        results = pullpush.search(keyword, subreddit) # fallback
    if results:
        firestore.set(f"search_cache/{cache_key}", results, ttl="24h")
        return results

    # Step 2: Google CSE
    counter = firestore.get(f"quota_counters/google_cse/{today()}")
    if counter["count"] < counter["cap"]:
        results = google_cse.search(f"site:reddit.com {keyword}")
        firestore.increment(f"quota_counters/google_cse/{today()}")
        firestore.set(f"search_cache/{cache_key}", results, ttl="24h")
        return results

    # Step 3: Brave
    counter = firestore.get(f"quota_counters/brave_api/{this_month()}")
    if counter["count"] < counter["cap"]:
        results = brave.search(f"site:reddit.com {keyword}")
        firestore.increment(f"quota_counters/brave_api/{this_month()}")
        firestore.set(f"search_cache/{cache_key}", results, ttl="24h")
        return results

    # Step 4: JustSERP — last resort
    counter = firestore.get(f"quota_counters/justserp/{today()}")
    if counter["count"] < JUSTSERP_DAILY_CAP:
        results = justserp.search(keyword)
        firestore.increment(f"quota_counters/justserp/{today()}")
        firestore.add("serp_usage", {keyword, timestamp, cost})
        firestore.set(f"search_cache/{cache_key}", results, ttl="24h")
        return results

    # All exhausted — return stale cache if available
    return cached["results"] if cached else []
```

---

## 8. Complete Decision Logic

```
function getData(keyword, subreddit, dateRange):

  # Always cache-first
  if firestore_cache.has(keyword, subreddit, dateRange):
      return cache.get(...)

  # Historical (>60 days old)
  if dateRange.end < NOW - 60 days:
      Arctic Shift → PullPush fallback → stale cache fallback

  # Semi-recent (7–60 days old)
  elif dateRange.end < NOW - 7 days:
      Arctic Shift → PullPush → Proxy as last resort

  # Live (<7 days)
  else:
      Proxy → cache immediately

  # Thread URL discovery (SERP layer)
  cache → Arctic Shift → Google CSE → Brave → JustSERP (last resort)
```

---

## 9. Feature-to-Source Mapping

| Feature | Primary Source | Fallback | Notes |
|---|---|---|---|
| Pattern detection / clustering | Arctic Shift | PullPush | Historical is perfect |
| Recurring pain points | Arctic Shift | PullPush | 6-12 months data |
| Competitor research | Arctic Shift | PullPush + Proxy | Proxy for last 60 days only |
| Onboarding insights | Arctic Shift | Firestore cache | Pre-seed on signup |
| Keyword monitoring (cron) | Arctic Shift + Proxy | PullPush | Hybrid by date |
| Thread URL discovery | Google CSE → Brave → JustSERP | Firestore cache | SERP layer, strict order |
| Real-time lead alerts | Proxy | Firestore cache | ~5 min delay acceptable |
| CRM / saved leads | Firestore | — | Never re-fetch once saved |
| URL monitoring | Proxy | — | Direct URL fetch |
| Subreddit discovery | Arctic Shift | PullPush | Historical is fine |

---

## 10. Cron Job Architecture

```
Every 15 minutes:
  → Check Firestore cache for monitored subreddits
  → Proxy worker: fetch /new.json only for subreddits with no recent cache
  → Score titles with Gemini (title-only, cheap)
  → Posts scoring >70: fetch full thread via proxy
  → Store in Firestore, trigger alerts

Every 24 hours:
  → Arctic Shift worker: run pattern analysis on last 30 days
  → Update Gemini theme clusters
  → Generate digest emails
  → Reset Google CSE daily quota counter in Firestore

Every 1st of month:
  → Reset Brave API monthly quota counter in Firestore
  → Check if new Arctic Shift monthly dump is available
  → If yes: re-run competitor analysis on fresh data
```

---

## 11. Environment Variables

```env
# Proxy (Layer 3)
PROXY_HOST=proxy.floppydata.io
PROXY_PORT=PORT
PROXY_USER=username
PROXY_PASS=password

# Arctic Shift (Layer 1)
ARCTIC_SHIFT_BASE_URL=https://arctic-shift.photon-reddit.com
ARCTIC_SHIFT_RATE_LIMIT=30          # req/min — be conservative

# PullPush (Layer 1 fallback)
PULLPUSH_BASE_URL=https://api.pullpush.io

# SERP — strict priority order (Layer 2)
GOOGLE_CSE_API_KEY=your_key
GOOGLE_CSE_ID=your_cse_id
GOOGLE_CSE_DAILY_CAP=90             # buffer under 100 free limit
BRAVE_API_KEY=your_key
BRAVE_MONTHLY_CAP=900               # buffer under ~1000 credit limit
JUSTSERP_API_KEY=your_key
JUSTSERP_DAILY_CAP=50               # hard cap — adjust per budget

# GCP
GCP_PROJECT_ID=your_project_id
FIRESTORE_DB=opiniondeck

# AI
GEMINI_API_KEY=your_key

# Cache TTL (hours)
CACHE_TTL_POST=168                  # 7 days
CACHE_TTL_SEARCH=24
CACHE_TTL_PATTERN=48
LEAD_RESCORE_HOURS=72
```

---

## 12. MVP Scope vs V2

### MVP — Arctic Shift + free SERP tiers + Firestore cache
- Pattern detection and theme analysis ✅
- Historical competitor intelligence ✅
- Keyword search across subreddits ✅
- Instant insights on user onboarding ✅
- Thread discovery via Google CSE + Brave free tiers ✅
- Basic lead discovery (daily digest, not real-time) ✅
- Full caching via Firestore (free tier covers MVP) ✅

**Do NOT build in MVP:**
- Real-time "alerts within minutes" — needs live proxy pipeline, save for V2
- Slack/email push notifications — V2

### V2 — Add live proxy layer + Memorystore
- Real-time keyword monitoring, minute-level freshness
- Live lead scoring as posts publish
- Slack/email push notifications
- URL-specific live monitoring
- Cloud Memorystore (Redis) for sub-second cache

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Arctic Shift goes down | Auto-switch to PullPush; serve Firestore cache |
| PullPush also down | Serve stale Firestore cache; show "last updated X ago" in UI |
| Google CSE daily quota exhausted | Fall through to Brave, then JustSERP |
| Brave credit exhausted mid-month | Fall through to JustSERP; log alert |
| JustSERP daily cap hit | Return stale cache; show soft warning in UI |
| Proxy costs spike | Enforce title-first scoring; cap daily GB in config |
| Reddit blocks proxy IPs | Rotate FloppyData → IPRoyal |
| Firestore free tier hit | Upgrade to paid Firestore — still very cheap |

---

## 14. Self-Hosting Arctic Shift (Future Escape Hatch)

If Arctic Shift shuts down permanently, all data is available on:
- **Academic Torrents**: Full Pushshift + Arctic Shift dumps
- **Hugging Face** `open-index/arctic`: 262GB Parquet, all subreddits 2005–2026

Self-hosting requires ~300GB Cloud Storage + BigQuery or PostgreSQL with FTS. Not needed for MVP but viable safety net for production.

---

*Start with Layer 1 (Arctic Shift + PullPush) + free SERP tiers + Firestore cache. Add proxies only when users need real-time alerts. JustSERP is always the last resort — never the default.*