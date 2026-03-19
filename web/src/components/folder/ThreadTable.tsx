import React from 'react';
import { ExternalLink, MessageSquare as MessageSquareIcon, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';

interface Thread {
    id: string;
    title: string;
    subreddit: string;
    author: string;
    commentCount: number;
    savedAt: string;
    analysisStatus?: string;
    extractedPainPoints?: string[];
}

interface ThreadTableProps {
    threads: Thread[];
    isAnalyzing: boolean;
    onSelectThread: (thread: Thread) => void;
}

export const ThreadTable: React.FC<ThreadTableProps> = ({ threads, isAnalyzing, onSelectThread }) => {
    return (
        <div className="thread-list-container premium-card">
            <h3 className="section-title">Saved Threads</h3>
            <div className="thread-list-header">
                <div>Thread / Source</div>
                <div>Saved Date</div>
                <div>Status</div>
                <div>Key Pain Points</div>
            </div>
            {threads
                .sort((a, b) => new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime())
                .map(item => {
                    const status = item.analysisStatus || (isAnalyzing ? 'processing' : 'pending');
                    const painPoints = item.extractedPainPoints || [];

                    return (
                        <div key={item.id} className="thread-list-row" onClick={() => onSelectThread(item)}>
                            <div className="thread-list-cell">
                                <div className="thread-list-title" title={item.title || 'Extracted Insight'}>
                                    {item.title || 'Extracted Insight'}
                                </div>
                                <div className="thread-meta-cell">
                                    <ExternalLink size={12} />
                                    <span>{item.subreddit || 'Unknown Source'}</span>
                                    {item.commentCount !== undefined && (
                                        <>
                                            <span className="meta-dot">•</span>
                                            <MessageSquareIcon size={12} />
                                            <span>{item.commentCount} comments</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="thread-list-cell">
                                {item.savedAt ? new Date(item.savedAt).toLocaleDateString() : '—'}
                            </div>
                            <div className="thread-list-cell">
                                <div className={`status-pill ${status}`}>
                                    {status === 'success' ? <CheckCircle2 size={12} /> :
                                        status === 'processing' ? <Loader2 size={12} className="animate-spin" /> :
                                            status === 'pending' ? <MessageSquareIcon size={12} /> :
                                                <AlertTriangle size={12} />}
                                    {status}
                                </div>
                            </div>
                            <div className="thread-list-cell">
                                {painPoints.length > 0 ? (
                                    <div className="thread-list-badges">
                                        {painPoints.slice(0, 2).map((pp, i) => (
                                            <span key={i} className="pain-point-badge" title={pp}>{pp}</span>
                                        ))}
                                        {painPoints.length > 2 && (
                                            <span className="more-badge">
                                                +{painPoints.length - 2} more
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <span className="waiting-text">
                                        {status === 'success' ? 'None found' : 'Waiting analysis...'}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
        </div>
    );
};
