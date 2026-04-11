import { NavLink } from 'react-router-dom';
import { TrendingUp, Users, Zap, Activity, GitFork, Shield, Clock, Key } from 'lucide-react';

const links = [
    { to: '/', label: 'Growth', icon: TrendingUp, exact: true },
    { to: '/engagement', label: 'Engagement', icon: Activity },
    { to: '/funnel', label: 'Funnel', icon: GitFork },
    { to: '/monetization', label: 'Monetization', icon: Zap },
    { to: '/health', label: 'System Health', icon: Shield },
    { to: '/users', label: 'Users', icon: Users },
    { to: '/waitlist', label: 'Waitlist', icon: Clock },
    { to: '/tokens', label: 'Tokens', icon: Key },
];

export function AdminSidebar() {
    return (
        <aside style={{
            width: '220px',
            flexShrink: 0,
            background: 'rgba(255,255,255,0.02)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            padding: '24px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            height: '100vh',
            position: 'sticky',
            top: 0,
            overflowY: 'auto',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '0 8px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                marginBottom: '8px',
            }}>
                <div style={{
                    background: 'rgba(255,69,0,0.15)',
                    borderRadius: '10px',
                    padding: '8px',
                    display: 'flex',
                }}>
                    <span style={{ fontSize: '16px' }}>📊</span>
                </div>
                <div>
                    <div style={{ color: '#fff', fontWeight: '700', fontSize: '0.9rem', lineHeight: 1 }}>
                        OpinionDeck
                    </div>
                    <div style={{ color: '#ff4500', fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.05em' }}>
                        ADMIN
                    </div>
                </div>
            </div>

            {links.map(({ to, label, icon: Icon, exact }) => (
                <NavLink
                    key={to}
                    to={to}
                    end={exact}
                    style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        textDecoration: 'none',
                        color: isActive ? '#fff' : '#8e92a4',
                        background: isActive ? 'rgba(255,69,0,0.1)' : 'transparent',
                        fontWeight: isActive ? '600' : '400',
                        fontSize: '0.88rem',
                        transition: 'all 0.15s',
                        borderLeft: isActive ? '2px solid #ff4500' : '2px solid transparent',
                    })}
                >
                    <Icon size={16} />
                    {label}
                </NavLink>
            ))}
        </aside>
    );
}
