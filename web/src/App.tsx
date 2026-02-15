import { useState, useMemo, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { FolderProvider } from "./contexts/FolderContext";
import { setTokenGetter } from "./lib/api";
import { ThemeToggle } from "./components/ThemeToggle";
import { AuthButton } from "./components/AuthButton";
import { UrlInput } from "./components/UrlInput";
import { FilterBar, type FilterState } from "./components/FilterBar";
import { ThreadView } from "./components/ThreadView";
import { ExportPanel } from "./components/ExportPanel";
import { UpgradePrompt } from "./components/UpgradePrompt";
import { PricingPage } from "./components/PricingPage";
import { SEOContent } from "./components/SEOContent";
import { Footer } from "./components/Footer";
import { useRedditThread } from "./hooks/useRedditThread";
import { applyFilters } from "@core/utils/filters.js";
import type { CLIOptions } from "@core/reddit/types.js";

function AppContent() {
  const { getIdToken, plan } = useAuth();
  const { thread, metadata, loading, error, fetch: fetchThread } = useRedditThread();
  const [filters, setFilters] = useState<FilterState>({
    minScore: undefined,
    maxDepth: undefined,
    skipDeleted: false,
    opOnly: false,
    topN: undefined,
  });

  // Wire up the token getter for API calls
  useEffect(() => {
    setTokenGetter(getIdToken);
  }, [getIdToken]);

  // Check for checkout redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleFetch = (url: string, sort: string) => {
    fetchThread({ url, sort });
  };

  const filteredThread = useMemo(() => {
    if (!thread) return null;

    const filterOpts: CLIOptions = {
      format: "md",
      stdout: false,
      copy: false,
      sort: "confidence",
      skipDeleted: filters.skipDeleted,
      opOnly: filters.opOnly,
      tokenCount: false,
      minScore: filters.minScore,
      maxDepth: filters.maxDepth,
      top: filters.topN,
    };

    const filteredComments = applyFilters(thread.comments, filterOpts);

    return {
      ...thread,
      comments: filteredComments,
    };
  }, [thread, filters]);

  const showUpgrade = metadata?.truncated === true && plan !== "pro";

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon" aria-hidden="true">📥</span>
            <h1 className="logo-text">Reddit Keeper</h1>
            <span className="logo-tagline">Export threads for AI & Research</span>
          </div>
          <div className="header-actions">
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </header>

      <main className="app-main">
        <UrlInput onFetch={handleFetch} loading={loading} />

        {error && (
          <div className="error-banner" role="alert">
            <span className="error-icon" aria-hidden="true">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {loading && (
          <div className="loading-state" role="status" aria-label="Loading thread">
            <div className="skeleton-post">
              <div className="skeleton-line skeleton-title" />
              <div className="skeleton-line skeleton-meta" />
              <div className="skeleton-line skeleton-body" />
              <div className="skeleton-line skeleton-body short" />
            </div>
            <div className="skeleton-comments">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton-comment" style={{ marginLeft: `${(i % 3) * 24}px` }}>
                  <div className="skeleton-line skeleton-comment-header" />
                  <div className="skeleton-line skeleton-comment-body" />
                </div>
              ))}
            </div>
            <p className="loading-text">Fetching thread from Reddit...</p>
          </div>
        )}

        {filteredThread && !loading && (
          <>
            <div className="controls-bar">
              <FilterBar {...filters} onChange={setFilters} />
              <ExportPanel thread={filteredThread} />
            </div>

            {showUpgrade && metadata && (
              <UpgradePrompt
                totalComments={metadata.totalCommentsFetched}
                commentsShown={metadata.commentsReturned}
                commentLimit={metadata.commentLimit || 50}
              />
            )}

            <ThreadView thread={filteredThread} />
          </>
        )}

        {!thread && !loading && !error && (
          <>
            <PricingPage />
            <SEOContent />
          </>
        )}
      </main>

      <Footer />
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
