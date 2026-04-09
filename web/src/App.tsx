
import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { FolderProvider } from "./contexts/FolderContext";
import { setTokenGetter } from "./lib/api";
import { posthog } from "./lib/posthog";
import { ThemeToggle } from "./components/ThemeToggle";
import { AuthButton } from "./components/AuthButton";
import { Footer } from "./components/Footer";
import { HomeView } from "./components/HomeView";
import { FolderDetail } from "./components/FolderDetail";
import { Skeleton } from "./components/Skeleton";
import { Sidebar } from "./components/Sidebar";
import { ReportsView } from "./components/ReportsView";
import { SettingsView } from "./components/SettingsView";
import { ResearchView } from "./components/ResearchView";
import { DiscoveryLab } from "./components/discovery/LabDiscovery";
import { UpgradeModal } from "./components/UpgradeModal";
import { PricingPage } from "./components/PricingPage";
import { Breadcrumbs } from "./components/common/Breadcrumbs";
import { MonitoringDashboard } from "./components/monitoring/MonitoringDashboard";
import { LeadsManagement } from "./components/monitoring/LeadsManagement";

import { LoginView } from "./components/LoginView";
import { VerificationGate } from "./components/VerificationGate";
import { AdminPortal } from "./components/admin/AdminPortal";
import { Toaster } from "react-hot-toast";
import { DiscoveryProvider } from "./components/discovery/contexts/DiscoveryContext";

