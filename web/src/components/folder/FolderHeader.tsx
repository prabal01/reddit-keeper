import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, Calendar, Sparkles, Loader2, UploadCloud, FileText, AlertTriangle, Trash2 } from 'lucide-react';

interface FolderHeaderProps {
    folder: any;
    isAnalyzing: boolean;
    isAggregating: boolean;
    hasThreads: boolean;
    analysesCount: number;
    onAnalyze: () => void;
    onImport: () => void;
    onReport: () => void;
    onDelete: () => void;
    onClearStuck: () => void;
}

export const FolderHeader: React.FC<FolderHeaderProps> = ({
    folder,
    isAnalyzing,
    isAggregating,
    hasThreads,
    analysesCount,
    onAnalyze,
    onImport,
    onReport,
    onDelete,
    onClearStuck
}) => {
    const navigate = useNavigate();

    return (
        <div className="folder-detail-header-section">
            <div className="folder-top-nav">
                <button className="btn-glass" onClick={() => navigate('/')}>
                    ← Back to Dashboard
                </button>
                <div className="folder-action-group">
                    {isAnalyzing ? (
                        <div className="status-badge analyzing">
                            <Loader2 className="animate-spin" size={18} />
                            Analyzing Intelligence...
                        </div>
                    ) : (
                        hasThreads && (
                            <button
                                className="btn-premium"
                                onClick={onAnalyze}
                                disabled={isAnalyzing || folder.syncStatus === 'syncing'}
                            >
                                <Sparkles size={18} />
                                {analysesCount > 0 ? 'Re-Analyze Intelligence' : 'Generate AI Intelligence'}
                            </button>
                        )
                    )}

                    <button
                        className="btn-glass"
                        onClick={onImport}
                    >
                        <UploadCloud size={16} />
                        Bulk Import
                    </button>

                    <button
                        className="btn-report"
                        onClick={onReport}
                        disabled={isAggregating || isAnalyzing}
                    >
                        {isAggregating ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
                        Get Report
                    </button>

                    {isAnalyzing && (
                        <button
                            className="btn-icon-warning"
                            onClick={onClearStuck}
                            title="Clear Stuck Analysis"
                        >
                            <AlertTriangle size={18} />
                        </button>
                    )}

                    <button className="btn-icon-danger" onClick={onDelete} title="Delete Folder">
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            <div className="folder-info-banner">
                <div className="folder-title-row">
                    <div className="folder-icon-wrapper">
                        <BarChart2 size={24} />
                    </div>
                    <h2 className="folder-name-heading">{folder.name}</h2>
                    {folder.syncStatus === 'syncing' && (
                        <div className="syncing-badge">
                            <Loader2 size={14} className="animate-spin" />
                            BACKGROUND SYNCING
                        </div>
                    )}
                </div>
                {folder.description && <p className="folder-description-text">{folder.description}</p>}

                <div className="folder-quick-stats">
                    <div className="stat-pill">
                        <Sparkles size={14} />
                        <span className="stat-value">{folder.totalAnalysisCount || 0}</span>
                        <span className="stat-label">Platforms Scanned</span>
                    </div>
                    <div className="stat-pill">
                        <Calendar size={14} />
                        <span className="stat-label">Created {new Date(folder.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
