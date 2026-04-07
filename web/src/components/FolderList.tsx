
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFolders } from '../contexts/FolderContext';
import type { Folder } from '../contexts/FolderContext';
import { Skeleton } from './Skeleton';
import { H2, Subtitle, Metadata } from './common/Typography';
import { UIButton } from './common/UIButton';
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
                <H2 className="folder-name text-[1.1rem]! mb-1">{folder.name}</H2>
                {folder.description && <Subtitle className="folder-desc text-[0.85rem]! line-clamp-1">{folder.description}</Subtitle>}
            </div>

            <div className="folder-card-meta">
                <Metadata className="thread-count-badge">
                    {folder.threadCount} {folder.threadCount === 1 ? 'thread' : 'threads'}
                </Metadata>
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
                <H2>My Monitors</H2>
                {user && (
                    <UIButton size="sm" onClick={() => setIsModalOpen(true)}>
                        + New Monitor
                    </UIButton>
                )}
            </div>

            {folders.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <FolderIcon size={48} strokeWidth={1.5} />
                    </div>
                    <Subtitle className="max-w-[400px] mx-auto">
                        You haven't set up any monitors yet. Create one to start tracking topics on Reddit.
                    </Subtitle>
                    <UIButton onClick={() => setIsModalOpen(true)}>
                        <PlusCircle size={18} /> Create Your First Monitor
                    </UIButton>
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
                            <H2>Create New Monitor</H2>
                        </div>

                        {(localError || contextError) && (
                            <div className="error-banner" style={{ marginBottom: '1rem', padding: '10px' }}>
                                <span className="error-icon">⚠️</span>
                                <p style={{ fontSize: '0.85rem' }}>{localError || contextError}</p>
                            </div>
                        )}
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <Metadata className="block mb-2 text-slate-400">What Do You Want to Monitor?</Metadata>
                                <input
                                    id="folder-name"
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="e.g., SaaS alternatives, AI tools, marketing trends"
                                    required
                                    autoFocus
                                    className="modal-input-v2"
                                />
                                <Subtitle className="input-hint text-[0.75rem]! mt-2">Choose a topic that interests you</Subtitle>
                            </div>

                            <div className="modal-actions">
                                <UIButton variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </UIButton>
                                <UIButton type="submit" disabled={!newName.trim() || submitting} loading={submitting}>
                                    Create Monitor
                                </UIButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
