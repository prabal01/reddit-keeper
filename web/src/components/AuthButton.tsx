import { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { createPortalSession } from "../lib/api";

export function AuthButton() {
    const { user, plan, loading, signInWithGoogle, signOut } = useAuth();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [signingIn, setSigningIn] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    // Close dropdown on Escape
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") setDropdownOpen(false);
        }
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, []);

    if (loading) {
        return <div className="auth-btn-skeleton" aria-hidden="true" />;
    }

    if (!user) {
        return (
            <button
                className="auth-btn sign-in-btn"
                onClick={async () => {
                    setSigningIn(true);
                    try {
                        await signInWithGoogle();
                    } finally {
                        setSigningIn(false);
                    }
                }}
                disabled={signingIn}
                aria-label="Sign in with Google"
            >
                <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {signingIn ? "Signing in..." : "Sign in"}
            </button>
        );
    }

    const planBadge = plan === "pro" ? "⚡ Pro" : "🆓 Free";

    return (
        <div className="auth-dropdown" ref={dropdownRef}>
            <button
                className="auth-btn account-btn"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
                aria-label={`Account menu for ${user.displayName || user.email}`}
            >
                {user.photoURL ? (
                    <img
                        className="user-avatar"
                        src={user.photoURL}
                        alt=""
                        width={28}
                        height={28}
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <span className="user-avatar-fallback" aria-hidden="true">
                        {(user.displayName || user.email || "U")[0].toUpperCase()}
                    </span>
                )}
                <span className="user-plan-badge" aria-label={`Current plan: ${plan || "free"}`}>
                    {planBadge}
                </span>
            </button>

            {dropdownOpen && (
                <div className="dropdown-menu" role="menu">
                    <div className="dropdown-header">
                        <p className="dropdown-name">{user.displayName}</p>
                        <p className="dropdown-email">{user.email}</p>
                    </div>
                    <div className="dropdown-divider" role="separator" />

                    {plan === "pro" && (
                        <button
                            className="dropdown-item"
                            role="menuitem"
                            onClick={async () => {
                                try {
                                    const url = await createPortalSession();
                                    window.location.href = url;
                                } catch (err) {
                                    console.error("Portal error:", err);
                                }
                            }}
                        >
                            💳 Manage Billing
                        </button>
                    )}

                    {plan !== "pro" && (
                        <button
                            className="dropdown-item upgrade-item"
                            role="menuitem"
                            onClick={() => {
                                setDropdownOpen(false);
                                // Scroll to pricing or trigger checkout
                                document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
                            }}
                        >
                            ⚡ Upgrade to Pro
                        </button>
                    )}

                    <button
                        className="dropdown-item sign-out-item"
                        role="menuitem"
                        onClick={async () => {
                            setDropdownOpen(false);
                            await signOut();
                        }}
                    >
                        🚪 Sign Out
                    </button>
                </div>
            )}
        </div>
    );
}
