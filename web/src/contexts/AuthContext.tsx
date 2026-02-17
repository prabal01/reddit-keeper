import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    type ReactNode,
} from "react";
import {
    onAuthStateChanged,
    signInWithPopup,
    signOut as firebaseSignOut,
    type User,
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { API_BASE, type PlanConfig } from "../lib/api";


interface AuthUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
}

interface AuthContextType {
    user: AuthUser | null;
    plan: "free" | "pro" | "past_due" | null;
    config: PlanConfig | null;
    loading: boolean;
    firebaseConfigured: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    refreshPlan: () => Promise<void>;
    getIdToken: () => Promise<string | null>;
    userStats: any | null;
    refreshStats: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [plan, setPlan] = useState<"free" | "pro" | "past_due" | null>(null);
    const [config, setConfig] = useState<PlanConfig | null>(null);
    const [loading, setLoading] = useState(!!auth); // only loading if Firebase is configured
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

    const firebaseConfigured = !!auth;

    const [userStats, setUserStats] = useState<any | null>(null);

    // Fetch plan from server
    const fetchPlan = useCallback(async (fbUser: User | null) => {
        if (!fbUser) {
            setPlan(null);
            setConfig(null);
            setUserStats(null);
            return;
        }

        try {
            const token = await fbUser.getIdToken();
            const res = await fetch(`${API_BASE}/user/plan`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setPlan(data.plan);
                setConfig(data.config);
            }
        } catch (err) {
            console.error("Failed to fetch plan:", err);
        }
    }, []);

    const fetchStats = useCallback(async (fbUser: User | null) => {
        if (!fbUser) return;
        try {
            const token = await fbUser.getIdToken();
            const res = await fetch(`${API_BASE}/user/stats`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const stats = await res.json();
                setUserStats(stats);
            }
        } catch (err) {
            console.error("Failed to fetch stats:", err);
        }
    }, []);

    useEffect(() => {
        // If Firebase is not configured, skip auth listener
        if (!auth) {
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            if (fbUser) {
                setFirebaseUser(fbUser);
                setUser({
                    uid: fbUser.uid,
                    email: fbUser.email,
                    displayName: fbUser.displayName,
                    photoURL: fbUser.photoURL,
                });
                await fetchPlan(fbUser);
                await fetchStats(fbUser);
            } else {
                setFirebaseUser(null);
                setUser(null);
                setPlan(null);
                setConfig(null);
                setUserStats(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, [fetchPlan, fetchStats]);

    // ── Extension Auth Sync ─────────────────────────────────────────────
    useEffect(() => {
        const syncTokenToExtension = async () => {
            const apiBase = API_BASE.startsWith('http') ? API_BASE : window.location.origin + API_BASE;

            if (!firebaseUser) {
                // Send null token to clear extension state on logout
                window.postMessage({
                    type: "OPINION_DECK_AUTH_TOKEN",
                    token: null,
                    apiUrl: apiBase,
                    dashboardUrl: window.location.origin
                }, window.location.origin);
                return;
            }

            try {
                const token = await firebaseUser.getIdToken();
                window.postMessage({
                    type: "OPINION_DECK_AUTH_TOKEN",
                    token,
                    apiUrl: apiBase,
                    dashboardUrl: window.location.origin
                }, window.location.origin);
            } catch (err) {
                console.error("Failed to sync token to extension:", err);
            }
        };

        const handleExtensionMessage = async (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (event.data && event.data.type === "OPINION_DECK_EXTENSION_READY") {
                console.log("[Web] Extension ready signal received. Syncing token...");
                await syncTokenToExtension();
            }
        };

        window.addEventListener("message", handleExtensionMessage);
        // Also sync immediately when user changes (login/logout)
        syncTokenToExtension();

        return () => window.removeEventListener("message", handleExtensionMessage);
    }, [firebaseUser]);

    const signInWithGoogle = useCallback(async () => {
        if (!auth || !googleProvider) {
            console.error("Firebase not configured. Cannot sign in.");
            return;
        }
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err: any) {
            if (err.code !== "auth/popup-closed-by-user") {
                console.error("Sign-in error:", err);
                throw err;
            }
        }
    }, []);

    const signOutUser = useCallback(async () => {
        if (auth) {
            await firebaseSignOut(auth);
        }
        setUser(null);
        setPlan(null);
        setConfig(null);
        setUserStats(null);
    }, []);

    const refreshPlan = useCallback(async () => {
        await fetchPlan(firebaseUser);
    }, [firebaseUser, fetchPlan]);

    const refreshStats = useCallback(async () => {
        await fetchStats(firebaseUser);
    }, [firebaseUser, fetchStats]);

    const getIdToken = useCallback(async (): Promise<string | null> => {
        if (!firebaseUser) return null;
        return firebaseUser.getIdToken(false); // Changed from true to false to stop forcing refresh
    }, [firebaseUser]);

    return (
        <AuthContext.Provider
            value={{
                user,
                plan,
                config,
                loading,
                firebaseConfigured,
                signInWithGoogle,
                signOut: signOutUser,
                refreshPlan,
                getIdToken,
                userStats,
                refreshStats
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
