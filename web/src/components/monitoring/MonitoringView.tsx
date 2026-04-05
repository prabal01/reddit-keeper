import React, { useState, useEffect } from 'react';
import { 
    Bell, 
    Settings as SettingsIcon, 
    ListFilter, 
    ExternalLink, 
    CheckCircle2, 
    Clock, 
    ChevronRight, 
    Sparkles, 
    Send,
    MessageSquare,
    AlertCircle,
    Loader2,
    RefreshCw
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { MonitorSettings } from './MonitorSettings';

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
            
            setOpportunities(oppData);
            setConfig(configData);
            
            // If no config exists, show settings by default
            if (!configData.websiteContext) {
                setShowSettings(true);
            }
        } catch (err) {
            console.error('Failed to fetch monitoring data', err);
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
                <Loader2 size={32} className="text-indigo-400 animate-spin" />
                <p className="text-slate-400 text-sm font-medium animate-pulse">Initializing monitoring systems...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            {/* Header Console */}
            <header className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-[#0f172a]/80 backdrop-blur-xl sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
                        <Bell size={24} className="text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Marketing Opportunities</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 py-0.5 bg-slate-900 rounded-full border border-white/5">
                                <Clock size={10} /> Sync: Every 8h
                            </span>
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 uppercase tracking-widest px-2 py-0.5 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                                <CheckCircle2 size={10} /> Active Monitoring
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-xs font-bold transition-all border border-white/5 disabled:opacity-50"
                    >
                        {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Sync Now
                    </button>
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                            showSettings 
                            ? 'bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/20' 
                            : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-white/5'
                        }`}
                    >
                        <SettingsIcon size={14} />
                        Configure TargetMatrix
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0a0f1e]">
                <div className="max-w-7xl mx-auto px-8 py-8 w-full">
                    {showSettings ? (
                        <div className="max-w-2xl mx-auto py-8">
                             <MonitorSettings initialConfig={config} onSave={handleSaveConfig} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-12 gap-8">
                            {/* Main Feed */}
                            <div className="col-span-12 lg:col-span-8 space-y-6">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <ListFilter size={14} />
                                        Opportunity Feed
                                    </h3>
                                    <span className="text-xs text-slate-600 font-medium">{opportunities.length} Total Matches</span>
                                </div>

                                {opportunities.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 rounded-3xl border border-dashed border-white/5 text-center">
                                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                            <Sparkles size={24} className="text-slate-600" />
                                        </div>
                                        <h4 className="text-slate-300 font-bold">Waiting for signals...</h4>
                                        <p className="text-slate-500 text-sm max-w-xs mt-2">We're scanning your subreddits. New opportunities will appear here every 8 hours.</p>
                                    </div>
                                ) : (
                                    opportunities.map(opp => (
                                        <article 
                                            key={opp.id} 
                                            className={`group relative flex flex-col p-6 rounded-2xl border transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 ${
                                                opp.status === 'new' 
                                                ? 'bg-slate-900/50 border-indigo-500/30 ring-1 ring-indigo-500/10' 
                                                : 'bg-slate-900/20 border-white/5 grayscale-[0.4] opacity-80'
                                            }`}
                                        >
                                            <header className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
                                                        <MessageSquare size={20} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-orange-400">r/{opp.postSubreddit}</span>
                                                            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">• {new Date(opp.createdAt * 1000).toLocaleDateString()}</span>
                                                        </div>
                                                        <h4 className="text-lg font-bold text-slate-100 group-hover:text-white transition-colors leading-snug mt-0.5">
                                                            {opp.postTitle}
                                                        </h4>
                                                    </div>
                                                </div>
                                                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border ${
                                                    opp.relevanceScore >= 80 
                                                    ? 'bg-indigo-500 text-white border-indigo-400' 
                                                    : 'bg-slate-800 text-slate-400 border-white/5'
                                                }`}>
                                                    {opp.relevanceScore}% Match
                                                </div>
                                            </header>

                                            {/* AI Insights Section */}
                                            <div className="mb-6 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                                    <Sparkles size={40} className="text-indigo-400" />
                                                </div>
                                                <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                    <AlertCircle size={10} /> AI Insight
                                                </h5>
                                                <p className="text-sm text-slate-300 leading-relaxed italic">
                                                    "{opp.matchReason}"
                                                </p>
                                            </div>

                                            {opp.suggestedReply && (
                                                <div className="mb-6 p-4 bg-slate-800/30 border border-white/5 rounded-xl">
                                                    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                        <Send size={10} /> Recommended Hook
                                                    </h5>
                                                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                                                        {opp.suggestedReply}
                                                    </p>
                                                </div>
                                            )}

                                            <footer className="flex items-center justify-between pt-4 border-t border-white/5">
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => handleUpdateStatus(opp.id, 'dismissed')}
                                                        className="px-3 py-1.5 bg-slate-800/50 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                                                    >
                                                        Dismiss
                                                    </button>
                                                    <button 
                                                        onClick={() => handleUpdateStatus(opp.id, 'contacted')}
                                                        className="px-3 py-1.5 bg-slate-800/50 hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                                                    >
                                                        Mark as Contacted
                                                    </button>
                                                </div>
                                                <a 
                                                    href={opp.postUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    onClick={() => handleUpdateStatus(opp.id, 'seen')}
                                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/10"
                                                >
                                                    Join Conversation
                                                    <ExternalLink size={12} />
                                                </a>
                                            </footer>
                                        </article>
                                    ))
                                )}
                            </div>

                            {/* Sidebar Intelligence */}
                            <aside className="col-span-12 lg:col-span-4 space-y-6">
                                <div className="p-6 bg-slate-900/50 border border-white/5 rounded-3xl">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Command Intelligence</h3>
                                    
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-xl">
                                            <span className="text-xs text-slate-500">Tracked Subs</span>
                                            <span className="text-sm font-bold text-white">{config?.subreddits?.length || 0}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-xl">
                                            <span className="text-xs text-slate-500">Unseen Matches</span>
                                            <span className="text-sm font-bold text-indigo-400">{opportunities.filter(o => o.status === 'new').length}</span>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-white/5">
                                        <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Your Product Context</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                                            {config?.websiteContext || "Define your product context in settings to start matching."}
                                        </p>
                                        <button 
                                            onClick={() => setShowSettings(true)}
                                            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 mt-2 flex items-center gap-1 group"
                                        >
                                            Edit Context <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-6 bg-indigo-600 rounded-3xl shadow-2xl shadow-indigo-500/20 relative overflow-hidden">
                                     <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <Bell size={80} />
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">Grow OpinionDeck</h3>
                                    <p className="text-xs text-indigo-100 leading-relaxed mb-4">
                                        Each match is scored against your product's core value proposition. Be helpful first, sell second.
                                    </p>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-700/50 rounded-xl text-xs text-white font-medium">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                            System Operating at 1rps
                                        </div>
                                    </div>
                                </div>
                            </aside>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
