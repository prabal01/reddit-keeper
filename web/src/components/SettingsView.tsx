import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PricingPage } from './PricingPage';
import { PageHeader } from './common/PageHeader';
import { Badge } from './common/Badge';
import { Metadata, H2 } from './common/Typography';

export const SettingsView: React.FC = () => {
    const { user, plan } = useAuth();

    return (
        <div className="dashboard-home px-4 py-4 md:px-8 md:py-6">
            <PageHeader 
                title="Settings" 
                subtitle="Manage your account, preferences, and workspace limits." 
            />

            <div className="settings-section bg-(--bg-secondary) p-5 md:p-8 rounded-2xl border border-(--border-light) mb-8 shadow-sm">
                <H2 className="mb-6">Account Profile</H2>
                <div className="grid gap-8">
                    <div className="flex flex-col gap-2">
                        <Metadata className="text-(--text-tertiary)">Email Address</Metadata>
                        <div className="text-lg font-bold text-(--text-primary)">{user?.email}</div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        <Metadata className="text-(--text-tertiary)">Membership Tier</Metadata>
                        <div className="flex items-center gap-3">
                            <Badge variant={plan === 'pro' || plan === 'beta' ? 'premium' : 'neutral'}>
                                {plan === 'pro' ? 'Founding Member' : plan === 'beta' ? 'Beta Member' : 'Free Plan'}
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>

            {plan !== 'pro' && (
                <div className="settings-section mt-12">
                    <H2 className="mb-6 px-1">Founding Member Program</H2>
                    <PricingPage />
                </div>
            )}
        </div>
    );
};
