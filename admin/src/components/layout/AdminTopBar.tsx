import { LogOut, RefreshCw } from 'lucide-react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

interface Props {
    title: string;
    onRefresh?: () => void;
    lastRefreshed?: Date | null;
}

export function AdminTopBar({ title, onRefresh, lastRefreshed }: Props) {
    const { user, signOut } = useAdminAuth();

    return (
        <div style={{
            height: '60px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            background: 'rgba(255,255,255,0.01)',
            flexShrink: 0,
        }}>
            <h1 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>
                {title}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {lastRefreshed && (
                    <span style={{ color: '#52526b', fontSize: '0.78rem' }}>
                        Updated {lastRefreshed.toLocaleTimeString()}
                    </span>
                )}

                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        title="Refresh data"
                        style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px',
                            padding: '6px 8px',
                            color: '#8e92a4',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                        }}
                        onMouseOver={e => (e.currentTarget.style.color = '#fff')}
                        onMouseOut={e => (e.currentTarget.style.color = '#8e92a4')}
                    >
                        <RefreshCw size={14} />
                    </button>
                )}

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px',
                }}>
                    {user?.photoURL && (
                        <img
                            src={user.photoURL}
                            alt=""
                            style={{ width: '22px', height: '22px', borderRadius: '50%' }}
                        />
                    )}
                    <span style={{ color: '#c8cad8', fontSize: '0.82rem' }}>{user?.email}</span>
                </div>

                <button
                    onClick={signOut}
                    title="Sign out"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#52526b',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px',
                    }}
                    onMouseOver={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseOut={e => (e.currentTarget.style.color = '#52526b')}
                >
                    <LogOut size={16} />
                </button>
            </div>
        </div>
    );
}
