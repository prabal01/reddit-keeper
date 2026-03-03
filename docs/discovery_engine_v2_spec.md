# Discovery Engine V2: Master Query & High-Precision Research

This document outlines the architectural decisions and implementation details for the "Idea Discovery" engine, focusing on the refined "Master Query" strategy and precision improvements implemented in March 2026.

## 1. Core Philosophy: The Master Query Strategy
Moving away from broad, high-volume searches that returned noisy "Vague Results," the engine now uses a **Single Master Query** approach.

### The Problem
Traditional keyword searches (e.g., "budget app") returned irrelevant content like "105 Ways to Use ChatGPT" because they happened to mention the keywords in passing. High engagement scores for these "listicles" drowned out actual niche discussions.

### The Solution: Problem Distillation
The AI now performs a "Root Problem" extraction before searching.
1. **Input**: "An app that journals based on health data and my activity."
2. **Root Problem**: "Journaling" or "Habit Building."
3. **Master Query**: `[Root Problem] + frustrating site:reddit.com`

---

## 2. Technical Architecture

### Phase 1: AI Intent Expansion
The `expandIdeaToQueries` function in `ai.ts` is the brain of the discovery. It:
- Distills the idea into a 2-3 word **Root Problem**.
- Identifies the **Core Pain** (e.g., "manual entry feels like a chore").
- Generates exactly ONE high-signal query targeting Reddit communities.

### Phase 2: Serper-Primary Baseline
We lead with the **Serper API** using the Master Query.
- **Why Serper?**: It provides a pre-indexed Google-quality view of Reddit/HN discussions without the restrictive permission blocks of the Official Google Search API.
- **Boost Factor**: Results found via Serper that map to Reddit/HN are given a **+8000 point score** immediately.

### Phase 3: Fallback Expansion (Deep Scan)
If Serper returns fewer than 3 high-signal results for the Master Query, the **Orchestrator** automatically triggers a parallel "Deep Scan":
- Concurrent calls to direct **Reddit Search API** and **HN Algolia API**.
- Uses original broad keywords to cast a wider net.

---

## 3. Precision Engineering (The Relevance Engine)

To ensure "Vague results" are purged, the following scorers were implemented in `reddit.service.ts` and `hn.service.ts`:

1. **Semantic Proximity Boost (+5,000 pts)**:
   - Keywords (e.g., "budget" and "chat") must appear within **150 characters** of each other.
   - This ensures the thread is *about* the intersection of ideas, not just mentioning them in a long list.

2. **The "Listicle" Penalty (-10,000 pts)**:
   - If a domain word appears only once in a long body of text (vague mentions), the result is penalized so heavily it drops out of the Top 10.

3. **Title Weighting (4x)**:
   - Matches in the Title are worth 4x more than body matches. A thread dedicated to the topic always wins over a passing mention.

---

## 4. Performance & Caching

### Layered Caching Strategy (Redis)
- **Discovery Cache**: Full reports for an idea are cached for 24 hours (`discovery:idea:v5`).
- **Thread Metadata Cache**: Individual thread stats (ups, comments) are stored in `reddit_meta:[id]` for 7 days.
- **Full Thread Data**: Comment trees and metadata are stored in `thread_data:v1:[url_hash]` to make opening threads instantaneous.

### Metadata Enrichment
Since search engines (Serper/Google) don't return upvotes or comment counts, the Orchestrator runs a **Background Enrichment Phase**:
- It identifies the top results with "0" metadata.
- It performs a parallel fetch of the real Reddit/HN JSON to pull actual engagement stats.
- **Configurability**: The number of enriched results is controlled by `discovery_enrichment_limit` in the global database config (default: **10**).
- This ensures the Discovery UI shows real-world signal (e.g., "79 Upvotes") instead of empty placeholders.

---

## 5. API Resilience & Self-Healing

The engine now includes a robust **Self-Healing layer** in \`ai.ts\` to handle high-volume analysis.

### Exponential Backoff (with Jitter)
When analyzing large folders (50+ threads), the system may hit Vertex AI's \`429 Resource Exhausted\` limits. 
- **The Solution**: All LLM calls (Embeddings, Clustering, and Synthesis) are wrapped in a \`withRetry\` helper in \`src/server/ai.ts\`.
- **Behavior**: If a 429 is detected, the system waits (2s, 4s, 8s...) with added randomness to avoid synchronization issues, ensuring the analysis finishes successfully rather than crashing.

