import React, { useMemo, useState } from 'react';
import { Download, ChevronDown, ChevronUp, Activity, Users } from 'lucide-react';
import { LeadCard } from '../LeadCard';
import { MonitoringAlertsFeed } from '../MonitoringAlertsFeed';
import { UIButton } from '../../common/UIButton';
import { Metadata } from '../../common/Typography';
import type { Lead, PersonLead } from '../../../contexts/FolderContext';

interface FeedTabProps {
    leads: Lead[];
    alerts: any[];
    onUpdateLeadStatus: (leadIds: string[], status: 'new' | 'contacted' | 'ignored') => Promise<void>;
}

const exportToCSV = (groupedLeads: PersonLead[]) => {
    const headers = ['Username', 'Profile URL', 'Subreddits', 'Top Thread', 'Thread URL', 'Score', 'Intent', 'Status', 'Last Seen'];
    const rows = groupedLeads.map(p => [
        p.author,
        p.author !== 'unknown' ? `https://reddit.com/u/${p.author}` : '',
        p.subreddits.join('; '),
        p.threads[0]?.title || '',
        p.threads[0]?.url || '',
        p.maxScore,
        p.intentMarkers.join('; '),
        p.status,
        p.threads[0]?.time || ''
    ]);
    const csv = [headers, ...rows]
        .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads.csv';
    a.click();
    URL.revokeObjectURL(url);
};

export const InboxTab: React.FC<FeedTabProps> = ({ leads, alerts, onUpdateLeadStatus }) => {
    const [showActivity, setShowActivity] = useState(false);

    const groupedLeads = useMemo<PersonLead[]>(() => {
        const map = new Map<string, PersonLead>();
        leads.forEach(lead => {
            const key = lead.author || `anon_${lead.id}`;
            const existing = map.get(key);
            if (existing) {
                existing.threads.push({
                    title: lead.thread_title || '',
                    url: lead.thread_url || '',
                    time: lead.saved_at
                });
                existing.maxScore = Math.max(existing.maxScore, lead.relevance_score || 0);
                existing.subreddits = [...new Set([...existing.subreddits, lead.subreddit || ''].filter(Boolean))];
                existing.intentMarkers = [...new Set([...existing.intentMarkers, ...(lead.intent_markers || [])])];
                if (lead.status === 'new') existing.status = 'new';
                else if (existing.status !== 'new' && lead.status === 'contacted') existing.status = 'contacted';
                existing.leadIds.push(lead.id);
            } else {
                map.set(key, {
                    author: lead.author || 'unknown',
                    threads: [{ title: lead.thread_title || '', url: lead.thread_url || '', time: lead.saved_at }],
                    maxScore: lead.relevance_score || 0,
                    subreddits: [lead.subreddit || ''].filter(Boolean),
                    intentMarkers: lead.intent_markers || [],
                    status: lead.status,
                    leadIds: [lead.id]
                });
            }
        });
        return Array.from(map.values()).sort((a, b) => b.maxScore - a.maxScore);
    }, [leads]);

    if (groupedLeads.length === 0) {
        return (
            <div className="empty-tab-state flex flex-col items-center justify-center py-16 text-center">
                <Users size={48} className="text-(--text-tertiary) mb-4 opacity-50" />
                <h3 className="text-xl font-bold mb-2">No Prospects Yet</h3>
                <p className="text-(--text-secondary) max-w-sm">We're scanning Reddit for people interested in this topic. You'll see prospects here once we find them.</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            {/* Summary + Export */}
            <div className="lead-feed-summary flex justify-between items-center py-2 border-b border-(--border-light)/50 pb-6">
                <div className="flex items-center gap-2">
                    <strong className="text-(--bg-accent) text-lg">{groupedLeads.length}</strong>
                    <Metadata className="text-(--text-secondary) font-medium">
                        {groupedLeads.length === 1 ? 'prospect' : 'prospects'} · Ranked by relevance
                    </Metadata>
                </div>
                <UIButton
                    variant="secondary"
                    size="sm"
                    onClick={() => exportToCSV(groupedLeads)}
                    icon={<Download size={14} />}
                >
                    Export CSV
                </UIButton>
            </div>

            {/* Lead Cards */}
            <div className="lead-feed-list grid grid-cols-1 gap-4">
                {groupedLeads.map(person => (
                    <LeadCard
                        key={person.author}
                        person={person}
                        onUpdateStatus={onUpdateLeadStatus}
                    />
                ))}
            </div>

            {/* Agent Activity collapsible */}
            {alerts.length > 0 && (
                <div className="mt-8">
                    <button
                        className="agent-activity-toggle w-full flex items-center justify-between p-4 rounded-xl bg-(--bg-secondary) border border-(--border-light) hover:border-(--bg-accent)/30 transition-all text-sm font-bold group"
                        onClick={() => setShowActivity(s => !s)}
                    >
                        <div className="flex items-center gap-3">
                            <Activity size={16} className="text-(--bg-accent)" />
                            <span>Agent Activity ({alerts.length} events)</span>
                        </div>
                        {showActivity ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {showActivity && (
                        <div className="mt-2 animate-slide-down">
                            <MonitoringAlertsFeed alerts={alerts} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

