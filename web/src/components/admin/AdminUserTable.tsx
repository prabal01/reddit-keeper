import { useEffect, useState } from 'react';
import { API_BASE, getAuthToken } from '../../lib/api';
import { Loader2, User, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export function AdminUserTable() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingPlanRef, setUpdatingPlanRef] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const token = await getAuthToken();
            const res = await fetch(`${API_BASE}/admin/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to fetch users");
            const data = await res.json();
            setUsers(data);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePlanChange = async (uid: string, newPlan: string) => {
        setUpdatingPlanRef(uid);
        try {
            const token = await getAuthToken();
            const res = await fetch(`${API_BASE}/admin/users/${uid}/plan`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ plan: newPlan })
            });
            if (!res.ok) throw new Error("Failed to update plan");
            toast.success("User plan updated!");
            await fetchUsers(); // Refresh
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setUpdatingPlanRef(null);
        }
    };

    const filteredUsers = users.filter(u => 
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.uid?.includes(searchTerm)
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '700', margin: 0 }}>User Management</h2>
                <div style={{ position: 'relative', width: '300px' }}>
                    <Search size={18} color="#8e92a4" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                        type="text" 
                        placeholder="Search by email or UID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 16px 12px 42px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            color: 'white',
                            fontSize: '0.9rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>
            </div>

            <div className="custom-scrollbar" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', overflowY: 'auto', overflowX: 'auto', maxHeight: '600px' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}><Loader2 className="animate-spin" size={24} color="#8e92a4" style={{ margin: '0 auto' }} /></div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)', color: '#8e92a4', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, zIndex: 10 }}>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>User</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Joined</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Plan</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Analyses</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#8e92a4' }}>
                                        No users found.
                                    </td>
                                </tr>
                            ) : filteredUsers.map(user => (
                                <tr key={user.uid} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <User size={16} />
                                            </div>
                                            <div>
                                                <div style={{ color: 'white', fontWeight: '600', marginBottom: '2px' }}>{user.email || 'No Email'}</div>
                                                <div style={{ color: '#8e92a4', fontSize: '0.75rem', fontFamily: 'monospace' }}>{user.uid}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#8e92a4' }}>
                                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <span style={{ 
                                            padding: '4px 10px', 
                                            borderRadius: '8px', 
                                            fontSize: '0.75rem', 
                                            fontWeight: '700', 
                                            textTransform: 'uppercase',
                                            background: user.plan === 'pro' ? 'rgba(34,197,94,0.1)' : user.plan === 'beta' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.05)',
                                            color: user.plan === 'pro' ? '#22c55e' : user.plan === 'beta' ? '#3b82f6' : '#8e92a4'
                                        }}>
                                            {user.plan || 'free'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 24px', color: 'white', fontWeight: '500' }}>
                                        {user.analysisCount || 0}
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <select 
                                                disabled={updatingPlanRef === user.uid}
                                                value={user.plan || 'free'}
                                                onChange={(e) => handlePlanChange(user.uid, e.target.value)}
                                                style={{
                                                    background: 'rgba(255,255,255,0.05)',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    color: 'white',
                                                    padding: '6px 12px',
                                                    borderRadius: '8px',
                                                    fontSize: '0.8rem',
                                                    outline: 'none',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <option value="free">Free</option>
                                                <option value="beta">Beta</option>
                                                <option value="pro">Pro</option>
                                                <option value="past_due">Past Due</option>
                                            </select>
                                            {updatingPlanRef === user.uid && <Loader2 className="animate-spin" size={16} color="#8e92a4" style={{ alignSelf: 'center' }} />}
                                        </div>
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
