import React, { useState, useEffect, useMemo } from 'react';
import {
    Trash2,
    Download,
    Filter,
    CheckCircle2,
    FileText,
    Users,
    TrendingUp,
    Loader2,
    Search,
    ChevronLeft,
    ChevronRight,
    FolderOpen
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface Lead {
    id: string;
    postId: string;
    postTitle: string;
    postSubreddit: string;
    postAuthor: string;
    postUrl: string;
    relevanceScore: number;
    status: 'new' | 'saved' | 'hidden' | 'dismissed';
    createdAt: number;
    matchedAt: string;
    folderId?: string;
    folderName?: string;
}

interface FolderOption {
    id: string;
    name: string;
}

const ITEMS_PER_PAGE = 25;

export const LeadsManagement: React.FC = () => {
    const { user, getIdToken } = useAuth();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [folders, setFolders] = useState<FolderOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'saved' | 'hidden' | 'dismissed'>('all');
    const [folderFilter, setFolderFilter] = useState<string>('all');
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [bulkUpdating, setBulkUpdating] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const token = await getIdToken();
            const headers = { 'Authorization': `Bearer ${token}` };

            const [oppRes, foldersRes] = await Promise.all([
                fetch('/api/monitoring/opportunities', { headers }),
                fetch('/api/folders', { headers })
            ]);

            const oppData = await oppRes.json();
            const foldersData = await foldersRes.json();

            const folderList: FolderOption[] = Array.isArray(foldersData)
                ? foldersData.map((f: any) => ({ id: f.id, name: f.name }))
                : [];
            setFolders(folderList);

            // Tag monitoring opportunities with a synthetic folder
            const monitoringLeads: Lead[] = (Array.isArray(oppData) ? oppData : []).map((l: any) => ({
                ...l,
                folderId: 'monitoring',
                folderName: 'Monitoring'
            }));

            // Fetch leads from monitoring-active folders
            const activeFolders = Array.isArray(foldersData)
                ? foldersData.filter((f: any) => f.is_monitoring_active)
                : [];

            const folderLeadArrays = await Promise.all(
                activeFolders.map((folder: any) =>
                    fetch(`/api/folders/${folder.id}/leads`, { headers })
                        .then(r => r.ok ? r.json() : [])
                        .catch(() => [])
                )
            );

            const existingIds = new Set(monitoringLeads.map(l => l.id));
            const folderLeads: Lead[] = folderLeadArrays.flatMap((arr: any[], idx: number) => {
                const folder = activeFolders[idx];
                return (Array.isArray(arr) ? arr : []).flatMap((fl: any) => {
                    if (existingIds.has(fl.id)) return [];
                    return [{
                        id: fl.id,
                        postId: fl.thread_id || fl.id,
                        postTitle: fl.thread_title || 'Unknown Thread',
                        postSubreddit: fl.subreddit || '',
                        postAuthor: fl.author || '',
                        postUrl: fl.thread_url || '#',
                        relevanceScore: fl.relevance_score || 50,
                        status: (fl.status === 'contacted' ? 'saved' : fl.status === 'ignored' ? 'dismissed' : 'new') as Lead['status'],
                        createdAt: fl.saved_at ? Math.floor(new Date(fl.saved_at).getTime() / 1000) : Math.floor(Date.now() / 1000),
                        matchedAt: fl.saved_at || new Date().toISOString(),
                        folderId: folder.id,
                        folderName: folder.name
                    }];
                });
            });

            setLeads([...monitoringLeads, ...folderLeads]);
        } catch (err) {
            console.error('Failed to fetch leads', err);
            setLeads([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchLeads();
    }, [user]);

    // Reset page when filters change
    useEffect(() => { setCurrentPage(0); }, [searchQuery, statusFilter, folderFilter]);

    const filteredLeads = useMemo(() => {
        let filtered = [...leads];
        if (folderFilter !== 'all') filtered = filtered.filter(l => l.folderId === folderFilter);
        if (statusFilter !== 'all') filtered = filtered.filter(l => l.status === statusFilter);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(l =>
                l.postTitle.toLowerCase().includes(q) ||
                l.postAuthor.toLowerCase().includes(q) ||
                l.postSubreddit.toLowerCase().includes(q)
            );
        }
        return filtered;
    }, [leads, folderFilter, statusFilter, searchQuery]);

    const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
    const pagedLeads = filteredLeads.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

    const handleSelectAll = () => {
        if (selectedLeads.size === pagedLeads.length) {
            setSelectedLeads(new Set());
        } else {
            setSelectedLeads(new Set(pagedLeads.map(l => l.id)));
        }
    };

    const handleSelectLead = (leadId: string) => {
        const next = new Set(selectedLeads);
        next.has(leadId) ? next.delete(leadId) : next.add(leadId);
        setSelectedLeads(next);
    };

    const handleBulkStatusUpdate = async (newStatus: Lead['status']) => {
        if (selectedLeads.size === 0) return;
        setBulkUpdating(true);
        try {
            const token = await getIdToken();
            await fetch('/api/monitoring/opportunities/bulk/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ ids: Array.from(selectedLeads), status: newStatus })
            });
            setLeads(prev => prev.map(l => selectedLeads.has(l.id) ? { ...l, status: newStatus } : l));
            setSelectedLeads(new Set());
        } catch (err) {
            console.error('Failed to update leads', err);
        } finally {
            setBulkUpdating(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedLeads.size === 0 || !confirm(`Delete ${selectedLeads.size} lead(s)?`)) return;
        setBulkDeleting(true);
        try {
            const token = await getIdToken();
            await fetch('/api/monitoring/opportunities/bulk', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ ids: Array.from(selectedLeads) })
            });
            setLeads(prev => prev.filter(l => !selectedLeads.has(l.id)));
            setSelectedLeads(new Set());
        } catch (err) {
            console.error('Failed to delete leads', err);
        } finally {
            setBulkDeleting(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const token = await getIdToken();
            const res = await fetch('/api/monitoring/opportunities/export/csv', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error('Failed to export leads', err);
        } finally {
            setExporting(false);
        }
    };

    const getStatusBadgeColor = (status: Lead['status']) => {
        switch (status) {
            case 'new': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
            case 'saved': return 'bg-green-500/20 text-green-300 border-green-500/30';
            case 'hidden': return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
            case 'dismissed': return 'bg-red-500/20 text-red-300 border-red-500/30';
        }
    };

    if (loading && !leads.length) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 size={32} className="text-orange-400 animate-spin" />
                <p className="text-zinc-400 text-sm font-medium">Loading leads...</p>
            </div>
        );
    }

    const hasSelection = selectedLeads.size > 0;

    // Build folder options for filter
    const folderOptions: { id: string; name: string }[] = [
        { id: 'monitoring', name: 'Monitoring' },
        ...folders.filter(f => leads.some(l => l.folderId === f.id))
    ];

    return (
        <div className="leads-management-container max-w-6xl mx-auto py-10 px-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 pb-8 border-b border-white/5">
                <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 border border-orange-500/20">
                        <Users size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight">Leads Vault</h1>
                        <p className="text-zinc-600 font-medium mt-1">{leads.length} total leads</p>
                    </div>
                </div>
                <button
                    onClick={handleExport}
                    disabled={leads.length === 0 || exporting}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-white/5 disabled:opacity-50"
                >
                    {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                    Export CSV
                </button>
            </div>

            {/* Newest 200 notice */}
            {leads.length >= 200 && (
                <div className="mb-4 px-4 py-2 bg-zinc-900 border border-white/5 rounded-lg flex items-center justify-between text-xs text-zinc-500">
                    <span>Showing newest 200 leads</span>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="text-orange-400 hover:text-orange-300 font-semibold transition-colors"
                    >
                        Export CSV for full history →
                    </button>
                </div>
            )}

            {/* Filters */}
            <div className="mb-6 flex flex-col gap-3">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                    <input
                        type="text"
                        placeholder="Search by title, author, or subreddit..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-900 border border-white/5 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
                    />
                </div>

                {/* Filter row */}
                <div className="flex items-center gap-4 flex-wrap">
                    {/* Project/Folder filter */}
                    <div className="flex items-center gap-2">
                        <FolderOpen size={12} className="text-zinc-600" />
                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Project</span>
                        <select
                            value={folderFilter}
                            onChange={(e) => setFolderFilter(e.target.value)}
                            className="bg-zinc-900 border border-white/10 rounded-md px-2 py-1 text-[11px] font-semibold text-zinc-300 focus:outline-none focus:border-orange-500/50"
                        >
                            <option value="all">All Projects</option>
                            {folderOptions.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status filter */}
                    <div className="flex items-center gap-2">
                        <Filter size={12} className="text-zinc-600" />
                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Status</span>
                        <div className="flex gap-1">
                            {(['all', 'new', 'saved', 'hidden', 'dismissed'] as const).map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border transition-all ${
                                        statusFilter === status
                                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                                            : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
                                    }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bulk Actions */}
            {hasSelection && (
                <div className="mb-4 p-4 bg-orange-500/5 border border-orange-500/20 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-orange-300">{selectedLeads.size} lead{selectedLeads.size !== 1 ? 's' : ''} selected</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleBulkStatusUpdate('saved')}
                            disabled={bulkUpdating}
                            className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded text-[10px] font-bold transition-colors disabled:opacity-50"
                        >
                            {bulkUpdating ? <Loader2 size={12} className="inline animate-spin mr-1" /> : '✓'} Mark Saved
                        </button>
                        <button
                            onClick={() => handleBulkStatusUpdate('dismissed')}
                            disabled={bulkUpdating}
                            className="px-3 py-1.5 bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 rounded text-[10px] font-bold transition-colors disabled:opacity-50"
                        >
                            Dismiss
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            disabled={bulkDeleting}
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded text-[10px] font-bold transition-colors disabled:opacity-50"
                        >
                            {bulkDeleting ? <Loader2 size={12} className="inline animate-spin mr-1" /> : <Trash2 size={12} className="inline mr-1" />}
                            Delete
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            {filteredLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 bg-white/2 rounded-xl border border-white/5">
                    <FileText size={32} className="text-zinc-600 mb-4" />
                    <h3 className="text-zinc-400 font-semibold mb-1">No leads found</h3>
                    <p className="text-zinc-600 text-sm">
                        {searchQuery ? 'Try adjusting your search' : 'Your leads will appear here once monitoring discovers them'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="text-left px-4 py-3 w-8">
                                        <input
                                            type="checkbox"
                                            checked={selectedLeads.size === pagedLeads.length && pagedLeads.length > 0}
                                            onChange={handleSelectAll}
                                            className="w-4 h-4 rounded border-white/20 bg-white/5 accent-orange-500"
                                        />
                                    </th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Author</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Thread</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Subreddit</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Project</th>
                                    <th className="text-center px-4 py-3 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Score</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Status</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Date</th>
                                    <th className="text-center px-4 py-3 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Link</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedLeads.map((lead) => (
                                    <tr key={lead.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedLeads.has(lead.id)}
                                                onChange={() => handleSelectLead(lead.id)}
                                                className="w-4 h-4 rounded border-white/20 bg-white/5 accent-orange-500"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            {lead.postAuthor && lead.postAuthor !== 'unknown' ? (
                                                <a
                                                    href={`https://reddit.com/u/${lead.postAuthor}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-orange-400 hover:text-orange-300 font-semibold"
                                                >
                                                    u/{lead.postAuthor}
                                                </a>
                                            ) : (
                                                <span className="text-zinc-600 text-xs italic">unknown</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 max-w-xs">
                                            <a
                                                href={lead.postUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-zinc-300 hover:text-white truncate block text-xs"
                                                title={lead.postTitle}
                                            >
                                                {lead.postTitle.substring(0, 60)}{lead.postTitle.length > 60 ? '...' : ''}
                                            </a>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-400 text-xs">
                                            {lead.postSubreddit ? `r/${lead.postSubreddit}` : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[10px] font-semibold text-zinc-500 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                                                {lead.folderName || 'Monitoring'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-orange-400 font-bold text-xs">{lead.relevanceScore}%</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadgeColor(lead.status)}`}>
                                                {lead.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-500 text-xs">
                                            {lead.createdAt
                                                ? formatDistanceToNow(new Date(lead.createdAt * 1000), { addSuffix: true })
                                                : lead.matchedAt
                                                    ? formatDistanceToNow(new Date(lead.matchedAt), { addSuffix: true })
                                                    : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <a
                                                href={lead.postUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-orange-400 hover:text-orange-300 transition-colors"
                                            >
                                                →
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                            <span className="text-xs text-zinc-500">
                                Showing {currentPage * ITEMS_PER_PAGE + 1}–{Math.min((currentPage + 1) * ITEMS_PER_PAGE, filteredLeads.length)} of {filteredLeads.length}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                                    disabled={currentPage === 0}
                                    className="p-1.5 rounded bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                                    const page = totalPages <= 7 ? i : (
                                        currentPage < 4 ? i :
                                        currentPage > totalPages - 4 ? totalPages - 7 + i :
                                        currentPage - 3 + i
                                    );
                                    return (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`min-w-[28px] h-7 rounded text-[11px] font-semibold border transition-colors ${
                                                page === currentPage
                                                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                                                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                                            }`}
                                        >
                                            {page + 1}
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={currentPage === totalPages - 1}
                                    className="p-1.5 rounded bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Footer Stats */}
            {leads.length > 0 && (
                <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4 pt-8 border-t border-white/5">
                    <div className="p-4 bg-white/2 rounded-lg border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Total</span>
                            <Users size={14} className="text-orange-500" />
                        </div>
                        <span className="text-2xl font-black text-white">{leads.length}</span>
                    </div>
                    <div className="p-4 bg-white/2 rounded-lg border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">New</span>
                            <FileText size={14} className="text-orange-400" />
                        </div>
                        <span className="text-2xl font-black text-white">{leads.filter(l => l.status === 'new').length}</span>
                    </div>
                    <div className="p-4 bg-white/2 rounded-lg border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Saved</span>
                            <CheckCircle2 size={14} className="text-orange-400" />
                        </div>
                        <span className="text-2xl font-black text-white">{leads.filter(l => l.status === 'saved').length}</span>
                    </div>
                    <div className="p-4 bg-white/2 rounded-lg border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Avg Score</span>
                            <TrendingUp size={14} className="text-orange-400" />
                        </div>
                        <span className="text-2xl font-black text-white">
                            {leads.length > 0
                                ? Math.round(leads.reduce((sum, l) => sum + l.relevanceScore, 0) / leads.length)
                                : 0}%
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
