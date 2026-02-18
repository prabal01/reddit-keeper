import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { createCheckoutSession } from "../lib/api";

const FEATURES = [
    { name: "AI Research Reports", free: "5 (Teaser)", pro: "50 / month", highlight: true },
    { name: "AI Research Reports", free: "5 / month", pro: "Unlimited", highlight: true },
    { name: "Pain Points & Themes", free: "Top 3", pro: "✅ Unlimited", highlight: true },
    { name: "Commercial Intent", free: "Locked 🔒", pro: "✅", highlight: true },
    { name: "Strength Analysis", free: "Locked 🔒", pro: "✅", highlight: true },
    { name: "Commercial Intent & Leads", free: "Locked 🔒", pro: "✅", highlight: true },
    { name: "Engagement Strategy", free: "Locked 🔒", pro: "✅" },
    { name: "Max Comments / Thread", free: "50", pro: "5,000" },
    { name: "Saved Threads", free: "Up to 30", pro: "Unlimited" },
    { name: "Research Folders", free: "1", pro: "Unlimited" },
];

export function PricingPage() {
    const { user, plan, signInWithGoogle } = useAuth();
    const [upgrading, setUpgrading] = useState(false);
    const [interval, setInterval] = useState<"month" | "year">("year");
    const [error, setError] = useState<string | null>(null);

    const handleUpgrade = async () => {
        setError(null);

        if (!user) {
            try {
                await signInWithGoogle();
            } catch {
                return;
            }
        }

        setUpgrading(true);
        try {
            const url = await createCheckoutSession(interval);
            window.location.href = url;
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUpgrading(false);
        }
    };

    const isPro = plan === "pro";

    return (
        <section className="pricing-section" id="pricing" aria-labelledby="pricing-heading">
            <h2 id="pricing-heading" className="pricing-title">Simple, transparent pricing</h2>
            <p className="pricing-subtitle">
                The intelligence you need, priced for scale.
            </p>

            <div className="pricing-cards">
                {/* Free Plan */}
                <div className="pricing-card" aria-label="Free plan">
                    <div className="pricing-card-header">
                        <span className="plan-emoji" aria-hidden="true">🌱</span>
                        <h3 className="plan-name">Free Trial</h3>
                        <div className="plan-price">
                            <span className="price-amount">$0</span>
                            <span className="price-period">/ month</span>
                        </div>
                    </div>
                    <ul className="plan-features" aria-label="Free plan features">
                        {FEATURES.map((f) => (
                            <li key={f.name} className="plan-feature">
                                <span className="feature-name">{f.name}</span>
                                <span className="feature-value free-value">{f.free}</span>
                            </li>
                        ))}
                    </ul>
                    <button className="plan-cta free-cta" disabled aria-label="Currently using free plan">
                        {isPro ? "Current" : "Active"}
                    </button>
                </div>

                {/* Pro Plan */}
                <div className="pricing-card pricing-card-pro" aria-label="Pro plan">
                    <div className="pricing-card-badge">Most Popular</div>
                    <div className="pricing-card-header">
                        <span className="plan-emoji" aria-hidden="true">💎</span>
                        <h3 className="plan-name">Pro</h3>

                        <div className="card-toggle-row">
                            <span className={`toggle-label ${interval === "month" ? "active" : ""}`}>Monthly</span>
                            <button
                                className={`pricing-toggle ${interval}`}
                                onClick={() => setInterval(interval === "month" ? "year" : "month")}
                                aria-label="Toggle billing"
                            >
                                <div className="toggle-handle" />
                            </button>
                            <span className={`toggle-label ${interval === "year" ? "active" : ""}`}>Yearly</span>
                        </div>

                        <div className="plan-price">
                            <span className="price-amount">${interval === "month" ? "9" : "7.50"}</span>
                            <span className="price-period">/ month</span>
                        </div>
                        <div className="billing-msg">
                            {interval === "month" ? "Billed monthly" : "Billed $90 yearly"}
                        </div>
                    </div>
                    <ul className="plan-features" aria-label="Pro plan features">
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
                        <button className="plan-cta pro-cta active" disabled aria-label="Currently on Pro plan">
                            ✓ Active
                        </button>
                    ) : (
                        <button
                            className="plan-cta pro-cta"
                            onClick={handleUpgrade}
                            disabled={upgrading}
                            aria-label={`Upgrade to Pro for ${interval === "month" ? "$9/mo" : "$7.50/mo"}`}
                        >
                            {upgrading ? "Redirecting..." : "Upgrade to Pro →"}
                        </button>
                    )}

                    {error && (
                        <p className="pricing-error" role="alert">
                            {error}
                        </p>
                    )}
                </div>
            </div>
            <style>{`
                .card-toggle-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 12px 0;
                    font-size: 0.9rem;
                    color: var(--text-tertiary);
                }
                .toggle-label.active {
                    color: var(--text-primary);
                    font-weight: 600;
                }
                .pricing-toggle {
                    width: 44px;
                    height: 24px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    position: relative;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .pricing-toggle.year {
                    background: var(--bg-accent);
                    border-color: var(--bg-accent);
                }
                .toggle-handle {
                    width: 18px;
                    height: 18px;
                    background: white;
                    border-radius: 50%;
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    transition: transform 0.2s ease;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }
                .pricing-toggle.year .toggle-handle {
                    transform: translateX(20px);
                }
                .billing-msg {
                    font-size: 0.85rem;
                    color: var(--text-tertiary);
                    margin-top: 4px;
                }
            `}</style>
        </section>
    );
}
