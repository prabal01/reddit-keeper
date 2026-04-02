import React, { useEffect, useState } from 'react';
import { API_BASE, getAuthToken } from '../../lib/api';
import { Loader2, Mail, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function AdminWaitlist() {
    const [waitlist, setWaitlist] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    useEffect(() => {
        fetchWaitlist();
    }, []);

    const fetchWaitlist = async () => {
        setLoading(true);
        try {
            const token = await getAuthToken();
            const res = await fetch(`${API_BASE}/admin/waitlist`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to fetch waitlist");
            const data = await res.json();
            setWaitlist(data);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id: string, status: string) => {
        setUpdatingId(id);
        try {
            const token = await getAuthToken();
            const res = await fetch(`${API_BASE}/admin/waitlist/${id}/status`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });
            if (!res.ok) throw new Error("Failed to update status");
            toast.success("Status updated!");
            await fetchWaitlist();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '700', margin: 0 }}>Waitlist Manager</h2>
                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '10px', fontSize: '0.9rem', color: '#8e92a4' }}>
                    Total: <strong style={{ color: 'white' }}>{waitlist.length}</strong>
                </span>
            </div>

            <div className="custom-scrollbar" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', overflowY: 'auto', overflowX: 'auto', maxHeight: '600px' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}><Loader2 className="animate-spin" size={24} color="#8e92a4" style={{ margin: '0 auto' }} /></div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)', color: '#8e92a4', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, zIndex: 10 }}>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Email Address</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Requested At</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Status</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {waitlist.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#8e92a4' }}>
                                        No waitlist requests found.
                                    </td>
                                </tr>
                            ) : waitlist.map(entry => (
                                <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', color: '#a0a0b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Mail size={16} />
                                            </div>
                                            <span style={{ color: 'white', fontWeight: '600' }}>{entry.email}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#8e92a4' }}>
                                        {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : 'Unknown'}
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <span style={{ 
                                            padding: '4px 10px', 
                                            borderRadius: '8px', 
                                            fontSize: '0.75rem', 
                                            fontWeight: '700', 
                                            textTransform: 'uppercase',
                                            background: entry.status === 'invited' ? 'rgba(34,197,94,0.1)' : 'rgba(255,165,0,0.1)',
                                            color: entry.status === 'invited' ? '#22c55e' : '#ffa500'
                                        }}>
                                            {entry.status === 'invited' ? 'Invited' : 'Pending'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        {updatingId === entry.id ? (
                                            <Loader2 className="animate-spin" size={18} color="#8e92a4" />
                                        ) : entry.status === 'pending' ? (
                                            <button 
                                                onClick={() => updateStatus(entry.id, 'invited')}
                                                style={{
                                                    background: 'none',
                                                    border: '1px solid rgba(34,197,94,0.3)',
                                                    color: '#22c55e',
                                                    padding: '6px 12px',
                                                    borderRadius: '8px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}
                                            >
                                                <CheckCircle size={14} /> Mark Invited
                                            </button>
                                        ) : (
                                            <span style={{ color: '#52526b', fontSize: '0.8rem' }}>No actions</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
