

## 1. Overview

**Feature Name:** Idea Discovery
**Location:** Sidebar → Discovery → *Idea Discovery (Sub-tab)*
**Purpose:** Convert a natural-language idea into high-relevance Reddit threads.

This feature only retrieves and ranks relevant discussions.
It does NOT analyze them.

Users can then:

* Select threads
* Save to folder
* Trigger analysis manually (existing flow)

---

## 2. Problem Statement

Users often:

* Don’t know what keywords to search
* Think in ideas, not search queries
* Miss relevant threads due to poor phrasing

Idea Discovery bridges:
Natural language idea → Structured search queries.

---

## 3. Goals

Primary Goal:

* Generate high-relevance threads from vague idea descriptions.

Secondary Goals:

* Reduce keyword guessing.
* Increase discovery quality.
* Improve thread selection quality before analysis.

---

## 4. Non-Goals

* No clustering
* No pain extraction
* No analysis
* No report preview
* No verdict or scoring
* No automatic folder creation

This is purely retrieval + ranking.

---

## 5. User Flow

### Step 1 – Entry

Sidebar
→ Discovery
→ Idea Discovery

User sees:

Title:
“Describe the idea or problem space you want to explore.”

Input:
Single structured text box.

Optional helper text:
“Mention who it’s for and the main problem.”

CTA:
“Find Relevant Discussions”

---

### Step 2 – Idea Processing

System performs:

1. Normalize idea text
2. Extract key entities and phrases
3. Generate query variations (5–10 max)
4. Deduplicate similar queries

No UI exposure of this step.

---

### Step 3 – Retrieval

For each generated query:

* Fetch top threads
* Apply lightweight ranking
* Deduplicate across queries
* Limit total results (e.g., 30–50 max)

---

### Step 4 – Ranking Logic (Lightweight Only)

Threads are ranked by:

* Relevance score (semantic similarity)
* Comment count
* Recency
* Keyword match strength

No heavy AI analysis.

---

### Step 5 – Display Results

Display exactly like normal Discovery results:

Each thread shows:

* Title
* Subreddit
* Comment count
* Score
* Age
* Snippet preview

Optional badges (lightweight signals only):

* High Engagement
* Recent Activity
* Strong Keyword Match

User can:

* Select threads
* Add to new folder
* Add to existing folder

After adding → normal analysis pipeline triggers.

---

## 6. Technical Flow

Input Idea
→ Phrase Extraction
→ Query Expansion
→ Reddit Retrieval
→ Ranking
→ Result List

No embeddings required if not already in system.
If embeddings exist, they may be reused for semantic matching.

Hard caps:

* Max queries generated
* Max threads retrieved per query
* Max total threads returned

---

## 7. Performance Requirements

* Response time target: < 5 seconds
* No LLM-heavy analysis in this stage
* Respect global Reddit rate limit
* Must use queue if needed
* Must cache query expansions

---

## 8. Data Handling

Do NOT store idea text permanently unless:

User explicitly saves threads to a folder.

Otherwise:
Idea session is ephemeral.

---

## 9. Edge Cases

If idea too vague:
Show:
“Try adding more detail about the user or problem.”

If idea too niche:
Return:
“Limited discussions found. Try broadening scope.”

If too many irrelevant matches:
Allow user to refine input.

---

## 10. Success Metrics

* Click-to-save rate (threads saved / threads shown)
* % of Idea Discovery sessions that result in folder creation
* Average threads selected per session
* Repeat usage rate

---

## 11. Key Principle

Idea Discovery should feel like:

“Smart search”

Not:

“Analysis engine”

It must stay lightweight, fast, and clean.

