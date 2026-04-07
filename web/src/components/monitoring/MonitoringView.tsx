import React, { useState, useEffect } from 'react';
import { 
    Bell, 
    Settings as SettingsIcon, 
    ListFilter, 
    ExternalLink, 
    CheckCircle2, 
    Clock, 
    Sparkles, 
    Send,
    MessageSquare,
    Loader2,
    RefreshCw,
    X,
    Activity
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { MonitorSettings } from './MonitorSettings';
import { MetricCard } from '../common/MetricCard';

interface Opportunity {
    id: string;
    postId: string;
    postTitle: string;
    postSubreddit: string;
    postUrl: string;
    relevanceScore: number;
    matchReason: string;
    suggestedReply: string | null;
    status: 'new' | 'seen' | 'contacted' | 'dismissed';
    matchedAt: string;
    createdAt: number;
}

export const MonitoringView: React.FC = () => {
    const { user, getIdToken } = useAuth();
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = await getIdToken();
            const [oppRes, configRes] = await Promise.all([
                fetch('/api/monitoring/opportunities', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/monitoring/config', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            
            const oppData = await oppRes.json();
            const configData = await configRes.json();
            
            // Defensively handle non-array responses (e.g. error objects)
            setOpportunities(Array.isArray(oppData) ? oppData : []);
            setConfig(configData?.error ? null : configData);
            
            // If no config exists, show settings by default
            if (!configData?.websiteContext) {
                setShowSettings(true);
            }
        } catch (err) {
            console.error('Failed to fetch monitoring data', err);
            setOpportunities([]); // Reset to empty array on fatal fetch error
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const handleSaveConfig = async (newConfig: { websiteContext: string; subreddits: string[] }) => {
        try {
            const token = await getIdToken();
            await fetch('/api/monitoring/config', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newConfig)
            });
            setShowSettings(false);
            fetchData();
        } catch (err) {
            console.error('Failed to save config', err);
        }
    };

    const handleUpdateStatus = async (id: string, status: Opportunity['status']) => {
        try {
            const token = await getIdToken();
            await fetch(`/api/monitoring/opportunities/${id}/status`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });
            setOpportunities(opportunities.map(o => o.id === id ? { ...o, status } : o));
        } catch (err) {
            console.error('Failed to update status', err);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const token = await getIdToken();
            await fetch('/api/monitoring/sync', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            // Give it a moment then refresh
            setTimeout(fetchData, 5000);
        } finally {
            setSyncing(false);
        }
    };

    if (loading && !opportunities.length) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 size={32} className="text-orange-400 animate-spin" />
                <p className="text-zinc-400 text-sm font-medium animate-pulse">Initializing monitoring systems...</p>
            </div>
        );
    }

    return (
        <div className="monitoring-view-container max-w-7xl mx-auto py-10 px-8">
            <div className="w-full mb-10">
                    {/* Brand Aligned Sub-header */}
                    <div className="flex items-center justify-between mb-8 pb-8 border-b border-white/5">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 border border-orange-500/20">
                                <Bell size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tight">Monitoring Matrix</h1>
                                <div className="flex items-center gap-3 mt-1.5 opacity-60">
                                    <span className="flex items-center gap-1.5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                        <Clock size={10} /> Sync: 8h Interval
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                    <span className="flex items-center gap-1.5 text-[10px] font-black text-orange-500 uppercase tracking-widest">
                                        <CheckCircle2 size={10} /> Active Scanners
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button 
                                onClick={handleSync}
                                disabled={syncing}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-white/5 disabled:opacity-50"
                            >
                                {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                Force Pulse
                            </button>
                            <button 
                                onClick={() => setShowSettings(!showSettings)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                                    showSettings 
                                    ? 'bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-500/20' 
                                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border-white/5'
                                }`}
                            >
                                <SettingsIcon size={12} />
                                {showSettings ? 'Close Config' : 'Configure Signals'}
                            </button>
                        </div>
                    </div>

                    {!showSettings && (
                        <div className="flex items-center gap-8 mb-12 px-2 overflow-x-auto pb-2 scrollbar-hide">
                            <MetricCard 
                                label="Tracked Communities" 
                                value={config?.subreddits?.length || 0} 
                                icon={<Activity size={18} />} 
                                color="#FF4500"
                                variant="minimal"
                            />
                            <div className="w-1 h-8 border-l border-white/5 shrink-0" />
                            <MetricCard 
                                label="Unseen Matches" 
                                value={(opportunities || []).filter(o => o?.status === 'new').length} 
                                icon={<Sparkles size={18} />} 
                                color="#00D1FF"
                                variant="minimal"
                            />
                             <div className="w-1 h-8 border-l border-white/5 shrink-0" />
                             <MetricCard 
                                label="System Efficiency" 
                                value="1rps" 
                                icon={<MessageSquare size={18} />} 
                                color="#A855F7"
                                variant="minimal"
                            />
                        </div>
                    )}
                    {showSettings ? (
                        <div className="max-w-2xl mx-auto py-8">
                             <MonitorSettings initialConfig={config} onSave={handleSaveConfig} />
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto space-y-2">
                            <div className="flex items-center justify-between mb-8 px-2">
                                <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                                    <ListFilter size={14} />
                                    Active Signals
                                </h3>
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">{opportunities.length} Total Matches</span>
                                </div>
                            </div>

                            {opportunities.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-32 bg-zinc-900/10 rounded-[32px] border border-dashed border-white/5 text-center">
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5">
                                        <Sparkles size={24} className="text-zinc-600" />
                                    </div>
                                    <h4 className="text-white/50 font-black tracking-tight text-xl">System Idle</h4>
                                    <p className="text-zinc-600 font-medium max-w-sm mt-2">Active scanners are monitoring your target subreddits. New opportunities appear here every 8 hours.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {opportunities.map(opp => (
                                        <article 
                                            key={opp.id} 
                                            className={`group relative flex flex-col py-10 px-2 transition-all duration-300 ${
                                                opp.status === 'new' ? 'opacity-100' : 'opacity-60 hover:opacity-100'
                                            }`}
                                        >
                                            <header className="flex items-start justify-between mb-5">
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                                                        opp.status === 'new' 
                                                        ? 'bg-orange-500/10 border border-orange-500/20 text-orange-500' 
                                                        : 'bg-white/5 border border-white/5 text-zinc-500'
                                                    }`}>
                                                        <MessageSquare size={20} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest transition-colors">r/{opp.postSubreddit}</span>
                                                            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest opacity-60">• {new Date(opp.createdAt * 1000).toLocaleDateString()}</span>
                                                        </div>
                                                        <h4 className="text-lg font-bold text-white/90 group-hover:text-white transition-colors leading-tight antialiased truncate md:whitespace-normal">
                                                            {opp.postTitle}
                                                        </h4>
                                                    </div>
                                                </div>
                                                <div className={`shrink-0 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border transition-all ${
                                                    opp.relevanceScore >= 80 
                                                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' 
                                                    : 'bg-white/5 text-zinc-500 border-white/5'
                                                }`}>
                                                    {opp.relevanceScore}% Match
                                                </div>
                                            </header>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 ml-14">
                                                <div className="relative p-5 rounded-xl bg-white/2 border border-white/5 group/insight hover:bg-white/4 transition-all">
                                                    <h5 className="text-[9px] font-black text-orange-500/60 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                                                        <Sparkles size={10} /> Platform Insight
                                                    </h5>
                                                    <p className="text-[13px] text-zinc-400 leading-relaxed font-medium italic" style={{ textWrap: 'pretty' }}>
                                                        "{opp.matchReason}"
                                                    </p>
                                                </div>

                                                {opp.suggestedReply && (
                                                    <div className="p-5 rounded-xl bg-white/2 border border-white/5 hover:bg-white/4 transition-all">
                                                        <h5 className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                                                            <Send size={10} /> Strategic Hook
                                                        </h5>
                                                        <p className="text-[12px] text-zinc-500 leading-relaxed font-medium">
                                                            {opp.suggestedReply}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <footer className="flex items-center justify-between ml-14">
                                                <div className="flex gap-4">
                                                    <button 
                                                        onClick={() => handleUpdateStatus(opp.id, 'dismissed')}
                                                        className="text-zinc-600 hover:text-red-400 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 p-1"
                                                    >
                                                        <X size={14} className="opacity-40" /> Dismiss
                                                    </button>
                                                    <button 
                                                        onClick={() => handleUpdateStatus(opp.id, 'contacted')}
                                                        className="text-zinc-600 hover:text-orange-400 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 p-1"
                                                    >
                                                        <CheckCircle2 size={14} className="opacity-40" /> Mark Contacted
                                                    </button>
                                                </div>
                                                <a 
                                                    href={opp.postUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    onClick={() => handleUpdateStatus(opp.id, 'seen')}
                                                    className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 border border-white/5 hover:border-orange-500/50 hover:bg-orange-500/10 text-white/70 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all group/link"
                                                >
                                                    Engage Segment
                                                    <ExternalLink size={12} className="opacity-40 group-hover/link:opacity-100 transition-opacity" />
                                                </a>
                                            </footer>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
        </div>
    </div>
  );
};
