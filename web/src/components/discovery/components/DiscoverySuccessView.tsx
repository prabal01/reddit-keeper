import React from 'react';
import { CheckCircle, Search, ArrowRight, Folder as FolderIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { H2, Subtitle } from '../../common/Typography';
import { UIButton } from '../../common/UIButton';
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
        <div className="flex flex-col items-center justify-center p-12 text-center bg-(--bg-secondary) backdrop-blur-xl rounded-[32px] border border-(--border-light) shadow-3xl animate-in fade-in zoom-in-95 duration-500 max-w-xl mx-auto my-20">
            <div className="w-24 h-24 bg-(--score-positive)/10 rounded-full flex items-center justify-center mb-8 border border-(--score-positive)/20 shadow-[0_0_30px_var(--score-positive-alpha)]">
                <CheckCircle size={48} className="text-(--score-positive)" />
            </div>

            <div className="mb-10">
                <H2 className="text-3xl! mb-4">Sync Complete!</H2>
                <Subtitle className="leading-relaxed">
                    Successfully added <b className="text-(--text-primary) font-bold">{count} {count === 1 ? 'thread' : 'threads'}</b> to the
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 mx-2 rounded-lg bg-(--bg-tertiary) border border-(--border-light) text-(--bg-accent) font-bold">
                        <FolderIcon size={14} /> {folderName}
                    </span> bucket.
                </Subtitle>
            </div>

            <div className="flex gap-4 w-full justify-center">
                <UIButton
                    variant="secondary"
                    className="flex-1 max-w-[200px] h-14 rounded-2xl!"
                    onClick={onReset}
                    icon={<Search size={18} />}
                >
                    Search More
                </UIButton>
                <Link to={`/folders/${folderId}`} className="flex-1 max-w-[200px]">
                    <UIButton
                        variant="primary"
                        className="w-full h-14 rounded-2xl!"
                        icon={<ArrowRight size={18} />}
                    >
                        View Folder
                    </UIButton>
                </Link>
            </div>
        </div>
    );
};
