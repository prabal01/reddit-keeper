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
import type { PlanConfig } from "../lib/api";

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
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [plan, setPlan] = useState<"free" | "pro" | "past_due" | null>(null);
    const [config, setConfig] = useState<PlanConfig | null>(null);
    const [loading, setLoading] = useState(!!auth); // only loading if Firebase is configured
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

    const firebaseConfigured = !!auth;

    // Fetch plan from server
    const fetchPlan = useCallback(async (fbUser: User | null) => {
        if (!fbUser) {
            setPlan(null);
            setConfig(null);
            return;
        }

        try {
            const token = await fbUser.getIdToken();
            const res = await fetch("/api/user/plan", {
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
            } else {
                setFirebaseUser(null);
                setUser(null);
                setPlan(null);
                setConfig(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, [fetchPlan]);

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
    }, []);

    const refreshPlan = useCallback(async () => {
        await fetchPlan(firebaseUser);
    }, [firebaseUser, fetchPlan]);

    const getIdToken = useCallback(async (): Promise<string | null> => {
        if (!firebaseUser) return null;
        return firebaseUser.getIdToken(true);
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
