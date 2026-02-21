Perfect. You’re thinking correctly now.

We’re not just patching compliance.
We’re redesigning Discovery as a **guided research workflow**.

Below is a detailed PRD you can feed directly into Google’s Antigravity (or any AI coding assistant).

This includes:

* Context
* Problem
* Goals
* UX changes
* Technical architecture
* Compliance constraints
* Edge cases
* Metrics
* Rollout plan

---

# 📘 PRD

## Feature: Guided Discovery Workflow (Compliance-Safe Architecture)

---

# 1. Background & Context

OpinionDeck is a competitive intelligence Chrome extension that:

* Extracts public discussions (Reddit, etc.)
* Allows saving threads to Decks
* Generates AI-powered build prioritization reports

Current issue:

Discovery research is triggered directly from the dashboard and executed in the background without explicit confirmation inside the extension UI.

This creates:

* Elevated Chrome Web Store rejection risk
* Background automation classification risk
* Lower perceived intentionality
* Reduced premium feel

We are redesigning Discovery into a **guided, user-approved workflow executed via the Side Panel**.

---

# 2. Problem Statement

Current flow:

Dashboard → Extension background → DISCOVERY_SEARCH → multiple Reddit queries executed silently.

Risks:

* Background automation without visible extension UI.
* Harder to defend during Chrome review.
* Less premium UX.
* Less user awareness of data processing.

We must:

* Make Discovery explicitly user-approved.
* Make research visible and intentional.
* Reduce background automation risk.
* Maintain moat and perceived intelligence.

---

# 3. Goals

### Primary Goals

1. Move Discovery execution from background-triggered to side-panel-controlled.
2. Add explicit user confirmation before research begins.
3. Introduce step-based research workflow.
4. Maintain strong UX and perceived magic.
5. Preserve build prioritization moat.

---

### Secondary Goals

* Reduce Chrome rejection risk.
* Improve perceived professionalism.
* Enable future monetization of deep research tiers.
* Make Discovery feel like a “Research Session”.

---

# 4. Non-Goals

* We are NOT removing Discovery.
* We are NOT exposing technical implementation details.
* We are NOT reducing intelligence quality.
* We are NOT removing multi-query architecture.

---

# 5. Proposed New Discovery Flow

---

## Step 0 – Trigger

User clicks “Discover Competitor” in Dashboard.

Dashboard sends:

```
action: "OPEN_DISCOVERY_PANEL"
competitor: "Notion"
```

Background:

* Opens side panel.
* Sends competitor name to side panel UI.

NO research starts yet.

---

## Step 1 – Research Setup Screen (Side Panel)

Display:

Title:

> Research Competitive Signals

Body:

> OpinionDeck will analyze public discussions about **[Competitor]** to identify:
>
> • Recurring complaints
> • Feature frustration
> • Switching behavior
> • Alternative tools mentioned
>
> This research runs only after your approval.

Buttons:

[ Start Research ]
[ Cancel ]

---

## Step 2 – Phase-Based Research Execution

After approval:

### Phase 1 – Pain Points

Run 2–3 Reddit search queries.

Show:

> Identifying recurring complaints...

Progress UI (spinner + label).

After completion:

Show:

> 12 high-signal complaint threads identified.

Button:
[ Next: Switching Behavior ]
[ Cancel Research ]

---

### Phase 2 – Switching Behavior

Run 2–3 additional queries.

Show:

> Detecting switching signals...

After completion:

> 8 discussions where users mention alternatives.

Button:
[ Finalize Discovery ]
[ Cancel ]

---

### Phase 3 – Final Ranking

Rank and dedupe.
Return top 20 results.

Send results back to dashboard via postMessage.

---

# 6. Technical Architecture Changes

---

## 6.1 Remove Direct Discovery Trigger

Remove:

```
OPINION_DECK_DISCOVERY_REQUEST → DISCOVERY_SEARCH
```

Replace with:

```
OPINION_DECK_DISCOVERY_REQUEST → OPEN_DISCOVERY_PANEL
```

---

## 6.2 Background Responsibilities

Background:

* Receives OPEN_DISCOVERY_PANEL
* Calls:

```
chrome.sidePanel.open()
```

* Sends competitor context to side panel

Discovery execution must only occur after:

Side panel sends:

```
action: "START_DISCOVERY"
```

---

## 6.3 Side Panel Responsibilities

Side panel must:

* Render approval screen
* Manage phase progression
* Trigger DISCOVERY_SEARCH with phase parameter
* Handle progress messages
* Handle cancel logic
* Enforce max call caps

---

# 7. Compliance Guardrails

---

## 7.1 Hard API Limits

Per Discovery session:

* Max total search queries: 6–10
* Max posts per query: 40
* Delay between queries: >= 800ms
* Visible cancellation button

---

## 7.2 No Silent Execution

Discovery must:

* Only execute when side panel is visible.
* Only execute after explicit user click.
* Never run automatically.

---

## 7.3 Transparency Language

We do NOT show technical mechanics.

We DO show purpose-based transparency.

Example:

> This research analyzes public discussions you approve.

---

# 8. Deep vs Shallow Thread Copy (Enhancement)

When saving thread:

If comments > 200:

Prompt user:

> This thread contains 1,200 comments.
>
> Choose extraction depth:
>
> [ Shallow Analysis (First 200 Comments) ]
> [ Deep Analysis (Up to 1,000 Comments) ]

Deep option may be:

* Slower
* Premium-tier in future

---

# 9. UX Design Changes

We will add:

1. Research Setup screen
2. Phase progress screen
3. Cancel button at every stage
4. Final result confirmation state
5. Smooth animated state transitions

Visual style must match:

Current dark gradient UI in screenshot.

---

# 10. Error Handling

* If Reddit rate-limits → show:

  > Platform is temporarily limiting requests. Please retry in a moment.

* If session aborted → clean reset state.

* If side panel closed mid-session → auto-cancel.

---

# 11. Analytics & Telemetry

Track:

* % users approving research
* % users completing full research
* Avg research duration
* Avg threads returned
* Cancellation rate
* Conversion to save-to-deck

---

# 12. Success Metrics

Post-launch:

* Chrome Web Store approval
* No rejection related to automation
* Increased perceived product professionalism
* Increased save-to-deck after discovery
* Improved paid conversion (future)

---

# 13. Rollout Plan

Phase 1:

* Implement guided discovery
* Remove direct background trigger
* Add UI gating

Phase 2:

* Add deep/shallow toggle
* Add research session analytics

Phase 3:

* Introduce “Deep Research (Pro)” positioning

---

# 14. Risks

* Slight increase in friction.
* Slight increase in user flow complexity.
* Slightly longer discovery time.

Mitigation:

Premium feel + visible progress + strong output.

---

# 15. Strategic Outcome

This redesign transforms OpinionDeck from:

“Background scraper”

Into:

“Guided Competitive Research Assistant.”

That strengthens:

* Compliance
* Brand perception
* Monetization positioning
* Investor defensibility
* Platform risk profile

