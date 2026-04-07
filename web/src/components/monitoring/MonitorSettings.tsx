import React, { useState } from 'react';
import { Plus, X, Sparkles, Loader2, Check, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Suggestion {
    name: string;
    members: string;
    signal: string;
    reason: string;
}

interface MonitorSettingsProps {
    onSave: (config: { websiteContext: string; subreddits: string[] }) => void;
    initialConfig?: { websiteContext: string; subreddits: string[] };
}

export const MonitorSettings: React.FC<MonitorSettingsProps> = ({ onSave, initialConfig }) => {
    const { getIdToken } = useAuth();
    const [websiteContext, setWebsiteContext] = useState(initialConfig?.websiteContext || '');
    const [subreddits, setSubreddits] = useState<string[]>(initialConfig?.subreddits || []);
    const [newSub, setNewSub] = useState('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [isScanningUrl, setIsScanningUrl] = useState(false);
    const [saving, setSaving] = useState(false);

    // URL Detection
    const isUrl = /^(http|https):\/\/[^ "]+$/.test(websiteContext.trim());

    const handleAddSub = (e?: React.FormEvent) => {
        e?.preventDefault();
        const clean = newSub.replace('r/', '').trim();
        if (clean && !subreddits.includes(clean)) {
            setSubreddits([...subreddits, clean]);
            setNewSub('');
        }
    };

    const scanWebsite = async () => {
        if (!isUrl) return;
        setIsScanningUrl(true);
        try {
            const token = await getIdToken();
            const res = await fetch('/api/monitoring/suggestions', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ context: websiteContext })
            });
            const data = await res.json();
            if (data.summarizedContext) {
                setWebsiteContext(data.summarizedContext);
            }
        } catch (err) {
            console.error('Failed to scan website', err);
        } finally {
            setIsScanningUrl(false);
        }
    };

    const fetchSuggestions = async () => {
        if (!websiteContext || isUrl) return;
        setLoadingSuggestions(true);
        try {
            const token = await getIdToken();
            const res = await fetch('/api/monitoring/suggestions', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ context: websiteContext })
            });

            if (!res.ok) throw new Error("Failed to fetch suggestions");
            
            const data = await res.json();
            setSuggestions(data.suggestions || []);
        } catch (err) {
            console.error('Failed to fetch suggestions', err);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave({ websiteContext, subreddits });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="monitor-settings space-y-12 py-4">
            <header className="flex items-center justify-between px-2">
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2" style={{ textWrap: 'balance' }}>
                         Signal Configuration
                    </h2>
                    <p className="text-sm font-medium text-zinc-500 mt-1">Define your product context and the communities we should watch.</p>
                </div>
            </header>

            {/* Stage 1: Context */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles size={14} className="text-orange-400" />
                        Product Context (The "Why")
                    </label>
                    {isUrl && !isScanningUrl && (
                        <button 
                            onClick={scanWebsite}
                            className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-3 py-1 rounded border border-orange-500/20 hover:bg-orange-500/20 transition-all flex items-center gap-2 animate-pulse"
                        >
                            <Sparkles size={12} />
                            Magic Scan Website
                        </button>
                    )}
                </div>
                
                <div className="relative group">
                    <textarea 
                        value={websiteContext}
                        onChange={(e) => setWebsiteContext(e.target.value)}
                        disabled={isScanningUrl}
                        placeholder="Paste your landing page URL or describe your product..."
                        className={`w-full h-40 bg-zinc-900/50 border border-white/10 rounded-xl p-4 text-base text-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-zinc-600 focus:bg-zinc-900/80 ${isScanningUrl ? 'opacity-50 blur-[1px]' : ''}`}
                    />
                    {isScanningUrl && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 rounded-xl backdrop-blur-[2px]">
                            <Loader2 size={32} className="animate-spin text-orange-500" />
                            <span className="text-sm font-bold text-white tracking-widest uppercase">Extracting Intelligence...</span>
                        </div>
                    )}
                </div>

                {!isUrl && websiteContext.length > 20 && (
                    <button 
                        onClick={fetchSuggestions}
                        disabled={loadingSuggestions}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-xs font-bold transition-all border border-orange-500/20 disabled:opacity-50"
                    >
                        {loadingSuggestions ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                <span>Brainstorming Relevant Communities...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles size={14} />
                                <span>Suggest High-Signal Subreddits</span>
                            </>
                        )}
                    </button>
                )}
            </section>

            {/* Suggestions */}
            {(suggestions.length > 0 || loadingSuggestions) && (
                <section className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Recommended Communities</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {loadingSuggestions ? (
                            Array(4).fill(0).map((_, i) => (
                                <div key={i} className="h-16 bg-zinc-900/50 border border-white/5 rounded-xl animate-pulse" />
                            ))
                        ) : (
                            suggestions.map((s) => (
                                <div 
                                    key={s.name} 
                                    onClick={() => !subreddits.includes(s.name) && setSubreddits([...subreddits, s.name])}
                                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${
                                        subreddits.includes(s.name) 
                                        ? 'bg-orange-500/20 border-orange-500/50 text-orange-100 shadow-[0_0_15px_-3px_rgba(255,69,0,0.3)]' 
                                        : 'bg-zinc-900/50 border-white/10 hover:border-orange-500/30 text-zinc-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-orange-400">
                                            <MessageSquare size={16} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold">r/{s.name}</div>
                                            <div className="text-[10px] text-zinc-500 font-medium">{s.members} members • {s.signal} signal</div>
                                        </div>
                                    </div>
                                    <div className="w-5 h-5 rounded-full border border-white/10 flex items-center justify-center">
                                        {subreddits.includes(s.name) && <Check size={12} className="text-orange-400" />}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            )}

            {/* Stage 2: Target Subreddits */}
            <section className="space-y-3">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Active Watchlist</label>
                <div className="flex flex-wrap gap-2 min-h-[50px] p-4 bg-zinc-900/50 border border-white/10 rounded-xl">
                    {subreddits.length === 0 && <span className="text-xs text-zinc-600 italic">No subreddits added yet...</span>}
                    {subreddits.map(sub => (
                        <span key={sub} className="flex items-center gap-2 px-3 py-1 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-full text-xs font-bold animate-in zoom-in-95 duration-200">
                            r/{sub}
                            <button onClick={() => setSubreddits(subreddits.filter(s => s !== sub))} className="hover:text-white transition-colors">
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-xs">r/</div>
                        <input 
                            type="text"
                            value={newSub}
                            onChange={(e) => setNewSub(e.target.value.toLowerCase().replace(/r\//, ''))}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSub())}
                            placeholder="subreddit-name"
                            className="w-full bg-zinc-900/50 border border-white/10 rounded-xl py-2.5 pl-7 pr-4 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-zinc-600"
                        />
                    </div>
                    <button 
                        onClick={handleAddSub}
                        className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl border border-white/10 transition-all"
                    >
                        <Plus size={18} />
                    </button>
                </div>
            </section>

            <footer className="pt-4 border-t border-white/5 flex justify-end">
                <button 
                    onClick={handleSave}
                    disabled={saving || !websiteContext || subreddits.length === 0}
                    className="px-6 py-2 bg-linear-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : 'Apply Configuration'}
                </button>
            </footer>
        </div>
    );
};
