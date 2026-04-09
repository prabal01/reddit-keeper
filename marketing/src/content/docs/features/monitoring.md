---
title: Monitoring
description: Set up continuous monitors that automatically surface new leads and patterns from Reddit communities.
section: Features
order: 4
---

# Monitoring

Monitoring is OpinionDeck's continuous intelligence system. Instead of manually running discovery searches, you configure a Monitor once and OpinionDeck scans your chosen subreddits on an ongoing basis — delivering new leads and market patterns directly to your dashboard.

---

## What is a Monitor?

A Monitor consists of:

| Field | Description |
|-------|-------------|
| **Name** | A label for this monitor (e.g. "Notion Competitors") |
| **Website context** | A short description of your product or the market you're tracking (e.g. "Alternative to Notion for small teams") |
| **Subreddits** | A list of subreddit names to scan (e.g. `productivity`, `startups`, `entrepreneur`) |

OpinionDeck uses the website context to score incoming posts — the more a post's content matches your context, the higher its relevance score.

---

## Creating a Monitor

From the **Monitoring** section of the dashboard:

1. Type your product description or competitor name into the input field
2. Click **Propose** — OpinionDeck's AI will suggest:
   - A list of relevant subreddits to watch
   - A refined website context
3. Review and adjust the proposed subreddits
4. Click **Start Monitoring**

<figure>
  <img src="/docs/monitoring-dashboard.png" alt="Monitor creation form showing AI-proposed subreddits and website context fields" style="width:100%;border-radius:12px;border:1px solid #2a2a4a;" />
  <figcaption>Creating a new monitor — the AI proposes relevant subreddits based on your context</figcaption>
</figure>

OpinionDeck will immediately run the first scan and return to your Monitoring Dashboard.

---

## Monitor limits by plan

| Plan | Max monitors | Subreddits per monitor |
|------|-------------|------------------------|
| Free | 0 | — |
| Trial | 3 | 10 |
| Starter | 3 | 10 |
| Professional | 10 | 20 |
| Enterprise | Unlimited | Unlimited |

If you've reached your plan's monitor limit, you'll see an **Upgrade plan** prompt when trying to create a new monitor.

---

## How scanning works

Once a Monitor is active, OpinionDeck scans your subreddits **every 8 hours**. Each run checks for posts published since the previous scan. The pipeline:

1. **Fetches new posts** from each subreddit
2. **Scores each post** using the website context as a relevance signal:
   - Intent keyword matches (frustration, alternative, comparison, recommendation)
   - Post engagement (score + comment count)
   - Post freshness (newer posts score higher)
   - Community quality (established subreddits with active discussion)
3. **Filters low-relevance posts** — only posts above the scoring threshold are saved
4. **Creates Lead records** for high-scoring posts
5. **Groups patterns** — if the same pain point appears across multiple posts, it's flagged as a recurring Pattern

---

## Leads feed

The Leads feed (accessible from the **Inbox** tab of any Research Deck) shows all posts that matched your monitor's criteria.

<figure>
  <img src="/docs/leads-feed.png" alt="Leads feed showing Reddit users with match scores, intent tags, and thread snippets" style="width:100%;border-radius:12px;border:1px solid #2a2a4a;" />
  <figcaption>The Leads feed — Reddit users surfaced by your monitors with relevance scores</figcaption>
</figure>

Each lead shows:
- Post title and subreddit
- Post author
- Relevance score
- Status badge: `new`, `contacted`, or `ignored`
- Link to the original Reddit thread

### Lead statuses

| Status | Meaning |
|--------|---------|
| `new` | Newly discovered, not yet actioned |
| `contacted` | You've reached out to this user |
| `ignored` | Not relevant; removed from your active feed |

Update a lead's status by clicking the status badge.

---

## Patterns

Patterns are recurring themes that OpinionDeck extracts by grouping leads with similar content.

For example, if 5 different posts in your leads feed all mention *"can't export data"*, OpinionDeck will create a Pattern called "Data export issues" with a frequency count of 5.

Patterns appear in the **Pain Map** tab of your Research Deck. They're sorted by frequency — the most common patterns appear at the top.

<figure>
  <img src="/docs/pain-map.png" alt="Pain Map tab showing pain points, triggers, and outcomes clustered by frequency" style="width:100%;border-radius:12px;border:1px solid #2a2a4a;" />
  <figcaption>Patterns extracted from monitoring leads, sorted by frequency</figcaption>
</figure>

---

## Monitoring alerts

Every scan generates an alert in the **Inbox** tab timeline:

| Alert type | What it means |
|------------|--------------|
| ✅ **New leads** | Scan found matching posts; count shown |
| 🔵 **No new leads** | Scan ran but no posts met the threshold |
| ❌ **Scan error** | Something went wrong; will retry automatically |

Each alert is timestamped and shows the subreddit and keyword that triggered the scan.

---

## Deactivating a Monitor

To pause a monitor without deleting it, go to the **Configs** tab of its Research Deck and click **Deactivate Monitor**. The monitor stops scanning but all existing leads and patterns are preserved.

To permanently delete a monitor, delete the associated Research Deck from the Folders view.

---

## Tips for better monitoring

- **Be specific in your context** — "Project management tool for software engineering teams" performs better than "project management tool". The more specific, the more accurate the relevance scoring.
- **Watch smaller subreddits too** — Niche communities (e.g. `r/devops`, `r/solopreneur`) often have higher-intent users than large general ones.
- **Check the Patterns tab weekly** — Patterns that appear more than 3 times in a week are strong signals for product roadmap or marketing messaging.
- **Use lead statuses** — Marking leads as `contacted` or `ignored` keeps your feed clean and helps you track outreach.
