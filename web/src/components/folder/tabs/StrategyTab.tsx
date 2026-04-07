import React from 'react';
import { FolderAnalyses } from '../FolderAnalyses';
import { Sparkles, TrendingUp, Lightbulb, FileText, Loader2 } from 'lucide-react';

interface StrategyTabProps {
    analyses: any[];
    isAnalyzing: boolean;
    isAggregating: boolean;
    hasThreads: boolean;
    onAnalyze: () => void;
    onReport: () => void;
    onCitationClick: (commentId: string) => void;
}

export const StrategyTab: React.FC<StrategyTabProps> = ({ 
    analyses, isAnalyzing, isAggregating, hasThreads, onAnalyze, onReport, onCitationClick 
}) => {
    return (
        <div className="strategy-tab-view animate-fade-in">
            <div className="tab-actions-bar mb-8 flex justify-between items-center">
                <div className="tab-description">
                    <h3 className="text-xl font-bold text-white">Strategic Intelligence</h3>
                    <p className="text-sm text-gray-500">AI-generated deep dives and aggregated market recommendations.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        className="btn-report" 
                        onClick={onReport}
                        disabled={isAggregating || !hasThreads}
                    >
                        {isAggregating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                        Aggregate Reports
                    </button>
                    <button 
                        className="btn-premium small" 
                        onClick={onAnalyze}
                        disabled={isAnalyzing || !hasThreads}
                    >
                        <Sparkles size={14} />
                        {analyses.length > 0 ? 'Generate New Analysis' : 'Run First Analysis'}
                    </button>
                </div>
            </div>
            
            <div className="strategy-grid">
                {/* Summary Section */}
                <div className="strategy-main">
                    {analyses.length === 0 ? (
                        <div className="empty-tab-state">
                            <Lightbulb size={48} className="text-gray-700 mb-4" />
                            <h3>No intelligence reports yet</h3>
                            <p>Run an analysis to extract strategic insights from your collected threads.</p>
                            <button 
                                className="btn-premium mt-6" 
                                onClick={onAnalyze}
                                disabled={isAnalyzing || !hasThreads}
                            >
                                <Sparkles size={18} />
                                Start AI Analysis
                            </button>
                        </div>
                    ) : (
                        <FolderAnalyses 
                            analyses={analyses} 
                            onCitationClick={onCitationClick} 
                        />
                    )}
                </div>

                <div className="strategy-sidebar">
                    <div className="strategy-card next-steps premium-card">
                        <h4 className="flex items-center gap-2 mb-4">
                            <TrendingUp size={16} className="text-green-500" />
                            Next Steps
                        </h4>
                        <ul className="text-sm list-disc pl-4 text-gray-400 flex flex-col gap-3">
                            <li>Engage with high-relevance leads in subreddits mentioned in the report.</li>
                            <li>Use extracted "Switch Triggers" to refine your marketing copy.</li>
                            <li>Monitor "Pain Points" section for potential feature ideas.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
