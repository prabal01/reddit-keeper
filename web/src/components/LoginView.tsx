import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthButton } from './AuthButton';
import { BRANDING } from '../constants/branding';
import { FileText, Search, Zap } from 'lucide-react';

export function LoginView() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user && !loading) {
            navigate('/');
        }
    }, [user, loading, navigate]);

    return (
        <div className="login-container" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
            {/* Left Panel - Brand & Value Props (Hidden on Mobile) */}
            <div className="login-brand-panel" style={{
                flex: 1,
                background: 'linear-gradient(135deg, #0f0f17 0%, #1a1a2e 100%)',
                color: 'white',
                padding: '60px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Abstract Background Element */}
                <div style={{
                    position: 'absolute',
                    top: '-10%',
                    right: '-10%',
                    width: '400px',
                    height: '400px',
                    background: 'radial-gradient(circle, rgba(255,69,0,0.15) 0%, rgba(255,69,0,0) 70%)',
                    borderRadius: '50%',
                    pointerEvents: 'none'
                }} />

                <div style={{ position: 'relative', zIndex: 10, maxWidth: '500px', margin: '0 auto' }}>
                    <div className="brand-header" style={{ marginBottom: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                            <img src="/logo.svg" alt={BRANDING.NAME} style={{ width: '48px', height: '48px' }} />
                            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.02em', margin: 0 }}>
                                {BRANDING.NAME}
                            </h1>
                        </div>
                        <p style={{ fontSize: '1.25rem', color: '#a0a0b8', lineHeight: '1.6', fontWeight: '500' }}>
                            {BRANDING.TAGLINE}
                        </p>
                    </div>

                    <div className="value-props" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                            <div style={{ background: 'rgba(255,69,0,0.2)', padding: '10px', borderRadius: '12px' }}>
                                <Zap size={24} color="#ff4500" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '4px' }}>Instant Intelligence</h3>
                                <p style={{ color: '#8e92a4', fontSize: '0.95rem' }}>Extract insights from Reddit, Twitter (X), HackerNews, and G2 (Coming Soon) in seconds.</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                            <div style={{ background: 'rgba(34,197,94,0.2)', padding: '10px', borderRadius: '12px' }}>
                                <Search size={24} color="#22c55e" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '4px' }}>Deep User Insights</h3>
                                <p style={{ color: '#8e92a4', fontSize: '0.95rem' }}>Uncover hidden user motivations, pain points, and product feedback.</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                            <div style={{ background: 'rgba(59,130,246,0.2)', padding: '10px', borderRadius: '12px' }}>
                                <FileText size={24} color="#3b82f6" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '4px' }}>Actionable Reports</h3>
                                <p style={{ color: '#8e92a4', fontSize: '0.95rem' }}>Turn thousands of unstructured comments into clear, strategy-ready documents.</p>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '60px', paddingTop: '30px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <p style={{ color: '#6e6e88', fontSize: '0.9rem', fontStyle: 'italic' }}>
                            "The most powerful tool for community research I've used."
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Panel - Auth Form */}
            <div className="login-form-panel" style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px',
                background: 'var(--bg-secondary)',
                position: 'relative'
            }}>
                <div style={{ width: '100%', maxWidth: '420px' }}>
                    <div className="mobile-brand" style={{ textAlign: 'center', marginBottom: '40px', display: 'none' }}>
                        <img src="/logo.svg" alt={BRANDING.NAME} style={{ width: '48px', height: '48px', margin: '0 auto 16px' }} />
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>{BRANDING.NAME}</h2>
                    </div>

                    <div className="auth-card-wrapper" style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>
                            Welcome Back
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                            Sign in to continue to your dashboard
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
                            <AuthButton />
                        </div>

                        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', lineHeight: '1.5' }}>
                            By signing in, you agree to our <a href="#" style={{ color: 'var(--text-link)' }}>Terms of Service</a> and <a href="#" style={{ color: 'var(--text-link)' }}>Privacy Policy</a>.
                        </p>
                    </div>
                </div>

                <div style={{ position: 'absolute', bottom: '24px', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                    &copy; {new Date().getFullYear()} {BRANDING.COMPANY_NAME}. All rights reserved.
                </div>
            </div>
        </div>
    );
}
