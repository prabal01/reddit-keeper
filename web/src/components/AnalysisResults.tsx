import React from 'react';
import './AnalysisResults.css';
import {
    Lock, Clock, Download, FileText, CheckCircle2, MinusCircle, XCircle,
    Megaphone, Target, MessageSquare, Lightbulb, Bug, FileDown,
    AlertCircle, BarChart3, Fingerprint, ShieldAlert, Zap
} from 'lucide-react';
import { exportReportToPDF } from '../lib/pdfExport';

interface MarketAttackSummary {
    core_frustration: string;
    primary_competitor_failure: string;
    immediate_opportunity: string;
    confidence_basis: {
        threads_analyzed: number;
        total_complaint_mentions: number;
    }
}

interface HighIntensityPainPoint {
    title: string;
    mention_count: number;
    threads_covered: number;
    intensity: "Low" | "Medium" | "High";
    representative_quotes: string[];
    why_it_matters: string;
}

interface SwitchTrigger {
    trigger: string;
    evidence_mentions: number;
    representative_quotes: string[];
    strategic_implication: string;
}

interface FeatureGap {
    missing_or_weak_feature: string;
    demand_signal_strength: "Low" | "Medium" | "High";
    mention_count: number;
    context_summary: string;
    opportunity_level: "Low" | "Medium" | "High";
}

interface CompetitiveWeakness {
    competitor: string;
    perceived_strength: string;
    perceived_weakness: string;
    exploit_opportunity: string;
}

interface RankedBuildPriority {
    priority_rank: number;
    initiative: string;
    justification: string;
    evidence_mentions: number;
    expected_impact: "Low" | "Medium" | "High";
}

interface MessagingAngle {
    angle: string;
    supporting_emotional_driver: string;
    supporting_evidence_quotes: string[];
}

interface RiskFlag {
    risk: string;
    evidence_basis: string;
}

interface AnalysisMetadata {
    platform: string;
    competitor_analyzed: string;
    total_threads: number;
    total_comments_analyzed: number;
    analysis_depth: "Lean" | "Moderate" | "Deep";
}

interface AnalysisData {
    market_attack_summary: MarketAttackSummary;
    high_intensity_pain_points: HighIntensityPainPoint[];
    switch_triggers: SwitchTrigger[];
    feature_gaps: FeatureGap[];
    competitive_weakness_map: CompetitiveWeakness[];
    ranked_build_priorities: RankedBuildPriority[];
    messaging_and_positioning_angles: MessagingAngle[];
    risk_flags: RiskFlag[];
    analysis_metadata: AnalysisMetadata;
    launch_velocity_90_days: {
        core_feature_to_ship: string;
        positioning_angle: string;
        target_segment: string;
        pricing_strategy: string;
        primary_differentiator: string;
    };
    executive_summary?: string; // Legacy bridge
    createdAt?: string;
    isLocked?: boolean;
}

