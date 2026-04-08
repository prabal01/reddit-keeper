# OpinionDeck — Product Review & Priority Backlog

**Review Date:** 2026-04-08
**Last Updated:** 2026-04-08
**Reviewer:** PM Audit (Claude)
**Overall Health:** Early-stage product with strong core, significant operational gaps

### Completed Items
- [x] **P1.1** — Test framework (Vitest) installed, 13 tests for auth + usageGuard middleware
- [x] **P1.2** — Usage guard changed from fail-open to fail-closed (returns 503)
- [x] **P1.3** — Error message sanitization (50+ routes fixed, zero `err.message` leaks)
- [x] **P1.4** — GitHub Actions CI pipeline (lint → type-check → test)
- [x] **P2.3** — Centralized config (`src/server/config.ts`): User-Agent (16 occurrences), Redis URL (3 occurrences), env validation at startup
- [x] **P2.2** — Type safety: 91 `catch (err: any)` → `catch (err: unknown)`, added `errMsg()`/`errCode()` helpers, fixed unsafe property access
- [x] **P3.1** — Pricing page: "Team Seats" labeled as "Coming Soon"
- [x] **P3.3** — Security: auth dev bypass now uses centralized `config.isProd`, removed raw `process.env.NODE_ENV` checks
- [x] **P3.4** — Observability: `/api/health` now checks Redis, Firestore, Queue individually, returns 503 when degraded
- [x] **P3.2** — Logging: replaced `console.*` with structured `logger` in queues.ts, ai.ts, admin router, middleware, alerts, marketing, brain — added `errMsg()`/`errCode()` helpers
- [x] **P4.5** — DB indexes documented in `firestore.indexes.json`

---

## Priority Definitions

| Priority | Meaning | Timeline |
|----------|---------|----------|
| **P1** | Blocking — can cause data loss, security breach, or production outage | Fix immediately |
| **P2** | High — actively degrading product quality or dev velocity | Fix within 1-2 sprints |
| **P3** | Medium — technical debt that compounds over time | Plan within this quarter |
| **P4** | Low — improvements that enhance quality but aren't urgent | Backlog / opportunistic |

---

## P1 — Critical (Fix Immediately)

### P1.1 — Zero Automated Tests
- **Risk:** Every deploy is a gamble. No safety net for regressions.
- **Current State:** No test runner configured. No unit, integration, or e2e tests exist anywhere in the codebase. Only ad-hoc diagnostic scripts in `src/scripts/`.
- **Action Items:**
  - [ ] Add Vitest as test framework (aligns with Vite frontend)
  - [ ] Write integration tests for the discovery flow (search → fetch → analyze → cluster)
  - [ ] Write integration tests for the monitoring flow (monitor → scrape → score → save)
  - [ ] Write unit tests for critical business logic: `usageGuard`, plan enforcement, auth middleware
  - [ ] Add test script to `package.json`
- **Files:** `package.json`, new `tests/` or `__tests__/` directories

### P1.2 — Usage Guard Fails Open
- **Risk:** If Firestore is unavailable, quota checks are bypassed — free users get unlimited access, costing real money on Vertex AI calls.
- **Current State:** `src/server/middleware/usageGuard.ts` has a `catch` block that calls `next()`, allowing the request through on any error.
- **Action Items:**
  - [ ] Change fail-open to fail-closed: return `503 Service Unavailable` when Firestore is unreachable
  - [ ] Add alerting when usage guard encounters Firestore errors
  - [ ] Add test coverage for this middleware
- **Files:** `src/server/middleware/usageGuard.ts`

### P1.3 — Error Messages Leak Internal Details
- **Risk:** `res.status(500).json({ error: err.message })` exposes stack traces, file paths, and internal state to clients. Security vulnerability (OWASP Top 10).
- **Current State:** Multiple routes return raw error messages to the client.
- **Action Items:**
  - [ ] Create a centralized error handler middleware that logs full details but returns generic messages
  - [ ] Audit all routes for `err.message` in responses
  - [ ] Return structured errors: `{ error: "Something went wrong", code: "INTERNAL_ERROR" }`
- **Files:** `src/server/discovery/router.ts`, `src/server/monitoring/router.ts`, `src/server.ts`

### P1.4 — No CI/CD Pipeline
- **Risk:** Manual `npm run deploy` with no automated checks. A typo or broken import ships to production unchecked.
- **Current State:** No `.github/workflows/`, no `.gitlab-ci.yml`, no automated pipeline of any kind.
- **Action Items:**
  - [ ] Create GitHub Actions workflow: lint → type-check → test → build
  - [ ] Gate deployments on CI passing
  - [ ] Add branch protection rules on `master`
