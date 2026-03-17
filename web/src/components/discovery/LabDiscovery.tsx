import React, { useState } from 'react';
import { Search, Sparkles, Zap, AlertCircle, Loader2, Globe, Copy, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE } from '../../lib/api';
import './LabDiscovery.css';

interface LabResult {
    id: string;
    title: string;
    subreddit: string;
    score: number;
    url: string;
    isAiDiscovered?: boolean;
}

export const DiscoveryLab: React.FC = () => {
    const { getIdToken, refreshPlan } = useAuth();
    const [competitor, setCompetitor] = useState('');

    const [loading, setLoading] = useState(false);
    const [skipCache, setSkipCache] = useState(true);
    const [baselineResults, setBaselineResults] = useState<LabResult[]>([]);
    const [aiResults, setAiResults] = useState<LabResult[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [copiedColumn, setCopiedColumn] = useState<string | null>(null);

    const copyToClipboard = (data: any, columnId: string) => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setCopiedColumn(columnId);
        setTimeout(() => setCopiedColumn(null), 2000);
    };

    const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

    const runComparison = async () => {
        if (!competitor.trim()) return;
        setLoading(true);
        setLogs([]);
        setBaselineResults([]);
        setAiResults([]);

        addLog(`Starting comparison for: ${competitor}`);

        try {
            const token = await getIdToken();
            addLog("Calling Comparison Engine...");

            const response = await fetch(`${API_BASE}/discovery/compare`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ query: competitor, skipCache })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            setBaselineResults(data.baseline || []);
            setAiResults(data.enhanced || []);
            refreshPlan();

            const aiOnlyCount = (data.enhanced || []).filter((r: any) =>
                !(data.baseline || []).some((b: any) => b.url === r.url)
            ).length;

            addLog(`Baseline found: ${data.baseline?.length || 0}`);
            addLog(`AI Enhanced found: ${data.enhanced?.length || 0} (${aiOnlyCount} new unique discoveries)`);

            setLoading(false);

        } catch (err: any) {
            addLog(`Error: ${err.message}`);
            setLoading(false);
        }
    };

    return (
        <div className="discovery-lab">
            <header className="lab-header">
                <div className="lab-badge">EXPERIMENTAL</div>
                <h1>Discovery Lab <span className="version">v2.0 POC</span></h1>
                <p>Compare baseline keyword search against the new AI-driven query expansion.</p>
            </header>

            <div className="lab-controls">
                <div className="search-box">
                    <Search className="search-icon" size={20} />
                    <input
                        type="text"
                        placeholder="Enter competitor (e.g. Linear, Notion)..."
                        value={competitor}
                        onChange={(e) => setCompetitor(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && runComparison()}
                    />
                    <button
                        className="run-btn"
                        onClick={runComparison}
                        disabled={loading || !competitor}
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                        Run A/B Test
                    </button>
                    <label className="skip-cache-toggle">
                        <input
                            type="checkbox"
                            checked={skipCache}
                            onChange={(e) => setSkipCache(e.target.checked)}
                        />
                        Bypass Cache
                    </label>
                </div>
            </div>

            <div className="lab-grid">
                {/* Baseline Column */}
                <div className="lab-column baseline">
                    <div className="column-header">
                        <Globe size={18} />
                        <h3>Baseline</h3>
                        <div className="header-actions">
                            <button
                                className="copy-json-btn"
                                onClick={() => copyToClipboard(baselineResults, 'baseline')}
                                disabled={baselineResults.length === 0}
                                title="Copy JSON"
                            >
                                {copiedColumn === 'baseline' ? <Check size={14} /> : <Copy size={14} />}
                                <span>JSON</span>
                            </button>
                        </div>
                    </div>
                    <div className="results-list">
                        {baselineResults.map(r => (
                            <div key={r.id} className="lab-card">
                                <div className="card-score">{r.score}</div>
                                <div className="card-content">
                                    <h4>{r.title}</h4>
                                    <span className="card-sub">r/{r.subreddit}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* AI Column */}
                <div className="lab-column ai-enhanced">
                    <div className="column-header">
                        <Sparkles size={18} />
                        <h3>AI-Enhanced</h3>
                        <div className="header-actions">
                            <button
                                className="copy-json-btn"
                                onClick={() => copyToClipboard(aiResults, 'ai')}
                                disabled={aiResults.length === 0}
                                title="Copy JSON"
                            >
                                {copiedColumn === 'ai' ? <Check size={14} /> : <Copy size={14} />}
                                <span>JSON</span>
                            </button>
                        </div>
                    </div>
                    <div className="results-list">
                        {aiResults.map(r => {
                            const isNew = !baselineResults.some(b => b.url === r.url);
                            return (
                                <div key={r.id} className={`lab-card ${isNew ? 'ai-new' : ''}`}>
                                    <div className="card-score">{r.score}</div>
                                    {isNew && <div className="ai-badge">NEW DISCOVERY</div>}
                                    <div className="card-content">
                                        <h4>{r.title}</h4>
                                        <span className="card-sub">r/{r.subreddit}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Logs Column */}
                <div className="lab-column logs">
                    <div className="column-header">
                        <AlertCircle size={18} />
                        <h3>Internal Logs</h3>
                    </div>
                    <div className="log-viewer">
                        {logs.map((log, i) => (
                            <div key={i} className="log-entry">{log}</div>
                        ))}
                        {logs.length === 0 && <div className="empty-logs">Logs will appear here...</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};
