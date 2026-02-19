
import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { FolderProvider } from "./contexts/FolderContext";
import { setTokenGetter } from "./lib/api";
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

import { LoginView } from "./components/LoginView";

const AppSkeleton = () => (
  <div className="app" style={{ background: 'var(--bg-primary, #f8f9fb)', minHeight: '100vh' }}>
    <aside className="sidebar skeleton-sidebar" style={{ background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ padding: '30px' }}>
        <Skeleton width="100%" height="40px" style={{ borderRadius: '12px', marginBottom: '40px' }} />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} width="100%" height="48px" style={{ borderRadius: '12px', marginBottom: '12px' }} />
        ))}
      </div>
      <div style={{ marginTop: 'auto', padding: '30px' }}>
        <Skeleton width="100%" height="100px" style={{ borderRadius: '20px' }} />
      </div>
    </aside>

    <div className="app-main-wrapper">
      <header className="app-header">
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginLeft: 'auto', paddingRight: '40px' }}>
          <Skeleton width="40px" height="40px" circle />
          <Skeleton width="100px" height="40px" style={{ borderRadius: '12px' }} />
        </div>
      </header>

      <main className="app-main">
        <div className="content-container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 40px' }}>
          <div style={{ marginTop: '40px' }}>
            <Skeleton width="40%" height="48px" style={{ marginBottom: '12px' }} />
            <Skeleton width="20%" height="24px" style={{ marginBottom: '40px' }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '40px' }}>
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} width="100%" height="160px" style={{ borderRadius: '24px' }} />
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

  if (loading) return <AppSkeleton />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppContent() {
  const { getIdToken, loading, user } = useAuth();

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
      {user && <Sidebar />}

      <div className="app-main-wrapper">
        <header className="app-header">
          <div className="header-breadcrumbs">
            {/* Future Breadcrumbs location */}
          </div>
          <div className="header-actions" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <ThemeToggle />
            {user && <AuthButton />}
          </div>
        </header>

        <main className="app-main">
          <div className="content-container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 40px' }}>
            <Routes>
              <Route path="/login" element={<LoginView />} />

              <Route path="/" element={
                <RequireAuth>
                  <HomeView />
                </RequireAuth>
              } />
              <Route path="/folders" element={
                <RequireAuth>
                  <HomeView />
                </RequireAuth>
              } />
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
              <Route path="/research" element={
                <RequireAuth>
                  <ResearchView />
                </RequireAuth>
              } />
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
            </Routes>
          </div>
        </main>

        {!user && <Footer />}
      </div>
    </div>
  );
}


function App() {
  return (
    <AuthProvider>
      <FolderProvider>
        <AppContent />
      </FolderProvider>
    </AuthProvider>
  );
}

export default App;
