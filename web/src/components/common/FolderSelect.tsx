import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Folder as FolderIcon, Check } from 'lucide-react';
import { type Folder } from '../../contexts/FolderContext';

interface FolderSelectProps {
    folders: Folder[];
    selectedFolderId: string;
    onSelect: (id: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

export const FolderSelect: React.FC<FolderSelectProps> = ({ 
    folders, 
    selectedFolderId, 
    onSelect, 
    placeholder = "Select a Deck...",
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedFolder = folders.find(f => f.id === selectedFolderId);
    const filteredFolders = folders.filter(f => 
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
                <div className="absolute z-50 w-full mt-2 bg-[#0f0f1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
                </div>
            )}
        </div>
    );
};
