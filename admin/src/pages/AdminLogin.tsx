import { useAdminAuth } from '../contexts/AdminAuthContext';

export function AdminLogin() {
    const { signInWithGoogle, error } = useAdminAuth();

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0f0f17',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '20px',
                padding: '48px',
                width: '360px',
                textAlign: 'center',
            }}>
                <div style={{
                    width: '56px',
                    height: '56px',
                    background: 'rgba(255,69,0,0.15)',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    fontSize: '28px',
                }}>
                    📊
                </div>
                <h1 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: '700', margin: '0 0 8px' }}>
                    OpinionDeck Admin
                </h1>
                <p style={{ color: '#8e92a4', fontSize: '0.9rem', margin: '0 0 32px' }}>
                    Sign in with your admin Google account
                </p>

                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: '8px',
                        padding: '12px',
                        color: '#ef4444',
                        fontSize: '0.85rem',
                        marginBottom: '20px',
                    }}>
                        {error}
                    </div>
                )}

                <button
                    onClick={signInWithGoogle}
                    style={{
                        width: '100%',
                        background: '#ff4500',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '14px',
                        color: '#fff',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = '#e03d00')}
                    onMouseOut={e => (e.currentTarget.style.background = '#ff4500')}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                </button>
            </div>
        </div>
    );
}
