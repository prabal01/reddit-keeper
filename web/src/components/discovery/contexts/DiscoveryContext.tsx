import React, { createContext, useContext, type ReactNode } from 'react';
import { useDiscovery as useImplementationHook } from '../hooks/useDiscovery';
import type { DiscoveryResult, DiscoveryPlan, DiscoveryHistoryEntry, PlatformFilter, IntentFilter } from '../hooks/useDiscovery';

interface DiscoveryContextType {
    results: DiscoveryResult[];
    allResults: DiscoveryResult[];
    selectedResults: DiscoveryResult[];
    loading: boolean;
    isSaving: boolean;
    isSearchingStarted: boolean;
    setIsSearchingStarted: (started: boolean) => void;
    selectedIds: Set<string>;
    discoveryPlan: DiscoveryPlan | null;
    platformFilter: PlatformFilter;
    setPlatformFilter: (filter: PlatformFilter) => void;
    intentFilter: IntentFilter;
    setIntentFilter: (filter: IntentFilter) => void;
    status: string | null;
    search: (query: string) => Promise<void>;
    ideaSearch: (idea: string, communities?: string[], competitors?: string[]) => Promise<void>;
    importUrls: (urls: string[]) => Promise<void>;
    enrichResult: (id: string, url: string, source: string) => Promise<void>;
    toggleSelection: (id: string) => void;
    selectAllVisible: () => void;
    unselectAllVisible: () => void;
    clearResults: () => void;
    setSelectedIds: (ids: Set<string>) => void;
    detectedIntent: { persona: string; pain: string; domain: string } | null;
    showSelectedOnly: boolean;
    setShowSelectedOnly: (show: boolean) => void;
    history: DiscoveryHistoryEntry[];
    historyLoading: boolean;
    fetchHistory: () => Promise<void>;
    deleteHistoryItem: (id: string) => Promise<void>;
    saveSelection: (folderId: string, folderName: string) => Promise<void>;
    lastSyncInfo: { count: number, folderName: string, folderId: string } | null;
    setLastSyncInfo: (info: { count: number, folderName: string, folderId: string } | null) => void;
}

const DiscoveryContext = createContext<DiscoveryContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const DiscoveryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const discovery = useImplementationHook();
    
    return (
        <DiscoveryContext.Provider value={discovery}>
            {children}
        </DiscoveryContext.Provider>
    );
};

export const useDiscoveryContext = () => {
    const context = useContext(DiscoveryContext);
    if (context === undefined) {
        throw new Error('useDiscoveryContext must be used within a DiscoveryProvider');
    }
    return context;
};
