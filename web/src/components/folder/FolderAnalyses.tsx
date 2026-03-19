import React from 'react';
import { FileText, FileDown, Calendar } from 'lucide-react';
import { AnalysisResults } from '../AnalysisResults';
import { exportReportToPDF } from '../../lib/pdfExport';

interface FolderAnalysesProps {
    analyses: any[];
    onCitationClick: (citationId: string) => void;
}

export const FolderAnalyses: React.FC<FolderAnalysesProps> = ({ analyses, onCitationClick }) => {
    if (analyses.length === 0) return null;

    const latestReport = analyses[0];
    const pastReports = analyses.slice(1);

    return (
        <div className="analysis-reports-section">
            <h3 className="section-title with-icon">
                <FileText size={24} color="var(--primary-color)" />
                Latest AI Report
            </h3>
            
            <div className="latest-report-card premium-card">
                <div className="report-card-header">
                    <div className="report-meta">
                        <div className="badge-latest">LATEST</div>
                        <span className="report-date">
                            Generated {latestReport.createdAt ? new Date(latestReport.createdAt).toLocaleString() : 'Recently'}
                        </span>
                    </div>
                    <button className="btn-glass sm" onClick={() => exportReportToPDF(latestReport)}>
                        <FileDown size={14} /> Download PDF
                    </button>
                </div>
                <div className="report-card-content">
                    <AnalysisResults data={latestReport} onCitationClick={onCitationClick} />
                </div>
            </div>

            {pastReports.length > 0 && (
                <div className="past-reports-section">
                    <h4 className="past-reports-title">Previous Reports</h4>
                    <div className="past-reports-list">
                        {pastReports.map((analysis, index) => (
                            <details key={analysis.id || index} className="report-collapsible premium-card">
                                <summary className="report-summary">
                                    <span className="summary-title">
                                        <Calendar size={16} />
                                        Report from {analysis.createdAt ? new Date(analysis.createdAt).toLocaleString() : 'Unknown Date'}
                                    </span>
                                    <span className="summary-hint">Click to view details</span>
                                </summary>
                                <div className="report-detail-content">
                                    <div className="detail-header">
                                        <button className="btn-glass sm" onClick={() => exportReportToPDF(analysis)}>
                                            <FileDown size={14} /> Download PDF
                                        </button>
                                    </div>
                                    <AnalysisResults data={analysis} onCitationClick={onCitationClick} />
                                </div>
                            </details>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
