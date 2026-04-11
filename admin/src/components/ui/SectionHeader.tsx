interface Props {
    title: string;
    sub?: string;
}

export function SectionHeader({ title, sub }: Props) {
    return (
        <div style={{ marginBottom: '24px' }}>
            <h2 style={{ color: '#fff', fontSize: '1.15rem', fontWeight: '700', margin: '0 0 4px' }}>{title}</h2>
            {sub && <p style={{ color: '#52526b', fontSize: '0.83rem', margin: 0 }}>{sub}</p>}
        </div>
    );
}
