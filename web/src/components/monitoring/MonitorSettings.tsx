import React, { useState } from 'react';
import { Plus, X, Sparkles, Loader2, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Suggestion {
    name: string;
    members: string;
    signal: string;
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
    const [saving, setSaving] = useState(false);

    const handleAddSub = (e?: React.FormEvent) => {
        e?.preventDefault();
        const clean = newSub.replace('r/', '').trim();
        if (clean && !subreddits.includes(clean)) {
            setSubreddits([...subreddits, clean]);
            setNewSub('');
        }
    };

    const removeSub = (name: string) => {
        setSubreddits(subreddits.filter(s => s !== name));
    };

    const fetchSuggestions = async () => {
        if (!websiteContext) return;
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
            const data = await res.json();
            setSuggestions(data);
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
        <div className="monitor-settings space-y-8 p-6 bg-[#0f172a] rounded-xl border border-white/5 shadow-2xl">
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                         Targeting Configuration
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">Define your product context and the communities we should watch.</p>
                </div>
            </header>

            {/* Stage 1: Context */}
            <section className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-400" />
                    Product Context (The "Why")
                </label>
                <textarea 
                    value={websiteContext}
                    onChange={(e) => setWebsiteContext(e.target.value)}
                    placeholder="Example: We are an automated market research tool for SaaS founders. We help them find pain points on Reddit and HN..."
                    className="w-full h-32 bg-slate-900/50 border border-white/10 rounded-lg p-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
                />
                <button 
                    onClick={fetchSuggestions}
                    disabled={!websiteContext || loadingSuggestions}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                >
                    {loadingSuggestions ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Suggest Subreddits
                </button>
            </section>

            {/* AI Suggestions Grid */}
            {suggestions.length > 0 && (
                <section className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                    <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest">AI Recommendations</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {suggestions.map(s => (
                            <div 
                                key={s.name} 
                                onClick={() => !subreddits.includes(s.name) && setSubreddits([...subreddits, s.name])}
                                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                                    subreddits.includes(s.name) 
                                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-100' 
                                    : 'bg-slate-900 border-white/5 hover:border-indigo-500/30 text-slate-300'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold">
                                        r/
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold">{s.name}</div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wider">{s.members} members • {s.signal} Signal</div>
                                    </div>
                                </div>
                                {subreddits.includes(s.name) ? <Check size={14} /> : <Plus size={14} />}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Stage 2: Target Subreddits */}
            <section className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Watchlist</label>
                <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-slate-900/50 border border-white/10 rounded-lg">
                    {subreddits.length === 0 && <span className="text-xs text-slate-600 italic">No subreddits added yet...</span>}
                    {subreddits.map(sub => (
                        <span key={sub} className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-full text-xs font-bold">
                            r/{sub}
                            <button onClick={() => removeSub(sub)} className="hover:text-white transition-colors">
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
                <form onSubmit={handleAddSub} className="flex gap-2">
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">r/</span>
                        <input 
                            type="text" 
                            value={newSub}
                            onChange={(e) => setNewSub(e.target.value)}
                            placeholder="subreddit-name"
                            className="w-full bg-slate-900 border border-white/10 rounded-lg py-2 pl-8 pr-4 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                        />
                    </div>
                    <button type="submit" className="p-2 aspect-square bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all">
                        <Plus size={20} />
                    </button>
                </form>
            </section>

            <footer className="pt-4 border-t border-white/5 flex justify-end">
                <button 
                    onClick={handleSave}
                    disabled={saving || !websiteContext || subreddits.length === 0}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : 'Apply Configuration'}
                </button>
            </footer>
        </div>
    );
};
