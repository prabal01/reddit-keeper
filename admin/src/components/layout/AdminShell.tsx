import { type ReactNode } from 'react';
import { AdminSidebar } from './AdminSidebar';

interface Props {
    children: ReactNode;
}

export function AdminShell({ children }: Props) {
    return (
        <div style={{
            display: 'flex',
            minHeight: '100vh',
            background: '#0f0f17',
            color: '#fff',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
            <AdminSidebar />
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {children}
            </main>
        </div>
    );
}
