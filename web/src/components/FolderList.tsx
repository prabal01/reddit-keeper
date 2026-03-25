
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
            <div className="folder-icon-wrapper">
                <FolderIcon size={24} />
            </div>
            
            <div className="folder-info">
                <h3 className="folder-name">{folder.name}</h3>
                {folder.description && <p className="folder-desc">{folder.description}</p>}
            </div>

            <div className="folder-card-meta">
                <div className="thread-count-badge">
                    {folder.threadCount} {folder.threadCount === 1 ? 'thread' : 'threads'}
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
        </div>
    );
};

export const FolderList: React.FC<{ onSelect: (folder: Folder) => void }> = ({ onSelect }) => {
    const { user } = useAuth();
    const { folders, loading, createFolder, error: contextError } = useFolders();
    console.log("[FolderList] Render - loading:", loading, "folders:", folders.length);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setSubmitting(true);
        setLocalError(null);

        try {
            await createFolder(newName);
            setNewName('');
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
                            <Skeleton width="48px" height="48px" style={{ borderRadius: '14px' }} />
                            <div className="folder-info">
                                <Skeleton width="60%" height="20px" style={{ marginBottom: '8px' }} />
                                <Skeleton width="90%" height="16px" />
                            </div>
                            <div className="folder-card-meta">
                                <Skeleton width="80px" height="24px" style={{ borderRadius: '10px' }} />
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
                                <label htmlFor="folder-name">Folder Name</label>
                                <input
                                    id="folder-name"
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="e.g., My Research Project"
                                    required
                                    autoFocus
                                    className="modal-input-v2"
                                />
                                <p className="input-hint">Give your research a clear name to organize your insights.</p>
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
