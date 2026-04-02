import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthButton } from './AuthButton';
import { API_BASE } from '../lib/api';
import { BRANDING } from '../constants/branding';
import { FileText, Search, Zap, Mail, Lock, Ticket, ArrowRight, Loader2, CheckCircle2, XCircle, Sparkles, Eye, EyeOff, Info } from 'lucide-react';

export function LoginView() {
    const { user, loading, registerWithEmail, loginWithEmail } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const showGoogle = searchParams.get('ODTest') === 'true';
    const inviteFromUrl = searchParams.get('invite') || '';

    // Form State
    const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [inviteCode, setInviteCode] = useState(inviteFromUrl);
    
    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [inviteValidating, setInviteValidating] = useState(false);
    const [inviteStatus, setInviteStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    // Request Access State
    const [showRequestAccess, setShowRequestAccess] = useState(false);
    const [requestEmail, setRequestEmail] = useState('');
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
    const [requestSuccess, setRequestSuccess] = useState(false);
    const [requestError, setRequestError] = useState('');

    useEffect(() => {
        if (user && !loading) {
            navigate('/');
        }
    }, [user, loading, navigate]);

    useEffect(() => {
        if (inviteFromUrl && authMode === 'register') {
            verifyInvite(inviteFromUrl);
        }
    }, [inviteFromUrl, authMode]);

    // Debounced invite verification
    useEffect(() => {
        if (authMode !== 'register' || !inviteCode || inviteCode === inviteFromUrl) return;
        
        const timer = setTimeout(() => {
            verifyInvite(inviteCode);
        }, 500);

        return () => clearTimeout(timer);
    }, [inviteCode, authMode]);

    // Cleanup error on mode switch
    useEffect(() => {
        setErrorMessage(null);
    }, [authMode]);

    // Handle invite code verification
    const verifyInvite = async (code: string) => {
        if (!code || authMode !== 'register') return;
        setInviteValidating(true);
        setInviteStatus('idle');
        setInviteError(null);
        try {
            const res = await fetch(`${API_BASE}/auth/verify-invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code.trim().toUpperCase() })
            });
            const data = await res.json();
            if (data.valid) {
                setInviteStatus('valid');
                setInviteError(null);
                return true;
            } else {
                setInviteStatus('invalid');
                setInviteError(data.error || "Please provide a valid invitation code.");
                return false;
            }
        } catch (err) {
            console.error("Invite verification failed:", err);
            return false;
        } finally {
            setInviteValidating(false);
        }
    };
    
    const handleRequestAccess = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!requestEmail) return;
        
        setIsSubmittingRequest(true);
        setRequestError('');
        
        try {
            // Using Formspark (User provided ID: dmLenUivD)
            const FORMSPARK_ACTION_URL = `https://submit-form.com/dmLenUivD`; 
            
            const response = await fetch(FORMSPARK_ACTION_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    email: requestEmail,
                    message: "Beta Access Request",
                    source: "opinion-deck-login"
                }),
            });

            // Mirror to Firestore waitlist
            try {
                await fetch(`${API_BASE}/waitlist`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: requestEmail })
                });
            } catch (err) {
                console.error("Failed to mirror waitlist entry to firestore:", err);
            }

            if (response.ok) {
                setRequestSuccess(true);
            } else {
                setRequestError("Submission failed. Please try again later.");
            }
        } catch (err) {
            setRequestError("Network error. Please check your connection.");
        } finally {
            setIsSubmittingRequest(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        
        setErrorMessage(null);
        setIsSubmitting(true);

        try {
            if (authMode === 'register') {
                let currentStatus = inviteStatus;
                
                // If user clicked submit while debouncer hadn't finished
                if (currentStatus === 'idle') {
                    const isValid = await verifyInvite(inviteCode);
                    currentStatus = isValid ? 'valid' : 'invalid';
                }

                if (currentStatus !== 'valid') {
                    throw new Error(inviteError || "Please provide a valid invitation code.");
                }
                await registerWithEmail(email, password, inviteCode);
            } else {
                await loginWithEmail(email, password);
            }
            // Success! Navigate to dashboard
            navigate('/');
        } catch (err: any) {
            console.error("Auth error:", err);
            setErrorMessage(err.message || "Authentication failed. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="login-container" style={{ display: 'flex', height: '100vh', background: '#0b0b12', overflow: 'hidden' }}>
            {/* Left Panel */}
            <div className="login-brand-panel" style={{
                flex: 1.2,
                background: 'linear-gradient(135deg, #0b0b12 0%, #131320 100%)',
                color: 'white',
                padding: '60px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                borderRight: '1px solid rgba(255,255,255,0.05)'
            }}>
                <div style={{
                    position: 'absolute',
                    top: '-10%',
                    right: '-10%',
                    width: '600px',
                    height: '600px',
                    background: 'radial-gradient(circle, rgba(255,69,0,0.1) 0%, rgba(255,69,0,0) 70%)',
                    borderRadius: '50%',
                    pointerEvents: 'none'
                }} />

                <div style={{ position: 'relative', zIndex: 10, maxWidth: '540px', margin: '0 auto' }}>
                    <div className="brand-header" style={{ marginBottom: '60px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
                            <div style={{ 
                                background: 'white', 
                                padding: '12px', 
                                borderRadius: '16px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                            }}>
                                <img src="/logo.svg" alt={BRANDING.NAME} style={{ width: '40px', height: '40px' }} />
                            </div>
                            <h1 style={{ fontSize: '2.8rem', fontWeight: '850', letterSpacing: '-0.04em', margin: 0 }}>
                                {BRANDING.NAME}
                            </h1>
                        </div>
                        <p style={{ fontSize: '1.4rem', color: '#a0a0b8', lineHeight: '1.5', fontWeight: '500' }}>
                            {BRANDING.TAGLINE}
                        </p>
                    </div>

                    <div className="value-props" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                            <div style={{ background: 'rgba(255,69,0,0.15)', padding: '12px', borderRadius: '14px', border: '1px solid rgba(255,69,0,0.2)' }}>
                                <Zap size={24} color="#ff4500" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '6px' }}>Private Beta Access</h3>
                                <p style={{ color: '#8e92a4', fontSize: '1rem', lineHeight: '1.5' }}>Opinion Deck is currently invite-only. Join an exclusive group of researchers and founders.</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                            <div style={{ background: 'rgba(34,197,94,0.15)', padding: '12px', borderRadius: '14px', border: '1px solid rgba(34,197,94,0.2)' }}>
                                <Search size={24} color="#22c55e" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '6px' }}>Multi-Platform Search</h3>
                                <p style={{ color: '#8e92a4', fontSize: '1rem', lineHeight: '1.5' }}>Surface insights across Reddit and HackerNews with a single master query.</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                            <div style={{ background: 'rgba(59,130,246,0.15)', padding: '12px', borderRadius: '14px', border: '1px solid rgba(59,130,246,0.2)' }}>
                                <FileText size={24} color="#3b82f6" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '6px' }}>AI-Driven Synthesis</h3>
                                <p style={{ color: '#8e92a4', fontSize: '1rem', lineHeight: '1.5' }}>Let Gemini 2.0 Flash cluster and analyze thousands of threads for you.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel - Auth Form */}
            <div className="auth-panel" style={{
                flex: 1,
                display: 'flex',
                background: '#0b0b12',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ 
                    width: '100%', 
                    maxWidth: '440px', 
                    padding: '40px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    boxSizing: 'border-box'
                }}>
                    <div className="auth-card" style={{ textAlign: 'left', width: '100%' }}>
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: 0, color: '#fff', letterSpacing: '-0.02em' }}>
                                    {authMode === 'register' ? 'Join the Beta' : 'Welcome Back'}
                                </h2>
                                {authMode === 'register' && (
                                    <div style={{ background: 'rgba(255, 69, 0, 0.1)', color: '#ff4500', padding: '4px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', border: '1px solid rgba(255, 69, 0, 0.2)' }}>
                                        BETA
                                    </div>
                                )}
                            </div>
                            <p style={{ color: '#8e92a4', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                {authMode === 'register' 
                                    ? 'Start surfacing strategic insights today.' 
                                    : 'Sign in to access your research dashboard.'}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#52526b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    Email Address
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#52526b' }} />
                                    <input 
                                        type="email" 
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="name@email.com"
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '16px 16px 16px 48px',
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1.5px solid rgba(255,255,255,0.06)',
                                            borderRadius: '16px',
                                            color: 'white',
                                            fontSize: '1rem',
                                            transition: 'all 0.2s',
                                            boxSizing: 'border-box',
                                            display: 'block'
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#52526b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    Password
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#52526b' }} />
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            if (authMode === 'register' && e.target.value.length > 0 && e.target.value.length < 8) {
                                                setPasswordError("Password must be at least 8 characters");
                                            } else {
                                                setPasswordError(null);
                                            }
                                        }}
                                        placeholder="••••••••"
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '16px 48px 16px 48px',
                                            background: 'rgba(255,255,255,0.02)',
                                            border: `1.5px solid ${passwordError ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                            borderRadius: '16px',
                                            color: 'white',
                                            fontSize: '1rem',
                                            transition: 'all 0.2s',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: '16px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            color: '#52526b',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {passwordError && (
                                    <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '6px', marginLeft: '4px', fontWeight: '600' }}>
                                        {passwordError}
                                    </p>
                                )}
                            </div>

                            {authMode === 'register' && (
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#52526b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        Invite Code
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <Ticket size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#52526b' }} />
                                        <input 
                                            type="text" 
                                            autoComplete="off"
                                            value={inviteCode}
                                            onChange={(e) => {
                                                setInviteCode(e.target.value);
                                                setInviteStatus('idle');
                                                setInviteError(null);
                                            }}
                                            onBlur={() => {
                                                if (inviteStatus === 'idle') verifyInvite(inviteCode);
                                            }}
                                            placeholder="DECK-XXXX-XX"
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '16px 48px 16px 48px',
                                                background: 'rgba(255,255,255,0.02)',
                                                border: `1.5px solid ${inviteStatus === 'valid' ? 'rgba(34,197,94,0.3)' : inviteStatus === 'invalid' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                                borderRadius: '16px',
                                                color: 'white',
                                                fontSize: '1rem',
                                                transition: 'all 0.2s',
                                                textTransform: 'uppercase',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)' }}>
                                            {inviteValidating ? <Loader2 className="animate-spin" size={18} color="#8e92a4" /> : (
                                                <>
                                                    {inviteStatus === 'valid' && <CheckCircle2 size={18} color="#22c55e" />}
                                                    {inviteStatus === 'invalid' && <XCircle size={18} color="#ef4444" />}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Request Access Link */}
                                    <div style={{ marginTop: '8px' }}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowRequestAccess(true);
                                                setRequestEmail(email);
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#ff4500',
                                                fontSize: '0.8rem',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: 0,
                                                opacity: 0.8,
                                                transition: 'opacity 0.2s'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                            onMouseOut={(e) => e.currentTarget.style.opacity = '0.8'}
                                        >
                                            <Sparkles size={14} />
                                            Don't have a code? Request Access
                                        </button>
                                    </div>
                                </div>
                            )}

                            {errorMessage && (
                                <div style={{ padding: '14px 18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', color: '#ef4444', fontSize: '0.9rem', fontWeight: '500' }}>
                                    {errorMessage}
                                </div>
                            )}

                            <div style={{ position: 'relative' }}>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting || (authMode === 'register' && (inviteStatus === 'invalid' || !inviteCode || password.length < 8))}
                                    className="submit-button"
                                    style={{
                                        width: '100%',
                                        padding: '18px',
                                        background: (authMode === 'register' && inviteStatus === 'valid' && password.length >= 8) 
                                            ? 'linear-gradient(135deg, #ff4500 0%, #ff6a00 100%)' 
                                            : '#1c1c2b',
                                        color: (authMode === 'register' && inviteStatus === 'valid' && password.length >= 8) ? 'white' : '#52526b',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        borderRadius: '16px',
                                        fontSize: '1.1rem',
                                        fontWeight: '800',
                                        cursor: (isSubmitting || (authMode === 'register' && (inviteStatus !== 'valid' || password.length < 8))) ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: (authMode === 'register' && inviteStatus === 'valid' && password.length >= 8) 
                                            ? '0 8px 30px rgba(255,69,0,0.3)' 
                                            : 'none'
                                    }}
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" size={22} /> : (
                                        <>
                                            {authMode === 'register' ? 'Join Private Beta' : 'Sign In'}
                                            <ArrowRight size={20} />
                                        </>
                                    )}
                                </button>
                                
                                {authMode === 'register' && (inviteStatus !== 'valid' || password.length < 8) && !isSubmitting && (
                                    <div style={{ 
                                        marginTop: '16px', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        gap: '8px', 
                                        color: '#ff4500', 
                                        fontSize: '0.85rem', 
                                        fontWeight: '800',
                                        background: 'rgba(255, 69, 0, 0.05)',
                                        padding: '12px',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255, 69, 0, 0.1)'
                                    }}>
                                        <Info size={16} />
                                        <span>
                                            {!inviteCode ? 'Please enter your invite code' : 
                                             inviteStatus === 'invalid' ? 'Invalid invitation code' : 
                                             password.length < 8 ? 'Password must be 8+ characters' : 
                                             'Validating your invitation...'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </form>

                        <div style={{ marginTop: '24px', textAlign: 'center' }}>
                            <button 
                                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                                style={{ background: 'none', border: 'none', color: '#8e92a4', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '600', transition: 'color 0.2s' }}
                                onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
                                onMouseOut={(e) => e.currentTarget.style.color = '#8e92a4'}
                            >
                                {authMode === 'login' ? (
                                    <>Don't have an invite? <span style={{ color: '#ff4500' }}>Join the Beta</span></>
                                ) : (
                                    <>Already in the beta? <span style={{ color: '#ff4500' }}>Sign In</span></>
                                )}
                            </button>
                        </div>

                        {showGoogle && (
                            <div style={{ marginTop: '40px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '32px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#52526b', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '20px' }}>
                                    <Sparkles size={14} />
                                    <span>Developer Gateway</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <AuthButton />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ position: 'absolute', bottom: '24px', fontSize: '0.8rem', color: '#52526b' }}>
                    &copy; {new Date().getFullYear()} {BRANDING.COMPANY_NAME}. All rights reserved.
                </div>

                {/* Request Access Overlay */}
                {showRequestAccess && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(11, 11, 18, 0.98)',
                        backdropFilter: 'blur(10px)',
                        zIndex: 100,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '40px',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        <div style={{ width: '100%', maxWidth: '320px', textAlign: 'center' }}>
                            {!requestSuccess ? (
                                <>
                                    <div style={{ background: 'rgba(255, 69, 0, 0.1)', width: '64px', height: '64px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                                        <Sparkles size={32} color="#ff4500" />
                                    </div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'white', marginBottom: '12px' }}>Request Beta Access</h3>
                                    <p style={{ color: '#8e92a4', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '32px' }}>
                                        Drop your email and we'll send you an invitation code as soon as a spot opens up.
                                    </p>
                                    
                                    <form onSubmit={handleRequestAccess} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <input 
                                            type="email" 
                                            placeholder="Your email address"
                                            value={requestEmail}
                                            onChange={(e) => setRequestEmail(e.target.value)}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '16px',
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '14px',
                                                color: 'white',
                                                fontSize: '0.95rem',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                        <button 
                                            type="submit"
                                            disabled={isSubmittingRequest}
                                            style={{
                                                width: '100%',
                                                padding: '16px',
                                                background: '#ff4500',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '14px',
                                                fontWeight: '800',
                                                fontSize: '1rem',
                                                cursor: 'pointer',
                                                boxShadow: '0 8px 25px rgba(255, 69, 0, 0.3)',
                                                opacity: isSubmittingRequest ? 0.7 : 1
                                            }}
                                        >
                                            {isSubmittingRequest ? 'Sending...' : 'Join Waitlist'}
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setShowRequestAccess(false)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#52526b',
                                                fontSize: '0.85rem',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                marginTop: '12px'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        {requestError && (
                                            <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '12px', fontWeight: '600' }}>{requestError}</p>
                                        )}
                                    </form>
                                </>
                            ) : (
                                <>
                                    <div style={{ background: 'rgba(34, 197, 94, 0.1)', width: '64px', height: '64px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                                        <CheckCircle2 size={32} color="#22c55e" />
                                    </div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'white', marginBottom: '12px' }}>Request Sent!</h3>
                                    <p style={{ color: '#8e92a4', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '32px' }}>
                                        We've received your request for <strong>{requestEmail}</strong>. We'll be in touch soon!
                                    </p>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setShowRequestAccess(false);
                                            setRequestSuccess(false);
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '16px',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: 'white',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '14px',
                                            fontWeight: '800',
                                            fontSize: '0.95rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Got it
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                input:-webkit-autofill,
                input:-webkit-autofill:hover,
                input:-webkit-autofill:focus,
                input:-webkit-autofill:active {
                    -webkit-box-shadow: 0 0 0 30px #131320 inset !important;
                    -webkit-text-fill-color: white !important;
                    transition: background-color 5000s ease-in-out 0s;
                }

                input:focus {
                    background: rgba(255,255,255,0.04) !important;
                    border-color: rgba(255,69,0,0.4) !important;
                    outline: none;
                }

                .submit-button:not(:disabled):hover {
                    transform: translateY(-2px);
                    filter: brightness(1.1);
                    box-shadow: 0 12px 40px rgba(255,69,0,0.4);
                }

                .submit-button:not(:disabled):active {
                    transform: translateY(0);
                }
            `}</style>
        </div>
    );
}

export default LoginView;
