import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
    Settings as SettingsIcon,
    ExternalLink,
    CheckCircle2,
    Sparkles,
    Loader2,
    RefreshCw,
    Zap,
    TrendingUp
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { MonitorSettings } from './MonitorSettings';

interface Opportunity {
    id: string;
    postId: string;
    postTitle: string;
    postSubreddit: string;
    postAuthor: string;
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
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

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
                <p className="text-slate-400 text-sm font-medium animate-pulse">Initializing monitoring systems...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-900/50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold text-white">Market Monitors</h1>
                            <p className="text-slate-400 text-xs mt-0.5">Track opportunities across communities</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSync}
                                disabled={syncing}
                                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700 rounded-lg hover:border-slate-600 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                            >
                                {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                Sync
                            </button>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                                    showSettings
                                    ? 'bg-orange-500 text-white border border-orange-500'
                                    : 'text-slate-300 bg-slate-900 border border-slate-700 hover:border-slate-600'
                                }`}
                            >
                                <SettingsIcon size={14} />
                                {showSettings ? 'Close' : 'Settings'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                {showSettings ? (
                    <div className="max-w-2xl">
                        <MonitorSettings initialConfig={config} onSave={handleSaveConfig} />
                    </div>
                ) : (
                    <>
                        {/* Summary Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-slate-900 rounded-lg p-3 border border-slate-800 hover:border-slate-700 transition-colors">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-xs font-medium text-slate-500">Active Monitors</p>
                                    <Zap size={12} className="text-orange-500" />
                                </div>
                                <p className="text-xl font-semibold text-white">{config?.subreddits?.length || 0}</p>
                                <p className="text-xs text-slate-600 mt-0.5">of 10 available</p>
                            </div>

                            <div className="bg-slate-900 rounded-lg p-3 border border-slate-800 hover:border-slate-700 transition-colors">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-xs font-medium text-slate-500">New Leads</p>
                                    <Sparkles size={12} className="text-blue-400" />
                                </div>
                                <p className="text-xl font-semibold text-white">{(opportunities || []).filter(o => o?.status === 'new').length}</p>
                                <p className="text-xs text-slate-600 mt-0.5">Waiting for you</p>
                            </div>

                            <div className="bg-slate-900 rounded-lg p-3 border border-slate-800 hover:border-slate-700 transition-colors">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-xs font-medium text-slate-500">Total Leads</p>
                                    <TrendingUp size={12} className="text-green-400" />
                                </div>
                                <p className="text-xl font-semibold text-white">{opportunities.length}</p>
                                <p className="text-xs text-slate-600 mt-0.5">All time</p>
                            </div>
                        </div>

                        {/* Monitors Grid */}
                        {opportunities.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-slate-800 bg-slate-900/30">
                                <Sparkles size={28} className="text-slate-600 mb-2" />
                                <h3 className="text-sm font-semibold text-white mb-0.5">Scanning in progress</h3>
                                <p className="text-slate-500 text-xs">New opportunities will appear here soon</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-max">
                                {opportunities.map(opp => {
                                    const isExpanded = expandedCards.has(opp.id);
                                    return (
                                    <div
                                        key={opp.id}
                                        className={`bg-slate-900 rounded-lg border transition-all hover:border-slate-700 ${
                                            opp.status === 'new' ? 'border-orange-500/40 ring-1 ring-orange-500/20' : 'border-slate-800'
                                        }`}
                                    >
                                        <div
                                            className="p-3 cursor-pointer"
                                            onClick={() => setExpandedCards(prev => {
                                                const next = new Set(prev);
                                                if (next.has(opp.id)) { next.delete(opp.id); } else { next.add(opp.id); }
                                                return next;
                                            })}
                                        >
                                            {/* Header */}
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <span className="text-xs font-semibold text-orange-400">r/{opp.postSubreddit}</span>
                                                        {opp.status === 'new' && (
                                                            <span className="text-xs font-bold text-green-400">LIVE</span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-xs font-semibold text-white line-clamp-2 leading-snug">
                                                        {opp.postTitle}
                                                    </h3>
                                                </div>
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                                    opp.relevanceScore >= 80
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-zinc-800 text-slate-400'
                                                }`}>
                                                    {opp.relevanceScore}%
                                                </span>
                                            </div>

                                            {/* Meta */}
                                            <p className="text-xs text-slate-500 mb-2">
                                                u/{opp.postAuthor}
                                                {opp.createdAt ? <span className="ml-1.5">· {formatDistanceToNow(new Date(opp.createdAt * 1000), { addSuffix: true })}</span> : null}
                                            </p>

                                            {/* Match Reason */}
                                            {opp.matchReason && (
                                                <div className="mb-2 py-2 border-y border-slate-800">
                                                    <p className="text-xs text-slate-500 font-medium mb-1">WHY IT MATCHED</p>
                                                    <p className={`text-xs text-slate-300 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                                                        {opp.matchReason}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Expanded Content */}
                                            {isExpanded && opp.suggestedReply && (
                                                <div className="mb-2 p-2 bg-slate-800/50 rounded">
                                                    <p className="text-xs text-slate-500 font-medium mb-1">SUGGESTED REPLY</p>
                                                    <p className="text-xs text-slate-300 leading-relaxed">{opp.suggestedReply}</p>
                                                </div>
                                            )}

                                            {/* Timestamp */}
                                            <p className="text-xs text-slate-500 mb-2">
                                                {opp.matchedAt
                                                    ? `Matched ${formatDistanceToNow(new Date(opp.matchedAt), { addSuffix: true })}`
                                                    : 'Recently matched'}
                                            </p>
                                        </div>

                                        {/* Actions — outside clickable area */}
                                        <div className="flex gap-2 px-3 pb-3">
                                            <button
                                                onClick={() => handleUpdateStatus(opp.id, 'contacted')}
                                                className="flex-1 px-2 py-1.5 text-xs font-semibold text-slate-300 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
                                            >
                                                <CheckCircle2 size={11} className="inline mr-1" />
                                                Done
                                            </button>
                                            <a
                                                href={opp.postUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(opp.id, 'seen'); }}
                                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-orange-400 hover:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 text-xs font-semibold rounded transition-colors"
                                            >
                                                <ExternalLink size={11} />
                                            </a>
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
