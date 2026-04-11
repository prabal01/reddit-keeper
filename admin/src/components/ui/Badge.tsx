const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
    free:         { bg: 'rgba(100,100,120,0.2)', text: '#8e92a4' },
    trial:        { bg: 'rgba(234,179,8,0.15)',  text: '#eab308' },
    starter:      { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
    pro:          { bg: 'rgba(168,85,247,0.15)', text: '#c084fc' },
    professional: { bg: 'rgba(255,69,0,0.15)',   text: '#ff6530' },
    beta:         { bg: 'rgba(34,197,94,0.15)',  text: '#4ade80' },
    enterprise:   { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24' },
    past_due:     { bg: 'rgba(239,68,68,0.15)',  text: '#f87171' },
};

interface Props {
    plan: string;
}

export function PlanBadge({ plan }: Props) {
    const colors = PLAN_COLORS[plan] ?? { bg: 'rgba(255,255,255,0.08)', text: '#8e92a4' };
    return (
        <span style={{
            background: colors.bg,
            color: colors.text,
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: '600',
            letterSpacing: '0.03em',
        }}>
            {plan}
        </span>
    );
}
