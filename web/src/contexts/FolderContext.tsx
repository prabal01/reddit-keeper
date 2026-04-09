import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
    is_monitoring_active?: boolean;
    seed_keywords?: string[];
}

export interface Lead {
    id: string;
    folderId: string;
    uid: string;
    thread_id?: string;
    thread_url?: string;
    thread_title?: string;
    status: 'new' | 'contacted' | 'ignored';
    saved_at: string;
    author?: string;
    subreddit?: string;
    relevance_score?: number;
    intent_markers?: string[];
}

export interface PersonLead {
    author: string;
    threads: { title: string; url: string; time: string }[];
    maxScore: number;
    subreddits: string[];
    intentMarkers: string[];
    status: 'new' | 'contacted' | 'ignored';
    leadIds: string[];
}

interface FolderContextType {
    folders: Folder[];
    loading: boolean;
    error: string | null;
    fetchFolders: () => Promise<void>;
    createFolder: (name: string, description?: string) => Promise<Folder>;
    deleteFolder: (id: string) => Promise<void>;
    saveThread: (folderId: string, threadData: any) => Promise<void>;
    getFolderThreads: (folderId: string) => Promise<any | { threads: any[], meta: any }>;
    analyzeFolder: (folderId: string) => Promise<any>;
    syncThreads: (folderId: string, urls: string[], items?: any[]) => Promise<void>;
    getFolderPatterns: (folderId: string) => Promise<any[]>;
    getFolderLeads: (folderId: string) => Promise<Lead[]>;
    updateLeadStatus: (folderId: string, leadId: string, status: 'new' | 'contacted' | 'ignored') => Promise<void>;
    getFolderAlerts: (folderId: string) => Promise<any[]>;
}

const FolderContext = createContext<FolderContextType | undefined>(undefined);

export const FolderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user, getIdToken, refreshPlan } = useAuth();

    const fetchFolders = useCallback(async () => {
        if (!user) { setLoading(false); return; }
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
    }, [user?.uid, getIdToken]);

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
            // Sync usage credits
            refreshPlan();
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

    const getFolderPatterns = async (folderId: string) => {
        if (!user) return [];
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/folders/${folderId}/patterns`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch patterns');
            return await res.json();
        } catch (err: any) {
            console.error(err);
            return [];
        }
    };

    const getFolderLeads = async (folderId: string) => {
        if (!user) return [];
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/folders/${folderId}/leads`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch leads');
            return await res.json();
        } catch (err: any) {
            console.error(err);
            return [];
        }
    };

    const updateLeadStatus = async (folderId: string, leadId: string, status: 'new' | 'contacted' | 'ignored') => {
        if (!user) throw new Error('Not authenticated');
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/folders/${folderId}/leads/${leadId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });
            if (!res.ok) throw new Error('Failed to update lead status');
        } catch (err: any) {
            console.error(err);
            throw err;
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
            const result = await res.json();
            // Sync usage credits after analysis
            refreshPlan();
            return result;
        } catch (err: any) {
            console.error(err);
            throw err;
        }
    };

    const syncThreads = async (folderId: string, urls: string[], items?: any[]) => {
        if (!user) throw new Error('Not authenticated');
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/folders/${folderId}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ urls, items })
            });

            if (!res.ok) throw new Error('Failed to initiate sync');

            // Update local folder state to syncing
            setFolders(prev => prev.map(f =>
                f.id === folderId ? { ...f, syncStatus: 'syncing' } : f
            ));
            // Sync usage credits (since sync increments counts)
            refreshPlan();
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    const getFolderAlerts = async (folderId: string) => {
        if (!user) return [];
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/folders/${folderId}/alerts`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch alerts');
            return await res.json();
        } catch (err: any) {
            console.error(err);
            return [];
        }
    };

    useEffect(() => {
        fetchFolders();
    }, [fetchFolders]);

    const contextValue = useMemo(() => ({
        folders,
        loading,
        error,
        fetchFolders,
        createFolder,
        deleteFolder,
        saveThread,
        getFolderThreads,
        getFolderPatterns,
        getFolderLeads,
        updateLeadStatus,
        getFolderAlerts,
        analyzeFolder,
        syncThreads
    }), [folders, loading, error, fetchFolders]);

    return (
        <FolderContext.Provider value={contextValue}>
            {children}
        </FolderContext.Provider>
    );
};

export const useFolders = () => {
    const context = useContext(FolderContext);
    if (!context) throw new Error('useFolders must be used within a FolderProvider');
    return context;
};
