import type { ThreadData } from "@core/reddit/types.js";

const rawApiBase = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
export const API_BASE = rawApiBase.endsWith("/api") ? rawApiBase : `${rawApiBase}/api`;



// ── Plan config type (matches server PlanConfig) ───────────────────

export interface PlanConfig {
    commentLimit: number;
    rateLimit: number;
    rateLimitWindow: number;
    maxMoreCommentsBatches: number;
    bulkDownload: boolean;
    apiAccess: boolean;
    exportHistory: boolean;
    exportHistoryDays: number;
    priorityQueue: boolean;
    discoveryLimit: number;
    analysisLimit: number;
    savedThreadLimit: number;
    commentDepth: number;
    monitorLimit: number;
    subredditsPerMonitor: number;
    teamSeats: number;
}

export type PlanType = "free" | "trial" | "starter" | "pro" | "professional" | "beta" | "enterprise" | "past_due";

export interface UserUsage {
    discoveryCount: number;
    analysisCount: number;
    savedThreadCount: number;
    monitorCount: number;
    totalSubreddits: number;
    leadsFound: number;
    newLeadsCount: number;
}

// ── Auth header helper ─────────────────────────────────────────────

let getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
    getToken = fn;
}

export async function getAuthToken(): Promise<string | null> {
    return getToken ? getToken() : null;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (getToken) {
        const token = await getToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }
    }
    return headers;
}

// ── Thread metadata (extended with truncation info) ────────────────

export interface ThreadMetadata {
    fetchedAt: string;
    totalCommentsFetched: number;
    commentsReturned: number;
    truncated: boolean;
    commentLimit?: number;
    toolVersion: string;
}

export interface FetchOptions {
    url: string;
    sort?: string;
}

export interface FetchResult extends ThreadData {
    metadata: ThreadMetadata;
}

// ── Fetch thread ───────────────────────────────────────────────────

export async function fetchThread(options: FetchOptions): Promise<FetchResult> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/fetch`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            url: options.url,
            sort: options.sort || "confidence",
        }),
    });

    if (response.status === 429) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
            `Rate limited. Please wait ${data.retryAfter || 60} seconds.`
        );
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Network error" }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}


// ── Fetch Folder Analysis ──────────────────────────────────────────

export async function deactivateMonitor(folderId: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/folders/${folderId}/deactivate`, {
        method: 'PATCH',
        headers,
    });
    if (!res.ok) throw new Error('Failed to deactivate monitor');
}

export async function fetchFolderAnalysis(folderId: string): Promise<any | null> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/folders/${folderId}/analysis`, {

        method: "GET",
        headers,
    });

    if (response.status === 404) return null;

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Failed to fetch analysis: ${response.status}`);
    }

    return response.json();
}
export async function fetchUserStats(): Promise<any> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/user/stats`, {
        method: "GET",
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch user stats");
    }

    return response.json();
}

export async function aggregateInsights(folderId: string): Promise<any> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/folders/${folderId}/analyze`, {
        method: "POST",
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Failed to aggregate insights: ${response.status}`);
    }

    return response.json();
}

export async function createRazorpayOrder(): Promise<any> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/payments/create-order`, {
        method: "POST",
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to create payment order");
    }

    return response.json();
}

export async function createDodoCheckout(plan: 'starter' | 'professional'): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/payments/dodo/create-session`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to create checkout session');
    }

    const { checkout_url } = await response.json();
    window.location.href = checkout_url;
}
