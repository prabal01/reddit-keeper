---
title: Analysis Engine
description: How OpinionDeck's AI extracts pain points, triggers, outcomes, and market summaries from Reddit threads.
section: Features
order: 6
---

# Analysis Engine

OpinionDeck's analysis engine reads every saved Reddit or HN thread and automatically extracts structured insights using Google Vertex AI (Gemini 2.0 Flash). This page explains what gets extracted, how it works, and how to get the most out of it.

---

## What gets extracted

### Pain Points
A **pain point** is a specific problem a user describes in a thread. The AI identifies language patterns that signal frustration, failure, or unmet needs.

**Examples:**
- *"The search is completely broken — I can't find anything older than a week"*
- *"Billing is confusing and I keep getting charged for seats I deleted"*
- *"There's no keyboard shortcut for the most common action"*

Each pain point is extracted as a concise phrase, attributed to the source thread.

### Switch Triggers
A **switch trigger** is the specific event or circumstance that caused a user to start looking for an alternative. These are distinct from pain points — they're the tipping point, not the underlying problem.

**Examples:**
- *"We hit the 5-user free tier limit and the jump to paid was too expensive"*
- *"The acquisition by X changed the pricing completely"*
- *"New hire couldn't figure out the onboarding — spent 3 days learning the tool"*

Switch triggers are some of the most valuable insights in OpinionDeck because they tell you exactly when and why users churn from competitors.

### Desired Outcomes
A **desired outcome** is what the user ultimately wants to achieve — the end state they're searching for. These differ from pain points (which describe what's wrong) by focusing on what success looks like.

**Examples:**
- *"Something that works on mobile without the desktop app"*
- *"A tool my non-technical co-founder can use without training"*
- *"One place for notes, tasks, and calendar — I'm tired of switching between apps"*

---

## Granular analysis

When you save a thread to a Research Deck, OpinionDeck automatically queues a **granular analysis** job. This job:

1. Downloads the full thread (post body + all comments up to your plan's depth limit)
2. Passes the content to the Gemini 2.0 Flash model with a structured extraction prompt
3. Returns a list of pain points, triggers, and outcomes — each with a confidence score
4. Stores the results in your Deck's Pain Map

The granular analysis is per-thread. Analysis runs in a background queue and typically completes within 30–90 seconds per thread.

<figure>
  <img src="/docs/analysis-engine.png" alt="Analysis engine pipeline showing the five stages from thread download to market summary, with sample extracted clusters" style="width:100%;border-radius:12px;border:1px solid #2a2a4a;" />
  <figcaption>The analysis pipeline — from raw thread to structured clusters</figcaption>
</figure>

---

## Semantic clustering

After individual threads are analysed, OpinionDeck runs a **clustering pass** across all extracted insights in a Deck. This groups similar items together:

- Pain points about "export" issues get clustered into a single group
- Multiple threads mentioning "pricing" as a trigger get combined into one pattern
- Desired outcomes that share a theme (e.g., "offline access") are merged

Clustering uses Google Vertex AI text embeddings (`text-embedding-004`) to measure semantic similarity. Items above the similarity threshold are grouped, and the most representative phrase is used as the cluster label.

The result: instead of 40 individual pain points, you see 8 distinct clusters — each with a frequency count showing how many threads mentioned that theme.

---

## AI deduplication

Within a cluster, OpinionDeck performs **LLM-based deduplication** to resolve near-identical items that differ only in phrasing. This prevents the Pain Map from being cluttered with slight variations of the same insight.

---

## Market summary (Strategy tab)

Once a Deck has at least 3 analysed threads, OpinionDeck generates a **market summary** — a synthesised report written by the AI covering:

- The most common pain points across all threads
- The strongest switch triggers (what's causing users to look for alternatives)
- Positioning gaps: what competitors are missing
- Tactical recommendations: messaging angles, product priorities, community opportunities

The summary is regenerated automatically when you add new threads or run analysis on additional content.

<figure>
  <img src="/docs/strategy-tab.png" alt="Strategy tab showing AI-generated executive summary, top opportunities with scores, and messaging recommendations" style="width:100%;border-radius:12px;border:1px solid #2a2a4a;" />
  <figcaption>The Strategy tab — AI-generated market summary produced by the analysis engine</figcaption>
</figure>

---

## Analysis limits

| Plan | Monthly analysis reports |
|------|--------------------------|
| Free | 1 |
| Trial | 1 |
| Starter | 1 |
| Professional | 10 |
| Enterprise | Unlimited |

Each "report" counts as one market summary generation. Granular per-thread extraction doesn't count against your report limit.

---

## Comment depth and analysis quality

The more comment content OpinionDeck can read, the richer the extracted insights. Comment depth is controlled by your plan:

| Plan | Comments per thread | Comment depth |
|------|---------------------|---------------|
| Free | 50 | 50 levels |
| Trial | 50 | 50 levels |
| Starter | 50 | 50 levels |
| Professional | 5,000 | 500 levels |
| Enterprise | Unlimited | Unlimited |

For threads with rich discussions (100+ comments), upgrading to Professional significantly improves the quality and coverage of extracted insights.

---

## Re-running analysis

If you upgrade your plan and want to re-analyse existing threads with deeper comment extraction, delete and re-save the threads to the Deck — this triggers a fresh download and analysis at your new plan's comment depth. Automatic re-analysis on plan upgrade is on the roadmap.

---

## Exporting analysis results

From the **Strategy** tab, you can export:

- **PDF report** — A formatted document with the market summary, pain points, triggers, and outcomes
- **JSON export** — Raw structured data for use in spreadsheets or other tools

Export history is retained based on your plan (3 days on Trial, up to 90 days on Professional).
