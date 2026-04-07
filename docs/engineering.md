# MVP Engineering & Architecture Document: Monitoring-First Pipeline

## 1. Introduction
This document details how the existing backend architecture (Node.js, Express, BullMQ, Firestore, Gemini AI) will be utilized to implement the "Monitoring-First" Reddit discovery MVP. Our goal is to extract pain-point patterns and lead opportunities while keeping within API rate limits and leveraging our resilient local fetcher setup.

## 2. Core Infrastructure & Services

### 2.1 Backend Entry Points & Queues
We will rely heavily on our existing robust BullMQ implementation (`src/server/queues.ts` and `src/server.ts`).
*   **Discovery Job Trigger:** When the frontend (`DiscoveryWorkbench.tsx`) initiates a new research session, it will hit an endpoint under `src/server/discovery/` or `src/server/monitoring/`.
*   **Background Workers:** 
    *   We will reuse the current Sync and Granular analysis queuing strategy. 
    *   To respect Reddit's rate limit (Strictly 1 thread/sec, `concurrency: 1`), the fetcher tasks will be pushed to the existing queue infrastructure.
    *   *New Pipeline:* We need a periodic monitoring job that wakes up (e.g., daily or hourly), fetches new posts for tracked keywords, and processes them without halting UI interactions.

### 2.2 Reddit Fetching & Resiliency
*   **Home-Hosted Tunnel:** We will continue to use the newly deployed local fetcher on the Mac Mini (as updated in recent PRs) to bypass cloud IP blocks. All scraping traffic routes through this tunnel (`src/reddit/`).
*   **Data Strategy:** For the initial immediate discovery, we can combine Reddit API (for real-time) and Pushshift (for historical data, if available/unblocked) to gather the first dataset rapidly.

### 2.3 AI Processing & Scoring (`src/server/ai.ts` & `src/server/clustering.ts`)
The MVP requires two types of outputs: Patterns and Opportunities.
*   **Pattern Detection:** We will leverage `src/server/clustering.ts` and `src/server/ai.ts` (using Gemini 2.0 Flash) to group fetched threads into clusters based on recurring complaints or requests.
*   **Relevance Scoring:** During the mapping of opportunities, the AI pipeline will generate a `relevance_score` (0-100) and identify the core "intent" of the post (e.g., seeking help, complaining about competitor).

## 3. Data Model & Firestore Architecture (`src/server/firestore.ts`)

The existing Firestore structure will be expanded to support the MVP models.

*   **Threads Collection:** 
    *   Will continue to use the MD5 hash of the URL as the document ID.
    *   *New Fields:* Add metadata fields for `relevance_score` and `intent_category`.
*   **Folders / Monitoring Jobs:**
    *   Existing Folders will act as the parent container for a "Monitoring Job".
    *   *Keywords:* The Folder schema will hold `seed_keywords` and `tracked_subreddits`.
*   **Patterns (New Concept):**
    *   Can be stored as a subcollection under Folders: `folders/{folderId}/patterns/{patternId}`.
    *   Schema: `{ id, description: "Feature X Requests", count: 8, keywords: [...], sample_post_ids: [...] }`
*   **Leads / CRM (New Concept):**
    *   Can be stored as a subcollection under Folders: `folders/{folderId}/leads/{leadId}`.
    *   Schema: `{ thread_id, status: "new" | "contacted" | "ignored", added_at, user }`.

## 4. Execution Flow (Backend perspective)

1.  **API call received:** `/api/discovery/start` -> Receives URL or keywords.
2.  **Job Enqueued:** A master job is placed on the BullMQ queue.
3.  **Data Fetching:** Rate-limited workers pull threads matching the criteria via the home-hosted local fetcher.
4.  **AI Aggregation:** Fetched data is sent to Vertex AI/Gemini (`ai.ts`):
    *   Pass 1: Find overarching patterns (Recurring issues).
    *   Pass 2: Score individual threads for lead gen viability.
5.  **Database Commit:** Results are synced to Firestore under the user's generated Folder structure.
6.  **Continuous Monitoring:** A CRON-like BullMQ repeatable job is registered to run daily, repeating steps 3-5 with an "incremental" time filter, updating pattern counts and adding new Leads to the CRM.

## 5. Security & Constraints
*   **Rate Limits:** The global API limits (Free: 25, Beta: 40, Pro: 60) enforced via `rateLimiter.ts` must apply to new pattern analytics endpoints.
*   **TOS / Automation:** Consistent with the MVP specification, we will absolutely **NOT** implement auto-DMs or auto-posting. The backend strictly performs read-only fetching and read-only analysis to protect user accounts from bans.
