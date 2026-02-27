import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { API_BASE } from '../lib/api';

export interface Folder {
    id: string;
    uid: string;
    name: string;
    description?: string;
    color?: string;
    createdAt: string;
    threadCount: number;
    syncStatus?: 'idle' | 'syncing';
    pendingSyncCount?: number;
}

interface FolderContextType {
    folders: Folder[];
    loading: boolean;
    error: string | null;
    fetchFolders: () => Promise<void>;
    createFolder: (name: string, description?: string) => Promise<Folder>;
    deleteFolder: (id: string) => Promise<void>;
    saveThread: (folderId: string, threadData: any) => Promise<void>;
    getFolderThreads: (folderId: string) => Promise<any[]>;
    analyzeFolder: (folderId: string) => Promise<any>;
    syncThreads: (folderId: string, urls: string[]) => Promise<void>;
}

const FolderContext = createContext<FolderContextType | undefined>(undefined);

export const FolderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { user, getIdToken } = useAuth();

    const fetchFolders = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/folders`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to fetch folders (${res.status})`);
            }
            const data = await res.json();
            setFolders(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    const createFolder = async (name: string, description?: string) => {
        if (!user) throw new Error('Not authenticated');
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/folders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, description })
            });
            if (!res.ok) throw new Error('Failed to create folder');
            const folder = await res.json();
            setFolders(prev => [folder, ...prev]);
            return folder;
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    const deleteFolder = async (id: string) => {
        if (!user) throw new Error('Not authenticated');
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/folders/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to delete folder');
            setFolders(prev => prev.filter(f => f.id !== id));
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    const saveThread = async (folderId: string, threadData: any) => {
        if (!user) throw new Error('Not authenticated');
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/folders/${folderId}/threads`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ threadData })
            });
            if (!res.ok) throw new Error('Failed to save thread');

            // Increment thread count locally
            setFolders(prev => prev.map(f =>
                f.id === folderId ? { ...f, threadCount: f.threadCount + 1 } : f
            ));
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };


    const getFolderThreads = async (folderId: string) => {
        if (!user) return { threads: [], meta: null };
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/folders/${folderId}/threads`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch threads');
            const data = await res.json();
            // Handle virtual inbox folder backward compatibility
            if (Array.isArray(data)) return { threads: data, meta: null };
            return data;
        } catch (err: any) {
            console.error(err);
            return { threads: [], meta: null };
        }
    };

    const analyzeFolder = async (folderId: string) => {
        if (!user) throw new Error('Not authenticated');
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/folders/${folderId}/analyze`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Analysis failed');
            }
            return await res.json();
        } catch (err: any) {
            console.error(err);
            throw err;
        }
    };

    const syncThreads = async (folderId: string, urls: string[]) => {
        if (!user) throw new Error('Not authenticated');
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/folders/${folderId}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ urls })
            });

            if (!res.ok) throw new Error('Failed to initiate sync');

            // Update local folder state to syncing
            setFolders(prev => prev.map(f =>
                f.id === folderId ? { ...f, syncStatus: 'syncing' } : f
            ));
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    useEffect(() => {
        fetchFolders();
    }, [fetchFolders]);

    return (
        <FolderContext.Provider value={{
            folders,
            loading,
            error,
            fetchFolders,
            createFolder,
            deleteFolder,
            saveThread,
            getFolderThreads,
            analyzeFolder,
            syncThreads
        }}>
            {children}
        </FolderContext.Provider>
    );
};

export const useFolders = () => {
    const context = useContext(FolderContext);
    if (!context) throw new Error('useFolders must be used within a FolderProvider');
    return context;
};