- **Files:** New `.github/workflows/ci.yml`

---

## P2 — High (Fix Within 1-2 Sprints)

### P2.1 — server.ts Monolith (3000+ Lines)
- **Risk:** Slows development velocity, increases merge conflicts, makes onboarding new devs painful.
- **Current State:** `src/server.ts` contains all route definitions, middleware setup, and inline logic in a single 3000+ line file.
- **Action Items:**
  - [ ] Extract route groups into feature-specific routers (monitoring already does this — follow that pattern)
  - [ ] Move middleware registration to a dedicated `src/server/middleware/index.ts`
  - [ ] Keep `server.ts` as a thin entry point: imports, app setup, route mounting, listen
  - [ ] Target: `server.ts` under 200 lines
- **Files:** `src/server.ts`, new router files in `src/server/*/router.ts`

### P2.2 — 48+ `any` Types in Backend
- **Risk:** Silent runtime failures. TypeScript provides no protection where `any` is used. AI schema changes from Google could break silently.
- **Current State:** `any` used extensively in AI schemas, Firestore operations, queue job definitions, and catch blocks.
- **Action Items:**
  - [ ] Replace `any` in `src/server/ai.ts` with Zod schemas for LLM responses
  - [ ] Type Firestore document interfaces in `src/server/firestore.ts`
  - [ ] Type queue job payloads in `src/server/queues.ts`
  - [ ] Replace `catch (err: any)` with `catch (err: unknown)` and narrow types
- **Files:** `src/server/ai.ts`, `src/server/firestore.ts`, `src/server/queues.ts`

### P2.3 — Hardcoded Configuration Values
- **Risk:** Inconsistent behavior across environments. Silent failures when defaults are wrong for production.
- **Current State:**
  - User-Agent strings duplicated in 4+ files
  - Redis URL defaults to `localhost:6379` in 3 places (fails silently in prod if env var missing)
  - Plan limits scattered across individual route handlers
- **Action Items:**
  - [ ] Create `src/server/config.ts` — single source of truth for all configuration
  - [ ] Validate required env vars at startup (fail fast with clear error messages)
  - [ ] Centralize plan limit definitions (currently scattered across discovery/router.ts, monitoring/router.ts, usageGuard.ts)
  - [ ] Extract User-Agent to config constant
- **Files:** New `src/server/config.ts`, update all files referencing env vars directly

### P2.4 — Monitoring Feature QA Before Launch
- **Risk:** Recently added feature with incomplete UI, untested worker logic, and undocumented limits.
- **Current State:**
  - `LeadsManagement.tsx` is new and minimal (7 symbols)
  - Firestore `in` query capped at 30 subreddits — undocumented limit, will break silently for power users
  - Redis cooldown logic (8h per subreddit) has no user-facing explanation
  - No loading skeleton for monitoring leads list
  - CSV export endpoint exists but not fully wired in UI
- **Action Items:**
  - [ ] Complete `LeadsManagement.tsx` with loading states, empty states, error handling
  - [ ] Add user-facing messaging about subreddit limits
  - [ ] Wire up CSV export in the UI
  - [ ] Test end-to-end: create monitor → scrape triggers → opportunities appear → export
  - [ ] Add pagination for opportunity lists
- **Files:** `web/src/components/monitoring/LeadsManagement.tsx`, `src/server/monitoring/service.ts`, `src/server/monitoring/router.ts`

---

## P3 — Medium (Plan Within This Quarter)

### P3.1 — Pricing Page Claims vs. Reality
- **Risk:** Advertising unbuilt features erodes user trust and could have legal implications.
- **Current State:**
  - "Team collaboration" — referenced in Enterprise tier, zero implementation
  - "API access" — no public API docs, no API key system
  - "Priority support" — no support system integrated
- **Action Items:**
  - [ ] Audit every claim on `PricingPage.tsx` against actual implementation
  - [ ] Remove or label unbuilt features as "Coming Soon"
  - [ ] Prioritize building or removing each unshipped feature
- **Files:** `web/src/components/PricingPage.tsx`

### P3.2 — Logging Inconsistency
- **Risk:** Mixed logging makes debugging production issues harder. Some errors go to structured logs (Axiom), others to raw console.
- **Current State:** Structured `logger` exists (`src/server/utils/logger.ts`) but many files still use `console.log` and `console.error` — especially `queues.ts` and `ai.ts`.
- **Action Items:**
  - [ ] Replace all `console.log/error/warn` with `logger.info/error/warn`
  - [ ] Add ESLint rule: `no-console` to prevent regression
  - [ ] Ensure all log entries include contextual metadata (userId, action, etc.)
