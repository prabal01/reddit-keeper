import React from 'react';
import { Clock, Trash2, ExternalLink, Hash, Lightbulb } from 'lucide-react';
import type { DiscoveryHistoryEntry } from '../hooks/useDiscovery';
import { formatDistanceToNow } from 'date-fns';

interface DiscoveryHistoryItemProps {
    entry: DiscoveryHistoryEntry;
    onSelect: (entry: DiscoveryHistoryEntry) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
}

const DiscoveryHistoryItem: React.FC<DiscoveryHistoryItemProps> = ({ entry, onSelect, onDelete }) => {
    const isIdea = entry.type === 'idea';
    const isBulk = entry.type === 'bulk';

    return (
        <div 
            className="discovery-history-item group"
            onClick={() => onSelect(entry)}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg ${isIdea ? 'bg-amber-500/10 text-amber-500' : isBulk ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}>
                        {isIdea ? <Lightbulb size={16} /> : isBulk ? <ExternalLink size={16} /> : <Hash size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                            {entry.query}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                <Clock size={10} />
                                {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                            </span>
                            <span className="text-[10px] text-gray-500">•</span>
                            <span className="text-[10px] text-gray-400">
                                {entry.resultsCount} results
                            </span>
                        </div>
                    </div>
                </div>
                
                <button
                    onClick={(e) => onDelete(entry.id, e)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete history"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {entry.topResults && entry.topResults.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {entry.topResults.slice(0, 3).map((res, idx) => (
                        <div key={idx} className="text-[9px] px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-gray-400 truncate max-w-[100px]">
                            {res.title}
                        </div>
                    ))}
                    {entry.topResults.length > 3 && (
                        <div className="text-[9px] px-1 py-0.5 text-gray-500">
                            +{entry.topResults.length - 3} more
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DiscoveryHistoryItem;
