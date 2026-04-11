const rawApiBase = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
export const API_BASE = rawApiBase.endsWith("/api") ? rawApiBase : `${rawApiBase}/api`;

let getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
    getToken = fn;
}

export async function getAuthToken(): Promise<string | null> {
    return getToken ? getToken() : null;
}

async function authHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (getToken) {
        const token = await getToken();
        if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

async function apiFetch<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, { headers: await authHeaders() });
    if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
    return res.json() as Promise<T>;
}

// ── Typed KPI fetchers ─────────────────────────────────────────────

export type PlanType = "free" | "trial" | "starter" | "pro" | "professional" | "beta" | "enterprise" | "past_due";

export interface GrowthKPI {
    planDist: Record<string, number>;
    daily: { date: string; newUsers: number; newAnalyses: number; [key: string]: string | number }[];
    metrics: { totalUsers: number; totalFolders: number; totalAnalyses: number };
}

export interface EngagementKPI {
    usersWithAnalysis: number;
    usersWithDiscovery: number;
    usersWithMonitor: number;
    totalMonitors: number;
    totalDiscoveries: number;
    totalAnalyses: number;
    avgAnalysesPerUser: number;
    avgDiscoveriesPerUser: number;
}

export interface DauPoint {
    date: string;
    dau: number;
    [key: string]: string | number;
}

export interface FunnelKPI {
    signups: number;
    hasFolder: number;
    hasSavedThread: number;
    hasAnalysis: number;
    hasMonitor: number;
}

export interface HealthKPI {
    totalFolders: number;
    processingFolders: number;
    failedFolders: number;
    completedFolders: number;
    successRate: number;
    queues: {
        sync: Record<string, number>;
        granular: Record<string, number>;
    };
}

export interface CohortRow {
    week: string;
    total: number;
    plans: Record<string, number>;
}

export interface AdminUser {
    uid: string;
    email: string;
    plan: string;
    createdAt: string;
    analysisCount: number;
    discoveryCount: number;
    savedThreadCount: number;
    fetchCount: number;
}

export interface WaitlistEntry {
    id: string;
    email: string;
    status: "pending" | "invited";
    createdAt: string;
}

export interface InviteToken {
    id: string;
    code: string;
    maxUses: number;
    uses: number;
    createdAt: string;
}

export interface BullmqStats {
    sync: Record<string, number>;
    granular: Record<string, number>;
    analysis: { active: number; waiting: number; completed: number; failed: number };
    monitoring_scraper: Record<string, number>;
    monitoring_matcher: Record<string, number>;
}

export const adminApi = {
    me: () => apiFetch<{ ok: boolean; email: string }>('/admin/me'),
    growth: () => apiFetch<GrowthKPI>('/admin/kpis/growth'),
    engagement: () => apiFetch<EngagementKPI>('/admin/kpis/engagement'),
    dau: (days = 30) => apiFetch<DauPoint[]>(`/admin/kpis/dau?days=${days}`),
    funnel: () => apiFetch<FunnelKPI>('/admin/kpis/funnel'),
    health: () => apiFetch<HealthKPI>('/admin/kpis/health'),
    cohorts: () => apiFetch<CohortRow[]>('/admin/kpis/cohorts'),
    users: (lastDocId?: string) => apiFetch<AdminUser[]>(`/admin/users${lastDocId ? `?lastDocId=${lastDocId}` : ''}`),
    waitlist: () => apiFetch<WaitlistEntry[]>('/admin/waitlist'),
    tokens: () => apiFetch<InviteToken[]>('/admin/tokens'),
    bullmq: () => apiFetch<BullmqStats>('/admin/bullmq-stats'),
    updateWaitlistStatus: async (id: string, status: string) => {
        const res = await fetch(`${API_BASE}/admin/waitlist/${id}/status`, {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error('Failed to update status');
        return res.json();
    },
    updateUserPlan: async (uid: string, plan: string) => {
        const res = await fetch(`${API_BASE}/admin/users/${uid}/plan`, {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify({ plan }),
        });
        if (!res.ok) throw new Error('Failed to update plan');
        return res.json();
    },
    createToken: async (code: string, maxUses: number) => {
        const res = await fetch(`${API_BASE}/admin/tokens`, {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify({ code, maxUses }),
        });
        if (!res.ok) throw new Error('Failed to create token');
        return res.json();
    },
};
