import React from 'react';
import { MessageSquare } from 'lucide-react';
import type { DiscoveryResult } from '../hooks/useDiscovery';

import { DiscoveryResultCard } from './DiscoveryResultCard';
import { BlurredCard } from './BlurredCard';
import { useAuth } from '../../../contexts/AuthContext';

interface ResultGridProps {
    results: DiscoveryResult[];
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
    onEnrichResult?: (id: string, url: string, source: string) => void;
}

export const ResultGrid: React.FC<ResultGridProps> = ({ results, selectedIds, onToggle, onEnrichResult }) => {
    if (results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-32 px-10 text-center bg-slate-900/40 rounded-[48px] border border-dashed border-white/5 animate-in fade-in zoom-in duration-700">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-inner">
                    <MessageSquare size={32} className="text-slate-600" />
                </div>
                <h3 className="text-xl font-black text-white/50 tracking-tight mb-2">No results found</h3>
                <p className="text-slate-600 font-medium max-w-sm">Start a search or add links to begin your research.</p>
            </div>
        );
    }

    const gridCols = "grid-cols-1";

    const { plan } = useAuth();
    const isPro = plan === 'pro';
    const displayLimit = isPro ? results.length : 10;

    return (
        <div className={`grid ${gridCols} gap-4 pb-24 animate-in fade-in slide-in-from-bottom-5 duration-700 w-full`}>
            {results.map((thread, index) => {
                if (index < displayLimit) {
                    return (
                        <DiscoveryResultCard
                            key={thread.id}
                            thread={thread}
                            isSelected={selectedIds.has(thread.id)}
                            onToggle={onToggle}
                            onEnrich={onEnrichResult}
                        />
                    );
                } else {
                    return <BlurredCard key={`blurred-${index}`} />;
                }
            })}
        </div>
    );
};