- **Files:** `src/server/queues.ts`, `src/server/ai.ts`, and others using `console.*`

### P3.3 — Security Hardening
- **Risk:** Several medium-severity security gaps that could be exploited.
- **Current State:**
  - Dev bypass header (`x-opiniondeck-dev`) in auth middleware — should be strictly gated to NODE_ENV
  - No CSRF protection on state-changing endpoints
  - CORS settings not visibly configured/restricted
  - Telegram webhook endpoint not validating request origin
- **Action Items:**
  - [ ] Verify dev bypass is impossible in production (double-check NODE_ENV guard)
  - [ ] Review and restrict CORS origins to known domains
  - [ ] Add CSRF protection or verify SameSite cookie settings
  - [ ] Add Telegram webhook signature validation
- **Files:** `src/server/middleware/auth.ts`, `src/server.ts` (CORS config)

### P3.4 — Observability & Alerting
- **Risk:** Limited visibility into production health. Issues discovered by users, not by the team.
- **Current State:** Axiom logging exists. No APM, no health checks, no uptime monitoring. PostHog initialized but may not be fully wired.
- **Action Items:**
  - [ ] Add `/health` endpoint with dependency checks (Firestore, Redis, Vertex AI)
  - [ ] Set up uptime monitoring (e.g., UptimeRobot, Better Stack)
  - [ ] Add alerting on error rate spikes (Axiom alerts or PagerDuty)
  - [ ] Verify PostHog is tracking key user events (discovery search, monitor created, opportunity viewed)
- **Files:** `src/server.ts`, `web/src/lib/posthog.ts`

---

## P4 — Low (Backlog / Opportunistic)

### P4.1 — No Circuit Breaker for External APIs
- **Current State:** `withRetry()` handles rate limits but no circuit breaker pattern. If Reddit or Vertex AI is fully down, every request retries 8 times before failing.
- **Action:** Consider a circuit breaker library (e.g., `cockatiel`, `opossum`) for external API calls.
- **Files:** `src/server/ai.ts`, `src/server/discovery/reddit.service.ts`

### P4.2 — Archive Diagnostic Scripts
- **Current State:** `src/scripts/` contains one-off test scripts (`test-justserp.ts`, `dump-threads-for-prompt.ts`). These aren't real tests but could confuse contributors.
- **Action:** Move to a `scripts/diagnostics/` directory or add a README explaining their purpose.
- **Files:** `src/scripts/`

### P4.3 — AdminTester Component in Production
- **Current State:** `web/src/components/admin/AdminTester.tsx` exists. Testing tools shouldn't ship to end users.
- **Action:** Gate behind admin role check or remove from production build.
- **Files:** `web/src/components/admin/AdminTester.tsx`

### P4.4 — Chrome Extension Polish
- **Current State:** Basic capture flow works for Reddit/HN. Missing deeper integration with main dashboard.
- **Action:** Add extension settings sync, capture confirmation UI, and link to dashboard view from extension popup.
- **Files:** `chrome-extension/src/`

### P4.5 — Database Index Audit
- **Current State:** Key collections indexed on `userId` and `createdAt`, but compound indexes not documented or verified.
- **Action:** Audit Firestore indexes against actual query patterns. Document required indexes in the repo.
- **Files:** New `firestore.indexes.json`

---

## Summary Scorecard

| Area | Score | Priority Items |
|------|-------|----------------|
| Testing | 0/10 | P1.1 |
| Security | 6/10 | P1.2, P1.3, P3.3 |
| DevOps | 4/10 | P1.4, P3.4 |
| Code Quality | 6/10 | P2.1, P2.2, P2.3, P3.2 |
| Feature Completeness | 7/10 | P2.4, P3.1 |
| Frontend UX | 7/10 | P2.4, P4.3 |
| Deployment | 8/10 | P1.4 |

---

## Recommended Sprint Plan

**Sprint 1 (This Week):** P1.1 (test framework setup + first tests), P1.2 (usage guard fix), P1.3 (error sanitization)

**Sprint 2 (Next Week):** P1.4 (CI/CD), P2.3 (config centralization), P2.4 (monitoring QA)

**Sprint 3-4:** P2.1 (server.ts split), P2.2 (type safety), P3.1 (pricing audit)

**Ongoing:** P3.2-P3.4 as capacity allows, P4.x opportunistically

---

*This document should be reviewed and updated monthly as items are completed or priorities shift.*
