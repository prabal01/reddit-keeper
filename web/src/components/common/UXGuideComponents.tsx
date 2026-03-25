import React from 'react';
import { Info, CheckCircle2 } from 'lucide-react';

interface StepperProps {
    steps: string[];
    currentStep: number;
}

export const SuccessStepper: React.FC<StepperProps> = ({ steps, currentStep }) => {
    return (
        <div className="success-stepper" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '12px',
            marginBottom: '40px',
            padding: '10px'
        }}>
            {steps.map((step, index) => {
                const isCompleted = index < currentStep;
                const isActive = index === currentStep;
                const isLocked = index > currentStep;
                
                return (
                    <React.Fragment key={step}>
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            opacity: isLocked ? 0.2 : 1,
                            filter: isLocked ? 'grayscale(1)' : 'none',
                            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                            cursor: isLocked ? 'not-allowed' : 'default'
                        }}>
                            <div className={`step-icon ${isActive ? 'pulse-primary' : ''}`} style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: isCompleted ? 'var(--primary-color)' : isActive ? 'rgba(255, 69, 0, 0.2)' : 'rgba(255,255,255,0.05)',
                                border: isActive ? '1px solid var(--primary-color)' : '1px solid rgba(255,255,255,0.1)',
                                color: isCompleted ? 'white' : isActive ? 'var(--primary-color)' : 'var(--text-muted)'
                            }}>
                                {isCompleted ? <CheckCircle2 size={14} /> : <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>{index + 1}</span>}
                            </div>
                            <span style={{ 
                                fontSize: '0.75rem', 
                                fontWeight: 700, 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.05em',
                                color: isActive ? 'var(--text-main)' : 'var(--text-muted)'
                            }}>
                                {step}
                            </span>
                        </div>
                        {index < steps.length - 1 && (
                            <div style={{ 
                                width: '40px', 
                                height: '1px', 
                                background: isCompleted ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)',
                                opacity: index >= currentStep ? 0.1 : 1,
                                transition: 'all 0.5s'
                            }} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

interface InfoboxProps {
    title: string;
    children: React.ReactNode;
    type?: 'info' | 'tip' | 'warning';
}

export const Infobox: React.FC<InfoboxProps> = ({ title, children, type = 'info' }) => {
    const colors = {
        info: { bg: 'rgba(59, 130, 246, 0.05)', border: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa' },
        tip: { bg: 'rgba(16, 185, 129, 0.05)', border: 'rgba(16, 185, 129, 0.2)', text: '#34d399' },
        warning: { bg: 'rgba(245, 158, 11, 0.05)', border: 'rgba(245, 158, 11, 0.2)', text: '#fbbf24' }
    };

    const style = colors[type];

    return (
        <div className="infobox-container" style={{
            padding: '16px 20px',
            borderRadius: '12px',
            background: style.bg,
            border: `1px solid ${style.border}`,
            display: 'flex',
            gap: '16px',
            margin: '20px 0',
            animation: 'fadeInUp 0.6s ease-out'
        }}>
            <div style={{ color: style.text, marginTop: '2px' }}>
                <Info size={18} />
            </div>
            <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{title}</h4>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {children}
                </div>
            </div>
        </div>
    );
};
