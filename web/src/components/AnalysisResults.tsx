import React from 'react';
import './AnalysisResults.css';
import { Clock, FileDown, Lightbulb, Bug, Fingerprint, CheckCircle2, Target, Download, FileText, Lock } from 'lucide-react';
import { exportReportToPDF } from '../lib/pdfExport';
import { useAuth } from '../contexts/AuthContext';

interface RankedBuildPriority {
    rank: number;
    initiative: string;
    justification: string;
    evidence_mentions: number;
    threads_covered: number;
    context_quote?: string;
}

interface ContextInsight {
    title: string;
    context_quote?: string;
}

interface AnalysisData {
    id?: string;
    createdAt?: string;
    isLocked?: boolean;
    market_attack_summary?: string;
    ranked_build_priorities?: RankedBuildPriority[];
    high_intensity_pain_points?: (string | ContextInsight)[];
    top_switch_triggers?: (string | ContextInsight)[];
    top_desired_outcomes?: (string | ContextInsight)[];
    metadata?: {
        total_threads: number;
        total_comments: number;
        generated_at: string;
    };
}

export const AnalysisResults: React.FC<{ data: AnalysisData; onCitationClick?: (id: string) => void }> = ({ data }) => {
    const { plan, openUpgradeModal } = useAuth();
    const isPro = plan === 'pro';

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
            ...(data.ranked_build_priorities || []).map(p => {
                let text = `**#${p.rank} ${p.initiative}**\n${p.justification}\n(${p.evidence_mentions} mentions, ${p.threads_covered} threads)`;
                if (p.context_quote) text += `\n  > "${p.context_quote}"`;
                return text;
            }),
            ``,
            `## High-Intensity Pain Points`,
            ...(data.high_intensity_pain_points || []).map(p => typeof p === 'string' ? `- ${p}` : `- ${p.title}\n  > "${p.context_quote || 'No context'}"`),
            ``,
            `## Top Switch Triggers`,
            ...(data.top_switch_triggers || []).map(t => typeof t === 'string' ? `- ${t}` : `- ${t.title}\n  > "${t.context_quote || 'No context'}"`),
            ``,
            `## Top Desired Outcomes`,
            ...(data.top_desired_outcomes || []).map(o => typeof o === 'string' ? `- ${o}` : `- ${o.title}\n  > "${o.context_quote || 'No context'}"`),
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

            {/* Dashboard Container (Vertical Stack) */}
            <div className="dashboard-vertical-stack">

                {/* 1. Ranked Build Priorities (Rich Table) */}
                {(data.ranked_build_priorities && data.ranked_build_priorities.length > 0) && (
                    <div className="data-table-container">
                        <div className="data-table-header" style={{ borderBottom: '2px solid rgba(255, 69, 0, 0.5)' }}>
                            <div style={{ background: '#FF4500', color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Lightbulb size={14} /> RANKED BUILD ROADMAP
                            </div>
                        </div>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th className="col-rank">RANK</th>
                                    <th className="col-priority">INITIATIVE</th>
                                    <th className="col-justification">JUSTIFICATION</th>
                                    <th className="col-evidence">EVIDENCE SIGNAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.ranked_build_priorities.map((bp, i) => {
                                    if (!isPro && i >= 2) {
                                        return (
                                            <tr key={i} className="blurred-row" onClick={openUpgradeModal} style={{ cursor: 'pointer' }}>
                                                <td className="col-rank">#?</td>
                                                <td colSpan={3} className="blurred-cell">
                                                    <div className="lock-content">
                                                        <Lock size={14} /> <span>Contact for Beta Access to unlock priority #{i + 1}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }
                                    const pct = Math.min(100, ((bp.evidence_mentions || 0) / 15) * 100);
                                    return (
                                        <tr key={i}>
                                            <td className="col-rank">#{bp.rank}</td>
                                            <td className="col-priority">
                                                <div style={{ fontWeight: 600 }}>{bp.initiative}</div>
                                                {bp.context_quote && (
                                                    <div style={{ marginTop: '8px', fontSize: '0.82rem', color: 'var(--text-tertiary)', fontStyle: 'italic', lineHeight: '1.4' }}>
                                                        "{bp.context_quote}"
                                                    </div>
                                                )}
                                            </td>
                                            <td className="col-justification">{bp.justification}</td>
                                            <td className="col-evidence">
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{bp.evidence_mentions} Mentions</div>
                                                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: '4px' }}>Across {bp.threads_covered} Threads</div>
                                                <div className="signal-bar-mini">
                                                    <div className="signal-bar-mini-fill" style={{ width: `${pct}%` }} />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* 2. High-Intensity Pain Points (Dense List) */}
                {(data.high_intensity_pain_points && data.high_intensity_pain_points.length > 0) && (
                    <div className="data-table-container">
                        <div className="data-table-header" style={{ borderBottom: '2px solid rgba(239, 68, 68, 0.5)' }}>
                            <div style={{ background: '#ef4444', color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Bug size={14} /> HIGH-INTENSITY PAIN POINTS
                            </div>
                        </div>
                        <div className="dense-list-container">
                            {data.high_intensity_pain_points.map((pp, i) => {
                                if (!isPro && i >= 2) {
                                    return (
                                        <div key={i} className="dense-list-item blurred-item" onClick={openUpgradeModal} style={{ cursor: 'pointer' }}>
                                            <Lock size={12} /> <span>Contact for Beta Access to unlock pain point #{i + 1}</span>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={i} className="dense-list-item" style={{ flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                            <div className="dense-list-item-icon" style={{ color: '#ef4444' }}>•</div>
                                            <div style={{ fontWeight: 600 }}>{typeof pp === 'string' ? pp : pp.title}</div>
                                        </div>
                                        {typeof pp !== 'string' && pp.context_quote && (
                                            <div style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-tertiary)', fontStyle: 'italic', lineHeight: '1.4' }}>
                                                "{pp.context_quote}"
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 3. Top Switch Triggers (Dense List) */}
                {(data.top_switch_triggers && data.top_switch_triggers.length > 0) && (
                    <div className="data-table-container">
                        <div className="data-table-header" style={{ borderBottom: '2px solid rgba(99, 102, 241, 0.5)' }}>
                            <div style={{ background: '#6366f1', color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Fingerprint size={14} /> TOP SWITCH TRIGGERS
                            </div>
                        </div>
                        <div className="dense-list-container">
                            {data.top_switch_triggers.map((st, i) => {
                                if (!isPro && i >= 2) {
                                    return (
                                        <div key={i} className="dense-list-item blurred-item" onClick={openUpgradeModal} style={{ cursor: 'pointer' }}>
                                            <Lock size={12} /> <span>Contact for Beta Access to unlock switch trigger #{i + 1}</span>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={i} className="dense-list-item" style={{ flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                            <div className="dense-list-item-icon" style={{ color: '#6366f1' }}>•</div>
                                            <div style={{ fontWeight: 600 }}>{typeof st === 'string' ? st : st.title}</div>
                                        </div>
                                        {typeof st !== 'string' && st.context_quote && (
                                            <div style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-tertiary)', fontStyle: 'italic', lineHeight: '1.4' }}>
                                                "{st.context_quote}"
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 4. Top Desired Outcomes (Dense List) */}
                {(data.top_desired_outcomes && data.top_desired_outcomes.length > 0) && (
                    <div className="data-table-container">
                        <div className="data-table-header" style={{ borderBottom: '2px solid rgba(16, 185, 129, 0.5)' }}>
                            <div style={{ background: '#10b981', color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <CheckCircle2 size={14} /> TOP DESIRED OUTCOMES
                            </div>
                        </div>
                        <div className="dense-list-container">
                            {data.top_desired_outcomes.map((o, i) => {
                                if (!isPro && i >= 2) {
                                    return (
                                        <div key={i} className="dense-list-item blurred-item" onClick={openUpgradeModal} style={{ cursor: 'pointer' }}>
                                            <Lock size={12} /> <span>Contact for Beta Access to unlock outcome #{i + 1}</span>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={i} className="dense-list-item" style={{ flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                            <CheckCircle2 size={16} color="#10b981" className="dense-list-item-icon" />
                                            <div style={{ fontWeight: 600 }}>{typeof o === 'string' ? o : o.title}</div>
                                        </div>
                                        {typeof o !== 'string' && o.context_quote && (
                                            <div style={{ paddingLeft: '24px', fontSize: '0.85rem', color: 'var(--text-tertiary)', fontStyle: 'italic', lineHeight: '1.4' }}>
                                                "{o.context_quote}"
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>

            <div className="analysis-footer">
                <div className="metadata-tag">Analysis completed: {data.metadata?.generated_at ? new Date(data.metadata.generated_at).toLocaleString() : 'Recent'}</div>
            </div>
        </div>
    );
};
