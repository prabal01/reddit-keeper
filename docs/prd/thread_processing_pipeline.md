# PRD: Granular Thread Processing Pipeline

## Context
Currently, the system attempts to analyze all threads in a folder in a single batch. This limits quality, risks hallucinations, and doesn't scale well with long threads or large folders.

## Objectives
- **Quality**: Analyze each thread individually to extract deeper, grounded insights.
- **Scale**: Pipeline should handle $N$ threads in parallel using background workers.
- **Granularity**: Track the status of every single thread in real-time.

## Technical Architecture

### 1. Data Flow
1. **Sync Completion**: Once a folder sync is finished, a trigger (or manual button) initiates the Analysis Phase.
2. **Enqueued Jobs**: Every thread in the folder is added to an `analysisQueue` (BullMQ).
3. **Parallel Processing**: Multiple workers pick up threads and call the LLM using a specialized, constraint-heavy prompt.
4. **Insight Storage**: Results are saved to a `threadInsights` subcollection or indexed by `threadId`.
5. **Real-time Aggregation**: The UI listens to these changes and calculates live metrics.

### 2. LLM Insight Schema
```typescript
interface StructuredThreadInsights {
  thread_id: string;
  pain_points: [
    {
      title: string; // canonical, max 6 words
      quotes: string[]; // verbatim
    }
  ];
  switch_triggers: [
    {
      title: string;
      quotes: string[];
    }
  ];
  desired_outcomes: [
    {
      title: string;
      quotes: string[];
    }
  ];
}
```

### 3. Prompt Constraints
- **Titles**: Lowercase, concrete, no adjectives, problem-focused, max 6-8 words.
- **Quotes**: Must be 100% verbatim from the thread text.
- **Prohibitions**: No strategic language, no mention counts, no ranking, no speculation.

### 4. Firestore Schema
- **Folder Updates**:
  - `analysisStatus`: 'idle' | 'processing' | 'complete'
- **Thread Analysis Tracking**:
  - `status`: 'processing' | 'success' | 'failed'
  - `threadLink`: string
  - `insightId`: string (ref to insight document)

## User Experience

### Folder View
- **Metrics Bar**: A persistent bar on top showing "Pain Points", "Switch Triggers", and "Desired Outcomes".
- **Real-time Stats**: Metrics show "Calculating..." until the first success, then update incrementally.
- **Thread List**: Each thread shows a "Processing" indicator with status colors (Blue for processing, Green for success, Red for failure).

## Implementation Phases
1. **Phase 1 (Current)**: Thread-level insights and status tracking.
2. **Phase 2 (Next)**: Aggregator phase to cluster granular insights into market-level strategy.
