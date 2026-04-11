export function Loader() {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', color: '#52526b', fontSize: '0.9rem' }}>
            Loading...
        </div>
    );
}

export function ErrorMsg({ msg }: { msg: string }) {
    return (
        <div style={{
            color: '#ef4444',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: '10px',
            padding: '16px',
            margin: '20px 0',
            fontSize: '0.88rem',
        }}>
            {msg}
        </div>
    );
}
