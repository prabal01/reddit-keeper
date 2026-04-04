import { useEffect, useState } from 'react';
import { API_BASE, getAuthToken } from '../../lib/api';
import { Loader2, ExternalLink, User, MessageSquare, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface MarketingLead {
    id: string;
    username: string;
    threadUrl: string;
    commentText: string;
    intensityScore: number;
    analysis: string;
    contextBio: string;
    status: 'new' | 'contacted' | 'ignore';
    createdAt: string;
}

export function AdminLeads() {
    const [leads, setLeads] = useState<MarketingLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingRef, setUpdatingRef] = useState<string | null>(null);

    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const token = await getAuthToken();
            const res = await fetch(`${API_BASE}/admin/marketing/leads`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to fetch marketing leads");
            const data = await res.json();
            setLeads(data);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        setUpdatingRef(id);
        try {
            const token = await getAuthToken();
            const res = await fetch(`${API_BASE}/admin/marketing/leads/${id}/status`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) throw new Error("Failed to update lead status");
            toast.success("Lead status updated!");
            setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus as any } : l));
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setUpdatingRef(null);
        }
    };

    if (loading) {
        return <div style={{ padding: '60px', textAlign: 'center' }}><Loader2 className="animate-spin" size={24} color="#8e92a4" style={{ margin: '0 auto' }} /></div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '700', margin: 0 }}>Lead Command Center</h2>
                <div style={{ color: '#8e92a4', fontSize: '0.9rem' }}>
                    {leads.length} high-intent targets identified via +1 Method
                </div>
            </div>

            <div className="custom-scrollbar" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', overflowY: 'auto', maxHeight: '700px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', color: '#8e92a4', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, zIndex: 10 }}>
                            <th style={{ padding: '16px 24px', fontWeight: '600' }}>Target User</th>
                            <th style={{ padding: '16px 24px', fontWeight: '600' }}>Intelligence</th>
                            <th style={{ padding: '16px 24px', fontWeight: '600' }}>Intensity</th>
                            <th style={{ padding: '16px 24px', fontWeight: '600' }}>Status</th>
                            <th style={{ padding: '16px 24px', fontWeight: '600' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leads.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#8e92a4' }}>
                                    No marketing leads found. Start analyzing threads in Telegram!
                                </td>
                            </tr>
                        ) : leads.map(lead => (
                            <tr key={lead.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background 0.2s' }}>
                                <td style={{ padding: '16px 24px', verticalAlign: 'top' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,69,0,0.1)', color: '#ff4500', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <User size={16} />
                                        </div>
                                        <div>
                                            <div style={{ color: 'white', fontWeight: '600', marginBottom: '4px' }}>u/{lead.username}</div>
                                            <a 
                                                href={`https://reddit.com/u/${lead.username}`} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                style={{ color: '#3b82f6', fontSize: '0.75rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                View Profile <ExternalLink size={10} />
                                            </a>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '16px 24px', maxWidth: '400px' }}>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                        <MessageSquare size={14} color="#8e92a4" style={{ flexShrink: 0, marginTop: '2px' }} />
                                        <div style={{ color: '#d1d5db', fontSize: '0.85rem', lineHeight: '1.5' }}>
                                            {lead.contextBio || lead.commentText}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#8e92a4', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: '2px solid #ff4500' }}>
                                        <span style={{ fontWeight: '600', color: '#ff4500' }}>Analysis:</span> {lead.analysis}
                                    </div>
                                </td>
                                <td style={{ padding: '16px 24px' }}>
                                    <div style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '6px',
                                        padding: '4px 10px',
                                        borderRadius: '20px',
                                        background: lead.intensityScore >= 8 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                                        color: lead.intensityScore >= 8 ? '#ef4444' : '#f59e0b',
                                        fontSize: '0.75rem',
                                        fontWeight: '700'
                                    }}>
                                        <AlertCircle size={12} />
                                        {lead.intensityScore}/10
                                    </div>
                                    <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#8e92a4' }}>
                                        {new Date(lead.createdAt).toLocaleDateString()}
                                    </div>
                                </td>
                                <td style={{ padding: '16px 24px' }}>
                                    <span style={{ 
                                        padding: '4px 10px', 
                                        borderRadius: '8px', 
                                        fontSize: '0.75rem', 
                                        fontWeight: '700', 
                                        textTransform: 'uppercase',
                                        background: 
                                            lead.status === 'contacted' ? 'rgba(34,197,94,0.1)' : 
                                            lead.status === 'ignore' ? 'rgba(255,255,255,0.05)' : 
                                            'rgba(59,130,246,0.1)',
                                        color: 
                                            lead.status === 'contacted' ? '#22c55e' : 
                                            lead.status === 'ignore' ? '#8e92a4' : 
                                            '#3b82f6'
                                    }}>
                                        {lead.status}
                                    </span>
                                </td>
                                <td style={{ padding: '16px 24px' }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            onClick={() => handleStatusChange(lead.id, 'contacted')}
                                            disabled={updatingRef === lead.id || lead.status === 'contacted'}
                                            title="Mark as Contacted"
                                            style={{ 
                                                background: 'rgba(34,197,94,0.1)', 
                                                border: '1px solid rgba(34,197,94,0.2)', 
                                                color: '#22c55e', 
                                                padding: '6px', 
                                                borderRadius: '8px', 
                                                cursor: 'pointer',
                                                opacity: lead.status === 'contacted' ? 0.5 : 1
                                            }}
                                        >
                                            <CheckCircle size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleStatusChange(lead.id, 'ignore')}
                                            disabled={updatingRef === lead.id || lead.status === 'ignore'}
                                            title="Archive/Ignore"
                                            style={{ 
                                                background: 'rgba(239,68,68,0.1)', 
                                                border: '1px solid rgba(239,68,68,0.2)', 
                                                color: '#ef4444', 
                                                padding: '6px', 
                                                borderRadius: '8px', 
                                                cursor: 'pointer',
                                                opacity: lead.status === 'ignore' ? 0.5 : 1
                                            }}
                                        >
                                            <XCircle size={16} />
                                        </button>
                                        <a 
                                            href={lead.threadUrl} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            title="View Original Thread"
                                            style={{ 
                                                background: 'rgba(255,255,255,0.05)', 
                                                border: '1px solid rgba(255,255,255,0.1)', 
                                                color: '#8e92a4', 
                                                padding: '6px', 
                                                borderRadius: '8px', 
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <ExternalLink size={16} />
                                        </a>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
