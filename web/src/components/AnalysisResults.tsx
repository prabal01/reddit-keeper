import React from 'react';
import './AnalysisResults.css';
import { Clock, FileDown, Lightbulb, Bug, Fingerprint, CheckCircle2, Target, Download, FileText } from 'lucide-react';
import { exportReportToPDF } from '../lib/pdfExport';

interface RankedBuildPriority {
    rank: number;
    initiative: string;
    justification: string;
    evidence_mentions: number;
    threads_covered: number;
}

interface AnalysisData {
    id?: string;
    createdAt?: string;
    isLocked?: boolean;
    market_attack_summary?: string;
    ranked_build_priorities?: RankedBuildPriority[];
    high_intensity_pain_points?: string[];
    top_switch_triggers?: string[];
    top_desired_outcomes?: string[];
    metadata?: {
        total_threads: number;
        total_comments: number;
        generated_at: string;
    };
}

export const AnalysisResults: React.FC<{ data: AnalysisData; onCitationClick?: (id: string) => void }> = ({ data }) => {
    const hasDashboardData = !!(data.ranked_build_priorities?.length || data.high_intensity_pain_points?.length || data.top_switch_triggers?.length);

    if (!hasDashboardData) {
        return (
            <div className="no-data">
                <p>No dashboard data found.</p>
                <p style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '8px' }}>Re-run analysis to generate a new report.</p>
            </div>
        );
    }

    const threads = data.metadata?.total_threads ?? 0;
    const comments = data.metadata?.total_comments ?? 0;
    const generatedAt = data.metadata?.generated_at ? new Date(data.metadata.generated_at).toLocaleDateString() : '—';

    const handleExportPDF = () => exportReportToPDF(data);

    const handleExportJSON = () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `report-${data.id || 'export'}.json`;
        a.click();
    };

    const handleExportMarkdown = () => {
        const lines = [
            `# Competitive Advantage Blueprint`,
            ``,
            `## Strategic Directive`,
            data.market_attack_summary,
            ``,
            `## Ranked Build Priorities`,
            ...(data.ranked_build_priorities || []).map(p =>
                `**#${p.rank} ${p.initiative}**\n${p.justification}\n(${p.evidence_mentions} mentions, ${p.threads_covered} threads)`
            ),
            ``,
            `## High-Intensity Pain Points`,
            ...(data.high_intensity_pain_points || []).map(p => `- ${p}`),
            ``,
            `## Top Switch Triggers`,
            ...(data.top_switch_triggers || []).map(t => `- ${t}`),
            ``,
            `## Top Desired Outcomes`,
            ...(data.top_desired_outcomes || []).map(o => `- ${o}`),
        ];
        const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `report-${data.id || 'export'}.md`;
        a.click();
    };

    return (
        <div className="analysis-results market-attack-view">

            {/* Header */}
            <div className="analysis-header">
                <div>
                    <h2 className="strategic-title">🔥 Competitive Advantage Blueprint</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                        {data.createdAt && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Clock size={13} /> {new Date(data.createdAt).toLocaleString()}
                            </span>
                        )}
                        {data.isLocked && <span className="badge-new" style={{ background: 'var(--warning-color)', color: 'black' }}>FREE PREVIEW</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button className="btn-text" onClick={handleExportPDF} style={{ background: 'rgba(255,69,0,0.1)', color: 'var(--primary-color)', padding: '5px 12px', borderRadius: '7px', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <FileDown size={13} /> PDF
                        </button>
                        <button className="btn-text" onClick={handleExportJSON} style={{ fontSize: '0.75rem', opacity: 0.65, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Download size={13} /> JSON
                        </button>
                        <button className="btn-text" onClick={handleExportMarkdown} style={{ fontSize: '0.75rem', opacity: 0.65, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FileText size={13} /> MD
                        </button>
                    </div>
                </div>

                {/* Metric cards */}
                <div className="metrics-row">
                    <div className="metric-card">
                        <span className="metric-label">Threads</span>
                        <span className="metric-value">{threads}</span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">Comments</span>
                        <span className="metric-value">{comments}</span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">Generated</span>
                        <span className="metric-value" style={{ fontSize: '1.1rem' }}>{generatedAt}</span>
                    </div>
                </div>
            </div>

            {/* Strategic Directive Banner - only if available */}
            {data.market_attack_summary && (
                <div className="attack-plan-banner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px', color: '#FF4500', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.06em' }}>
                        <Target size={14} /> Strategic Directive
                    </div>
                    <p>{data.market_attack_summary}</p>
                </div>
            )}

            {/* Dashboard Grid */}
            <div className="dashboard-grid">

                {/* Left: Ranked Build Roadmap */}
                <div className="dashboard-main-column">
                    <div className="dashboard-card">
                        <div className="dashboard-card-accent build"><Lightbulb size={15} /> Ranked Build Roadmap</div>
                        <div className="roadmap-grid">
                            {(data.ranked_build_priorities || []).map((bp, i) => {
                                const pct = Math.min(100, ((bp.evidence_mentions || 0) / 15) * 100);
                                return (
                                    <div key={i} className="roadmap-card">
                                        <div className="roadmap-header-row">
                                            <div className="rank-num">#{bp.rank}</div>
                                            <div style={{ flex: 1 }}>
                                                <h4>{bp.initiative}</h4>
                                                <p>{bp.justification}</p>
                                                <div className="signal-bar-container">
                                                    <div className="signal-bar-fill" style={{ width: `${pct}%` }} />
                                                </div>
                                                <div className="signal-meta">
                                                    <span>Signal Strength</span>
                                                    <span>{bp.evidence_mentions} Mentions / {bp.threads_covered} Threads</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right: Sidebar */}
                <div className="dashboard-sidebar">

                    {/* Pain Points */}
                    <div className="dashboard-card">
                        <div className="dashboard-card-accent attack"><Bug size={15} /> High-Intensity Pain Points</div>
                        <div className="pain-list-sidebar">
                            {(data.high_intensity_pain_points || []).map((pp, i) => (
                                <div key={i} className="pain-item-compact">
                                    <h4>{pp}</h4>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Switch Triggers */}
                    <div className="dashboard-card">
                        <div className="dashboard-card-accent exit"><Fingerprint size={15} /> Top Switch Triggers</div>
                        <div>
                            {(data.top_switch_triggers || []).map((st, i) => (
                                <div key={i} className="trigger-item-compact">{st}</div>
                            ))}
                        </div>
                    </div>

                    {/* Desired Outcomes */}
                    <div className="dashboard-card">
                        <div className="dashboard-card-accent priority"><CheckCircle2 size={15} /> Top Desired Outcomes</div>
                        <div className="pain-list-sidebar">
                            {(data.top_desired_outcomes || []).map((o, i) => (
                                <div key={i} className="outcome-item-compact">
                                    <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
                                    <span>{o}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>

            <div className="analysis-footer">
                <div className="metadata-tag">Analysis completed: {data.metadata?.generated_at ? new Date(data.metadata.generated_at).toLocaleString() : 'Recent'}</div>
            </div>
        </div>
    );
};
