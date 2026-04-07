import { useState } from 'react';
import { Shield, Users, BarChart3, Ticket, Clock, Activity, Brain } from 'lucide-react';
import { AdminOverview } from './AdminOverview';
import { AdminUserTable } from './AdminUserTable';
import { AdminTokenManager } from './AdminTokenManager';
import { AdminWaitlist } from './AdminWaitlist';
import { AdminQueues } from './AdminQueues';
import { AdminLeads } from './AdminLeads';
import { AdminTester } from './AdminTester';
import { PageHeader } from '../common/PageHeader';
import { Subtitle } from '../common/Typography';

type Tab = 'overview' | 'users' | 'tokens' | 'waitlist' | 'queues' | 'leads' | 'sandbox';

export function AdminPortal() {
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'leads', label: 'Leads', icon: Activity },
        { id: 'sandbox', label: 'AI Sandbox', icon: Brain },
        { id: 'tokens', label: 'Beta Tokens', icon: Ticket },
        { id: 'waitlist', label: 'Waitlist', icon: Clock },
        { id: 'queues', label: 'Queues', icon: BarChart3 },
    ];

    return (
        <div className="admin-portal" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ marginBottom: '32px' }}>
                <PageHeader 
                    title="Command Center" 
                    subtitle="Platform Management" 
                    icon={<Shield size={22} className="text-white" />}
                />
                <Subtitle className="mt-4">Overview and management of the OpinionDeck platform.</Subtitle>
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
                {activeTab === 'leads' && <AdminLeads />}
                {activeTab === 'tokens' && <AdminTokenManager />}
                {activeTab === 'waitlist' && <AdminWaitlist />}
                {activeTab === 'queues' && <AdminQueues />}
                {activeTab === 'sandbox' && <AdminTester />}
            </div>
        </div>
    );
}
