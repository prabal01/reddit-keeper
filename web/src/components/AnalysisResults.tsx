
import React from 'react';
import './AnalysisResults.css';
import {
    Lock, Clock, Download, FileText, CheckCircle2, MinusCircle, XCircle,
    Megaphone, Target, MessageSquare, Lightbulb, Trophy, Bug, FileDown
} from 'lucide-react';
import { exportReportToPDF } from '../lib/pdfExport';

interface Theme {
    title: string;
    description: string;
    confidence: number;
    sentiment: "Positive" | "Neutral" | "Negative";
    citations: string[];
    isLocked?: boolean;
}

interface FeatureRequest {
    feature: string;
    frequency: "High" | "Medium" | "Low";
    context: string;
    isLocked?: boolean;
}

interface PainPoint {
    issue: string;
    severity: "Critical" | "Major" | "Minor";
    description: string;
    isLocked?: boolean;
}

interface BuyingSignal {
    signal: string;
    context: string;
    confidence: "High" | "Medium" | "Low";
    isLocked?: boolean;
}

interface PotentialLead {
    username: string;
    platform: string;
    intent_context: string;
    original_post_id: string;
    isLocked?: boolean;
}

interface EngagementOpportunity {
    thread_id: string;
    reason: string;
    talking_points: string[];
    isLocked?: boolean;
}

interface AnalysisData {
    executive_summary: string;
    themes: Theme[];
    feature_requests: FeatureRequest[];
    pain_points: PainPoint[];
    sentiment_breakdown: {
        positive: number;
        neutral: number;
        negative: number;
    };
    // New Fields
    // New Fields
    quality_score?: number;
    quality_reasoning?: string;
    createdAt?: string;
    relevance_explanation?: string;
    buying_intent_signals?: BuyingSignal[];
    engagement_opportunities?: EngagementOpportunity[];
    potential_leads?: PotentialLead[];

    // Freemium props
    isLocked?: boolean;
    locked_counts?: {
        leads: number;
        intent: number;
        engagement: number;
        features: number;
    };
}


