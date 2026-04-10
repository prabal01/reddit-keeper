import React, { useState } from 'react';
import { Plus, X, Sparkles, Loader2, Check, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { H2, Metadata } from '../common/Typography';
import { UIButton } from '../common/UIButton';
import { Badge } from '../common/Badge';

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
    const { getIdToken, plan } = useAuth();
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
        <div className="monitor-settings flex flex-col gap-12 py-4">
            <header className="flex items-center justify-between px-2">
                <div>
                    <H2 className="text-2xl! tracking-tight flex items-center gap-2">
                         Signal Configuration
                    </H2>
                    <Metadata className="mt-1">Define your product context and the communities we should watch.</Metadata>
                </div>
            </header>

            {/* Stage 1: Context */}
            <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Badge variant={plan === 'pro' || plan === 'beta' ? 'premium' : 'neutral'}>
                            {plan === 'pro' ? 'Founding Member' : plan === 'beta' ? 'Beta Member' : 'Free Plan'}
                        </Badge>
                    </div>
                    {isUrl && !isScanningUrl && (
                        <UIButton 
                            variant="secondary"
                            size="sm"
                            onClick={scanWebsite}
                            className="animate-pulse!"
                            icon={<Sparkles size={12} />}
                        >
                            Magic Scan Website
                        </UIButton>
                    )}
                </div>
                
                <div className="relative group">
                    <textarea 
                        value={websiteContext}
                        onChange={(e) => setWebsiteContext(e.target.value)}
                        disabled={isScanningUrl}
                        placeholder="Paste your landing page URL or describe your product..."
                        className={`w-full h-40 bg-(--bg-input) border border-(--border-light) rounded-xl p-4 text-base text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-(--bg-accent)/50 transition-all placeholder:text-(--text-tertiary) focus:bg-(--bg-secondary) ${isScanningUrl ? 'opacity-50 blur-[1px]' : ''}`}
                    />
                    {isScanningUrl && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 rounded-xl backdrop-blur-[2px]">
                            <Loader2 size={32} className="animate-spin text-(--bg-accent)" />
                            <Metadata className="text-white! font-bold!">Extracting Intelligence...</Metadata>
                        </div>
                    )}
                </div>

                {!isUrl && websiteContext.length > 20 && (
                    <UIButton 
                        onClick={fetchSuggestions}
                        disabled={loadingSuggestions}
                        variant="secondary"
                        size="sm"
                        icon={loadingSuggestions ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    >
                        {loadingSuggestions ? 'Brainstorming Communities...' : 'Suggest High-Signal Subreddits'}
                    </UIButton>
                )}
            </section>

            {/* Suggestions */}
            {(suggestions.length > 0 || loadingSuggestions) && (
                <section className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
                    <Metadata className="tracking-widest!">Recommended Communities</Metadata>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {loadingSuggestions ? (
                            Array(4).fill(0).map((_, i) => (
                                <div key={i} className="h-16 bg-(--bg-secondary) border border-(--border-light) rounded-xl animate-pulse" />
                            ))
                        ) : (
                            suggestions.map((s) => (
                                <div 
                                    key={s.name} 
                                    onClick={() => !subreddits.includes(s.name) && setSubreddits([...subreddits, s.name])}
                                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${
                                        subreddits.includes(s.name) 
                                        ? 'bg-(--bg-accent)/10 border-(--bg-accent)/50 text-(--bg-accent) shadow-(--premium-glow)' 
                                        : 'bg-(--bg-secondary) border-(--border-light) hover:border-(--bg-accent)/30 text-(--text-primary)'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-(--bg-tertiary) flex items-center justify-center text-(--bg-accent)">
                                            <MessageSquare size={16} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold">r/{s.name}</div>
                                            <Metadata className="opacity-60">{s.members} members • {s.signal} signal</Metadata>
                                        </div>
                                    </div>
                                    <div className="w-5 h-5 rounded-full border border-(--border-light) flex items-center justify-center">
                                        {subreddits.includes(s.name) && <Check size={12} className="text-(--bg-accent)" />}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            )}

            {/* Stage 2: Target Subreddits */}
            <section className="flex flex-col gap-3">
                <Metadata className="tracking-widest!">Active Watchlist</Metadata>
                <div className="flex flex-wrap gap-2 min-h-[50px] p-4 bg-(--bg-secondary) border border-(--border-light) rounded-xl">
                    {subreddits.length === 0 && <Metadata className="italic">No subreddits added yet...</Metadata>}
                    {subreddits.map(sub => (
                        <Badge key={sub} variant="info" className="animate-in zoom-in-95 duration-200">
                            r/{sub}
                            <button onClick={() => setSubreddits(subreddits.filter(s => s !== sub))} className="ml-1 hover:text-white transition-colors">
                                <X size={10} />
                            </button>
                        </Badge>
                    ))}
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-(--text-tertiary) font-bold text-xs">r/</div>
                        <input 
                            type="text"
                            value={newSub}
                            onChange={(e) => setNewSub(e.target.value.toLowerCase().replace(/r\//, ''))}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSub())}
                            placeholder="subreddit-name"
                            className="w-full bg-(--bg-input) border border-(--border-light) rounded-xl py-2.5 pl-7 pr-4 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-(--bg-accent)/50 transition-all placeholder:text-(--text-tertiary)"
                        />
                    </div>
                    <UIButton 
                        onClick={handleAddSub}
                        variant="secondary"
                        className="p-2.5!"
                    >
                        <Plus size={18} />
                    </UIButton>
                </div>
            </section>

            <footer className="pt-8 border-t border-(--border-light) flex justify-end">
                <UIButton 
                    onClick={handleSave}
                    disabled={saving || !websiteContext || subreddits.length === 0}
                    variant="primary"
                    size="lg"
                    icon={saving ? <Loader2 size={16} className="animate-spin" /> : undefined}
                >
                    Apply Configuration
                </UIButton>
            </footer>
        </div>
    );
};
