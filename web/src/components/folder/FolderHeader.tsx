import { Loader2, Settings, Activity, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { PageHeader } from '../common/PageHeader';
import { Badge } from '../common/Badge';
import { UIButton } from '../common/UIButton';
import { Metadata } from '../common/Typography';

interface FolderHeaderProps {
    folder: any;
    isAnalyzing: boolean;
    leadsCount?: number;
    patternsCount?: number;
    lastScanTime?: string | null;
    onConfigsOpen?: () => void;
    configsOpen?: boolean;
}

export const FolderHeader: React.FC<FolderHeaderProps> = ({
    folder,
    isAnalyzing,
    leadsCount,
    patternsCount,
    lastScanTime,
    onConfigsOpen,
    configsOpen = false,
}) => {

    const lastScanLabel = lastScanTime
        ? formatDistanceToNow(new Date(lastScanTime), { addSuffix: true })
        : 'Never';

    const renderStatusBadge = () => {
        if (isAnalyzing) {
            return (
                <Badge variant="premium" icon={<Loader2 className="animate-spin" size={12} />}>
                    Analyzing
                </Badge>
            );
        }
        if (folder.syncStatus === 'syncing') {
            return (
                <Badge variant="neutral" icon={<RefreshCw className="animate-spin" size={12} />}>
                    Refreshing
                </Badge>
            );
        }
        if (folder.is_monitoring_active) {
            return (
                <Badge variant="success" icon={<div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}>
                    Monitoring
                </Badge>
            );
        }
        return (
            <Badge variant="neutral">Ready</Badge>
        );
    };

    return (
        <div className="flex flex-col gap-6 mb-8">
            <PageHeader
                title={folder.name}
                subtitle={folder.description || "Track conversations and find opportunities"}
                showStatus={true}
                actions={
                    <div className="flex items-center gap-3">
                        {onConfigsOpen && (
                            <UIButton
                                variant="secondary"
                                size="sm"
                                onClick={onConfigsOpen}
                                className={configsOpen ? 'border-(--bg-accent)/30 bg-(--bg-accent)/5' : ''}
                                icon={<Settings size={18} className={configsOpen ? 'text-(--bg-accent)' : ''} />}
                                title="Configure this monitor"
                            />
                        )}
                        {renderStatusBadge()}
                    </div>
                }
            />

            {leadsCount !== undefined && (
                <div className="flex items-center gap-4 py-2.5 px-5 rounded-2xl bg-(--bg-secondary) border border-(--border-light) w-fit shadow-sm">
                    <div className="flex items-center gap-2">
                        <Activity size={14} className="text-(--bg-accent)" />
                        <Metadata className="font-bold text-(--text-primary)">{leadsCount} prospect{leadsCount !== 1 ? 's' : ''}</Metadata>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-(--border-light)" />
                    <div className="flex items-center gap-2">
                        <Metadata className="font-medium">{patternsCount ?? 0} problem{(patternsCount ?? 0) !== 1 ? 's' : ''}</Metadata>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-(--border-light)" />
                    <Metadata className="text-(--text-tertiary) text-xs">Updated {lastScanLabel}</Metadata>
                </div>
            )}
        </div>
    );
};
