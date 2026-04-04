import { Timestamp } from "@google-cloud/firestore";

/**
 * COMMON TYPES
 */
export type Status = "new" | "approved" | "posted" | "contacted" | "ignore";

/**
 * TWITTER CONTENT ENGINE TYPES
 */
export interface TopicSelection {
  bucket: string;
  subtopic: string;
  angle: string;
}

export interface Post {
  index: number;
  content: string;
  topic?: string;
}

export interface PostRecord {
  id: string;
  date: string;
  platform: "twitter";
  content: string;
  topic: string;
  status: Status;
  posted: boolean;
  bufferPostId?: string;
  createdAt: Date | Timestamp;
}

export interface PendingSession {
  topic: string;
  posts: Post[];
  editPendingIndex?: number;
  createdAt: any;
}

/**
 * REDDIT MARKETING AGENT TYPES
 */
export interface RedditPost {
  id: string;
  author: string;
  title?: string;
  body: string;
  permalink: string;
  score: number;
  created_utc: number;
  comments?: RedditComment[];
}

export interface RedditComment {
  id: string;
  author: string;
  body: string;
  permalink: string;
  score: number;
  created_utc: number;
  replies?: RedditComment[];
}

export interface MarketingAnalysis {
  lead: {
    username: string;
    score: number;
    reason: string;
    contextBio: string;
  };
  variants: {
    main: string;
    short: string;
    casual: string;
  };
}

export interface MarketingLead {
  id: string;
  username: string;
  threadUrl: string;
  commentText: string;
  intensityScore: number;
  analysis: string;
  contextBio: string;
  status: 'new' | 'contacted' | 'ignore';
  createdAt: any;
}

/**
 * TELEGRAM ACTION TYPES
 */
export type UserAction =
  | { type: "generate"; raw?: string }
  | { type: "select"; index: number }
  | { type: "edit"; index: number; feedback: string }
  | { type: "confirm_edit" }
  | { type: "reject_edit" }
  | { type: "skip" }
  | { type: "help" }
  | { type: "reddit_url"; url: string }
  | { type: "save_lead"; username: string }
  | { type: "ignore_lead" }
  | { type: "unknown"; raw: string };

/**
 * PUBLISHER INTERFACES
 */
export interface PublishResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface Publisher {
  publish(content: string): Promise<PublishResult>;
}
