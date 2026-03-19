import React, { useState } from 'react';
import { X, Star, Loader2, ShoppingCart, ChevronRight } from 'lucide-react';
import { useFolders, type Folder } from '../../../contexts/FolderContext';
import { useDiscoveryContext } from '../contexts/DiscoveryContext';

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
        <aside className="w-80 border-l border-white/10 bg-white/2 backdrop-blur-xl flex flex-col h-full animate-in slide-in-from-right duration-500">
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#FF4500]/10 rounded-lg">
                        <ShoppingCart size={18} className="text-[#FF8717]" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-white uppercase tracking-widest">Research Cart</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{selectedResults.length} items selected</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {selectedResults.map(item => (
                    <div 
                        key={item.id} 
                        className="group relative bg-white/3 border border-white/5 rounded-xl p-3 hover:border-[#FF4500]/30 transition-all"
                    >
                        <div className="flex justify-between items-start gap-2">
                            <h4 className="text-[11px] font-bold text-slate-200 leading-snug line-clamp-2">{item.title}</h4>
                            <button 
                                onClick={() => toggleSelection(item.id)}
                                className="p-1 text-slate-600 hover:text-white transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-white/5 text-[9px] font-black uppercase text-slate-500 tracking-tighter">
                                {item.source}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-6 bg-white/3 border-t border-white/10 space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Destination Deck</label>
                    <select 
                        value={selectedFolderId}
                        onChange={(e) => setSelectedFolderId(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-[#FF4500]/50 transition-all appearance-none cursor-pointer"
                    >
                        <option value="" className="bg-[#1a1a2e]">Choose a deck...</option>
                        {folders.map((f: Folder) => (
                            <option key={f.id} value={f.id} className="bg-[#1a1a2e]">{f.name}</option>
                        ))}
                    </select>
                </div>

                <button 
                    disabled={!selectedFolderId || isSaving}
                    onClick={() => {
                        const folder = folders.find((f: Folder) => f.id === selectedFolderId);
                        saveSelection(selectedFolderId, folder?.name || 'Selected Folder');
                    }}
                    className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest transition-all ${
                        selectedFolderId && !isSaving 
                        ? 'bg-[#FF4500] text-white shadow-[0_8px_20px_rgba(255,69,0,0.3)] hover:scale-[1.02] active:scale-[0.98]' 
                        : 'bg-white/5 text-slate-600 cursor-not-allowed'
                    }`}
                >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
                    <span>{isSaving ? 'Saving...' : 'Save to Deck'}</span>
                </button>
            </div>
        </aside>
    );
};
