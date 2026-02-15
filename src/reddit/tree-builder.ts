import type {
    RedditThing,
    RedditListing,
    RedditPostData,
    RedditCommentData,
    RedditMoreData,
    Post,
    Comment,
} from "./types.js";

/**
 * Transform raw Reddit post data into our clean Post type
 */
export function transformPost(raw: RedditPostData): Post {
    return {
        id: raw.id,
        title: raw.title,
        author: raw.author,
        subreddit: raw.subreddit,
        selftext: raw.selftext,
        url: raw.url,
        score: raw.score,
        upvoteRatio: raw.upvote_ratio,
        numComments: raw.num_comments,
        createdUtc: raw.created_utc,
        permalink: `https://www.reddit.com${raw.permalink}`,
        flair: raw.link_flair_text,
        isSelf: raw.is_self,
        isNsfw: raw.over_18,
        isSpoiler: raw.spoiler,
        isLocked: raw.locked,
        isArchived: raw.archived,
    };
}

/**
 * Transform a raw Reddit comment into our clean Comment type (without replies — those are attached later)
 */
export function transformComment(raw: RedditCommentData): Comment {
    return {
        id: raw.id,
        author: raw.author ?? "[deleted]",
        body: raw.body ?? "[deleted]",
        score: raw.score ?? 0,
        createdUtc: raw.created_utc,
        parentId: raw.parent_id,
        depth: raw.depth ?? 0,
        isSubmitter: raw.is_submitter ?? false,
        edited: typeof raw.edited === "number",
        distinguished: raw.distinguished,
        stickied: raw.stickied ?? false,
        replies: [],
    };
}

/**
 * Recursively extract comments from the Reddit API response, collecting
 * all comments into a flat list and gathering "more" IDs to fetch later.
 */
export function extractCommentsFromListing(
    listing: RedditThing<RedditListing<RedditCommentData | RedditMoreData>>
): { comments: Comment[]; moreIds: string[]; linkId: string } {
    const comments: Comment[] = [];
    const moreIds: string[] = [];
    let linkId = "";

    if (!listing?.data?.children) {
        return { comments, moreIds, linkId };
    }

    for (const child of listing.data.children) {
        if (child.kind === "t1") {
            const commentData = child.data as RedditCommentData;
            const comment = transformComment(commentData);

            if (!linkId && commentData.link_id) {
                linkId = commentData.link_id;
            }

            // Recursively process nested replies
            if (commentData.replies && typeof commentData.replies === "object") {
                const nested = extractCommentsFromListing(
                    commentData.replies as RedditThing<RedditListing<RedditCommentData | RedditMoreData>>
                );
                comment.replies = nested.comments;
                moreIds.push(...nested.moreIds);
                if (!linkId && nested.linkId) linkId = nested.linkId;
            }

            comments.push(comment);
        } else if (child.kind === "more") {
            const moreData = child.data as RedditMoreData;
            if (moreData.children && moreData.children.length > 0) {
                moreIds.push(...moreData.children);
            }
        }
    }

    return { comments, moreIds, linkId };
}

/**
 * Build a hierarchical comment tree from a flat list of comments
 * (used when processing /api/morechildren responses)
 */
export function buildTreeFromFlat(flatComments: Comment[], rootParentId: string): Comment[] {
    const byId = new Map<string, Comment>();
    const roots: Comment[] = [];

    // Index all comments
    for (const comment of flatComments) {
        comment.replies = [];
        byId.set(`t1_${comment.id}`, comment);
    }

    // Build parent-child relationships
    for (const comment of flatComments) {
        const parent = byId.get(comment.parentId);
        if (parent) {
            parent.replies.push(comment);
        } else {
            roots.push(comment);
        }
    }

    return roots;
}

/**
 * Merge additional comments into an existing comment tree.
 * Tries to insert new comments under their correct parent.
 */
export function mergeIntoTree(existingTree: Comment[], newComments: Comment[]): void {
    // Build a lookup of all existing comments
    const existingById = new Map<string, Comment>();

    function indexTree(comments: Comment[]) {
        for (const c of comments) {
            existingById.set(`t1_${c.id}`, c);
            indexTree(c.replies);
        }
    }
    indexTree(existingTree);

    for (const newComment of newComments) {
        const parent = existingById.get(newComment.parentId);
        if (parent) {
            parent.replies.push(newComment);
        } else {
            // This is a top-level reply or parent isn't in tree yet
            existingTree.push(newComment);
        }
        // Index the new comment so later comments can find it as parent
        existingById.set(`t1_${newComment.id}`, newComment);
    }
}

/**
 * Count total comments in a tree (including nested)
 */
export function countComments(comments: Comment[]): number {
    let count = 0;
    for (const c of comments) {
        count += 1 + countComments(c.replies);
    }
    return count;
}
