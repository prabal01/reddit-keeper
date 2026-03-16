import React from 'react';
import { CheckCircle, Search, ArrowRight, Folder as FolderIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import './DiscoverySuccessView.css';

interface DiscoverySuccessViewProps {
    count: number;
    folderName: string;
    folderId: string;
    onReset: () => void;
}

export const DiscoverySuccessView: React.FC<DiscoverySuccessViewProps> = ({
    count,
    folderName,
    folderId,
    onReset
}) => {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/60 backdrop-blur-xl rounded-[32px] border border-white/10 shadow-3xl animate-in fade-in zoom-in-95 duration-500 max-w-xl mx-auto my-20">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-8 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                <CheckCircle size={48} className="text-emerald-500" />
            </div>

            <div className="mb-10">
                <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Sync Complete!</h2>
                <p className="text-slate-400 text-lg leading-relaxed">
                    Successfully added <b className="text-white font-bold">{count} {count === 1 ? 'thread' : 'threads'}</b> to the
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 mx-2 rounded-lg bg-white/5 border border-white/5 text-[#FF4500] font-bold">
                        <FolderIcon size={14} /> {folderName}
                    </span> bucket.
                </p>
            </div>

            <div className="flex gap-4 w-full justify-center">
                <button
                    className="flex-1 max-w-[200px] h-14 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                    onClick={onReset}
                >
                    <Search size={18} />
                    Search More
                </button>
                <Link
                    to={`/folders/${folderId}`}
                    className="flex-1 max-w-[200px] h-14 rounded-2xl bg-[#FF4500] text-white font-bold hover:brightness-110 shadow-lg shadow-[#FF4500]/20 transition-all flex items-center justify-center gap-3"
                >
                    View Folder
                    <ArrowRight size={18} />
                </Link>
            </div>
        </div>
    );
};
