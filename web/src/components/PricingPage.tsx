import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { createCheckoutSession } from "../lib/api";

const FEATURES = [
    { name: "Threads per day", free: "Unlimited", pro: "Unlimited" },
    { name: "Comments per thread", free: "Up to 50", pro: "All comments", highlight: true },
    { name: "Export formats", free: "MD, JSON, Text", pro: "MD, JSON, Text" },
    { name: "Comment filters", free: "✅", pro: "✅" },
    { name: "Bulk download", free: "—", pro: "✅", highlight: true },
    { name: "Export history", free: "—", pro: "30 days", highlight: true },
    { name: "API access", free: "—", pro: "✅", highlight: true },
    { name: "Priority queue", free: "—", pro: "✅", highlight: true },
];

export function PricingPage() {
    const { user, plan, signInWithGoogle } = useAuth();
    const [upgrading, setUpgrading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleUpgrade = async () => {
        setError(null);

        if (!user) {
            try {
                await signInWithGoogle();
            } catch {
                return;
            }
            // After sign-in, the flow continues
        }

        setUpgrading(true);
        try {
            const url = await createCheckoutSession();
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
                Free for small threads. Upgrade when you need the full power.
            </p>

            <div className="pricing-cards">
                {/* Free Plan */}
                <div className="pricing-card" aria-label="Free plan">
                    <div className="pricing-card-header">
                        <span className="plan-emoji" aria-hidden="true">🆓</span>
                        <h3 className="plan-name">Free</h3>
                        <div className="plan-price">
                            <span className="price-amount">$0</span>
                            <span className="price-period">/ forever</span>
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
                        {isPro ? "Downgrade not needed" : "Current Plan"}
                    </button>
                </div>

                {/* Pro Plan */}
                <div className="pricing-card pricing-card-pro" aria-label="Pro plan">
                    <div className="pricing-card-badge">Most Popular</div>
                    <div className="pricing-card-header">
                        <span className="plan-emoji" aria-hidden="true">⚡</span>
                        <h3 className="plan-name">Pro</h3>
                        <div className="plan-price">
                            <span className="price-amount">$5</span>
                            <span className="price-period">/ month</span>
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
                            aria-label="Upgrade to Reddit Keeper Pro for $5 per month"
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
        </section>
    );
}
