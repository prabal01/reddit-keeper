import React, { useState } from 'react';
import { useFolders } from '../../../contexts/FolderContext';
import type { DiscoveryResult } from '../hooks/useDiscovery';
import { X, Save, FolderPlus, Trash2, ExternalLink, Check, Loader2 } from 'lucide-react';

interface DiscoverySidebarProps {
    selectedResults: DiscoveryResult[];
    onToggleSelection: (id: string) => void;
    onSave: (folderId: string) => Promise<void>;
    onClear: () => void;
    isSaving: boolean;
}

export const DiscoverySidebar: React.FC<DiscoverySidebarProps> = ({
    selectedResults,
    onToggleSelection,
    onSave,
    onClear,
    isSaving
}) => {
    const { folders, createFolder } = useFolders();
    const [targetFolderId, setTargetFolderId] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        setIsCreating(true);
        try {
            const folder = await createFolder(newFolderName.trim());
            setTargetFolderId(folder.id);
            setNewFolderName('');
            setIsCreatingFolder(false);
        } catch (err) {
            console.error("Failed to create folder:", err);
        } finally {
            setIsCreating(false);
        }
    };

    if (selectedResults.length === 0) {
        return (
            <aside className="w-[360px] h-[calc(100vh-140px)] sticky top-[100px] flex flex-col items-center justify-center text-center bg-white/[0.01] rounded-[32px] border border-dashed border-white/5 animate-in fade-in slide-in-from-right-4 duration-700">
                <div className="flex flex-col items-center justify-center -mt-12 px-8">
                    <div className="w-12 h-12 bg-white/[0.03] rounded-2xl flex items-center justify-center mb-5 border border-white/5">
                        <Save size={20} className="text-slate-600 opacity-50" />
                    </div>
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Research Bucket</h3>
                    <p className="text-slate-600 text-[11px] font-medium leading-relaxed max-w-[200px]">Select intelligence cards to begin organizing your work.</p>
                </div>
            </aside>
        );
    }

    return (
        <aside className="w-[360px] h-[calc(100vh-140px)] sticky top-[100px] flex flex-col bg-white/[0.02] backdrop-blur-3xl rounded-[32px] border border-white/10 shadow-2xl animate-in fade-in slide-in-from-right-8 duration-700 overflow-hidden group/sidebar">
            <div className="p-5 pb-3 flex justify-between items-center border-b border-white/5">
                <div className="flex items-center gap-3">
                    <h3 className="text-slate-500 font-black text-[9px] uppercase tracking-[0.2em]">Workspace</h3>
                    <span className="bg-[#FF4500]/10 text-[#FF8717] text-[9px] font-black px-2 py-0.5 rounded-md border border-[#FF4500]/20">{selectedResults.length}</span>
                </div>
                <button
                    className="p-2.5 rounded-xl bg-white/5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-all duration-300 border border-transparent hover:border-red-500/20"
                    onClick={onClear}
                    title="Clear workspace"
                    aria-label="Clear all items from research workspace"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-hide">
                <div className="flex flex-col gap-3">
                    {selectedResults.map(item => (
                        <div key={item.id} className="group/item relative bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-2xl p-4 transition-all duration-300 flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] opacity-60">r/{item.subreddit || 'hacker-news'}</span>
                                <div className="flex items-center gap-1.5 opacity-0 group-hover/item:opacity-100 transition-all duration-300">
                                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 bg-white/5 transition-all" aria-label={`View r/${item.subreddit} thread in new tab`}>
                                        <ExternalLink size={10} />
                                    </a>
                                    <button
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/10 bg-white/5 transition-all"
                                        onClick={() => onToggleSelection(item.id)}
                                        aria-label={`Remove "${item.title}" from workspace`}
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            </div>
                            <p className="text-[10px] font-bold leading-relaxed text-slate-400 line-clamp-2 tracking-tight group-hover/item:text-white transition-colors uppercase">{item.title}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-6 bg-black/40 border-t border-white/10 flex flex-col gap-5">
                {!isCreatingFolder ? (
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <select
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-slate-300 text-xs font-black uppercase tracking-widest outline-none focus:border-[#FF4500]/50 focus:text-white transition-all appearance-none cursor-pointer"
                                value={targetFolderId}
                                onChange={(e) => setTargetFolderId(e.target.value)}
                                aria-label="Select target research folder"
                            >
                                <option value="" className="bg-slate-900">Select Target Folder</option>
                                {folders.map((f: any) => (
                                    <option key={f.id} value={f.id} className="bg-slate-900">{f.name}</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                <Check size={14} className="opacity-40" />
                            </div>
                        </div>
                        <button
                            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all border-dashed"
                            onClick={() => setIsCreatingFolder(true)}
                            title="Create New Project Folder"
                            aria-label="Create new project folder"
                            aria-expanded={isCreatingFolder}
                        >
                            <FolderPlus size={18} />
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 p-5 rounded-[24px] bg-black/30 border border-[#FF4500]/20 animate-in fade-in zoom-in-95 duration-300">
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">New Research Folder</div>
                        <input
                            className="bg-transparent border-none text-white text-sm font-black uppercase tracking-widest outline-none w-full p-1 placeholder:text-slate-700"
                            type="text"
                            placeholder="Enter Name..."
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                            autoFocus
                            aria-label="New folder name"
                        />
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                className="text-[10px] font-black text-slate-500 hover:text-white transition-colors uppercase tracking-widest"
                                onClick={() => setIsCreatingFolder(false)}
                                disabled={isCreating}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-1.5 rounded-lg bg-[#FF4500] text-white text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all"
                                onClick={handleCreateFolder}
                                disabled={!newFolderName.trim() || isCreating}
                            >
                                {isCreating ? <Loader2 className="animate-spin" size={12} /> : "Create"}
                            </button>
                        </div>
                    </div>
                )}

                <button
                    className="w-full bg-[#FF4500] text-white py-4 rounded-[20px] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-[#FF4500]/20 hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-3"
                    disabled={isSaving || !targetFolderId}
                    onClick={() => onSave(targetFolderId)}
                >
                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Sync Workspace
                </button>
            </div>
        </aside>
    );
};