const AppSkeleton = () => (
  <div className="app" style={{ background: '#0a0a0c', minHeight: '100vh', display: 'flex' }}>
    <aside className="sidebar skeleton-sidebar" style={{ 
      width: '260px', 
      minWidth: '260px',
      background: 'rgba(10, 10, 12, 0.4)', 
      borderRight: '1px solid rgba(255, 255, 255, 0.05)',
      padding: '32px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '32px'
    }}>
      <div className="sidebar-logo-skeleton">
        <Skeleton width="120px" height="32px" style={{ borderRadius: '8px' }} />
      </div>
      
      <div className="sidebar-nav-skeleton" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px' }}>
            <Skeleton width="24px" height="24px" style={{ borderRadius: '6px' }} />
            <Skeleton width={i % 2 === 0 ? "100px" : "80px"} height="16px" style={{ borderRadius: '4px' }} />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <Skeleton width="100%" height="80px" style={{ borderRadius: '20px' }} />
      </div>
    </aside>

    <div className="app-main-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <header className="app-header" style={{ height: '64px', display: 'flex', alignItems: 'center', padding: '0 32px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <Skeleton width="32px" height="32px" circle />
          <Skeleton width="32px" height="32px" circle />
          <Skeleton width="80px" height="36px" style={{ borderRadius: '18px' }} />
        </div>
      </header>

      <main className="app-main" style={{ padding: '40px 0' }}>
        <div className="content-container" style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 32px' }}>
          
          {/* URL Input Skeleton */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '60px' }}>
            <Skeleton width="100%" height="56px" style={{ maxWidth: '800px', borderRadius: '16px' }} />
          </div>

          {/* Welcome Header Skeleton */}
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ display: 'inline-block', width: '100%', maxWidth: '600px' }}>
              <Skeleton width="80%" height="48px" style={{ margin: '0 auto 16px', borderRadius: '8px' }} />
              <Skeleton width="50%" height="24px" style={{ margin: '0 auto', borderRadius: '4px' }} />
            </div>
          </div>

          {/* Metrics Row Skeleton */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '24px', 
            marginBottom: '64px',
            flexWrap: 'wrap'
          }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ 
                width: '240px', 
                height: '72px', 
                background: 'rgba(255,255,255,0.02)', 
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                gap: '16px'
              }}>
                <Skeleton width="24px" height="24px" circle />
                <div style={{ flex: 1 }}>
                  <Skeleton width="40%" height="16px" style={{ marginBottom: '4px' }} />
                  <Skeleton width="60%" height="12px" />
                </div>
              </div>
            ))}
          </div>

          {/* Folder List Skeleton */}
          <div className="folders-section">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <Skeleton width="200px" height="28px" />
              <Skeleton width="120px" height="40px" style={{ borderRadius: '10px' }} />
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
              gap: '24px' 
            }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="folder-card" style={{ 
                  height: '100px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '0 24px', 
                  gap: '20px',
                  pointerEvents: 'none'
                }}>
                  <Skeleton width="48px" height="48px" style={{ borderRadius: '14px' }} />
                  <div style={{ flex: 1 }}>
                    <Skeleton width="50%" height="20px" style={{ marginBottom: '8px' }} />
                    <Skeleton width="30%" height="14px" />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  </div>
);

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AppSkeleton />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  console.log(`[RequireAuth] Path: ${location.pathname}, Verified: ${user.emailVerified}`);

  if (!user.emailVerified && location.pathname !== "/verify-email") {
    console.log("[RequireAuth] Redirecting to /verify-email");
    return <Navigate to="/verify-email" replace />;
  }

  if (user.emailVerified && location.pathname === "/verify-email") {
    console.log("[RequireAuth] Redirecting to / (Verified!)");
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppContent() {
  const { getIdToken, loading, user, isUpgradeModalOpen, closeUpgradeModal } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  // PostHog: capture pageview on route change
  useEffect(() => {
    posthog.capture('$pageview');
  }, [location.pathname]);

  // PostHog: identify user on login, reset on logout
  useEffect(() => {
    if (user) {
      posthog.identify(user.uid, { email: user.email });
    } else {
      posthog.reset();
    }
  }, [user]);

  // Wire up the token getter for API calls
  useEffect(() => {
    setTokenGetter(getIdToken);

    // Broadcast token to extension for "Zero-Login"
    const broadcastToken = async () => {
      try {
        const token = await getIdToken();
        if (token) {
          const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const apiUrl = import.meta.env.VITE_API_URL || (isLocal ? 'http://localhost:3001/api' : '');

          const dashboardUrl = window.location.origin;

          window.postMessage({
            type: "OPINION_DECK_AUTH_TOKEN",
            token,
            apiUrl,
            dashboardUrl
          }, window.location.origin);
        }
      } catch (err) {
        console.warn("Failed to broadcast token to extension:", err);
      }
    };

    broadcastToken();
    // Re-broadcast on focus to ensure extension gets it if just opened
    window.addEventListener("focus", broadcastToken);
    return () => window.removeEventListener("focus", broadcastToken);
  }, [getIdToken]);

  // Check for checkout redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (loading) {
    return <AppSkeleton />;
  }

  return (
    <div className="app">
      {user && !isLoginPage && <Sidebar />}

      <div className="app-main-wrapper">
        {!isLoginPage && (
          <header className="app-header">
            <div className="header-content">
              <div className="header-breadcrumbs">
                <Breadcrumbs />
              </div>
              <div className="header-actions">
                <ThemeToggle />
                {user && <AuthButton />}
              </div>
            </div>
          </header>
        )}

        <main className="app-main">
          <div className="content-container">
            <Routes>
              <Route path="/login" element={<LoginView />} />
              <Route path="/verify-email" element={
                <RequireAuth>
                  <VerificationGate />
                </RequireAuth>
              } />

              <Route path="/" element={
                <RequireAuth>
                  <MonitoringDashboard />
                </RequireAuth>
              } />
              <Route path="/discovery" element={
                <RequireAuth>
                  <ResearchView />
                </RequireAuth>
              } />
              <Route path="/decks" element={
                <RequireAuth>
                  <HomeView />
                </RequireAuth>
              } />
              <Route path="/folders" element={<Navigate to="/decks" replace />} />
              <Route path="/research" element={<Navigate to="/" replace />} />
              <Route path="/reports" element={
                <RequireAuth>
                  <ReportsView />
                </RequireAuth>
              } />
              <Route path="/settings" element={
                <RequireAuth>
                  <SettingsView />
                </RequireAuth>
              } />
              <Route path="/monitoring" element={<Navigate to="/" replace />} />
              <Route path="/leads" element={
                <RequireAuth>
                  <LeadsManagement />
                </RequireAuth>
              } />
              {/* Research alias handled by Navigate above */}
              <Route path="/folders/:folderId" element={
                <RequireAuth>
                  <FolderDetail />
                </RequireAuth>
              } />
              <Route path="/folders/:folderId/threads/:threadId" element={
                <RequireAuth>
                  <FolderDetail />
                </RequireAuth>
              } />
              <Route path="/lab/discovery" element={
                <RequireAuth>
                  <DiscoveryLab />
                </RequireAuth>
              } />
              <Route path="/admin" element={
                <RequireAuth>
                  <AdminPortal />
                </RequireAuth>
              } />
              <Route path="/pricing" element={
                <RequireAuth>
                  <PricingPage />
                </RequireAuth>
              } />
            </Routes>
          </div>
        </main>

        {!user && !isLoginPage && <Footer />}

        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={closeUpgradeModal}
        />
        <Toaster position="bottom-right" toastOptions={{
          style: {
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          },
        }} />
      </div>
    </div>
  );
}


function App() {
  return (
    <AuthProvider>
      <FolderProvider>
        <DiscoveryProvider>
          <AppContent />
        </DiscoveryProvider>
      </FolderProvider>
    </AuthProvider>
  );
}

export default App;