export const AnalysisResults: React.FC<{ data: AnalysisData, onCitationClick?: (id: string) => void }> = ({ data, onCitationClick }) => {
    const handleExportJSON = () => {
        const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `OpinionDeck_Analysis_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    const handleExportMarkdown = () => {
        // ... (existing markdown export logic)
        const md = `# OpinionDeck Analysis Report - ${new Date().toLocaleDateString()}
 
 ## Executive Summary
 ${data.executive_summary || "No summary available."}
 
 ## Top Themes
 ${(data.themes || []).map(t => `### ${t.title} (${t.confidence}% Confidence)
 ${t.description}
 *Sentiment: ${t.sentiment}*`).join('\n\n')}
 
 ## Feature Requests
 ${(data.feature_requests || []).map(f => `- **${f.feature}** (${f.frequency}): ${f.context}`).join('\n')}
 
 ## Pain Points
 ${(data.pain_points || []).map(p => `- **${p.issue}** (${p.severity}): ${p.description}`).join('\n')}
 
 ${data.potential_leads ? `## Potential Leads for Outreach
 ${data.potential_leads.map(l => `- **${l.username}** (${l.platform}): ${l.intent_context}`).join('\n')}` : ''}
 `;
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `OpinionDeck_Analysis_${new Date().toISOString().split('T')[0]}.md`;
        a.click();
    };

    const handleExportPDF = () => {
        exportReportToPDF(data);
    };

    return (
        <div className="analysis-results">
            <div className="analysis-header">
                <div>
                    <h2>📊 AI Research Report</h2>
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
                            <FileDown size={14} /> Download PDF Report
                        </button>
                        <button className="btn-text" onClick={handleExportJSON} style={{ fontSize: '0.75rem', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Download size={14} /> JSON
                        </button>
                        <button className="btn-text" onClick={handleExportMarkdown} style={{ fontSize: '0.75rem', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FileText size={14} /> Markdown
                        </button>
                    </div>
                </div>

                {data.quality_score !== undefined && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                        <div className="quality-badge">
                            <span className="score-label">Research Quality</span>
                            <div className="score-value" style={{ color: data.quality_score >= 80 ? 'var(--success-color)' : data.quality_score >= 50 ? 'var(--warning-color)' : 'var(--error-color)' }}>
                                {data.quality_score}/100
                            </div>
                        </div>
                        {data.quality_reasoning ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', maxWidth: '200px', textAlign: 'right', fontStyle: 'italic' }}>
                                "{data.quality_reasoning}"
                            </span>
                        ) : data.isLocked && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Lock size={12} /> Unlock for reasoning
                            </span>
                        )}
                    </div>
                )}

                {data.sentiment_breakdown && (
                    <div className="sentiment-summary">
                        <div className="sentiment-bar">
                            <div className="seg pos" style={{ flexGrow: data.sentiment_breakdown.positive || 0 }} title={`Positive: ${data.sentiment_breakdown.positive || 0}%`} />
                            <div className="seg neu" style={{ flexGrow: data.sentiment_breakdown.neutral || 0 }} title={`Neutral: ${data.sentiment_breakdown.neutral || 0}%`} />
                            <div className="seg neg" style={{ flexGrow: data.sentiment_breakdown.negative || 0 }} title={`Negative: ${data.sentiment_breakdown.negative || 0}%`} />
                        </div>
                        <div className="sentiment-legend">
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={14} color="var(--success-color)" /> {data.sentiment_breakdown.positive || 0}% Positive</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MinusCircle size={14} color="var(--text-tertiary)" /> {data.sentiment_breakdown.neutral || 0}% Neutral</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={14} color="var(--error-color)" /> {data.sentiment_breakdown.negative || 0}% Negative</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="analysis-section">
                <h3>Executive Summary</h3>
                <p className="exec-summary">{data.executive_summary || "No summary available."}</p>
                {data.relevance_explanation && (
                    <p className="relevance-note">
                        <strong>Strategic Relevance:</strong> {data.relevance_explanation}
                    </p>
                )}
            </div>

            <div className="analysis-grid">
                {/* Potential Leads Section */}
                {(data.potential_leads && data.potential_leads.length > 0) ? (
                    <div className="analysis-card leads-card" style={{ gridColumn: '1 / -1' }}>
                        <div className="card-header-accent outreach" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Megaphone size={18} /> Potential Customer Outreach</div>
                        <h3>High Intent Leads ({data.potential_leads.length})</h3>

                        <div className="leads-list-compact" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginTop: '10px' }}>
                            {data.potential_leads.map((lead, i) => (
                                <div key={i} className="lead-item" style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    padding: '12px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-light)',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    {lead.isLocked ? (
                                        <>
                                            <div style={{ filter: 'blur(5px)', opacity: 0.5, pointerEvents: 'none' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                    <strong style={{ color: 'var(--primary-color)', fontSize: '0.9rem' }}>Hidden User</strong>
                                                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.5 }}>Social</span>
                                                </div>
                                                <p style={{ fontSize: '0.8rem', margin: '0 0 8px 0', lineHeight: '1.4', opacity: 0.9 }}>
                                                    {lead.intent_context}
                                                </p>
                                                <button className="btn-text" style={{ fontSize: '0.7rem', padding: 0 }}>View Source Post →</button>
                                            </div>

                                            {/* Mini Lock Overlay */}
                                            <div style={{
                                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: 'rgba(0,0,0,0.1)',
                                                backdropFilter: 'blur(2px)'
                                            }}>
                                                <div style={{
                                                    background: 'var(--bg-card)',
                                                    padding: '8px 16px',
                                                    borderRadius: '20px',
                                                    border: '1px solid var(--border-light)',
                                                    boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    fontSize: '0.8rem', fontWeight: 600
                                                }}>
                                                    <Lock size={12} /> Upgrade to Unlock
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                <strong style={{ color: 'var(--primary-color)', fontSize: '0.9rem' }}>{lead.username}</strong>
                                                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.5 }}>{lead.platform}</span>
                                            </div>
                                            <p style={{ fontSize: '0.8rem', margin: '0 0 8px 0', lineHeight: '1.4', opacity: 0.9 }}>{lead.intent_context}</p>
                                            <button
                                                className="btn-text"
                                                onClick={() => onCitationClick && onCitationClick(lead.original_post_id)}
                                                style={{ fontSize: '0.7rem', padding: 0 }}
                                            >
                                                View Source Post →
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                {/* Buying Intent Signals */}
                {(data.buying_intent_signals && data.buying_intent_signals.length > 0) ? (
                    <div className="analysis-card buying-intent">
                        <div className="card-header-accent" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Target size={18} /> High Value Signals</div>
                        <h3>Buying Intent Detected ({data.buying_intent_signals.length})</h3>
                        <ul className="intent-list">
                            {data.buying_intent_signals.map((signal, i) => (
                                <li key={i} className="intent-item" style={{ position: 'relative', overflow: 'hidden' }}>
                                    {signal.isLocked ? (
                                        <>
                                            <div style={{ filter: 'blur(5px)', opacity: 0.5, pointerEvents: 'none' }}>
                                                <div className="intent-header">
                                                    <span className="signal-type">Hidden Signal</span>
                                                    <span className="confidence-tag high">High Confidence</span>
                                                </div>
                                                <p>"{signal.context}"</p>
                                            </div>
                                            <div style={{
                                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <div style={{
                                                    background: 'var(--bg-card)',
                                                    padding: '4px 12px',
                                                    borderRadius: '20px',
                                                    border: '1px solid var(--border-light)',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                    fontSize: '0.75rem', fontWeight: 600,
                                                    display: 'flex', alignItems: 'center', gap: '6px'
                                                }}>
                                                    <Lock size={12} /> Upgrade to Unlock
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="intent-header">
                                                <span className="signal-type">{signal.signal}</span>
                                                <span className={`confidence-tag ${signal.confidence.toLowerCase()}`}>
                                                    {signal.confidence} Confidence
                                                </span>
                                            </div>
                                            <p>"{signal.context}"</p>
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}

                {/* Engagement Opportunities */}
                {(data.engagement_opportunities && data.engagement_opportunities.length > 0) ? (
                    <div className="analysis-card engagement">
                        <div className="card-header-accent" style={{ background: '#3b82f6', display: 'flex', alignItems: 'center', gap: '8px' }}><MessageSquare size={18} /> Engagement & Reply Tips</div>
                        <h3>Engagement Opportunities ({data.engagement_opportunities.length})</h3>
                        <ul className="engagement-list">
                            {data.engagement_opportunities.map((opp, i) => (
                                <li key={i} className="engagement-item" style={{ position: 'relative', overflow: 'hidden' }}>
                                    {opp.isLocked ? (
                                        <>
                                            <div style={{ filter: 'blur(5px)', opacity: 0.5, pointerEvents: 'none' }}>
                                                <div style={{ marginBottom: '8px' }}>
                                                    <span style={{
                                                        background: '#e0e7ff', color: '#4338ca',
                                                        fontSize: '0.7rem', fontWeight: 700,
                                                        padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase'
                                                    }}>
                                                        Hidden Opportunity
                                                    </span>
                                                </div>
                                                <p style={{ fontWeight: 600, margin: '0 0 8px 0', opacity: 0.8 }}>
                                                    This opportunity is locked.
                                                </p>
                                                <ul>
                                                    <li>• Locked talking point strategy #1</li>
                                                    <li>• Locked talking point strategy #2</li>
                                                </ul>
                                            </div>
                                            <div style={{
                                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <div style={{
                                                    background: 'var(--bg-card)',
                                                    padding: '4px 12px',
                                                    borderRadius: '20px',
                                                    border: '1px solid var(--border-light)',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                    fontSize: '0.75rem', fontWeight: 600,
                                                    display: 'flex', alignItems: 'center', gap: '6px'
                                                }}>
                                                    <Lock size={12} /> Upgrade to Unlock
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ marginBottom: '8px' }}>
                                                <span style={{
                                                    background: '#e0e7ff', color: '#4338ca',
                                                    fontSize: '0.7rem', fontWeight: 700,
                                                    padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase'
                                                }}>
                                                    Reply Opportunity
                                                </span>
                                            </div>
                                            <p style={{ fontWeight: 600, margin: '0 0 8px 0' }}>{opp.reason}</p>
                                            <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px' }}>
                                                <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>SUGGESTED TALKING POINTS:</strong>
                                                <ul style={{ margin: 0 }}>
                                                    {opp.talking_points.map((tp, idx) => (
                                                        <li key={idx}>• {tp}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <button
                                                className="btn-text"
                                                onClick={() => onCitationClick && onCitationClick(opp.thread_id)}
                                            >
                                                Go to Comment →
                                            </button>
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}

                {/* Feature Requests */}
                {(data.feature_requests && data.feature_requests.length > 0) ? (
                    <div className="analysis-card features">
                        <div className="card-header-accent" style={{ background: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}><Lightbulb size={18} /> Feature Requests</div>
                        <h3>Feature Requests Detected ({data.feature_requests.length})</h3>
                        <ul className="feature-list">
                            {data.feature_requests.map((req, i) => (
                                <li key={i} className="feature-item" style={{ position: 'relative', overflow: 'hidden' }}>
                                    {req.isLocked ? (
                                        <>
                                            <div style={{ filter: 'blur(5px)', opacity: 0.5, pointerEvents: 'none' }}>
                                                <div className="feature-header">
                                                    <strong>Hidden Feature Request</strong>
                                                    <span className="freq-badge f-high">High Frequency</span>
                                                </div>
                                                <p className="context">"One of the most requested features..."</p>
                                            </div>
                                            <div style={{
                                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <div style={{
                                                    background: 'var(--bg-card)',
                                                    padding: '4px 12px',
                                                    borderRadius: '20px',
                                                    border: '1px solid var(--border-light)',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                    fontSize: '0.75rem', fontWeight: 600,
                                                    display: 'flex', alignItems: 'center', gap: '6px'
                                                }}>
                                                    <Lock size={12} /> Upgrade to Unlock
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="feature-header">
                                                <strong>{req.feature}</strong>
                                                <span className={`freq-badge f-${(req.frequency || 'medium').toLowerCase()}`}>
                                                    {req.frequency} Freq
                                                </span>
                                            </div>
                                            <p className="context">"{req.context}"</p>
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}

                {/* Themes */}
                {(data.themes || []).length > 0 && (
                    <div className="analysis-card themes">
                        <h3><Trophy size={18} color="#eab308" style={{ display: 'inline', marginRight: '8px' }} /> Top Themes ({data.themes.length})</h3>
                        <ul className="theme-list">
                            {(data.themes || []).map((theme, i) => (
                                <li key={i} className="theme-item" style={{ position: 'relative', overflow: 'hidden' }}>
                                    {theme.isLocked ? (
                                        <>
                                            <div style={{ filter: 'blur(5px)', opacity: 0.5, pointerEvents: 'none' }}>
                                                <div className="theme-header">
                                                    <span className="theme-title">Hidden Theme Analysis</span>
                                                    <span className="confidence-badge c-90">90% Conf.</span>
                                                </div>
                                                <p style={{ opacity: 0.8 }}>This deep-dive theme analysis is locked.</p>
                                                <div className="citations">
                                                    <span className="citation-pill">src</span>
                                                    <span className="citation-pill">src</span>
                                                </div>
                                            </div>
                                            <div style={{
                                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <div style={{
                                                    background: 'var(--bg-card)',
                                                    padding: '4px 12px',
                                                    borderRadius: '20px',
                                                    border: '1px solid var(--border-light)',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                    fontSize: '0.75rem', fontWeight: 600,
                                                    display: 'flex', alignItems: 'center', gap: '6px'
                                                }}>
                                                    <Lock size={12} /> Upgrade to Unlock
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="theme-header">
                                                <span className="theme-title">{theme.title}</span>
                                                <span className={`confidence-badge c-${Math.floor(theme.confidence / 10) * 10}`}>
                                                    {theme.confidence}% Conf.
                                                </span>
                                            </div>
                                            <p>{theme.description}</p>
                                            <div className="citations">
                                                {(theme.citations || []).map(c => (
                                                    <button
                                                        key={c}
                                                        className="citation-pill"
                                                        title="View source comment"
                                                        onClick={() => onCitationClick && onCitationClick(c)}
                                                    >
                                                        {c.replace('ID:', '')}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Pain Points */}
                {(data.pain_points || []).length > 0 && (
                    <div className="analysis-card pain-points">
                        <h3><Bug size={18} color="var(--error-color)" style={{ display: 'inline', marginRight: '8px' }} /> Pain Points & Bugs ({data.pain_points.length})</h3>
                        <ul className="pain-list">
                            {(data.pain_points || []).map((pp, i) => (
                                <li key={i} className="pain-item" style={{ position: 'relative', overflow: 'hidden' }}>
                                    {pp.isLocked ? (
                                        <>
                                            <div style={{ filter: 'blur(5px)', opacity: 0.5, pointerEvents: 'none' }}>
                                                <div className="pain-header">
                                                    <strong>Hidden Pain Point</strong>
                                                    <span className="severity-badge s-critical">CRITICAL</span>
                                                </div>
                                                <p>This critical user pain point is locked.</p>
                                            </div>
                                            <div style={{
                                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <div style={{
                                                    background: 'var(--bg-card)',
                                                    padding: '4px 12px',
                                                    borderRadius: '20px',
                                                    border: '1px solid var(--border-light)',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                    fontSize: '0.75rem', fontWeight: 600,
                                                    display: 'flex', alignItems: 'center', gap: '6px'
                                                }}>
                                                    <Lock size={12} /> Upgrade to Unlock
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="pain-header">
                                                <strong>{pp.issue}</strong>
                                                <span className={`severity-badge s-${(pp.severity || 'minor').toLowerCase()}`}>
                                                    {pp.severity}
                                                </span>
                                            </div>
                                            <p>{pp.description}</p>
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};
