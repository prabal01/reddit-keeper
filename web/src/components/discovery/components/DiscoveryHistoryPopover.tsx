import React, { useRef, useEffect } from 'react';
import { X, Search, History as HistoryIcon } from 'lucide-react';
import type { DiscoveryHistoryEntry } from '../hooks/useDiscovery';
import DiscoveryHistoryItem from './DiscoveryHistoryItem';

interface DiscoveryHistoryPopoverProps {
    history: DiscoveryHistoryEntry[];
    isOpen: boolean;
    onClose: () => void;
    onSelect: (entry: DiscoveryHistoryEntry) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    isLoading: boolean;
}

const DiscoveryHistoryPopover: React.FC<DiscoveryHistoryPopoverProps> = ({ 
    history, 
    isOpen, 
    onClose, 
    onSelect, 
    onDelete,
    isLoading 
}) => {
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div 
            ref={popoverRef}
            className="discovery-history-popover"
            role="dialog"
            aria-label="Search History"
        >
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-2 text-white">
                    <HistoryIcon size={18} className="text-blue-400" />
                    <h3 className="text-sm font-semibold">Search History</h3>
                </div>
                <button 
                    onClick={onClose}
                    className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                    aria-label="Close search history"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2">
                {isLoading ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-3 text-gray-500">
                        <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                        <span className="text-xs">Loading history...</span>
                    </div>
                ) : history.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-500">
                        <div className="p-3 bg-white/5 rounded-full">
                            <Search size={24} className="opacity-20" />
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-medium text-gray-400">No history yet</p>
                            <p className="text-[10px] mt-1 max-w-[180px]">Your recent discovery searches will appear here.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {history.map((entry) => (
                            <DiscoveryHistoryItem 
                                key={entry.id}
                                entry={entry}
                                onSelect={(e) => {
                                    onSelect(e);
                                    onClose();
                                }}
                                onDelete={onDelete}
                            />
                        ))}
                    </div>
                )}
            </div>

            {history.length > 0 && (
                <div className="p-3 bg-black/40 border-t border-white/10 flex justify-center">
                    <p className="text-[10px] text-gray-500">
                        Showing last {history.length} searches
                    </p>
                </div>
            )}
        </div>
    );
};

export default DiscoveryHistoryPopover;
