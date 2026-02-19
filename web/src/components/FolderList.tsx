
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFolders } from '../contexts/FolderContext';
import type { Folder } from '../contexts/FolderContext';
import { Skeleton } from './Skeleton';
import './Folders.css';

interface FolderCardProps {
    folder: Folder;
    onClick: (folder: Folder) => void;
}

import { Folder as FolderIcon, Trash2, PlusCircle } from 'lucide-react';

const FolderCard: React.FC<FolderCardProps> = ({ folder, onClick }) => {
    const { deleteFolder } = useFolders();

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to delete "${folder.name}"? This will delete all saved threads in it.`)) {
            deleteFolder(folder.id);
        }
    };

    return (
        <div className="folder-card" onClick={() => onClick(folder)}>
            <div className="folder-card-header">
                <div className="folder-icon-wrapper">
                    <FolderIcon size={24} />
                </div>
                <div className="folder-actions">
                    <button
                        className="btn-icon-v2"
                        onClick={handleDelete}
                        title="Delete Folder"
                        aria-label="Delete Folder"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>
            <div className="folder-info">
                <h3 className="folder-name">{folder.name}</h3>
                {folder.description && <p className="folder-desc">{folder.description}</p>}
            </div>
            <div className="folder-card-footer">
                <div className="thread-count-badge">
                    {folder.threadCount} {folder.threadCount === 1 ? 'thread' : 'threads'}
                </div>
            </div>
        </div>
    );
};

export const FolderList: React.FC<{ onSelect: (folder: Folder) => void }> = ({ onSelect }) => {
    const { user } = useAuth();
    const { folders, loading, createFolder, error: contextError } = useFolders();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const [template, setTemplate] = useState('standard');

    const TEMPLATES = [
        { id: 'standard', name: 'Standard Research', desc: '' },
        { id: 'competitor', name: 'Competitor Analysis', desc: 'Focus on strengths, weaknesses, feature gaps, and user complaints about [Competitor Name].' },
        { id: 'intent', name: 'Buying Intent Search', desc: 'Identify users actively looking for solutions, asking for recommendations, or expressing willingness to pay.' },
        { id: 'content', name: 'Content Ideas', desc: 'Find questions, misconceptions, and popular topics to create content about.' }
    ];

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setSubmitting(true);
        setLocalError(null);

        try {
            await createFolder(newName, newDesc);
            setNewName('');
            setNewDesc('');
            setTemplate('standard');
            setIsModalOpen(false);
        } catch (err: any) {
            setLocalError(err.message || 'Failed to create folder');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading && folders.length === 0) {
        return (
            <div className="folders-section">
                <div className="section-header">
                    <Skeleton width="250px" height="32px" />
                    <Skeleton width="120px" height="40px" style={{ borderRadius: '12px' }} />
                </div>
                <div className="folders-grid">
                    {[1, 2, 3].map(id => (
                        <div key={id} className="folder-card" style={{ pointerEvents: 'none' }}>
                            <div className="folder-card-header">
                                <Skeleton width="40px" height="40px" circle />
                                <Skeleton width="32px" height="32px" style={{ borderRadius: '8px' }} />
                            </div>
                            <div className="folder-info">
                                <Skeleton width="60%" height="20px" style={{ marginBottom: '8px' }} />
                                <Skeleton width="90%" height="16px" />
                            </div>
                            <div className="folder-card-footer">
                                <Skeleton width="80px" height="24px" style={{ borderRadius: '8px' }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="folders-section">
            <div className="section-header">
                <h2>Your Research Folders</h2>
                {user && (
                    <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                        + New Folder
                    </button>
                )}
            </div>

            {folders.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <FolderIcon size={48} strokeWidth={1.5} />
                    </div>
                    <p>You haven't created any folders yet. Organization is the first step to deep research.</p>
                    <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                        <PlusCircle size={18} /> Create your first folder
                    </button>
                </div>
            ) : (
                <div className="folders-grid">
                    {folders.map(folder => (
                        <FolderCard key={folder.id} folder={folder} onClick={onSelect} />
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Create New Research Folder</h3>
                        </div>

                        {(localError || contextError) && (
                            <div className="error-banner" style={{ marginBottom: '1rem', padding: '10px' }}>
                                <span className="error-icon">⚠️</span>
                                <p style={{ fontSize: '0.85rem' }}>{localError || contextError}</p>
                            </div>
                        )}
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label htmlFor="folder-template">Research Template</label>
                                <select
                                    id="folder-template"
                                    value={template}
                                    onChange={(e) => {
                                        const t = TEMPLATES.find(t => t.id === e.target.value);
                                        setTemplate(e.target.value);
                                        if (t) setNewDesc(t.desc);
                                    }}
                                    className="form-select" // Ensure you have styles for this or use inline
                                    style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                >
                                    {TEMPLATES.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="folder-name">Name</label>
                                <input
                                    id="folder-name"
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="e.g., Habit Tracker Pricing"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="folder-desc">Instructions for AI (Optional)</label>
                                <textarea
                                    id="folder-desc"
                                    value={newDesc}
                                    onChange={e => setNewDesc(e.target.value)}
                                    placeholder="What is this research about?"
                                    rows={3}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={!newName.trim() || submitting}>
                                    {submitting ? 'Creating...' : 'Create Folder'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
