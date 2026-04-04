import { BUCKETS, TopicSelection } from "../config/topics.js";
import { getRecentLeads } from "../db/firestore.js";

// We'll reuse the recent leads or some other history to avoid repetition if needed,
// but for the Content Engine, we primarily care about not repeating the same topic.
// In the unified bot, we'll keep it simple for now.

export async function selectTopic(): Promise<TopicSelection> {
  // Flatten all bucket+subtopic combos
  const allOptions: TopicSelection[] = BUCKETS.flatMap((bucket) =>
    bucket.subtopics.map((sub) => ({
      bucket: bucket.name,
      subtopic: sub.name,
      angle: sub.angle,
    }))
  );

  // Pick a random one
  const randomIndex = Math.floor(Math.random() * allOptions.length);
  return allOptions[randomIndex];
}
