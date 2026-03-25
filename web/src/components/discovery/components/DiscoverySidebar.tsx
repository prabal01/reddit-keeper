import React, { useState } from 'react';
import { X, Star, Loader2, ShoppingCart, ChevronRight } from 'lucide-react';
import { useFolders, type Folder } from '../../../contexts/FolderContext';
import { useDiscoveryContext } from '../contexts/DiscoveryContext';
import { FolderSelect } from '../../common/FolderSelect';

export const DiscoverySidebar: React.FC = () => {
    const { folders } = useFolders();
    const { 
        selectedResults, 
        toggleSelection, 
        saveSelection, 
        isSaving 
    } = useDiscoveryContext();
    
    const [selectedFolderId, setSelectedFolderId] = useState('');

    if (selectedResults.length === 0) return null;

    return (
        <aside className="w-80 h-full border-l border-white/5 bg-black/40 backdrop-blur-3xl flex flex-col relative overflow-hidden group/sidebar">
            {/* Background Gradient Accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-linear-to-br from-[#FF4500]/5 to-transparent rounded-full -mr-32 -mt-32 blur-[100px] pointer-events-none" />
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-linear-to-br from-[#FF4500]/20 to-[#FF8717]/20 rounded-2xl flex items-center justify-center border border-[#FF4500]/20">
                        <ShoppingCart size={20} className="text-[#FF8717]" />
                    </div>
                    <div>
                        <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Selected Results</h3>
                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{selectedResults.length} Items Selected</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1 custom-scrollbar">
                {selectedResults.map(item => (
                    <div 
                        key={item.id} 
                        className="group relative flex items-start gap-4 p-4 rounded-2xl hover:bg-white/3 transition-all duration-300 cursor-default"
                    >
                        <div className="flex-1 min-w-0">
                            <h4 className="text-[10px] font-bold text-slate-300 leading-relaxed line-clamp-2 group-hover:text-white transition-colors">{item.title}</h4>
                            <div className="mt-2.5 flex items-center gap-3">
                                <span className="text-[8px] font-black uppercase text-[#FF4500]/60 tracking-tighter">
                                    {item.source}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-white/10" />
                                <span className="text-[8px] font-black uppercase text-slate-600 tracking-tighter">
                                    Verified
                                </span>
                            </div>
                        </div>
                        <button 
                            onClick={() => toggleSelection(item.id)}
                            className="mt-0.5 p-1.5 text-slate-700 hover:text-white hover:bg-white/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>

            <div className="absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-black/20 to-transparent pointer-events-none z-10" />
            <div className="p-8 bg-linear-to-t from-black/40 to-transparent border-t border-white/5 space-y-6">
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Save to Deck</label>
                        <ChevronRight size={12} className="text-slate-700" />
                    </div>
                    <FolderSelect 
                        folders={folders}
                        selectedFolderId={selectedFolderId}
                        onSelect={setSelectedFolderId}
                        disabled={isSaving}
                    />
                </div>

                <button 
                    disabled={!selectedFolderId || isSaving}
                    onClick={() => {
                        const folder = folders.find((f: Folder) => f.id === selectedFolderId);
                        saveSelection(selectedFolderId, folder?.name || 'Selected Folder');
                    }}
                    className={`dw-primary-btn w-full py-4! rounded-2xl! text-[10px]! ${
                        !selectedFolderId || isSaving ? 'opacity-20 translate-y-0 shadow-none' : ''
                    }`}
                >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} className="group-hover:rotate-12 transition-transform" />}
                    <span>{isSaving ? 'Saving...' : 'Save to Deck'}</span>
                </button>
            </div>
        </aside>
    );
};
