# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**OpinionDeck** is a competitive intelligence platform that monitors Reddit and HackerNews for product opportunities, user pain points, and market insights. It's a full-stack application with backend API, web dashboard, Chrome extension, Telegram bot, and marketing site.

### Core Product Features
- **Discovery Lab**: Search Reddit/HN threads, extract AI-analyzed insights (pain points, triggers, outcomes)
- **Monitoring**: Set up market monitors that continuously track subreddits for opportunities
- **Analysis**: AI-powered clustering and deduplication of findings using Vertex AI embeddings
- **Integration**: Chrome extension for seamless content capture, Telegram bot for async interactions

---

## Monorepo Structure & Development Commands

This is a **polyrepo** (multiple packages) managed in a single repo:

### Backend (Node.js + Express)
```bash
# Development
npm run dev:server          # Watch mode with tsx, port 3001
npm run build              # TypeScript compilation to dist/

# Production
npm run start              # Run compiled server
npm run deploy             # Docker build → GCR push → Cloud Run deploy
```

**Entry point**: `src/server.ts` (Express API server, 3000+ lines)

### Frontend (React + Vite)
```bash
cd web
npm run dev                # Vite dev server with HMR, port 5173
npm run build              # TypeScript + Vite production build
npm run lint               # ESLint
```

**Entry point**: `web/src/App.tsx`

### Chrome Extension
```bash
cd chrome-extension
# Build config in vite.config.ts
# Manual build via npm scripts (check package.json)
```

**Entry point**: `chrome-extension/src/background.ts` (background event handler)

### Telegram Bot
```bash
# Runs as a microservice via Cloud Run
# Entry point: bots/marketing-bot/src/handlers/webhook.ts
```

### Marketing Site (Astro)
```bash
cd marketing
npm run dev                # Astro dev server
npm run build              # Static site generation
```

### Combined Development (All Services)
```bash
npm run dev                # Concurrently runs dev:server and dev:web
```

---

## Architecture at a Glance

### Backend Architecture (src/server/)

| Component | File | Purpose |
|-----------|------|---------|
| **Database Layer** | `firestore.ts` | Firestore collections, queries, user state |
| **AI Service** | `ai.ts` | Thread analysis, embeddings, LLM ranking via Vertex AI |
| **Admin Portal** | `admin.ts` | User management, waitlist, beta tokens, analytics |
| **Monitoring** | `monitoring/service.ts` | Market monitoring configs, opportunity tracking |
| **Clustering** | `clustering.ts` | Semantic clustering of insights (pain points, triggers) |
| **Queue Workers** | `queues.ts` | BullMQ job processing (sync, analysis, granular analysis) |
| **Thread Download** | `../thread-downloader/downloader.ts` | Reddit API interaction, comment parsing |
| **Alerts** | `alerts.ts` | Error/warning notifications |

**Key Middleware** (src/server/middleware/):
- `auth.js` - Firebase Auth + custom JWT validation
- `rateLimiter.js` - Redis-backed rate limiting
- `usageGuard.js` - Plan-based quota enforcement
- `admin.js` - Admin-only endpoint protection

### Frontend Architecture (web/src/)

| Component | Purpose |
|-----------|---------|
| **AuthContext** | Global auth state, Firebase integration, plan/usage tracking |
| **DiscoveryLab** | Search interface for finding insights |
| **MonitoringView** | Dashboard for active monitors and opportunities |
| **FolderContext** | Workspace/folder state management |
| **API Client** | Fetch wrappers with auth headers |

### Data Layer

**Firestore Collections**:
- `users` - User profiles, plan tier, usage stats
- `folders` - Analysis workspaces
- `folder_analyses` - Stored analysis results
- `discovery_history` - User's search history with results
- `monitoring_monitors` - Market monitor configs
- `monitoring_posts` - Cached Reddit posts
- `monitoring_opportunities` - High-scoring opportunities for users
- `invite_codes` - Beta access tokens

**External APIs**:
- **Vertex AI** (Gemini 2.0 Flash) - Thread analysis, query expansion, opportunity scoring
- **Vertex AI Embeddings** - text-embedding-004 for semantic similarity
- **Reddit JSON API** - Thread and comment fetching
- **HackerNews API** - Thread metadata
- **Google Custom Search** - Query discovery

---

## Key Data Flows

### Discovery Flow (User searches for insights)
```
User Input (idea/URL)
  ↓ expandIdeaToQueries() [Brainstorm search angles]
  ↓ External Search APIs [Google, Reddit, HN]
  ↓ fetchWithRetry() [Download Reddit threads with backoff]
  ↓ analyzeThreadGranular() [Extract pain points, triggers, outcomes]
  ↓ aggregate() [Cluster similar insights]
  ↓ arbitrateSimilarity() [Dedup via LLM]
  ↓ synthesizeReport() [Rank and format]
  ↓ saveDiscoveryHistory() [Store in Firestore]
```

### Monitoring Flow (Continuous market scanning)
```
saveUserMonitor() [User sets monitor]
  ↓ searchSubreddits() [AI finds relevant communities]
  ↓ getPostsForSubreddits() [Cron fetches posts]
  ↓ scoreMarketingOpportunity() [LLM ranks by relevance/intent]
  ↓ saveOpportunity() [High-score posts → dashboard]
```

