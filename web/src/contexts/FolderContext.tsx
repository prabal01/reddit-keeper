import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

export interface Folder {
    id: string;
    uid: string;
    name: string;
    description?: string;
    color?: string;
    createdAt: string;
    threadCount: number;
}

interface FolderContextType {
    folders: Folder[];
    loading: boolean;
    error: string | null;
    fetchFolders: () => Promise<void>;
    createFolder: (name: string, description?: string) => Promise<Folder>;
    deleteFolder: (id: string) => Promise<void>;
    saveThread: (folderId: string, threadData: any) => Promise<void>;
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
            const res = await fetch('/api/folders', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch folders');
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
            const res = await fetch('/api/folders', {
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
            const res = await fetch(`/api/folders/${id}`, {
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
            const res = await fetch(`/api/folders/${folderId}/threads`, {
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
            saveThread
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
