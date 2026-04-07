import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Users, Clock, Globe } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Folder } from '../../contexts/FolderContext';
import { H2, Metadata } from '../common/Typography';
import { Badge } from '../common/Badge';

interface MonitorCardProps {
    folder: Folder;
    leadCount?: number;
    patternCount?: number;
    lastScanTime?: string | null;
}

export const MonitorCard: React.FC<MonitorCardProps> = ({ 
    folder, 
    leadCount = 0, 
    patternCount = 0, 
    lastScanTime 
}) => {
    const navigate = useNavigate();
    const keyword = folder.seed_keywords?.[0] || folder.name;
    const isUrl = keyword.startsWith('http') || keyword.includes('.com');

    return (
        <button
            onClick={() => navigate(`/folders/${folder.id}`)}
            className="group w-full text-left p-6 rounded-2xl bg-(--bg-secondary) border border-(--border-light) hover:border-(--bg-accent)/40 hover:bg-(--bg-secondary)/60 transition-all duration-300"
        >
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-2">
                    {isUrl ? <Globe size={14} className="text-blue-400" /> : <Target size={14} className="text-(--bg-accent)" />}
                    <Metadata className="text-(--text-tertiary)">
                        {isUrl ? 'Website monitor' : 'Niche monitor'}
                    </Metadata>
                </div>
                <Badge variant="success">Live</Badge>
            </div>

            <H2 className="text-[1.1rem]! mb-6 group-hover:text-(--bg-accent) transition-colors line-clamp-1">
                {keyword}
            </H2>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-(--text-tertiary)">
                        <Users size={12} />
                        <Metadata>Leads</Metadata>
                    </div>
                    <span className="text-xl font-black text-(--text-primary)">{leadCount}</span>
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-(--text-tertiary)">
                        <Target size={12} />
                        <Metadata>Signals</Metadata>
                    </div>
                    <span className="text-xl font-black text-(--text-primary)">{patternCount}</span>
                </div>
            </div>

            {lastScanTime && (
                <div className="mt-6 pt-4 border-t border-(--border-light) flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] text-(--text-tertiary) font-medium">
                        <Clock size={10} />
                        <span>Last scan {formatDistanceToNow(new Date(lastScanTime), { addSuffix: true })}</span>
                    </div>
                    <Metadata className="text-(--bg-accent) opacity-0! group-hover:opacity-100! transition-opacity">
                        View Inbox →
                    </Metadata>
                </div>
            )}
        </button>
    );
};
