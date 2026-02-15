import type { ThreadData } from "@core/reddit/types.js";

const API_BASE = "/api";

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
}

// ── Auth header helper ─────────────────────────────────────────────

let getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
    getToken = fn;
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

// ── Create Checkout Session ────────────────────────────────────────

export async function createCheckoutSession(): Promise<string> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/create-checkout-session`, {
        method: "POST",
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed" }));
        throw new Error(error.error || "Failed to create checkout session");
    }

    const data = await response.json();
    return data.url;
}

// ── Create Portal Session ──────────────────────────────────────────

export async function createPortalSession(): Promise<string> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/create-portal-session`, {
        method: "POST",
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed" }));
        throw new Error(error.error || "Failed to open billing portal");
    }

    const data = await response.json();
    return data.url;
}
