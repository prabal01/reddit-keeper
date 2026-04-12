import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthButton } from './AuthButton';
import { BRANDING } from '../constants/branding';
import { FileText, Search, Zap, Mail, Lock, ArrowRight, ArrowLeft, Loader2, Sparkles, Eye, EyeOff, Info, CheckCircle2 } from 'lucide-react';

export function LoginView() {
    const { user, loading, registerWithEmail, loginWithEmail, resetPassword } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const showGoogle = searchParams.get('ODTest') === 'true';

    // Form State
    const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('register');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [resetSent, setResetSent] = useState(false);

    useEffect(() => {
        if (user && !loading) {
            navigate('/');
        }
    }, [user, loading, navigate]);

    // Cleanup error on mode switch
    useEffect(() => {
        setErrorMessage(null);
        setResetSent(false);
    }, [authMode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        setErrorMessage(null);
        setIsSubmitting(true);

        try {
            if (authMode === 'register') {
                await registerWithEmail(email, password);
            } else {
                await loginWithEmail(email, password);
            }
            navigate('/');
        } catch (err: any) {
            console.error("Auth error:", err);
            setErrorMessage(err.message || "Authentication failed. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        setErrorMessage(null);
        setIsSubmitting(true);

        try {
            await resetPassword(email);
        } catch (err: any) {
            // Silently ignore errors for security - don't reveal if email exists
            console.error("Password reset error:", err);
        } finally {
            setResetSent(true);
            setIsSubmitting(false);
        }
    };

    const isRegisterReady = authMode === 'register' && password.length >= 8 && email.length > 0;

    return (
        <div className="login-container" style={{ display: 'flex', minHeight: '100vh', background: '#0b0b12', overflow: 'hidden' }}>
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
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '6px' }}>Free Trial — No Credit Card</h3>
                                <p style={{ color: '#8e92a4', fontSize: '1rem', lineHeight: '1.5' }}>Start monitoring Reddit and HackerNews for market opportunities with a free trial account.</p>
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
                            <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: '0 0 12px', color: '#fff', letterSpacing: '-0.02em' }}>
                                {authMode === 'register' ? 'Get Started Free' : authMode === 'login' ? 'Welcome Back' : 'Reset Password'}
                            </h2>
                            <p style={{ color: '#8e92a4', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                {authMode === 'register'
                                    ? 'Create your account and start your free trial.'
                                    : authMode === 'login'
                                        ? 'Sign in to access your research dashboard.'
                                        : 'Enter your email and we\'ll send you a reset link.'}
                            </p>
                        </div>

                        {authMode === 'forgot' ? (
                            resetSent ? (
                                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                    <div style={{
                                        background: 'rgba(34,197,94,0.1)',
                                        width: '64px',
                                        height: '64px',
                                        borderRadius: '20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 24px',
                                        border: '1px solid rgba(34,197,94,0.2)'
                                    }}>
                                        <CheckCircle2 size={32} color="#22c55e" />
                                    </div>
                                    <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: '700', marginBottom: '12px' }}>
                                        Check Your Email
                                    </h3>
                                    <p style={{ color: '#8e92a4', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '24px' }}>
                                        If an account exists for <strong style={{ color: '#fff' }}>{email}</strong>,
                                        you'll receive a password reset link shortly.
                                    </p>
                                    <button
                                        onClick={() => { setAuthMode('login'); }}
                                        className="submit-button"
                                        style={{
                                            width: '100%',
                                            padding: '16px',
                                            background: 'linear-gradient(135deg, #ff4500 0%, #ff6a00 100%)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '16px',
                                            fontSize: '1rem',
                                            fontWeight: '800',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '10px',
                                            boxShadow: '0 8px 30px rgba(255,69,0,0.3)'
                                        }}
                                    >
                                        <ArrowLeft size={18} />
                                        Back to Sign In
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

                                    {errorMessage && (
                                        <div style={{ padding: '14px 18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', color: '#ef4444', fontSize: '0.9rem', fontWeight: '500' }}>
                                            {errorMessage}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isSubmitting || email.length === 0}
                                        className="submit-button"
                                        style={{
                                            width: '100%',
                                            padding: '18px',
                                            background: email.length > 0
                                                ? 'linear-gradient(135deg, #ff4500 0%, #ff6a00 100%)'
                                                : '#1c1c2b',
                                            color: email.length > 0 ? 'white' : '#52526b',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            borderRadius: '16px',
                                            fontSize: '1.1rem',
                                            fontWeight: '800',
                                            cursor: (isSubmitting || email.length === 0) ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '12px',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            boxShadow: email.length > 0
                                                ? '0 8px 30px rgba(255,69,0,0.3)'
                                                : 'none'
                                        }}
                                    >
                                        {isSubmitting ? <Loader2 className="animate-spin" size={22} /> : (
                                            <>
                                                Send Reset Link
                                                <ArrowRight size={20} />
                                            </>
                                        )}
                                    </button>
                                </form>
                            )
                        ) : (
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

                                {errorMessage && (
                                    <div style={{ padding: '14px 18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', color: '#ef4444', fontSize: '0.9rem', fontWeight: '500' }}>
                                        {errorMessage}
                                    </div>
                                )}

                                <div style={{ position: 'relative' }}>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || (authMode === 'register' && password.length < 8)}
                                        className="submit-button"
                                        style={{
                                            width: '100%',
                                            padding: '18px',
                                            background: (authMode === 'login' || isRegisterReady)
                                                ? 'linear-gradient(135deg, #ff4500 0%, #ff6a00 100%)'
                                                : '#1c1c2b',
                                            color: (authMode === 'login' || isRegisterReady) ? 'white' : '#52526b',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            borderRadius: '16px',
                                            fontSize: '1.1rem',
                                            fontWeight: '800',
                                            cursor: (isSubmitting || (authMode === 'register' && password.length < 8)) ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '12px',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            boxShadow: (authMode === 'login' || isRegisterReady)
                                                ? '0 8px 30px rgba(255,69,0,0.3)'
                                                : 'none'
                                        }}
                                    >
                                        {isSubmitting ? <Loader2 className="animate-spin" size={22} /> : (
                                            <>
                                                {authMode === 'register' ? 'Create Account' : 'Sign In'}
                                                <ArrowRight size={20} />
                                            </>
                                        )}
                                    </button>

                                    {authMode === 'register' && password.length > 0 && password.length < 8 && !isSubmitting && (
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
                                            <span>Password must be 8+ characters</span>
                                        </div>
                                    )}
                                </div>
                            </form>
                        )}

                        {authMode === 'login' && (
                            <div style={{ textAlign: 'right', marginTop: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setAuthMode('forgot')}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#8e92a4',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        fontWeight: '600',
                                        padding: '4px 0',
                                        transition: 'color 0.2s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.color = '#ff4500'}
                                    onMouseOut={(e) => e.currentTarget.style.color = '#8e92a4'}
                                >
                                    Forgot Password?
                                </button>
                            </div>
                        )}

                        <div style={{ marginTop: '24px', textAlign: 'center' }}>
                            {authMode === 'forgot' ? (
                                <button
                                    onClick={() => setAuthMode('login')}
                                    style={{ background: 'none', border: 'none', color: '#8e92a4', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '600', transition: 'color 0.2s' }}
                                    onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
                                    onMouseOut={(e) => e.currentTarget.style.color = '#8e92a4'}
                                >
                                    <span style={{ color: '#ff4500' }}>&larr; Back to Sign In</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                                    style={{ background: 'none', border: 'none', color: '#8e92a4', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '600', transition: 'color 0.2s' }}
                                    onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
                                    onMouseOut={(e) => e.currentTarget.style.color = '#8e92a4'}
                                >
                                    {authMode === 'login' ? (
                                        <>Don't have an account? <span style={{ color: '#ff4500' }}>Sign Up Free</span></>
                                    ) : (
                                        <>Already have an account? <span style={{ color: '#ff4500' }}>Sign In</span></>
                                    )}
                                </button>
                            )}
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
            </div>

            <style>{`
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
