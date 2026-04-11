import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, CheckCircle, EyeOff, MessageSquare, ArrowUpCircle, ChevronUp } from 'lucide-react';
import { Badge } from '../common/Badge';
import { UIButton } from '../common/UIButton';
import type { PersonLead } from '../../contexts/FolderContext';

interface LeadCardProps {
    person: PersonLead;
    onUpdateStatus: (leadIds: string[], status: 'new' | 'contacted' | 'ignored') => Promise<void>;
}

const normalizeScore = (s: number) => (s <= 1 ? Math.round(s * 100) : Math.round(s));

const INTENT_CONFIG: Record<string, { label: string; color: string }> = {
    frustration:      { label: 'Frustration',      color: '#ef4444' },
    question:         { label: 'Question',          color: '#3b82f6' },
    high_engagement:  { label: 'High Engagement',   color: '#f59e0b' },
    alternative:      { label: 'Seeking Alternative', color: '#8b5cf6' },
};

export const LeadCard: React.FC<LeadCardProps> = ({ person, onUpdateStatus }) => {
    const score = normalizeScore(person.maxScore);
    const isAnonymous = !person.author || person.author === 'unknown';
    const profileUrl = isAnonymous ? null : `https://reddit.com/u/${person.author}`;
    const displayName = isAnonymous
        ? (person.threads[0]?.title?.substring(0, 60) || 'Reddit Thread')
        : `u/${person.author}`;
    const primaryThread = person.threads[0];
    const additionalThreads = person.threads.slice(1, 4);
    const hiddenCount = Math.max(0, person.threads.length - 4);

    const renderStatusBadge = () => {
        switch (person.status) {
            case 'new':
                return <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">New</span>;
            case 'contacted':
                return <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Contacted</span>;
            case 'ignored':
                return <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-500/15 text-neutral-400 border border-neutral-500/20">Ignored</span>;
            default:
                return null;
        }
    };

    return (
        <div className="lead-card group bg-(--bg-secondary)/50 border border-(--border-light)/60 hover:border-[#FF4500]/25 rounded-sm transition-all overflow-hidden">
            {/* Reddit-style top bar */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-(--bg-primary)/40 border-b border-(--border-light)/30 text-[11px]">
                {person.subreddits.length > 0 && (
                    <div className="flex items-center gap-1.5">
                        {person.subreddits.map((s, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <span className="text-(--text-tertiary)/40">·</span>}
                                <a
                                    href={`https://reddit.com/r/${s}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-bold text-(--text-secondary) hover:text-[#FF4500] hover:underline transition-colors"
                                >
                                    r/{s}
                                </a>
                            </React.Fragment>
                        ))}
                    </div>
                )}
                <span className="text-(--text-tertiary)/50">•</span>
                <span className="text-(--text-tertiary)/70">Posted by{' '}</span>
                {isAnonymous ? (
                    <span className="text-(--text-tertiary)/70">[anonymous]</span>
                ) : (
                    <a
                        href={profileUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-(--text-tertiary)/70 hover:text-(--text-primary) hover:underline transition-colors"
                    >
                        u/{person.author}
                    </a>
                )}
                {primaryThread?.time && (
                    <>
                        <span className="text-(--text-tertiary)/50">•</span>
                        <span className="text-(--text-tertiary)/60">
                            {formatDistanceToNow(new Date(primaryThread.time), { addSuffix: true })}
                        </span>
                    </>
                )}
                <div className="ml-auto flex items-center gap-2">
                    {renderStatusBadge()}
                </div>
            </div>

            <div className="flex">
                {/* Vote column */}
                <div className="flex flex-col items-center gap-0.5 px-2 py-3 bg-(--bg-primary)/20 min-w-[40px]">
                    <ChevronUp size={20} className="text-(--text-tertiary)/40" />
                    <span className="text-xs font-bold text-[#FF4500]">{score}%</span>
                    <span className="text-[9px] text-(--text-tertiary)/50 uppercase tracking-wider">match</span>
                </div>

                {/* Main content */}
                <div className="flex-1 py-3 px-3">
                    {/* Primary thread title */}
                    {primaryThread && (
                        <a
                            href={primaryThread.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-base font-semibold text-(--text-primary) hover:text-[#FF4500] transition-colors mb-1 leading-snug"
                        >
                            {primaryThread.title || 'View thread'}
                        </a>
                    )}

                    {/* Intent markers as flair */}
                    {person.intentMarkers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                            {person.intentMarkers.map((marker, i) => {
                                const config = INTENT_CONFIG[marker];
                                const color = config?.color || '#FF4500';
                                return (
                                    <span
                                        key={i}
                                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                        style={{
                                            backgroundColor: `${color}15`,
                                            color: color,
                                            border: `1px solid ${color}25`,
                                        }}
                                    >
                                        {config?.label || marker}
                                    </span>
                                );
                            })}
                        </div>
                    )}

                    {/* Additional threads as "related posts" */}
                    {additionalThreads.length > 0 && (
                        <div className="mt-2 mb-2 pl-3 border-l-2 border-(--border-light)/40 space-y-1.5">
                            {additionalThreads.map((thread, i) => (
                                <div key={i} className="group/thread flex items-baseline gap-1.5">
                                    <MessageSquare size={11} className="text-(--text-tertiary)/40 mt-0.5 shrink-0" />
                                    <a
                                        href={thread.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[13px] text-(--text-secondary)/80 hover:text-[#FF4500] transition-colors line-clamp-1"
                                    >
                                        {thread.title || 'View thread'}
                                    </a>
                                    {thread.time && (
                                        <span className="text-[10px] text-(--text-tertiary)/40 whitespace-nowrap shrink-0">
                                            {formatDistanceToNow(new Date(thread.time), { addSuffix: true })}
                                        </span>
                                    )}
                                </div>
                            ))}
                            {hiddenCount > 0 && (
                                <span className="text-[11px] text-(--text-tertiary)/50 font-medium">
                                    +{hiddenCount} more thread{hiddenCount > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Reddit-style action bar */}
                    <div className="flex items-center gap-1 mt-3 -ml-1.5">
                        <span className="flex items-center gap-1 text-[11px] font-bold text-(--text-tertiary)/50 px-1.5 py-1 rounded hover:bg-(--bg-primary)/50 cursor-default uppercase tracking-wide">
                            <MessageSquare size={13} />
                            {person.threads.length} thread{person.threads.length !== 1 ? 's' : ''}
                        </span>

                        {profileUrl && (
                            <a
                                href={profileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[11px] font-bold text-(--text-tertiary)/50 px-1.5 py-1 rounded hover:bg-(--bg-primary)/50 hover:text-(--text-secondary) transition-colors uppercase tracking-wide"
                            >
                                <ExternalLink size={13} />
                                Profile
                            </a>
                        )}

                        <div className="flex-1" />

                        {person.status === 'new' && (
                            <>
                                <button
                                    onClick={() => onUpdateStatus(person.leadIds, 'contacted')}
                                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-500/70 px-2 py-1 rounded hover:bg-emerald-500/10 transition-colors uppercase tracking-wide cursor-pointer"
                                    title="Mark that you've contacted this person"
                                >
                                    <CheckCircle size={13} />
                                    Contacted
                                </button>
                                <button
                                    onClick={() => onUpdateStatus(person.leadIds, 'ignored')}
                                    className="flex items-center gap-1 text-[11px] font-bold text-(--text-tertiary)/40 px-2 py-1 rounded hover:bg-red-500/10 hover:text-red-400 transition-colors uppercase tracking-wide cursor-pointer"
                                    title="Hide this person from your list"
                                >
                                    <EyeOff size={13} />
                                    Skip
                                </button>
                            </>
                        )}
                        {(person.status === 'contacted' || person.status === 'ignored') && (
                            <button
                                onClick={() => onUpdateStatus(person.leadIds, 'new')}
                                className="flex items-center gap-1 text-[11px] font-bold text-(--text-tertiary)/50 px-2 py-1 rounded hover:bg-(--bg-primary)/50 hover:text-(--text-secondary) transition-colors uppercase tracking-wide cursor-pointer"
                                title="Bring this person back to your prospects list"
                            >
                                <ArrowUpCircle size={13} />
                                Put Back
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
