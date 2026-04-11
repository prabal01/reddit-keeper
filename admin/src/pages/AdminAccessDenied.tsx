import { useAdminAuth } from '../contexts/AdminAuthContext';

export function AdminAccessDenied() {
    const { user, signOut } = useAdminAuth();

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
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '20px',
                padding: '48px',
                width: '360px',
                textAlign: 'center',
            }}>
                <div style={{ fontSize: '40px', marginBottom: '20px' }}>🚫</div>
                <h1 style={{ color: '#ef4444', fontSize: '1.3rem', fontWeight: '700', margin: '0 0 12px' }}>
                    Access Denied
                </h1>
                <p style={{ color: '#8e92a4', fontSize: '0.9rem', margin: '0 0 8px' }}>
                    Your account is not authorized to access the admin dashboard.
                </p>
                <p style={{
                    color: '#6b6f82',
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    margin: '0 0 28px',
                }}>
                    {user?.email}
                </p>
                <button
                    onClick={signOut}
                    style={{
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                        padding: '10px 24px',
                        color: '#8e92a4',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                >
                    Sign out
                </button>
            </div>
        </div>
    );
}
