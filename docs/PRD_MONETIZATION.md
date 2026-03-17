# PRD: Monetization & Usage Limits (Founders Beta)

## 1. Objective
The goal is to move from "Unlimited" stubs to a sustainable "Usage-Protected" model that accounts for JustSerp (Discovery) and Gemini (Analysis) costs. The system must respect account tiers (Free vs. Founding) and provide clear UI/UX feedback when limits are approached or reached.

---

## 2. Plan Definitions & Limits

| Feature | Free Trial ($0) | Founding Access ($19) |
| :--- | :--- | :--- |
| **Price** | $0 Forever | $19 One-Time (Beta) |
| **Max Discovery Searches** | **3 Total** (1 scan/search) | **30 Total** (3-Query "Deep-Scan") |
| **Deep-Dive Blueprints** | **1 Total** | **10 Total** |
| **Saved Threads** | Max 5 | Unlimited (Cap at 500) |
| **Thread Depth** | 50 Comments | 500 Comments |
| **Search Density** | Standard (10 results) | **Triple Density** (30-40 results) |
| **Advanced Features** | Basic Pain Points | Full Signal Suite | **Radar, Team & Platform Multiplier** |

---

## 3. Cost Analysis (Per User Capacity)

Estimated based on current API pricing:
- **JustSerp (Discovery)**: ~$0.001 per search (assuming standard search tier).
- **Gemini 2.0 Flash (Analysis)**: ~$0.01 per 10k tokens.

### 3.1 Free Trial ($0)
- **Max Discovery Cost**: 3 searches $\times$ $0.001 = **$0.003**
- **Max Analysis Cost**: 1 report $\times$ $0.01 = **$0.01**
- **Total Acquisition Cost (CAC)**: **~$0.013 per user** (Insignificant).

### 3.2 Founding Access ($19)
- **Max Discovery Cost**: 30 uses $\times$ (3 queries/use $\times$ $0.001) = **$0.09**
- **Max Analysis Cost**: 10 reports $\times$ $0.01 = **$0.10**
- **Total Operational Cost**: **~$0.19 per user**.
- **Net Margin**: $19.00 - $0.19 = **$18.81 (99% Margin)**.

> [!NOTE]
> Even if users hit 100% of their limits, your cost per user remains under $0.25. This allows for massive scaling without immediate infrastructure debt.

---

## 3. Core Functional Requirements

### 3.1 Backend Gatekeeping (Instinctive Restriction)
- **Automatic Enforcement**: Every high-cost endpoint (`/api/fetch`, `/api/discovery/*`, `/api/analyze`) must call a `checkUsage(uid)` utility.
- **403 Forbidden**: If a user hits their limit, the API must return a `403` with a specific `errorCode` (e.g., `LIMIT_REACHED_DISCOVERY`).
- **Plan Resilience**: A change in Firestore `plan` field (e.g., manually changing "free" to "pro") must take effect instantly across all endpoints.

### 3.2 Usage Persistence (Firestore)
The `UserDoc` in Firestore will be extended to track usage:
- `discoveryCount`: Incremented on successful Discovery searches.
- `analysisCount`: Incremented on successful Full Analysis generation.
- `savedThreadCount`: Incremented when saving to a folder.

### 3.3 Discovery "Deep-Scan" Logic (Differentiation)
- **Free Logic**: Generate 1 optimized search query. Fetch top 10 results.
- **Paid Logic**: Generate 3 distinct search angles (e.g., specific pain, competitor failure, desired transition). Run 3 parallel Serper searches. De-duplicate results to provide 30-40 threads.

---

## 4. UI/UX & Visual Restrictions
### 3.4 Standard Plan (Roadmap - $39+/mo)
- **AI Signal Radar**: Automated weekly scans for new pain points with email summaries.
- **Multi-Platform Expansion**: Support for G2, Capterra, and Twitter (X).
- **Team Collaboration**: Shared "Competitive Decks" and collaborative research folders.
- **Increased Limits**: 50 Searches/mo, 20 Blueprints/mo.

### 4.1 The "Blurred Value" Strategy
To drive conversion, we show users what they *could* have:
- **Discovery Results**: Free users see all 30-40 results titles but cards 11-40 are **blurred** with an overlay: *"Upgrade to Founding Access to unlock 30+ more high-signal threads."*
- **Blueprint Insights**: Reveal the "Top 2 Pain Points", but blur the "Switching Triggers" and "Feature Gaps" for free users.

### 4.2 Usage Indicators & Paywalls
- **The "Fuel Gauge"**: A subtle progress bar in the sidebar or discovery header showing usage (e.g., *"Discovery Searches: 2/3"*).
- **Upgrade Modal**: A beautiful, high-friction modal that appears when a limit is hit, highlighting the $19 one-time value.

---

## 5. Marketing Page Alignment (`marketing/`)
-   Update `index.astro` pricing cards to strictly match the $0 / $19 model.
-   Replace "Standard Plan" (disabled) with a "Coming Soon" label for a $39/mo subscription.
-   Remove all references to "Unlimited" usage for the Beta tier.

---

## 6. Technical TODOs (Execution Order)
1. **[Backend]** Update `UserDoc` type and `getOrCreateUser` defaults.
2. **[Backend]** Implement usage increment helpers.
3. **[Backend]** Create `usageGuard` middleware.
4. **[Backend]** Update `discoveryOrchestrator` to support 1-query vs 3-query modes based on plan.
5. **[Frontend]** Update `useAuth` hook to return usage stats alongside plan.
6. **[Frontend]** Build `UpgradeModal` and `BlurredCard` components.
7. **[Frontend]** Reflect usage bars in `HomeView` and `DiscoveryWorkbench`.
8. **[Marketing]** Sync Astro pricing with actual plan limits.
