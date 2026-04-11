import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react';
import { BRANDING } from '../constants/branding';
import { toast } from 'react-hot-toast';

export function VerificationGate() {
    const { user, sendVerificationEmail, refreshUser, signOut } = useAuth();
    const [isSending, setIsSending] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [countdown, setCountdown] = useState(30); // Start with 30s wait on first load

    useEffect(() => {
        // Auto-refresh every 5 seconds to check if they verified
        const interval = setInterval(() => {
            refreshUser();
        }, 15000); // Increased from 5s to 15s to stay well within rate limits
        return () => clearInterval(interval);
    }, [refreshUser]);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleResend = async () => {
        if (countdown > 0) return;
        setIsSending(true);
        try {
            await sendVerificationEmail();
            toast.success("Verification email sent!");
            setCountdown(60); // 60 second cooldown after manual resend
        } catch (err: any) {
            toast.error(err.message || "Failed to send email");
        } finally {
            setIsSending(false);
        }
    };

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        const updatedUser = await refreshUser();
        setIsRefreshing(false);
        
        if (updatedUser?.emailVerified) {
            toast.success("Email verified! Redirecting...");
        } else {
            toast.error("We couldn't confirm your verification yet. Please check your inbox (and spam) for the link.", {
                duration: 5000,
                icon: '✉️'
            });
        }
    };

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: '#0b0b12', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background Decorations */}
            <div style={{
                position: 'absolute',
                top: '10%',
                left: '10%',
                width: '400px',
                height: '400px',
                background: 'radial-gradient(circle, rgba(255,69,0,0.05) 0%, rgba(255,69,0,0) 70%)',
                borderRadius: '50%',
                zIndex: 0
            }} />

            <div className="verification-card" style={{
                maxWidth: '480px',
                width: '100%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '32px',
                padding: 'clamp(24px, 5vw, 48px)',
                textAlign: 'center',
                position: 'relative',
                zIndex: 1,
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
            }}>
                <div style={{ 
                    background: 'rgba(255,69,0,0.1)', 
                    width: '80px', 
                    height: '80px', 
                    borderRadius: '24px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    margin: '0 auto 32px',
                    border: '1px solid rgba(255,69,0,0.2)'
                }}>
                    <Mail size={40} color="#ff4500" />
                </div>

                <h1 style={{ color: 'white', fontSize: '2rem', fontWeight: '850', marginBottom: '16px', letterSpacing: '-0.02em' }}>
                    Verify your email
                </h1>
                
                <p style={{ color: '#8e92a4', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '40px' }}>
                    We've sent a verification link to <strong style={{ color: 'white' }}>{user?.email}</strong>. 
                    Please click it to activate your {BRANDING.NAME} account.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <button
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: 'white',
                            color: '#0b0b12',
                            border: 'none',
                            borderRadius: '16px',
                            fontWeight: '800',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            transition: 'all 0.2s'
                        }}
                    >
                        {isRefreshing ? <RefreshCw className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                        I've Verified My Email
                    </button>

                    <button
                        onClick={handleResend}
                        disabled={isSending || countdown > 0}
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: 'rgba(255,255,255,0.04)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '16px',
                            fontWeight: '700',
                            fontSize: '0.95rem',
                            cursor: countdown > 0 ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            opacity: countdown > 0 ? 0.5 : 1
                        }}
                    >
                        <RefreshCw size={18} className={isSending ? "animate-spin" : ""} />
                        {countdown > 0 ? `Resend in ${countdown}s` : "Resend Email"}
                    </button>
                </div>

                <div style={{ marginTop: '48px', paddingTop: '32px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', gap: '32px' }}>
                    <button
                        onClick={() => signOut()}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#52526b',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>

            </div>
        </div>
    );
}
