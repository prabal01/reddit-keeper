# MVP UI/UX Design Document: Monitoring-First Reddit Discovery

## 1. Introduction
This document outlines how we will adapt the existing Opinion Deck / Reddit Downloader UI to meet the "Monitoring-First" MVP product specification derived from the RedShip competitor analysis. 

The core objective is to transition from purely fetching links to surfacing **recurring customer pain-points (Patterns)** and immediate **engagement opportunities (Threads)**.

## 2. Adapting the Current UI

Our existing application already has a sophisticated UI that we can leverage and tweak to match the MVP spec.

### 2.1 Onboarding & Discovery Phase (`web/src/components/discovery/DiscoveryWorkbench.tsx`)
The current Discovery Workshop uses a 3-stage stepper. We will adapt these steps:

*   **Step 0 (Selection) - `ResearchModeCards.tsx`:** 
    *   *Current:* Chooses the analysis mode.
    *   *MVP Adaptation:* Modify the phrasing to emphasize "Monitoring". e.g., "Monitor Competitor", "Find Pain Points", "Discover Leads".
*   **Step 1 (Context) - `DiscoveryInput.tsx`:** 
    *   *Current:* Guided input (Problem/Audience).
    *   *MVP Adaptation:* Keep this. We already support URL/keyword input. We will ensure the prompt clearly asks: "What product or topic do you want to monitor?"
*   **Step 2 (Results) - `DiscoverySuccessView.tsx` & `ResultGrid`:** 
    *   *Current:* Shows Intelligence summary and an interactive thread grid.
    *   *MVP Adaptation (CRITICAL):* Transform this step into a split-screen or tabbed view.
        *   **Tab A: Patterns (Recurring Complaints):** Leverage `AnalysisResults.tsx` and `IntelligenceScanner.tsx` UI metaphors to display clustered insights (e.g., "Feature X missing (8 mentions)") with a sample user quote.
        *   **Tab B: Opportunities (Lead Threads):** Reuse `ResultGrid` to list specific Reddit threads. We will add actionable buttons: "Reply (external link)", "Save as Lead", and "Dismiss".

### 2.2 Monitoring Dashboard & CRM (`web/src/components/FolderDetail.tsx`)
Once the initial discovery is completed, users enter the "Monitoring Phase".

*   **Saved Leads / CRM:** 
    *   *Current:* Users save threads into Folders.
    *   *MVP Adaptation:* `FolderDetail.tsx` will act as our lightweight CRM. When an "Opportunity" is saved, it lands here. We will augment the UI to include a "Status" badge (New, Contacted, Ignored).
*   **Routine Updates (Intelligence Digest):**
    *   *MVP Adaptation:* Introduce a dashboard widget inside `FolderDetail.tsx` or a dedicated `ReportsView.tsx` to show the Weekly/Daily Pattern Digest (e.g., "3 new high-intent threads found since yesterday"). 

### 2.3 Navigation & Alerts
*   **Header/Sidebar (`Sidebar.tsx`):** Add an "Alerts" or "Inbox" notification pin to indicate when background monitoring has found new high-scoring leads.
*   **Loading States (`DiscoveryLoadingState.tsx`):** We will update the cycling messages to reflect "Scanning Reddit...", "Analyzing pain points...", "Scoring threads for relevance...".

## 3. User Flow Summary

1. User clicks **"New Research"**.
2. Selects Mode, enters URL or Keywords in **Discovery Input**.
3. **Loading UX** plays while the backend fetches initial data (Pushshift/Reddit API) and runs AI clustering.
4. User lands on **Discovery Results**. They select a Tab: "Patterns" (Insights) vs "Opportunities" (Leads).
5. User clicks **"Save as Lead"** on an opportunity.
6. User visits **Folder/CRM** to manage leads and view ongoing alerts populated by the background monitoring workers.

## 4. UI Component Reusability Checklist
- [x] Use `DiscoveryWorkbench.tsx` for the main MVP funnel.
- [x] Duplicate and refactor `AnalysisResults.tsx` logic for the new "Patterns" tab.
- [x] Expand `FolderDetail.tsx` to handle Lead CRM statuses.
- [x] Tweak existing `Skeleton.tsx` and `PremiumLoader.tsx` for fast perceived performance during live monitoring scans.
