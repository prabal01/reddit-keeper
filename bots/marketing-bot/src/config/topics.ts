export interface Subtopic {
  name: string;
  angle: string;
}

export interface Bucket {
  name: string;
  subtopics: Subtopic[];
}

export interface TopicSelection {
  bucket: string;
  subtopic: string;
  angle: string;
}

export const BUCKETS: Bucket[] = [
  {
    name: "problem_awareness",
    subtopics: [
      { name: "Validating before building", angle: "Don't build what nobody wants" },
      { name: "Vitamin vs painkiller ideas", angle: "Only painkillers get paid" },
      { name: "Talking to users first", angle: "Code is the last step, not the first" },
      { name: "Market pull vs push", angle: "Build what people are already searching for" },
      { name: "Mistaking features for problems", angle: "Features aren't problems, outcomes are" },
    ],
  },
  {
    name: "build_in_public",
    subtopics: [
      { name: "Sharing revenue honestly", angle: "Real numbers build real trust" },
      { name: "Transparent product decisions", angle: 'Show the "why" behind every pivot' },
      { name: "Learning from failures", angle: "Failures shared become lessons for others" },
      { name: "Weekly build updates", angle: "Consistency > virality" },
      { name: "Open roadmaps & priorities", angle: "Let your users see what's next" },
    ],
  },
  {
    name: "tactical_advice",
    subtopics: [
      { name: "First 100 users", angle: "Distribution > product at day 1" },
      { name: "Landing page conversion", angle: "One CTA, one promise, one proof" },
      { name: "Pricing your SaaS", angle: "Price on value, not on cost" },
      { name: "Cold outreach that works", angle: "Personalization beats volume" },
      { name: "SEO for early-stage", angle: "Start writing before you start coding" },
      { name: "Choosing your tech stack", angle: "Boring tech ships faster" },
    ],
  },
  {
    name: "contrarian_takes",
    subtopics: [
      { name: "MVPs are still too big", angle: "Ship in days, not months" },
      { name: "Fundraising isn't the answer", angle: "Revenue > funding for most SaaS" },
      { name: "Competition is good", angle: "Competition validates the market" },
      { name: "First-mover myth", angle: "Fast followers win more often" },
      { name: "Perfection kills startups", angle: "Done > perfect, always" },
      { name: "Solo founder advantage", angle: "Small teams move 10x faster" },
    ],
  },
];

export const TONE_PROMPT = `You are a SaaS founder building in public. Your writing style is hyper-valuable, direct, opinionated, and zero fluff. You never sound salesy. You are an expert casually sharing a deep, hard-earned insight. You provide actionable frameworks or brutal truths that founders immediately realize they needed to hear.`;

export const PRODUCT_CONTEXT = `Product Context: You built OpinionDeck, a tool that helps validate startup ideas by analyzing deep discussions from Reddit and Hacker News. 
Rule: Always lead with pure value, a framework, or an insight about the Topic. The mention of OpinionDeck must feel like a seamless, natural byproduct of the problem you just solved, not an advertisement.`;
