import type { LucideIcon } from 'lucide-react';

interface Props {
    label: string;
    value: string | number;
    icon: LucideIcon;
    color?: string;
    delta?: string;
    deltaPositive?: boolean;
    sub?: string;
}

export function StatCard({ label, value, icon: Icon, color = '#ff4500', delta, deltaPositive, sub }: Props) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px',
            padding: '22px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
        }}>
            <div style={{
                background: `${color}18`,
                padding: '12px',
                borderRadius: '12px',
                flexShrink: 0,
            }}>
                <Icon size={22} color={color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#8e92a4', fontSize: '0.82rem', margin: '0 0 4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {label}
                </p>
                <h3 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0, color: '#fff', lineHeight: 1 }}>
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </h3>
                {(delta || sub) && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                        {delta && (
                            <span style={{
                                fontSize: '0.78rem',
                                color: deltaPositive ? '#22c55e' : '#ef4444',
                                fontWeight: '600',
                            }}>
                                {delta}
                            </span>
                        )}
                        {sub && <span style={{ fontSize: '0.78rem', color: '#52526b' }}>{sub}</span>}
                    </div>
                )}
            </div>
        </div>
    );
}
