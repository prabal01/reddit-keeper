import crypto from "crypto";
import { RedditPost } from "../types.js";

/**
 * Strips a Reddit URL of tracking parameters
 */
export function cleanRedditUrl(url: string): string {
  const urlObj = new URL(url);
  return `${urlObj.origin}${urlObj.pathname}`.replace(/\/$/, "");
}

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

/**
 * Robust fetcher with retry logic and stealth headers to bypass 403 blocks.
 * Prioritizes the home-hosted fetcher bridge if REDDIT_SERVICE_URL is set.
 */
async function fetchWithRetry(url: string, maxRetries = 3): Promise<any> {
  const serviceUrl = process.env.REDDIT_SERVICE_URL;
  const internalSecret = process.env.INTERNAL_FETCH_SECRET;

  if (serviceUrl) {
    const fetcherEndpoint = `${serviceUrl.replace(/\/$/, "")}/fetch`;
    console.log(`[Reddit] Fetching via Bridge: ${url}`);
    
    try {
      const response = await fetch(fetcherEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${internalSecret}`
        },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        throw new Error(`BRIDGE_ERROR: ${response.status} - ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.warn(`[Reddit] Bridge fetch failed, falling back to direct: ${error.message}`);
    }
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) console.log(`[Reddit] Retrying native fetch (Attempt ${attempt}/${maxRetries})...`);
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.reddit.com/",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("retry-after") || "5");
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body.substring(0, 200)}`);
      }

      return await response.json();
    } catch (error: any) {
      if (attempt === maxRetries) throw error;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
}

/**
 * Extracts and flattens comments from Reddit's specialized listing format.
 */
function extractAllText(data: any): string {
  let text = "";
  
  // Post content
  if (data[0]?.data?.children?.[0]?.data) {
    const post = data[0].data.children[0].data;
    text += `# ${post.title}\n\n`;
    if (post.selftext) text += `${post.selftext}\n\n`;
  }

  // Comments
  const processComments = (listing: any) => {
    if (!listing?.data?.children) return;
    for (const child of listing.data.children) {
      if (child.kind === "t1") {
        const c = child.data;
        text += `--- Comment by u/${c.author} (${c.score} points) ---\n${c.body}\n\n`;
        if (c.replies?.data) processComments(c.replies);
      }
    }
  };

  if (data[1]) processComments(data[1]);
  return text;
}

/**
 * Fetches a Reddit thread natively using internal logic.
 * This bypasses the need for external CLI tools and build complexities.
 */
export async function fetchThread(url: string): Promise<RedditPost> {
  const cleanUrl = cleanRedditUrl(url);
  const jsonUrl = `${cleanUrl}.json?limit=100`;
  const sessionId = crypto.randomUUID();

  try {
    console.log(`[Reddit] Fetching thread natively: ${jsonUrl}`);
    const data = await fetchWithRetry(jsonUrl);
    
    if (!Array.isArray(data) || data.length < 2) {
      throw new Error("Invalid Reddit API response format");
    }

    const postData = data[0].data.children[0].data;
    const fullText = extractAllText(data);

    return {
      id: postData.id || sessionId,
      author: postData.author,
      title: postData.title,
      body: fullText, // The AI uses this for analysis
      permalink: `https://www.reddit.com${postData.permalink}`,
      score: postData.score || 0,
      created_utc: postData.created_utc || Date.now() / 1000,
      comments: [] // Content is already merged into the body for AI efficiency
    };

  } catch (error: any) {
    console.error(`[Reddit] Internal Fetch Error: ${error.message}`);
    throw new Error(`Reddit analysis failed: ${error.message}`);
  }
}

/**
 * Flattens a thread into a text block for AI ingestion.
 * reddit-dl already provides a high-quality text representation.
 */
export function flattenThread(thread: RedditPost): string {
  // If the body is coming from reddit-dl's text output, it's already flattened and formatted.
  return thread.body;
}
