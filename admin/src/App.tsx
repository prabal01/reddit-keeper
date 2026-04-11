import { Routes, Route, Navigate } from 'react-router-dom';
import { useAdminAuth } from './contexts/AdminAuthContext';
import { AdminLogin } from './pages/AdminLogin';
import { AdminAccessDenied } from './pages/AdminAccessDenied';
import { AdminShell } from './components/layout/AdminShell';
import { GrowthSection } from './pages/GrowthSection';
import { EngagementSection } from './pages/EngagementSection';
import { FunnelSection } from './pages/FunnelSection';
import { MonetizationSection } from './pages/MonetizationSection';
import { SystemHealthSection } from './pages/SystemHealthSection';
import { UsersSection } from './pages/UsersSection';
import { WaitlistSection } from './pages/WaitlistSection';
import { TokensSection } from './pages/TokensSection';

function LoadingScreen() {
    return (
        <div style={{
            minHeight: '100vh',
            background: '#0f0f17',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#52526b',
            fontSize: '0.9rem',
        }}>
            Initializing...
        </div>
    );
}

export function App() {
    const { state } = useAdminAuth();

    if (state === 'loading') return <LoadingScreen />;
    if (state === 'unauthenticated') return <AdminLogin />;
    if (state === 'denied') return <AdminAccessDenied />;

    return (
        <AdminShell>
            <Routes>
                <Route path="/" element={<GrowthSection />} />
                <Route path="/engagement" element={<EngagementSection />} />
                <Route path="/funnel" element={<FunnelSection />} />
                <Route path="/monetization" element={<MonetizationSection />} />
                <Route path="/health" element={<SystemHealthSection />} />
                <Route path="/users" element={<UsersSection />} />
                <Route path="/waitlist" element={<WaitlistSection />} />
                <Route path="/tokens" element={<TokensSection />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AdminShell>
    );
}
