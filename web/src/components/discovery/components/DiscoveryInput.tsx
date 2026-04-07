import { Loader2, Sparkles, History as HistoryIcon, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { UIButton } from '../../common/UIButton';
import { H2, Metadata } from '../../common/Typography';
import { Badge } from '../../common/Badge';

interface DiscoveryInputProps {
    activeTab: 'competitor' | 'idea' | 'bulk';
    onBack: () => void;

    // Competitor State
    competitor: string;
    setCompetitor: (val: string) => void;
    onCompetitorSearch: () => void;

    // Idea State (Now Problem/Audience Framework)
    problem: string;
    setProblem: (val: string) => void;
    audience: string;
    setAudience: (val: string) => void;
    onIdeaSearch: () => void;

    // Bulk State
    bulkUrls: string;
    setBulkUrls: (val: string) => void;
    onBulkImport: (urls: string[]) => void;

    // Global State
    loading: boolean;
}

export const DiscoveryInput: React.FC<DiscoveryInputProps> = ({
    activeTab,
    competitor, setCompetitor, onCompetitorSearch,
    problem, setProblem, audience, setAudience, onIdeaSearch,
    bulkUrls, setBulkUrls, onBulkImport,
    loading
}) => {
    const [bulkError, setBulkError] = useState<string | null>(null);

    const validateAndImportBulk = () => {
        setBulkError(null);
        const rawUrls = bulkUrls.split(/[\n,]+/).map(u => u.trim()).filter(u => u !== '');

        if (rawUrls.length === 0) {
            setBulkError("Please enter at least one URL.");
            return;
        }

        if (rawUrls.length > 50) {
            setBulkError("Maximum 50 URLs allowed.");
            return;
        }

        const validatedUrls: string[] = [];
        const invalidUrls: string[] = [];

        rawUrls.forEach(url => {
            try {
                const parsedUrl = new URL(url);
                const isReddit = parsedUrl.hostname.includes('reddit.com');
                const isHN = parsedUrl.hostname.includes('news.ycombinator.com');

                if (isReddit) {
                    const paths = parsedUrl.pathname.split('/').filter(Boolean);
                    if (paths.length === 4 || paths.length === 5) validatedUrls.push(url);
                    else invalidUrls.push(url);
                } else if (isHN) {
                    if (parsedUrl.searchParams.has('id')) validatedUrls.push(url);
                    else invalidUrls.push(url);
                } else {
                    invalidUrls.push(url);
                }
            } catch (e) {
                invalidUrls.push(url);
            }
        });

        if (invalidUrls.length > 0) {
            setBulkError(`Found ${invalidUrls.length} invalid links. Please use only Reddit or HN thread links.`);
            return;
        }

        onBulkImport(validatedUrls);
    };

    const urlCount = bulkUrls.split('\n').map(l => l.trim()).filter(Boolean).length;

    return (
        <div className="discovery-input-bar group/input flex flex-col gap-8 max-w-4xl mx-auto w-full mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Step 2 Header */}
            <div className="flex items-center justify-between px-6">
                <div className="flex flex-col">
                    <H2>
                        {activeTab === 'competitor' ? 'Who are your rivals?' : activeTab === 'idea' ? 'Tell us your focus' : 'Paste your links'}
                    </H2>
                    <Metadata className="text-(--bg-accent)! opacity-100! mt-1">
                        Step 2: Add specific details for the search
                    </Metadata>
                </div>
            </div>

            {/* Main Integrated Bar */}
            <div className="discovery-input-card relative flex items-center gap-4 bg-(--bg-input) backdrop-blur-3xl border border-(--border) rounded-full px-8 py-4 shadow-2xl group-focus-within/input:border-[#FF4500]/40 transition-all duration-500">
                <div className="flex-1 flex items-center min-w-0">
                    <div className="w-full transition-all duration-500">
                        {activeTab === 'competitor' && (
                            <input
                                className="w-full bg-transparent border-none text-base font-bold text-(--text-primary) outline-none focus:outline-none focus:ring-0 placeholder:text-(--text-tertiary) tracking-tight"
                                type="text"
                                placeholder="Enter names (e.g. Linear, Asana, Monday)"
                                value={competitor}
                                onChange={(e) => setCompetitor(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && onCompetitorSearch()}
                                autoFocus
                            />
                        )}

                        {activeTab === 'idea' && (
                            <div className="flex items-center gap-3 w-full text-base font-bold">
                                <span className="text-(--text-tertiary) opacity-50 whitespace-nowrap hidden sm:inline">Solving</span>
                                <input
                                    className="flex-1 bg-transparent border-none text-base font-bold text-(--text-primary) outline-none focus:outline-none focus:ring-0 placeholder:text-(--text-tertiary) tracking-tight min-w-[150px]"
                                    type="text"
                                    placeholder="specific problem..."
                                    value={problem}
                                    onChange={(e) => setProblem(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && onIdeaSearch()}
                                    autoFocus
                                />
                                <span className="text-(--text-tertiary) opacity-50 whitespace-nowrap hidden sm:inline">for</span>
                                <input
                                    className="w-64 bg-transparent border-none text-base font-bold text-(--primary-color) outline-none focus:outline-none focus:ring-0 placeholder:text-(--primary-color)/30 tracking-tight"
                                    type="text"
                                    placeholder="this specific audience"
                                    value={audience}
                                    onChange={(e) => setAudience(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && onIdeaSearch()}
                                />
                            </div>
                        )}

                        {activeTab === 'bulk' && (
                            <div className="flex items-center gap-4 w-full">
                                <input
                                    className="w-full bg-transparent border-none text-base font-bold text-(--text-primary) outline-none focus:outline-none focus:ring-0 placeholder:text-(--text-tertiary) tracking-tight"
                                    placeholder="Paste Reddit or HN links here..."
                                    value={bulkUrls}
                                    onChange={(e) => setBulkUrls(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2 group/btn">
                    <UIButton
                        size="lg"
                        className="px-8 py-3.5 transform hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-20 disabled:grayscale disabled:scale-100 shadow-[0_0_20px_rgba(255,69,0,0.2)]"
                        onClick={activeTab === 'competitor' ? onCompetitorSearch : activeTab === 'idea' ? onIdeaSearch : validateAndImportBulk}
                        disabled={loading || (activeTab === 'competitor' && !competitor.trim()) || (activeTab === 'idea' && !problem.trim()) || (activeTab === 'bulk' && urlCount === 0)}
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                        <span className="text-[12px] font-black uppercase tracking-widest leading-none pt-0.5 whitespace-nowrap">
                            {loading ? 'Initializing...' : 'Start Monitoring Agent'}
                        </span>
                    </UIButton>
                    
                    {!loading && (
                        <Badge variant="premium" className="animate-in fade-in slide-in-from-top-1 duration-500" icon={<Zap size={10} />}>
                            Costs 1 Discovery Credit
                        </Badge>
                    )}
                </div>
            </div>

            {/* Guided Interaction Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-8 pt-4">
                {bulkError && <p className="text-[10px] font-bold text-[#FF4500] uppercase tracking-widest animate-pulse">{bulkError}</p>}
                
                <div className="flex-1" />
                
                <div className="flex items-center gap-2 text-[9px] font-black text-slate-700 uppercase tracking-wider">
                    <HistoryIcon size={12} className="text-slate-500" />
                    <span>Press Enter to start</span>
                </div>
            </div>
        </div>
    );
};