### Extension Flow (Browser-based content capture)
```
User browses Reddit/HN
  ↓ Content script extracts thread data
  ↓ Background script formats + saves
  ↓ saveToBackend() [POST /api/extractions]
  ↓ Auth header [Firebase JWT]
  ↓ Firestore [Data persisted]
```

---

## Technology Stack

| Layer | Tech |
|-------|------|
| **Backend** | Node.js, Express, TypeScript |
| **Frontend** | React 19+, Vite, Tailwind CSS |
| **Extension** | Chrome Extension API (MV3) |
| **Database** | Firestore (real-time, NoSQL) |
| **Auth** | Firebase Auth + JWT |
| **AI/LLM** | Google Vertex AI (Gemini 2.0 Flash) |
| **Embeddings** | Vertex AI text-embedding-004 |
| **Job Queue** | BullMQ (Redis-backed) |
| **HTTP** | Fetch API, node-fetch |
| **Logging** | Custom logger (`src/server/utils/logger.ts`) |
| **Markdown** | jsPDF for PDF export, markdown-it parsing |
| **Analytics** | PostHog |

---

## Environment Setup

### Required Files
Copy `.env.example` to `.env` and populate:

**Critical vars** (backend won't start without these):
- `GOOGLE_CLOUD_PROJECT` - GCP project ID
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to GCP service account JSON
- `GEMINI_API_KEY` - Google Gemini API key (alt to Vertex AI)
- `REDIS_URL` - Redis connection string (BullMQ queue backend)
- `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_CX` - Custom search API
- `ADMIN_SECRET` - Secret for admin endpoints

**Optional but recommended**:
- `TELEGRAM_BOT_TOKEN` - Telegram bot API token
- `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` - Payment processing
- `AXIOM_TOKEN` + `AXIOM_DATASET` - Logging provider
- `BUFFER_API_KEY` - Social media scheduling

### Firebase Setup
- Backend authenticates via service account (GOOGLE_APPLICATION_CREDENTIALS)
- Frontend uses Firebase web SDK (hardcoded in web config)
- Both use Firestore as primary database

### Local Development
```bash
# Install dependencies
npm install && cd web && npm install && cd ../chrome-extension && npm install && cd ..

# Set up .env (copy .env.example and fill in local values)
# Minimum: GOOGLE_APPLICATION_CREDENTIALS, REDIS_URL, GEMINI_API_KEY

# Start dev servers
npm run dev                    # Concurrent server + web
# OR individually:
npm run dev:server            # Backend on :3001
npm run dev:web               # Frontend on :5173
```

---

## Common Development Tasks

### Adding a New API Endpoint
1. Create router file in `src/server/[feature]/router.ts`
2. Register in `src/server.ts` with `app.use('/api/[feature]', router)`
3. Add auth/rate-limit middleware as needed
4. Use Firestore functions from `src/server/firestore.ts` for data access
5. Reference example: `src/server/monitoring/router.ts`

### Adding Frontend Components
- Place in `web/src/components/` with corresponding `.css` file
- Use `AuthContext` for user state via `const { user, plan } = useAuth()`
- Fetch API calls via `lib/api.ts` helpers with auth headers
- Style with Tailwind CSS classes

### Analyzing a Reddit Thread
- Direct: `import { parseRedditUrl, fetchWithRetry } from './thread-downloader/downloader.ts'`
- Via API: `POST /api/fetch-thread` with URL and optional `returnComments=true`
- Result: `Comment[]` with recursive tree structure (parent refs, direct replies)

### Running AI Analysis
- Threads: `analyzeThreadGranular()` for granular pain points/triggers/outcomes
- Batch: `analyzeDiscoveryBatch()` for multi-thread pattern detection
- Embeddings: `getEmbeddings()` via Vertex AI for semantic similarity
- Rate limits: `withRetry()` handles Vertex AI backoff (exponential, max 8 attempts)

### Adding a Job Queue Task
1. Define job schema in `src/server/queues.ts`
2. Create worker in same file with `new Worker(queueName, processor)`
3. Add job to queue: `syncQueue.add('task-name', data)`
4. Reference: `analysisQueue` (thread analysis), `syncQueue` (data sync)

### Debugging Data Issues
- Check Firestore collections via Firebase Console
- Use `getDb()` to access Firestore instance directly
- Enable debug logging: `LOGLEVEL=debug` in env
- Server logs go to stdout (with pino-pretty formatting if present)

---

## Code Patterns & Conventions

### Error Handling
- Use `try-catch` with `logger.error()` for async operations
- Always include user feedback via `sendAlert()` for critical errors
- Rate limit errors: `withRetry()` automatically handles backoff

### Async/Queue Pattern
- Heavy operations (analysis, sync) → BullMQ queues, not direct await
- Example: `analyzeThreads()` enqueues to `analysisQueue`, not direct processing
- Workers handle background job execution with retry logic

### Data Fetching (Reddit)
- Always use `fetchWithRetry()` (not raw fetch) to respect rate limits
- Pass `User-Agent` header to avoid 403s
- Parse JSON responses with `.json()` not manual parsing

### Type Safety
- Use TypeScript strict mode (enforced in tsconfig.json)
- Define types in same file or `_types.ts` file in module
- Export types from service files for client usage
- Example: `SavedThread` type from `firestore.ts`

### Logging
- Use `logger` from `src/server/utils/logger.ts` (pino-based)
- Levels: `info` (normal), `warn` (issues), `error` (failures), `debug` (dev)
- Structured logging: `logger.info({ userId, action }, 'message')`

### Authentication
- Backend: `authMiddleware` validates Firebase JWT from `Authorization: Bearer <token>`
- Frontend: `AuthProvider` wraps app, handles Firebase login/logout
- API Client: `lib/api.ts` automatically adds auth header to requests

---

## Deployment

### Deployment Pipeline
```bash
npm run deploy
# Equivalent to:
npm run deploy:build        # Docker build (linux/amd64)
npm run deploy:push         # Push to gcr.io/redditkeeperprod/opiniondeck-backend
npm run deploy:run          # Deploy to Cloud Run (us-east1, unauthenticated)
```

### Environment Variables (Cloud Run)
- Loaded from `env.yaml` at deploy time
- Must include all required vars from `.env` section

### Frontend Deployment
- Web: Built separately, deployed to static hosting (likely Firebase Hosting)
- Extension: Manual submission to Chrome Web Store
- Marketing: Astro static site deployed to Netlify or similar

---

## CodeGraph & Codebase Analysis

This project has CodeGraph initialized (`.codegraph/` exists). For codebase exploration:

- **Lightweight lookups** (main session): Use `codegraph_search`, `codegraph_callers`, `codegraph_impact`, `codegraph_node`
- **Deep exploration** (new Explore agent): Use `codegraph_explore` for understanding systems
  
Example: "How does the discovery flow work?" → Spawn Explore agent to trace `expandIdeaToQueries` → `analyzeThreadGranular` → `aggregate`

---

## Performance & Scaling Considerations

### Rate Limiting
- **Vertex AI**: Quota ~500 RPM, use `withRetry()` with exponential backoff
- **Reddit API**: ~60 req/min per IP, use `fetchWithRetry()` with delay
- **User endpoints**: Redis rate limiter (rateLimiterMiddleware) - 100 req/min per user

### Caching
- `monitoring_posts` - Pre-fetched posts cached for 24h (in DB)
- Embeddings - Generated once per unique chunk, not recalculated
- Discovery results - Stored in `folder_analyses` for instant retrieval

### Concurrency
- BullMQ handles job isolation (workers run in parallel)
- Multiple analysis jobs can run simultaneously via separate workers
- Firestore auto-scales writes; design for eventual consistency

### Database Indexes
- Key collections indexed on `userId`, `createdAt` for queries
- Check Firebase Console → Firestore → Indexes for existing compound indexes

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| **Redis connection fails** | Verify `REDIS_URL` env var, Redis service running locally or in cloud |
| **Vertex AI quota exceeded** | Use Gemini API key instead; `withRetry()` auto-retries rate limits |
| **Firebase auth fails** | Check `GOOGLE_APPLICATION_CREDENTIALS` points to valid JSON file |
| **Thread fetch returns 403** | Ensure `User-Agent` header is set in requests |
| **Extension not loading** | Check Chrome Extension settings, MV3 manifest compatibility |

---

## File Organization Quick Reference

```
src/
├── server.ts              (Main Express app setup, route registration)
├── cli.ts                 (CLI interface)
├── server/
│   ├── firestore.ts       (Database operations)
│   ├── ai.ts              (LLM analysis, embeddings)
│   ├── admin.ts           (User/analytics management)
│   ├── clustering.ts      (Semantic clustering)
│   ├── queues.ts          (BullMQ workers and definitions)
│   ├── monitoring/        (Market monitoring service + router)
│   ├── discovery/         (Discovery orchestration + router)
│   ├── middleware/        (Auth, rate limit, usage guard)
│   └── utils/             (Shared utilities: logger, etc.)
├── thread-downloader/     (Reddit API client)
├── reddit/                (Reddit types, comment tree builder)
└── formatters/            (Output formatting)

web/src/
├── App.tsx                (Root component)
├── components/            (React UI components)
├── contexts/              (Auth, Folder state)
├── lib/                   (API client, utilities)
└── assets/                (Styles, images)

chrome-extension/src/
├── background.ts          (Event handler, API sync)
├── content/               (Content scripts for Reddit/HN)
└── popup/                 (Extension UI)
```

---

## Notes for Future Contributors

- **No test framework** currently in place. Before adding tests, consider Jest or Vitest.
- **Monorepo tooling**: Uses npm workspaces implicitly (separate package.json per package). Consider pnpm or Turborepo for optimization.
- **API design**: RESTful with JSON payloads. Consider OpenAPI schema for documentation.
- **Error messages**: Include user-friendly messages in API responses (not just error codes).
- **Secrets**: Environment variables loaded via dotenv. Never commit `.env` or credentials.
