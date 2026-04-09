import React, { useState } from 'react';
import { Settings, Globe, Zap, X, AlertTriangle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ConfigsTabProps {
    folder: any;
    onDelete: () => void;
    onClearStuck: () => void;
    onClose?: () => void;
}

export const ConfigsTab: React.FC<ConfigsTabProps> = ({ folder, onDelete, onClearStuck, onClose }) => {
    const navigate = useNavigate();
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmText, setConfirmText] = useState('');

    const isMonitor = !!folder.is_monitoring_active;
    const canConfirm = confirmText.toLowerCase() === 'delete';

    const handleConfirm = () => {
        if (!canConfirm) return;
        onDelete();
    };

    return (
        <div className="configs-tab-view animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-bold text-(--text-primary)">Monitor Settings</h2>
                    <p className="text-xs text-(--text-tertiary) mt-0.5">Agent parameters and controls</p>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/8 text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                        title="Close settings"
                    >
                        <X size={15} />
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {/* Source Context — compact row */}
                <div className="rounded-xl border border-(--border-light) bg-(--bg-secondary) p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Globe size={14} className="text-blue-400" />
                        <span className="text-xs font-bold uppercase tracking-widest text-(--text-tertiary)">Source Context</span>
                    </div>
                    <div className="flex flex-col gap-3">
                        {folder.source_url && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-(--text-tertiary) shrink-0">URL</span>
                                <span className="text-(--text-secondary) truncate font-mono text-xs bg-black/20 px-2 py-1 rounded">
                                    {folder.source_url}
                                </span>
                            </div>
                        )}
                        {folder.seed_keywords?.length > 0 && (
                            <div>
                                <span className="text-xs text-(--text-tertiary) mb-2 block">Keywords</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {folder.seed_keywords.map((kw: string, i: number) => (
                                        <span key={i} className="bg-white/5 border border-white/8 text-gray-300 px-2.5 py-1 rounded-full text-xs">
                                            {kw}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Monitor Status — compact row */}
                <div className="rounded-xl border border-(--border-light) bg-(--bg-secondary) p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Zap size={14} className="text-orange-400" />
                        <span className="text-xs font-bold uppercase tracking-widest text-(--text-tertiary)">Status</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-(--text-primary)">Global Monitoring Agent</p>
                            <p className="text-xs text-(--text-tertiary) mt-0.5">
                                Scanning {folder.seed_keywords?.length || 0} keywords · Reddit/HN · every 12h
                            </p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            isMonitor
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                        }`}>
                            {isMonitor ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                    <button className="btn-secondary small flex items-center gap-1.5" onClick={() => navigate('/settings')}>
                        <Settings size={13} />
                        Adjust Plan
                    </button>
                    <button className="btn-secondary small text-gray-500" onClick={onClearStuck}>
                        Clear Stuck State
                    </button>
                    {!showConfirm && (
                        <button
                            className="btn-danger small ml-auto flex items-center gap-1.5"
                            onClick={() => setShowConfirm(true)}
                        >
                            {isMonitor ? 'Remove Monitor' : 'Delete Mission'}
                        </button>
                    )}
                </div>

                {/* Inline type-to-confirm */}
                {showConfirm && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                        <div className="flex items-start gap-3 mb-4">
                            <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-red-400 mb-1">
                                    {isMonitor ? 'Remove this monitor?' : 'Delete this mission?'}
                                </p>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    {isMonitor
                                        ? 'Monitor deactivates and disappears from dashboard. Collected leads and patterns stay intact in this folder.'
                                        : 'Permanently deletes folder and all saved threads. Cannot be undone.'}
                                </p>
                            </div>
                        </div>
                        <label className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2 block">
                            Type <span className="text-red-400 font-mono normal-case">delete</span> to confirm
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={e => setConfirmText(e.target.value)}
                            placeholder="delete"
                            autoFocus
                            className="w-full bg-black/30 border border-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:border-red-500/50 focus:outline-none"
                        />
                        <div className="flex gap-2">
                            <button
                                className="btn-secondary small"
                                onClick={() => { setShowConfirm(false); setConfirmText(''); }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-danger small"
                                onClick={handleConfirm}
                                disabled={!canConfirm}
                                style={{ opacity: canConfirm ? 1 : 0.35, cursor: canConfirm ? 'pointer' : 'not-allowed' }}
                            >
                                {isMonitor ? 'Remove Monitor' : 'Delete Mission'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
