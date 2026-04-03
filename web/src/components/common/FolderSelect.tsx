import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Folder as FolderIcon, Check, Plus, Loader2 } from 'lucide-react';
import { type Folder, useFolders } from '../../contexts/FolderContext';
import { toast } from 'react-hot-toast';

interface FolderSelectProps {
    folders: Folder[];
    selectedFolderId: string;
    onSelect: (id: string) => void;
    placeholder?: string;
    disabled?: boolean;
    direction?: 'up' | 'down';
}

export const FolderSelect: React.FC<FolderSelectProps> = ({ 
    folders, 
    selectedFolderId, 
    onSelect, 
    placeholder = "Select a Deck...",
    disabled = false,
    direction = 'down'
}) => {
    const { createFolder } = useFolders();
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedFolder = folders.find(f => f.id === selectedFolderId);
    const filteredFolders = folders.filter(f => 
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setIsCreating(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCreateFolder = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newFolderName.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const newFolder = await createFolder(newFolderName.trim());
            onSelect(newFolder.id);
            setIsCreating(false);
            setNewFolderName('');
            setIsOpen(false);
            toast.success(`Created "${newFolder.name}"`);
        } catch (err: any) {
            toast.error(err.message || "Failed to create folder");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-white/8 focus:border-[#FF4500]/40 outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <div className="flex items-center gap-3 truncate">
                    <FolderIcon size={14} className={selectedFolder ? "text-[#FF4500]" : "text-slate-600"} />
                    <span className={selectedFolder ? "text-white" : "text-slate-500"}>
                        {selectedFolder ? selectedFolder.name : placeholder}
                    </span>
                </div>
                <ChevronDown size={14} className={`text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className={`absolute z-50 w-full ${direction === 'up' ? 'bottom-full mb-2' : 'mt-2'} bg-[#0f0f1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
                    {!isCreating ? (
                        <>
                            <div className="p-2 border-b border-white/5">
                                <div className="relative">
                                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                                    <input
                                        autoFocus
                                        className="w-full bg-white/5 border-none rounded-xl pl-9 pr-4 py-2.5 text-[10px] font-bold text-white placeholder:text-slate-700 outline-none focus:bg-white/10 transition-all"
                                        placeholder="Search decks..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                            
                            <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                                {filteredFolders.length > 0 ? (
                                    filteredFolders.map(folder => (
                                        <button
                                            key={folder.id}
                                            type="button"
                                            onClick={() => {
                                                onSelect(folder.id);
                                                setIsOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                                selectedFolderId === folder.id 
                                                    ? 'bg-[#FF4500]/10 text-[#FF8717]' 
                                                    : 'text-slate-500 hover:bg-white/5 hover:text-white'
                                            }`}
                                        >
                                            <span className="truncate">{folder.name}</span>
                                            {selectedFolderId === folder.id && <Check size={12} />}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-8 text-center">
                                        <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">No decks found</p>
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsCreating(true)}
                                className="w-full flex items-center gap-3 px-5 py-4 border-t border-white/5 text-[10px] font-black uppercase tracking-widest text-[#FF4500] hover:bg-[#FF4500]/5 hover:text-[#FF8717] transition-all"
                            >
                                <Plus size={14} />
                                <span>Create New Deck</span>
                            </button>
                        </>
                    ) : (
                        <div className="p-4 animate-in slide-in-from-right-2 duration-300">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">New Research Deck</span>
                                <button 
                                    onClick={() => setIsCreating(false)}
                                    className="text-[9px] font-bold text-slate-600 hover:text-white"
                                >
                                    Cancel
                                </button>
                            </div>
                            <form onSubmit={handleCreateFolder}>
                                <input
                                    autoFocus
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white placeholder:text-slate-700 outline-none focus:border-[#FF4500]/40 transition-all mb-4"
                                    placeholder="Enter deck name..."
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    disabled={isSubmitting}
                                />
                                <button
                                    type="submit"
                                    disabled={!newFolderName.trim() || isSubmitting}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#FF4500] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#FF8717] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(255,69,0,0.2)]"
                                >
                                    {isSubmitting ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Check size={14} />
                                    )}
                                    <span>{isSubmitting ? 'Creating...' : 'Create & Select'}</span>
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
