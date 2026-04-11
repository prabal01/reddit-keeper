interface Stage {
    label: string;
    value: number;
    color: string;
}

interface Props {
    stages: Stage[];
}

export function FunnelChart({ stages }: Props) {
    const max = stages[0]?.value || 1;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stages.map((stage, i) => {
                const pct = Math.round((stage.value / max) * 100);
                const dropOff = i > 0 && stages[i - 1].value > 0
                    ? Math.round((1 - stage.value / stages[i - 1].value) * 100)
                    : null;

                return (
                    <div key={stage.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: stage.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.7rem',
                                    fontWeight: '700',
                                    color: '#fff',
                                    flexShrink: 0,
                                }}>
                                    {i + 1}
                                </span>
                                <span style={{ color: '#c8cad8', fontSize: '0.88rem' }}>{stage.label}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {dropOff !== null && (
                                    <span style={{ color: '#ef4444', fontSize: '0.78rem', fontWeight: '600' }}>
                                        -{dropOff}%
                                    </span>
                                )}
                                <span style={{ color: '#fff', fontWeight: '700', fontSize: '0.95rem', minWidth: '48px', textAlign: 'right' }}>
                                    {stage.value.toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <div style={{
                            height: '8px',
                            background: 'rgba(255,255,255,0.06)',
                            borderRadius: '4px',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${pct}%`,
                                background: stage.color,
                                borderRadius: '4px',
                                transition: 'width 0.6s ease',
                            }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
