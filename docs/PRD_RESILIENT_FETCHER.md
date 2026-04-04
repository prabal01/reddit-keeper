# PRD: OpinionDeck Resilient Reddit Fetcher

## 1. Problem Statement
**Current Status**: The core OpinionDeck backend (`src/reddit/client.ts`) uses a direct `fetch` call that is frequently flagged by Reddit’s anti-bot systems, returning **403 Forbidden** errors. This is particularly frequent on Cloud Run IP ranges.

**Project Goal**: Restore 100% reliability for thread capture while preserving the hierarchical comment-tree structure required for the dashboard UI.

---

## 2. Target Audience
- **OpinionDeck Users**: Research professionals and marketers who need guaranteed access to Reddit data.
- **Developers**: Ensuring the scraper is maintainable and doesn't require constant header-syncing.

---

## 3. Proposed Solution Architecture

### Phase 1: Surgical Header Sync (The MVP)
- **Action**: Update the existing `fetchWithRetry` function with the modern "Standard Browser" header signature.
- **Significance**: Matches the successful pattern found in `reddit-dl` but keeps the existing JSON transform logic for the UI tree.
- **Constraint**: Must not break existing `ThreadData` types.

### Phase 2: Internal Fetcher Isolation (Scale)
- **Goal**: Move scraping to a specialized microservice.
- **Action**: Create a sibling service (e.g., `services/scraper`) that exclusively handles communication with Reddit.
- **Benefit**: If Reddit flags the Scraper IP, the main OpinionDeck Dashboard remains unaffected.

### Phase 3: Regional Failover & Proxies (Production)
- **Goal**: Bypass persistent IP blocks.
- **Action**:
    - Deploy Scraper across `us-central1`, `europe-west1`, and `asia-northeast1`.
    - Implement automatic "Region Hopping" on 403.
    - Integrate Residential Proxies (e.g., BrightData) for high-volume accounts.

---

## 4. Functional Requirements

| ID | Feature | Priority | Description |
| :--- | :--- | :--- | :--- |
| **F-01** | **Browser Mimicry** | High | Use `Sec-Fetch-*` and modern Chrome `User-Agent` strings. |
| **F-02** | **Tree Preservation** | High | Ensure comments are still returned in a parent-child hierarchy. |
| **F-03** | **Recursive Depth** | Medium | Handle "Load more comments" up to depth 10. |
| **F-04** | **Rate Limit IQ** | Medium | Respect `Retry-After` headers but use adaptive timing. |

---

## 5. Technical Specifications

### Implementation Constraints
- **Language**: TypeScript (ESM).
- **Runtime**: Node.js 22 (Bumping from 20 for better performance and `reddit-dl` compatibility).
- **Engine**: `fetch` API + `child_process` (for fallback CLI tools).

### Monitoring & Success
- **Success Rate**: Track % of successful fetches vs total attempts in PostHog.
- **Latency**: Target < 5s for top-level fetch, < 15s for full tree resolution.

---

## 6. Roadmap
1.  **Week 1**: Implement Phase 1 (Headers) + Node 22 upgrade.
2.  **Week 2**: Validate survival across 10 most popular subreddits.
3.  **Week 3**: Prepare VPC configuration for Microservice isolation.
