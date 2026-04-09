---
title: FAQ
description: Answers to common questions about OpinionDeck, troubleshooting, and account management.
section: Reference
order: 9
---

# Frequently Asked Questions

---

## Getting started

### Do I need a credit card to sign up?
No. The free plan requires only an email and password. No credit card is needed until you upgrade to a paid plan.

### Do I need an invite code?
No. Registration is open — anyone can create a free account.

### How long does the trial last?
The trial lasts 3 days from the moment you sign up. After 3 days your account automatically moves to the free plan. No charge occurs unless you manually upgrade.

### Can I use OpinionDeck without creating an account?
No — Discovery Lab, monitoring, and analysis all require an account. You can explore the pricing and feature docs before signing up. Creating a free account takes under a minute and requires no credit card.

---

## Discovery

### How many results does a discovery search return?
Typically 20–50 results per search, depending on how much relevant content exists across Reddit and HN. Results are ranked by intent signals and engagement.

### Why did my search return no results?
A few possibilities:
- The query is too niche or too broad — try different phrasing
- Reddit may be temporarily rate-limiting requests — try again in a minute
- The search API's daily quota may be exhausted — results will be available again the next day

### Can I search in languages other than English?
Discovery is optimised for English-language content. Other languages may work but results quality is not guaranteed.

### Does OpinionDeck index all of Reddit?
No — OpinionDeck searches Reddit in real-time (live results) and also pulls from the Arctic Shift and PullPush historical archives. It does not maintain its own Reddit index.

### What is AI Brain and when should I use it?
AI Brain expands your single query into multiple semantically related searches. Use it when:
- You're exploring a new market and aren't sure which search terms to use
- You want broader coverage across adjacent pain points
- You have extra monthly discoveries to spare

Disable it when you want a fast, targeted search on a specific keyword.

---

## Monitoring

### How often do monitors scan subreddits?
Monitors run every 8 hours. Each scan checks for posts published since the previous run.

### Can I manually trigger a scan?
Not currently — monitors run automatically on their 8-hour schedule. Manual triggers are planned for a future release.

### Why are some leads not showing up?
Leads are only created for posts that score above OpinionDeck's relevance threshold. Posts that don't match your website context well enough will be filtered out. To capture more leads:
- Make your website context more specific
- Add more subreddits to your monitor
- Lower the score threshold in monitor settings (if available on your plan)

### What happens to leads when I delete a monitor?
Deleting the associated Research Deck permanently removes all leads and patterns. To preserve leads while stopping new scans, **deactivate** the monitor instead of deleting it.

### Can I have monitors for the same subreddit in different decks?
Yes. Multiple monitors can watch the same subreddit — each with a different website context. This lets you track the same community from different competitive angles.

---

## Analysis

### How long does analysis take?
Granular per-thread analysis typically completes in 30–90 seconds. Market summary generation (the Strategy tab) takes 1–3 minutes depending on how many threads are in the Deck.

### Why are there duplicate pain points?
The clustering algorithm groups semantically similar insights but may miss exact duplicates phrased very differently. If you notice duplicates, the deduplication pass will catch them on the next analysis run.

### Can I re-run analysis after upgrading my plan?
Yes. Delete and re-save the threads to the Deck — this triggers a fresh download and analysis at your new plan's comment depth. Automatic re-analysis on plan upgrade is on the roadmap.

### Why does the Strategy tab say "Not enough data"?
The market summary requires at least 3 analysed threads in the Deck. Add more threads from Discovery and wait for analysis to complete.

---

## Chrome Extension

### Which browsers are supported?
Chrome and all Chromium-based browsers (Edge, Brave, Arc). Firefox is not supported.

### The extension shows "Not signed in" even though I'm logged in
Try signing out of the extension and signing back in. If the issue persists, clear the extension's storage from `chrome://extensions` → OpinionDeck → Extension options.

### Deep extraction is very slow
Deep extraction on large threads (1,000+ comments) can take 30–60 seconds. This is normal — the extension is making multiple API calls to Reddit to load all comment branches. If it times out, try shallow extraction first.

### Can the extension work on private Reddit communities?
No. The extension can only access publicly visible Reddit content.

---

## Account & billing

### How do I upgrade my plan?
Click **Upgrade Plan** in the left sidebar or go to **Settings** to manage your plan. You'll be redirected to a secure checkout page.

### Can I downgrade my plan?
Yes. Contact [hello@opiniondeck.com](mailto:hello@opiniondeck.com) to request a downgrade. Downgrade takes effect at the end of your current billing period.

### What payment methods are accepted?
OpinionDeck accepts all major credit and debit cards via Dodo Payments.

### How do I cancel my subscription?
Email [hello@opiniondeck.com](mailto:hello@opiniondeck.com) to cancel. Cancellation takes effect at the end of the current billing period.

### Can I get a refund?
Yes, within 7 days of subscribing. See the [Refund Policy](/refund) for details.

---

## Data & privacy

### Where is my data stored?
OpinionDeck stores data in Google Firestore (us-east1 region). Thread content and large analysis payloads are stored in Google Cloud Storage.

### Does OpinionDeck store the full Reddit thread content?
Yes — when you save a thread to a Deck, OpinionDeck downloads and stores the post body and comments. This is necessary for the AI analysis to work offline.

### Can I export my data?
Yes. From the **Strategy** tab of any Deck, click **Export** to download your analysis as PDF or JSON. You can also request a full account data export by emailing [hello@opiniondeck.com](mailto:hello@opiniondeck.com).

### Does OpinionDeck comply with Reddit's Terms of Service?
OpinionDeck uses the official Reddit JSON API and respects Reddit's rate limits. Thread data is fetched for personal research purposes and is not redistributed.

---

## Still need help?

Email us at [hello@opiniondeck.com](mailto:hello@opiniondeck.com) or visit the [Contact](/contact) page.
