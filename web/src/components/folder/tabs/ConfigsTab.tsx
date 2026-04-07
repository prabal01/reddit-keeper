import React from 'react';
import { Settings, Globe, Zap, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ConfigsTabProps {
    folder: any;
    onDelete: () => void;
    onClearStuck: () => void;
    onClose?: () => void;
}

export const ConfigsTab: React.FC<ConfigsTabProps> = ({ folder, onDelete, onClearStuck, onClose }) => {
    const navigate = useNavigate();

    return (
        <div className="configs-tab-view animate-fade-in">
            <div className="tab-header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2>Monitor Settings</h2>
                    <p>Manage the parameters and monitoring settings for this agent.</p>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'rgba(255,255,255,0.4)',
                            flexShrink: 0
                        }}
                        title="Close settings"
                    >
                        <X size={15} />
                    </button>
                )}
            </div>

            <div className="configs-grid">
                {/* Source Mapping */}
                <div className="configs-card premium-card">
                    <div className="flex items-center gap-3 mb-6">
                        <Globe size={24} className="text-blue-400" />
                        <h3 className="text-xl font-bold">Source Context</h3>
                    </div>
                    <div className="configs-field mb-6">
                        <label className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2 block">Project Website</label>
                        <div className="configs-input-wrapper">
                            <input 
                                className="configs-input bg-gray-900 border-gray-800 text-gray-200 block w-full p-3 rounded"
                                value={folder.source_url || "No website URL tracked."}
                                readOnly
                            />
                        </div>
                    </div>
                    <div className="configs-field">
                        <label className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2 block">Seed Keywords</label>
                        <div className="configs-pill-grid flex flex-wrap gap-2">
                            {folder.seed_keywords?.map((kw: string, i: number) => (
                                <span key={i} className="configs-pill bg-gray-800 text-gray-300 px-3 py-1.5 rounded-full text-xs font-semibold">
                                    {kw}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Monitoring Settings */}
                <div className="configs-card premium-card">
                    <div className="flex items-center gap-3 mb-6">
                        <Zap size={24} className="text-orange-400" />
                        <h3 className="text-xl font-bold">Monitor Status</h3>
                    </div>
                    <div className="configs-field mb-6">
                        <div className="flex justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-800">
                            <div>
                                <h4 className="text-white font-bold mb-1">Global Monitoring Agent</h4>
                                <p className="text-xs text-gray-500">Currently scanning {folder.seed_keywords?.length || 0} keywords across Reddit/HN every 12h.</p>
                            </div>
                            <div className={`status-toggle ${folder.is_monitoring_active ? 'active' : ''}`}>
                                <span className={folder.is_monitoring_active ? 'text-green-500 font-bold' : 'text-gray-600 font-bold'}>
                                    ACTIVE
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="configs-actions-footer flex gap-4 mt-12 pt-8 border-t border-gray-800">
                        <button className="btn-secondary small" onClick={() => navigate('/settings')}>
                            <Settings size={14} />
                            Adjust Plan
                        </button>
                        <button className="btn-secondary small text-gray-500" onClick={onClearStuck}>
                            Clear Stuck State
                        </button>
                        <button className="btn-danger small ml-auto" onClick={onDelete}>
                            Delete Mission
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
