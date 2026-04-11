import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, User, CheckCircle, EyeOff, ChevronRight } from 'lucide-react';
import { Badge } from '../common/Badge';
import { UIButton } from '../common/UIButton';
import { Caption } from '../common/Typography';
import type { PersonLead } from '../../contexts/FolderContext';

interface LeadCardProps {
    person: PersonLead;
    onUpdateStatus: (leadIds: string[], status: 'new' | 'contacted' | 'ignored') => Promise<void>;
}

const normalizeScore = (s: number) => (s <= 1 ? Math.round(s * 100) : Math.round(s));

const INTENT_CONFIG: Record<string, { label: string; className: string }> = {
    frustration:      { label: 'Frustration',      className: 'frustration' },
    question:         { label: 'Question',          className: 'question' },
    high_engagement:  { label: 'High Engagement',   className: 'high_engagement' },
    alternative:      { label: 'Alternative',       className: 'alternative' },
};

export const LeadCard: React.FC<LeadCardProps> = ({ person, onUpdateStatus }) => {
    const score = normalizeScore(person.maxScore);
    const isAnonymous = !person.author || person.author === 'unknown';
    const profileUrl = isAnonymous ? null : `https://reddit.com/u/${person.author}`;
    const displayName = isAnonymous
        ? (person.threads[0]?.title?.substring(0, 60) || 'Reddit Thread')
        : `u/${person.author}`;
    const visibleThreads = person.threads.slice(0, 3);
    const hiddenCount = person.threads.length - visibleThreads.length;

    const renderStatusBadge = () => {
        switch (person.status) {
            case 'new':
                return <Badge variant="info">New</Badge>;
            case 'contacted':
                return <Badge variant="success">Contacted</Badge>;
            case 'ignored':
                return <Badge variant="neutral">Ignored</Badge>;
            default:
                return null;
        }
    };

    return (
        <div className="lead-card group p-5 bg-(--bg-secondary)/40 border border-(--border-light) hover:border-(--bg-accent)/30 rounded-2xl transition-all shadow-sm">
            <div className="lead-card-header flex justify-between items-start mb-4">
                <div className="lead-author-group flex items-center gap-3">
                    <div className="lead-avatar w-10 h-10 rounded-full bg-(--bg-accent)/10 flex items-center justify-center text-(--bg-accent) border border-(--bg-accent)/20">
                        <User size={20} />
                    </div>
                    <div className="lead-author-info">
                        <div className="flex items-center gap-2">
                            {isAnonymous ? (
                                <span className="font-bold text-(--text-primary) line-clamp-1 max-w-xs" title={displayName}>
                                    {displayName}
                                </span>
                            ) : (
                                <a
                                    href={profileUrl!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-bold text-(--text-primary) hover:text-(--bg-accent) transition-colors"
                                    title="Visit this person's Reddit profile"
                                >
                                    u/{person.author}
                                </a>
                            )}
                            {score > 0 && (
                                <Badge variant="neutral" className="text-[10px]! px-1.5! py-0!">
                                    {score}% match
                                </Badge>
                            )}
                        </div>
                        {person.subreddits.length > 0 && (
                            <div className="lead-subreddits flex flex-wrap gap-1 mt-1">
                                {person.subreddits.map((s, i) => (
                                    <Caption key={i} className="text-(--bg-accent) font-semibold opacity-80 hover:opacity-100 cursor-default">r/{s}</Caption>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="lead-meta-group">
                    {renderStatusBadge()}
                </div>
            </div>

            <div className="lead-thread-list space-y-2 mb-4 bg-(--bg-primary)/30 rounded-xl p-3 border border-(--border-light)/50">
                {visibleThreads.map((thread, i) => (
                    <div key={i} className="lead-thread-item flex items-start gap-2 group/item">
                        <ChevronRight size={14} className="mt-0.5 text-(--text-tertiary) group-hover/item:text-(--bg-accent) transition-colors" />
                        <div className="lead-thread-content flex-1">
                            <a
                                href={thread.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-(--text-secondary) hover:text-(--text-primary) flex items-center gap-1.5 transition-colors line-clamp-1"
                            >
                                {thread.title || 'View thread'}
                                <ExternalLink size={12} className="opacity-0 group-hover/item:opacity-100 transition-opacity" />
                            </a>
                            {thread.time && (
                                <Caption className="text-xs opacity-60">
                                    {formatDistanceToNow(new Date(thread.time), { addSuffix: true })}
                                </Caption>
                            )}
                        </div>
                    </div>
                ))}
                {hiddenCount > 0 && (
                    <Caption className="px-5 text-(--text-tertiary) font-bold">+{hiddenCount} more thread{hiddenCount > 1 ? 's' : ''}</Caption>
                )}
            </div>

            {person.intentMarkers.length > 0 && (
                <div className="lead-intent-pills flex flex-wrap gap-1.5 mb-5">
                    {person.intentMarkers.map((marker, i) => {
                        const config = INTENT_CONFIG[marker];
                        return (
                            <Badge key={i} variant="neutral" className="bg-(--bg-accent)/5 border-(--bg-accent)/10 text-(--bg-accent)/80 text-[10px]! py-0.5! px-2!">
                                {config?.label || marker}
                            </Badge>
                        );
                    })}
                </div>
            )}

            <div className="lead-actions flex justify-between items-center pt-4 border-t border-(--border-light)/30">
                <div className="lead-action-btns flex gap-2 flex-wrap">
                    {person.status === 'new' && (
                        <>
                            <UIButton
                                variant="secondary"
                                size="sm"
                                onClick={() => onUpdateStatus(person.leadIds, 'contacted')}
                                icon={<CheckCircle size={14} />}
                                className="bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40 text-emerald-500!"
                                title="Mark that you've contacted this person"
                            >
                                Mark Contacted
                            </UIButton>
                            <UIButton
                                variant="secondary"
                                size="sm"
                                onClick={() => onUpdateStatus(person.leadIds, 'ignored')}
                                icon={<EyeOff size={14} />}
                                className="hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500!"
                                title="Hide this person from your list"
                            >
                                Skip for Now
                            </UIButton>
                        </>
                    )}
                    {(person.status === 'contacted' || person.status === 'ignored') && (
                        <UIButton
                            variant="secondary"
                            size="sm"
                            onClick={() => onUpdateStatus(person.leadIds, 'new')}
                            title="Bring this person back to your prospects list"
                        >
                            Put Back
                        </UIButton>
                    )}
                </div>
                {profileUrl && (
                    <UIButton
                        variant="secondary"
                        size="sm"
                        onClick={() => window.open(profileUrl, '_blank')}
                        icon={<ExternalLink size={14} />}
                        title="Visit their Reddit profile"
                    >
                        Visit Profile
                    </UIButton>
                )}
            </div>
        </div>
    );
};
