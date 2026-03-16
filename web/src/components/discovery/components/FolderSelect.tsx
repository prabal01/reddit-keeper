import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Folder as FolderIcon, Check } from 'lucide-react';
import type { Folder } from '../../../contexts/FolderContext';
import './FolderSelect.css';

interface FolderSelectProps {
    folders: Folder[];
    selectedId: string;
    onSelect: (id: string) => void;
    placeholder?: string;
}

export const FolderSelect: React.FC<FolderSelectProps> = ({
    folders,
    selectedId,
    onSelect,
    placeholder = "Select Target Folder..."
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedFolder = folders.find(f => f.id === selectedId);

    const filteredFolders = folders.filter(f =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase())
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
            <div
                className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border transition-all duration-200 cursor-pointer ${isOpen ? 'border-[#6366f1] bg-white/10 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'border-white/10 hover:border-white/20'}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <FolderIcon size={16} className={isOpen ? 'text-[#6366f1]' : 'text-slate-400'} />
                <span className={`flex-1 text-sm font-medium ${selectedFolder ? 'text-white' : 'text-slate-500'}`}>
                    {selectedFolder ? selectedFolder.name : placeholder}
                </span>
                <ChevronDown size={16} className={`text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#6366f1]' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-20 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="p-3 border-b border-white/5 bg-slate-900/40">
                        <div className="flex items-center gap-2 px-3 py-2 bg-black/20 rounded-lg border border-white/5 focus-within:border-[#6366f1]/30 transition-all">
                            <Search size={14} className="text-slate-500" />
                            <input
                                className="bg-transparent border-none text-white text-xs outline-none w-full"
                                type="text"
                                placeholder="Find folder..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="max-h-[240px] overflow-y-auto scrollbar-hide py-2">
                        {filteredFolders.length > 0 ? (
                            filteredFolders.map(folder => (
                                <div
                                    key={folder.id}
                                    className={`flex items-center justify-between px-4 py-2.5 mx-2 rounded-lg cursor-pointer transition-all ${folder.id === selectedId ? 'bg-[#6366f1]/10 text-[#6366f1]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                    onClick={() => {
                                        onSelect(folder.id);
                                        setIsOpen(false);
                                    }}
                                >
                                    <span className="text-sm font-medium">{folder.name}</span>
                                    {folder.id === selectedId && <Check size={14} />}
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-8 text-center text-xs text-slate-500 italic">No folders found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
