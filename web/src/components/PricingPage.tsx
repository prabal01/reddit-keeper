import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { H2, Subtitle } from "./common/Typography";
import { UIButton } from "./common/UIButton";
import { createDodoCheckout } from "../lib/api";

const FEATURES = [
    { name: "Monitors", trial: "3", starter: "3", pro: "10", enterprise: "Unlimited", highlight: true },
    { name: "Subreddits per Monitor", trial: "10", starter: "10", pro: "20", enterprise: "Unlimited", highlight: true },
    { name: "Pain Points Extraction", trial: "✅", starter: "✅", pro: "✅", enterprise: "✅", highlight: true },
    { name: "Trigger Identification", trial: "✅", starter: "✅", pro: "✅", enterprise: "✅", highlight: true },
    { name: "Desired Outcomes", trial: "✅", starter: "✅", pro: "✅", enterprise: "✅", highlight: true },
    { name: "Semantic Clustering", trial: "✅", starter: "✅", pro: "✅", enterprise: "✅" },
    { name: "Export (PDF/JSON)", trial: "✅", starter: "✅", pro: "✅", enterprise: "✅" },
    { name: "Team Seats (Coming Soon)", trial: "1", starter: "1", pro: "3", enterprise: "5+" },
];

export function PricingPage() {
    const { plan } = useAuth();
    const isTrial = plan === "free" || plan === "trial";
    const isStarter = plan === "starter";
    const isPro = plan === "pro" || plan === "professional";
    const isEnterprise = plan === "enterprise";
    const isPastDue = plan === "past_due";
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

    const handleUpgrade = async (targetPlan: 'starter' | 'professional') => {
        setCheckoutLoading(targetPlan);
        try {
            await createDodoCheckout(targetPlan);
        } catch (err: any) {
            console.error('Checkout failed:', err);
            alert(err.message || 'Failed to start checkout. Please try again.');
        } finally {
            setCheckoutLoading(null);
        }
    };

    return (
        <section className="pricing-section" id="pricing" aria-labelledby="pricing-heading">
            <H2 id="pricing-heading" className="pricing-title text-center mb-2">Simple, transparent pricing</H2>
            <Subtitle className="pricing-subtitle text-center mb-12">
                Start with a free 3-day trial. Upgrade when it's working.
            </Subtitle>

            {isPastDue && (
                <div style={{ maxWidth: 600, margin: '0 auto 32px', padding: '16px 24px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, textAlign: 'center' }}>
                    <p style={{ color: '#f87171', fontWeight: 600, marginBottom: 4 }}>Your payment is past due</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Please update your payment method or resubscribe to restore access.</p>
                </div>
            )}

            <div className="pricing-cards">
                {/* Trial Plan */}
                <div className="pricing-card" aria-label="Trial plan">
                    <div className="pricing-card-header">
                        <span className="plan-emoji" aria-hidden="true">🌱</span>
                        <H2 className="plan-name text-[1.5rem]!">Trial</H2>
                        <div className="plan-price">
                            <span className="price-amount">$0</span>
                            <span className="price-period">/ 3 days</span>
                        </div>
                    </div>
                    <ul className="plan-features" aria-label="Trial plan features">
                        {FEATURES.map((f) => (
                            <li key={f.name} className="plan-feature">
                                <span className="feature-name">{f.name}</span>
                                <span className="feature-value trial-value">{f.trial}</span>
                            </li>
                        ))}
                    </ul>
                    <UIButton variant="secondary" className="w-full" disabled>
                        {isTrial ? "Active Trial" : "Expired"}
                    </UIButton>
                </div>

                {/* Starter Plan */}
                <div className="pricing-card" aria-label="Starter plan">
                    <div className="pricing-card-header">
                        <span className="plan-emoji" aria-hidden="true">⚡</span>
                        <H2 className="plan-name text-[1.5rem]!">Starter</H2>
                        <div className="plan-price">
                            <span className="price-amount">$19</span>
                            <span className="price-period">/ month</span>
                        </div>
                        <div className="billing-msg">For indie founders & makers</div>
                    </div>
                    <ul className="plan-features" aria-label="Starter plan features">
                        {FEATURES.map((f) => (
                            <li
                                key={f.name}
                                className={`plan-feature ${f.highlight ? "highlight" : ""}`}
                            >
                                <span className="feature-name">{f.name}</span>
                                <span className="feature-value starter-value">{f.starter}</span>
                            </li>
                        ))}
                    </ul>
                    {isStarter ? (
                        <UIButton variant="primary" className="active w-full" disabled>
                            ✓ Current Plan
                        </UIButton>
                    ) : (
                        <UIButton
                            variant="primary"
                            className="w-full"
                            disabled={checkoutLoading === 'starter'}
                            onClick={() => handleUpgrade('starter')}
                        >
                            {checkoutLoading === 'starter' ? 'Loading...' : 'Upgrade to Starter →'}
                        </UIButton>
                    )}
                </div>

                {/* Professional Plan */}
                <div className="pricing-card pricing-card-pro" aria-label="Professional plan">
                    <div className="pricing-card-badge">Most Popular</div>
                    <div className="pricing-card-header">
                        <span className="plan-emoji" aria-hidden="true">🚀</span>
                        <H2 className="plan-name text-[1.5rem]! text-white!">Professional</H2>
                        <div className="plan-price">
                            <span className="price-amount">$59</span>
                            <span className="price-period">/ month</span>
                        </div>
                        <div className="billing-msg">For product & growth teams</div>
                    </div>
                    <ul className="plan-features" aria-label="Professional plan features">
                        {FEATURES.map((f) => (
                            <li
                                key={f.name}
                                className={`plan-feature ${f.highlight ? "highlight" : ""}`}
                            >
                                <span className="feature-name">{f.name}</span>
                                <span className="feature-value pro-value">{f.pro}</span>
                            </li>
                        ))}
                    </ul>
                    {isPro ? (
                        <UIButton variant="primary" className="active w-full" disabled>
                            ✓ Current Plan
                        </UIButton>
                    ) : (
                        <UIButton
                            variant="primary"
                            className="w-full"
                            disabled={checkoutLoading === 'professional'}
                            onClick={() => handleUpgrade('professional')}
                        >
                            {checkoutLoading === 'professional' ? 'Loading...' : 'Upgrade to Professional →'}
                        </UIButton>
                    )}
                </div>

                {/* Enterprise Plan */}
                <div className="pricing-card" aria-label="Enterprise plan">
                    <div className="pricing-card-header">
                        <span className="plan-emoji" aria-hidden="true">💼</span>
                        <H2 className="plan-name text-[1.5rem]!">Enterprise</H2>
                        <div className="plan-price">
                            <span className="price-amount">Custom</span>
                            <span className="price-period">/ month</span>
                        </div>
                        <div className="billing-msg">For large teams & agencies</div>
                    </div>
                    <ul className="plan-features" aria-label="Enterprise plan features">
                        {FEATURES.map((f) => (
                            <li
                                key={f.name}
                                className={`plan-feature ${f.highlight ? "highlight" : ""}`}
                            >
                                <span className="feature-name">{f.name}</span>
                                <span className="feature-value enterprise-value">{f.enterprise}</span>
                            </li>
                        ))}
                    </ul>
                    <UIButton
                        variant="primary"
                        className="w-full"
                        onClick={() => window.location.href = "mailto:hello@opiniondeck.com?subject=Enterprise Inquiry"}
                    >
                        Contact Sales →
                    </UIButton>
                </div>
            </div>
            <style>{`
                .pricing-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 24px;
                    margin-top: 48px;
                }

                .pricing-card {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 32px 24px;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    transition: all 0.3s ease;
                }

                .pricing-card:hover {
                    border-color: var(--bg-accent);
                    transform: translateY(-4px);
                }

                .pricing-card-pro {
                    background: var(--bg-accent);
                    border-color: var(--bg-accent);
                    transform: scale(1.05);
                }

                .pricing-card-pro:hover {
                    transform: scale(1.05) translateY(-4px);
                }

                .pricing-card-badge {
                    position: absolute;
                    top: -12px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--bg-accent);
                    color: white;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .pricing-card-header {
                    text-align: center;
                    margin-bottom: 28px;
                }

                .plan-emoji {
                    font-size: 2.5rem;
                    display: block;
                    margin-bottom: 12px;
                }

                .plan-name {
                    font-size: 1.5rem !important;
                    margin: 8px 0;
                }

                .pricing-card-pro .plan-name {
                    color: white;
                }

                .plan-price {
                    display: flex;
                    align-items: baseline;
                    justify-content: center;
                    gap: 4px;
                    margin: 16px 0;
                }

                .price-amount {
                    font-size: 2.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .pricing-card-pro .price-amount {
                    color: white;
                }

                .price-period {
                    font-size: 1rem;
                    color: var(--text-secondary);
                }

                .pricing-card-pro .price-period {
                    color: rgba(255, 255, 255, 0.8);
                }

                .billing-msg {
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    margin-top: 4px;
                }

                .pricing-card-pro .billing-msg {
                    color: rgba(255, 255, 255, 0.8);
                }

                .plan-features {
                    list-style: none;
                    padding: 0;
                    margin: 28px 0;
                    flex-grow: 1;
                }

                .plan-feature {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 0;
                    border-bottom: 1px solid var(--border);
                    font-size: 0.9rem;
                }

                .pricing-card-pro .plan-feature {
                    border-bottom-color: rgba(255, 255, 255, 0.1);
                }

                .plan-feature:last-child {
                    border-bottom: none;
                }

                .plan-feature.highlight {
                    font-weight: 600;
                }

                .feature-name {
                    color: var(--text-primary);
                }

                .pricing-card-pro .feature-name {
                    color: white;
                }

                .feature-value {
                    color: var(--text-secondary);
                    font-weight: 500;
                }

                .pricing-card-pro .feature-value {
                    color: rgba(255, 255, 255, 0.9);
                }

                .trial-value, .starter-value, .pro-value, .enterprise-value {
                    color: var(--bg-accent);
                    font-weight: 600;
                }

                .pricing-card-pro .trial-value,
                .pricing-card-pro .starter-value,
                .pricing-card-pro .pro-value,
                .pricing-card-pro .enterprise-value {
                    color: white;
                }
            `}</style>
        </section>
    );
}
