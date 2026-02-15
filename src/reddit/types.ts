/**
 * TypeScript types for Reddit API data structures
 */

/** Raw Reddit API "Thing" wrapper */
export interface RedditThing<T> {
    kind: string;
    data: T;
}

/** Reddit Listing (paginated container) */
export interface RedditListing<T> {
    modhash: string;
    dist: number;
    children: RedditThing<T>[];
    after: string | null;
    before: string | null;
}

/** Raw post data from Reddit API */
export interface RedditPostData {
    id: string;
    name: string; // fullname, e.g. t3_abc123
    title: string;
    author: string;
    subreddit: string;
    selftext: string;
    url: string;
    score: number;
    upvote_ratio: number;
    num_comments: number;
    created_utc: number;
    permalink: string;
    link_flair_text: string | null;
    is_self: boolean;
    over_18: boolean;
    spoiler: boolean;
    locked: boolean;
    archived: boolean;
}

/** Raw comment data from Reddit API */
export interface RedditCommentData {
    id: string;
    name: string; // fullname, e.g. t1_xyz789
    author: string;
    body: string;
    body_html: string;
    score: number;
    created_utc: number;
    parent_id: string;
    link_id: string;
    depth: number;
    is_submitter: boolean;
    edited: boolean | number;
    distinguished: string | null;
    stickied: boolean;
    replies: "" | RedditThing<RedditListing<RedditCommentData>>;
}

/** "More" comments placeholder from Reddit API */
export interface RedditMoreData {
    id: string;
    name: string;
    parent_id: string;
    depth: number;
    count: number;
    children: string[];
}

// --- Parsed / Clean types used by our app ---

/** Clean post object */
export interface Post {
    id: string;
    title: string;
    author: string;
    subreddit: string;
    selftext: string;
    url: string;
    score: number;
    upvoteRatio: number;
    numComments: number;
    createdUtc: number;
    permalink: string;
    flair: string | null;
    isSelf: boolean;
    isNsfw: boolean;
    isSpoiler: boolean;
    isLocked: boolean;
    isArchived: boolean;
}

/** Clean comment object with nested replies */
export interface Comment {
    id: string;
    author: string;
    body: string;
    score: number;
    createdUtc: number;
    parentId: string;
    depth: number;
    isSubmitter: boolean;
    edited: boolean;
    distinguished: string | null;
    stickied: boolean;
    replies: Comment[];
}

/** Complete thread data (post + all comments) */
export interface ThreadData {
    post: Post;
    comments: Comment[];
    metadata: {
        fetchedAt: string;
        totalCommentsFetched: number;
        toolVersion: string;
    };
}

/** CLI options */
export interface CLIOptions {
    format: "md" | "json" | "text";
    output?: string;
    stdout: boolean;
    copy: boolean;
    minScore?: number;
    maxDepth?: number;
    sort: string;
    skipDeleted: boolean;
    opOnly: boolean;
    top?: number;
    tokenCount: boolean;
}

/** Parsed Reddit URL info */
export interface RedditUrlInfo {
    subreddit: string;
    postId: string;
    fullUrl: string;
}
