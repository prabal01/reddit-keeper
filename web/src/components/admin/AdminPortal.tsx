import React, { useState } from 'react';
import { Shield, Users, BarChart3, Ticket, Clock, Activity } from 'lucide-react';
import { AdminOverview } from './AdminOverview';
import { AdminUserTable } from './AdminUserTable';
import { AdminTokenManager } from './AdminTokenManager';
import { AdminWaitlist } from './AdminWaitlist';
import { AdminQueues } from './AdminQueues'; // Future, or stub it for now

type Tab = 'overview' | 'users' | 'tokens' | 'waitlist' | 'queues';

export function AdminPortal() {
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'tokens', label: 'Beta Tokens', icon: Ticket },
        { id: 'waitlist', label: 'Waitlist', icon: Clock },
        { id: 'queues', label: 'Queues', icon: Activity },
    ];

    return (
        <div className="admin-portal" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <Shield size={28} color="#ff4500" />
                    <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: 0 }}>Command Center</h1>
                </div>
                <p style={{ color: '#8e92a4', fontSize: '1rem', margin: 0 }}>Overview and management of the OpinionDeck platform.</p>
            </div>

            {/* Tabs Navigation */}
            <div style={{ 
                display: 'flex', 
                gap: '8px', 
                marginBottom: '32px', 
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                paddingBottom: '1px' 
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 20px',
                            background: activeTab === tab.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                            border: 'none',
                            borderTopLeftRadius: '12px',
                            borderTopRightRadius: '12px',
                            borderBottom: activeTab === tab.id ? '2px solid #ff4500' : '2px solid transparent',
                            color: activeTab === tab.id ? 'white' : '#8e92a4',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            fontWeight: activeTab === tab.id ? '600' : '500',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => { if (activeTab !== tab.id) e.currentTarget.style.color = 'white'; }}
                        onMouseOut={(e) => { if (activeTab !== tab.id) e.currentTarget.style.color = '#8e92a4'; }}
                    >
                        <tab.icon size={18} color={activeTab === tab.id ? "#ff4500" : "currentColor"} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="admin-content-area" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', padding: '32px', minHeight: '500px' }}>
                {activeTab === 'overview' && <AdminOverview />}
                {activeTab === 'users' && <AdminUserTable />}
                {activeTab === 'tokens' && <AdminTokenManager />}
                {activeTab === 'waitlist' && <AdminWaitlist />}
                {activeTab === 'queues' && <AdminQueues />}
            </div>
        </div>
    );
}
