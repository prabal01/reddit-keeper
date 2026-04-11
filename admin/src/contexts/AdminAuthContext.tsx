import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { setTokenGetter, adminApi } from '../lib/api';

type AuthState = 'loading' | 'unauthenticated' | 'denied' | 'authenticated';

interface AdminAuthContextValue {
    state: AuthState;
    user: User | null;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    error: string | null;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>('loading');
    const [user, setUser] = useState<User | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!auth) {
            setState('unauthenticated');
            return;
        }

        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                setUser(null);
                setState('unauthenticated');
                return;
            }

            // Register token getter for API calls
            setTokenGetter(() => firebaseUser.getIdToken());

            try {
                await adminApi.me();
                setUser(firebaseUser);
                setState('authenticated');
            } catch {
                setUser(firebaseUser);
                setState('denied');
            }
        });

        return unsub;
    }, []);

    const signInWithGoogle = async () => {
        if (!auth || !googleProvider) {
            setError('Firebase not configured');
            return;
        }
        setError(null);
        try {
            await signInWithPopup(auth, googleProvider);
            // onAuthStateChanged will handle the state transition
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Sign-in failed');
        }
    };

    const signOut = async () => {
        if (!auth) return;
        await firebaseSignOut(auth);
        setUser(null);
        setState('unauthenticated');
    };

    return (
        <AdminAuthContext.Provider value={{ state, user, signInWithGoogle, signOut, error }}>
            {children}
        </AdminAuthContext.Provider>
    );
}

export function useAdminAuth() {
    const ctx = useContext(AdminAuthContext);
    if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
    return ctx;
}
