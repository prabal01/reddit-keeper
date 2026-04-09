---
title: Discovery Lab
description: Search Reddit and Hacker News for market insights, competitor mentions, and high-intent posts.
section: Features
order: 3
---

# Discovery Lab

The Discovery Lab is OpinionDeck's on-demand research tool. You enter a query and get back a ranked list of relevant Reddit and Hacker News threads, scored by engagement and intent signals.

---

## Search modes

### Competitor Discovery
Enter a competitor's product name (e.g. `Linear`, `Superhuman`, `Calendly`). OpinionDeck searches for:
- Direct mentions and reviews
- Frustration threads ("X is terrible because...")
- Alternative-seeking posts ("looking for something better than X")
- Head-to-head comparisons ("X vs Y")

### Idea Discovery
Enter a product idea or market description (e.g. `async standup tool for remote teams`). OpinionDeck:
1. Generates multiple search angles using AI (e.g. "remote standup problems", "standup alternative", "daily sync tool frustration")
2. Runs all angles in parallel across Reddit and HN
3. Aggregates and deduplicates the results

> **Free plan note:** On the free plan, idea discovery generates 1 search angle. Paid plans generate up to 3 angles for broader coverage.

### URL / Website Input
Paste a product URL (e.g. `https://notion.so`). OpinionDeck extracts the product name from the URL and runs competitor discovery automatically.

---

## AI Brain

Toggle **AI Brain** on to enable query expansion. With AI Brain active:
- Your single query is expanded into multiple semantically related searches
- Results cover adjacent pain points and use cases you may not have thought of
- Takes slightly longer (3–8 seconds) but returns significantly more coverage

Leave AI Brain off for fast, targeted searches on a specific term.

<figure>
  <img src="/docs/discovery-search.png" alt="Discovery Lab search bar with AI Brain toggle highlighted" style="width:100%;border-radius:12px;border:1px solid #2a2a4a;" />
  <figcaption>The AI Brain toggle in the Discovery Lab search bar</figcaption>
</figure>

---

## Platform filtering

Use the platform filter to restrict results to a specific source:

| Filter | What it searches |
|--------|-----------------|
| **All** | Reddit + Hacker News (default) |
| **Reddit** | Reddit only — broader community coverage |
| **HN** | Hacker News only — technical audiences, startup context |

---

## Understanding results

Each result card shows:

### Intent markers
OpinionDeck tags each result with one or more intent signals:

| Tag | What it means |
|-----|--------------|
| `frustration` | Post expresses dissatisfaction with an existing product |
| `alternative` | User is explicitly seeking a different solution |
| `high-engagement` | Post has unusually high comment/upvote activity |
| `question` | User is asking for advice, tool recommendations, or explanations |

Posts tagged **frustration** or **alternative** are your highest-priority leads — they represent users who are actively looking to switch.

### Engagement metrics
- **Score** — Reddit upvote count (proxy for visibility and resonance)
- **Comments** — Discussion volume (high comments often signal strong opinions)

<figure>
  <img src="/docs/discovery-results.png" alt="Discovery results grid showing Reddit threads tagged with frustration, alternative, and high-engagement" style="width:100%;border-radius:12px;border:1px solid #2a2a4a;" />
  <figcaption>Discovery results with intent markers and engagement metrics</figcaption>
</figure>

---

## Saving results to a Research Deck

1. Check the results you want to keep
2. Click **Save to Deck**
3. Choose an existing Deck or create a new one

OpinionDeck downloads the full thread (post body + all comments up to your plan's comment depth limit) and queues it for AI analysis.

> **Comment depth:** Free plan fetches up to 50 comments. Professional plan fetches up to 5,000 comments per thread, giving the analysis engine much more signal to work with.

---

## Discovery history

Every search is automatically saved to your history. From the Discovery Lab:

- Click **History** to view past searches
- Re-open any past search to see its cached results instantly (no re-querying)
- Delete individual history entries you no longer need

Search history retention (how long past searches remain accessible in the history panel):

| Plan | Search history retention |
|------|--------------------------|
| Trial | 3 days |
| Starter | 7 days |
| Professional | 90 days |
| Enterprise | Unlimited |

> **Note:** This controls your search history panel only. PDF/JSON export retention is separate — see [Pricing →](/docs/plans/pricing).

---

## Discovery limits

Monthly discovery limits reset at the start of each billing cycle.

| Plan | Monthly discoveries |
|------|---------------------|
| Free | 3 |
| Trial | 3 |
| Starter | 3 |
| Professional | 30 |
| Enterprise | Unlimited |

A "discovery" counts as one submitted search (regardless of how many results come back).

---

## Data sources

Discovery searches across:

1. **Reddit live API** — Current posts and comments, rate limited, real-time
2. **Hacker News (Algolia)** — Full-text search across all stories and comments
3. **Arctic Shift** — Historical Reddit archive for older posts (Professional+ plans)
4. **PullPush.io** — Secondary Reddit archive, used as a fallback for author enrichment

When the live Reddit API returns no results, OpinionDeck automatically falls back to the historical archive for the same query.