export const AnalysisResults: React.FC<{ data: AnalysisData, onCitationClick?: (id: string) => void }> = ({ data, onCitationClick }) => {
    console.log("[AnalysisResults] Received data:", data);
    const handleExportJSON = () => {
        const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `OpinionDeck_AttackPlan_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    const handleExportMarkdown = () => {
        const md = `# OpinionDeck Strategic Intelligence Report - ${new Date().toLocaleDateString()}

## Market Attack Summary
- **Core Frustration:** ${data.market_attack_summary?.core_frustration}
- **Primary Failure:** ${data.market_attack_summary?.primary_competitor_failure}
- **Immediate Opportunity:** ${data.market_attack_summary?.immediate_opportunity}

## High-Intensity Pain Points
${(data.high_intensity_pain_points || []).map(p => `- **Why it matters:** ${p.why_it_matters}
`).join('\n')}

## 🚀 If You Launch in 90 Days, Do This
- **Core Feature to Ship:** ${data.launch_velocity_90_days?.core_feature_to_ship}
- **Positioning Angle:** ${data.launch_velocity_90_days?.positioning_angle}
- **Target Segment:** ${data.launch_velocity_90_days?.target_segment}
- **Pricing Strategy:** ${data.launch_velocity_90_days?.pricing_strategy}
- **Primary Differentiator:** ${data.launch_velocity_90_days?.primary_differentiator}
`;
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `OpinionDeck_Strategy_${new Date().toISOString().split('T')[0]}.md`;
        a.click();
    };

    const handleExportPDF = () => {
        exportReportToPDF(data);
    };

    const isLegacy = !data.market_attack_summary && (data.executive_summary || (data as any).themes);

    if (!data.market_attack_summary && !isLegacy) return <div className="no-data">Insufficient analysis data.</div>;

    if (isLegacy) {
        return (
            <div className="analysis-results legacy-view">
                <div className="analysis-header">
                    <div>
                        <h2 className="strategic-title">📊 Intelligence Report (Legacy)</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '8px' }}>
                            {data.createdAt && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={14} /> {new Date(data.createdAt).toLocaleString()}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="quality-badge" style={{ borderColor: 'var(--border-color)' }}>
                        <span className="score-label">Format</span>
                        <div className="score-value" style={{ fontSize: '1rem' }}>v1.0</div>
                    </div>
                </div>

                <div className="analysis-section">
                    <div className="section-badge">Executive Summary</div>
                    <div className="exec-summary">
                        {data.executive_summary?.split('\n').map((line, i) => (
                            <p key={i}>{line}</p>
                        )) || <p>No executive summary available in this legacy report.</p>}
                    </div>
                </div>

                <div className="legacy-warning" style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px', marginBottom: '2rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <strong>Note:</strong> This is an older report format. Re-run analysis to generate a full <strong>Competitive Advantage Blueprint</strong> with attack summaries, build priorities, and messaging levers.
                </div>
            </div>
        );
    }

    return (
        <div className="analysis-results market-attack-view">
            <div className="analysis-header">
                <div>
                    <h2 className="strategic-title">🔥 Competitive Advantage Blueprint</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {data.createdAt && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={14} /> {new Date(data.createdAt).toLocaleString()}
                            </span>
                        )}
                        {data.isLocked && <span className="badge-new" style={{ background: 'var(--warning-color)', color: 'black' }}>FREE PREVIEW</span>}
                    </div>
                    <div className="export-actions" style={{ display: 'flex', gap: '15px', marginTop: '12px' }}>
                        <button className="btn-text" onClick={handleExportPDF} style={{ background: 'rgba(255, 69, 0, 0.1)', color: 'var(--primary-color)', padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileDown size={14} /> Download Strategy PDF
                        </button>
                        <button className="btn-text" onClick={handleExportJSON} style={{ fontSize: '0.75rem', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Download size={14} /> JSON
                        </button>
                        <button className="btn-text" onClick={handleExportMarkdown} style={{ fontSize: '0.75rem', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FileText size={14} /> Markdown
                        </button>
                    </div>
                </div>

                <div className="intelligence-meta">
                    <div className="quality-badge-aggressive">
                        <span className="score-label">Intel Confidence</span>
                        <div className="score-value">
                            {data.market_attack_summary?.confidence_basis?.total_complaint_mentions || 0}
                        </div>
                    </div>
                    <div className="dataset-meta">
                        <span>{data.analysis_metadata?.total_threads || 0} Threads</span>
                        <span>{data.analysis_metadata?.total_comments_analyzed || 0} Comments</span>
                        <span>{data.analysis_metadata?.analysis_depth} Depth</span>
                    </div>
                </div>
            </div>

            {/* 1. Market Attack Summary */}
            <div className="analysis-section attack-summary-section">
                <div className="section-badge">Strategic Directive</div>
                <div className="attack-grid">
                    <div className="attack-card frustration">
                        <div className="card-header"><BarChart3 size={16} /> Core Frustrations</div>
                        <p>{data.market_attack_summary?.core_frustration}</p>
                    </div>
                    <div className="attack-card failure">
                        <div className="card-header"><Target size={16} /> Competitor Failure</div>
                        <p>{data.market_attack_summary?.primary_competitor_failure}</p>
                    </div>
                    <div className="attack-card opportunity">
                        <div className="card-header"><Zap size={16} /> Immediate Strike</div>
                        <p>{data.market_attack_summary?.immediate_opportunity}</p>
                    </div>
                </div>
            </div>

            <div className="analysis-grid">
                {/* 2. High-Intensity Pain Points */}
                <div className="analysis-card pain-points-aggressive">
                    <div className="card-header-accent attack"><Bug size={18} /> High-Intensity Pain Points</div>
                    <div className="pain-list-aggressive">
                        {data.high_intensity_pain_points?.map((pp, i) => (
                            <div key={i} className="pain-item-aggressive">
                                <div className="pain-meta">
                                    <span className={`intensity-badge ${pp.intensity.toLowerCase()}`}>{pp.intensity} Intensity</span>
                                    <span className="mention-count">{pp.mention_count} Mentions ({pp.threads_covered} Threads)</span>
                                </div>
                                <h4>{pp.title}</h4>
                                <p><strong>Impact:</strong> {pp.why_it_matters}</p>
                                <div className="quote-gallery">
                                    {pp.representative_quotes?.map((q, j) => (
                                        <div key={j} className="raw-quote">"{q}"</div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. Switching Triggers */}
                <div className="analysis-card switching-triggers">
                    <div className="card-header-accent exit"><Fingerprint size={18} /> Switching Triggers</div>
                    <div className="trigger-list">
                        {data.switch_triggers?.map((st, i) => (
                            <div key={i} className="trigger-item">
                                <div className="trigger-header">
                                    <strong>{st.trigger}</strong>
                                    <span className="trigger-count">{st.evidence_mentions} signals</span>
                                </div>
                                <p><em>Strategy:</em> {st.strategic_implication}</p>
                                {st.representative_quotes?.[0] && <div className="raw-quote mini">"{st.representative_quotes[0]}"</div>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. Feature Gaps */}
                <div className="analysis-card feature-gaps">
                    <div className="card-header-accent gap"><MessageSquare size={18} /> Feature Deficiencies</div>
                    <div className="gap-list">
                        {data.feature_gaps?.map((fg, i) => (
                            <div key={i} className="gap-item">
                                <div className="gap-header">
                                    <strong>{fg.missing_or_weak_feature}</strong>
                                    <span className={`impact-badge ${fg.opportunity_level.toLowerCase()}`}>{fg.opportunity_level} Opportunity</span>
                                </div>
                                <p>{fg.context_summary}</p>
                                <div className="gap-meta">Demand Signal: {fg.demand_signal_strength}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 5. Competitive Weakness Map */}
                <div className="analysis-card weakness-map">
                    <div className="card-header-accent exploit"><ShieldAlert size={18} /> Weakness Map</div>
                    <div className="weakness-list">
                        {data.competitive_weakness_map?.map((cw, i) => (
                            <div key={i} className="weakness-item">
                                <span className="comp-name">{cw.competitor}</span>
                                <div className="flaw"><strong>Weakness:</strong> {cw.perceived_weakness}</div>
                                <div className="strategy"><strong>Strike Plan:</strong> {cw.exploit_opportunity}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 6. Ranked Build Priorities */}
                <div className="analysis-card build-priorities">
                    <div className="card-header-accent build"><Lightbulb size={18} /> Build Roadmap</div>
                    <div className="priority-list">
                        {data.ranked_build_priorities?.map((bp, i) => (
                            <div key={i} className="priority-item">
                                <div className="priority-header">
                                    <span className="rank-num">#{bp.priority_rank}</span>
                                    <span className={`impact-badge ${bp.expected_impact.toLowerCase()}`}>{bp.expected_impact} Impact</span>
                                </div>
                                <h4>{bp.initiative}</h4>
                                <p>{bp.justification}</p>
                                <div className="priority-meta">Evidence Strength: {bp.evidence_mentions} signals</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 7. Messaging & Positioning */}
                <div className="analysis-card messaging-angles">
                    <div className="card-header-accent megaphone"><Megaphone size={18} /> Messaging Leverage</div>
                    <div className="angles-grid">
                        {data.messaging_and_positioning_angles?.map((ma, i) => (
                            <div key={i} className="angle-item">
                                <span className="angle-name">{ma.angle}</span>
                                <p className="emotional-driver">{ma.supporting_emotional_driver}</p>
                                {ma.supporting_evidence_quotes?.[0] && <div className="angle-hook">"{ma.supporting_evidence_quotes[0]}"</div>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 8. Risk Flags */}
                <div className="analysis-card risk-flags">
                    <div className="card-header-accent alert"><AlertCircle size={18} /> Intelligence Risks</div>
                    <div className="risk-list">
                        {data.risk_flags?.map((rf, i) => (
                            <div key={i} className="risk-item">
                                <strong>{rf.risk}</strong>
                                <p>{rf.evidence_basis}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 9. 90-Day Launch Roadmap */}
                <div className="analysis-card launch-90-days">
                    <div className="card-header-accent priority"><Clock size={18} /> If You Launch in 90 Days...</div>
                    <div className="launch-tactics-grid">
                        <div className="tactic-item">
                            <label>Core Feature to Ship</label>
                            <div className="tactic-value">{data.launch_velocity_90_days?.core_feature_to_ship}</div>
                        </div>
                        <div className="tactic-item">
                            <label>Positioning Angle</label>
                            <div className="tactic-value">{data.launch_velocity_90_days?.positioning_angle}</div>
                        </div>
                        <div className="tactic-item">
                            <label>Target Segment</label>
                            <div className="tactic-value">{data.launch_velocity_90_days?.target_segment}</div>
                        </div>
                        <div className="tactic-item">
                            <label>Pricing Strategy</label>
                            <div className="tactic-value">{data.launch_velocity_90_days?.pricing_strategy}</div>
                        </div>
                        <div className="tactic-item">
                            <label>Primary Differentiator</label>
                            <div className="tactic-value">{data.launch_velocity_90_days?.primary_differentiator}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="analysis-footer">
                <div className="metadata-tag">Analysis Depth: {data.analysis_metadata?.analysis_depth}</div>
                <div className="metadata-tag">Data Source: {data.analysis_metadata?.platform}</div>
                <div className="metadata-tag">Subject: {data.analysis_metadata?.competitor_analyzed}</div>
            </div>
        </div>
    );
};
