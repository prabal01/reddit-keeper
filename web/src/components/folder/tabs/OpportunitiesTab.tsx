import React from 'react';
import { MonitoringSplitView } from '../MonitoringSplitView';
import { Target } from 'lucide-react';

interface OpportunitiesTabProps {
    leads: any[];
    onUpdateLeadStatus: (leadId: string, status: 'new' | 'contacted' | 'ignored') => Promise<void>;
}

export const OpportunitiesTab: React.FC<OpportunitiesTabProps> = ({ leads, onUpdateLeadStatus }) => {
    // Filter to high-intent leads (e.g. relevance > 0.8)
    const highIntentLeads = leads.filter(l => (l.relevance_score || 0) >= 0.8);

    if (highIntentLeads.length === 0) {
        return (
            <div className="empty-tab-state">
                <Target size={48} className="text-gray-600 mb-4" />
                <h3>No high-intent opportunities yet</h3>
                <p>We're filtering for conversations where users are actively looking for solutions.</p>
            </div>
        );
    }

    return (
        <div className="opportunities-tab-view animate-fade-in">
            <div className="tab-header mb-8">
                <h2>High-Intent Matches</h2>
                <p>Focused list of threads with the highest relevance to your product.</p>
            </div>
            
            <MonitoringSplitView 
                patterns={[]} 
                leads={highIntentLeads} 
                onUpdateLeadStatus={onUpdateLeadStatus}
            />
        </div>
    );
};
