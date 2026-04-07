import { useAuth } from "../contexts/AuthContext";
import { H2, Subtitle } from "./common/Typography";
import { UIButton } from "./common/UIButton";

const FEATURES = [
    { name: "Deep-Scan Discovery", free: "Standard (1x)", pro: "3x Resolution", highlight: true },
    { name: "Research Discoveries", free: "3 total", pro: "30 / month", highlight: true },
    { name: "Full Intelligence Reports", free: "1 (Blurred)", pro: "10 Full Reports", highlight: true },
    { name: "Pain Points & Triggers", free: "Top 2 shown", pro: "✅ Unrestricted", highlight: true },
    { name: "Ranked Build Roadmap", free: "Top 2 shown", pro: "✅ Unrestricted", highlight: true },
    { name: "Max Comments / Thread", free: "50", pro: "5,000" },
    { name: "Saved Threads", free: "Up to 5", pro: "Up to 500" },
    { name: "Export (PDF/JSON/MD)", free: "❌", pro: "✅" },
];

export function PricingPage() {
    const { plan } = useAuth();
    const isPro = plan === "pro";

    return (
        <section className="pricing-section" id="pricing" aria-labelledby="pricing-heading">
            <H2 id="pricing-heading" className="pricing-title text-center mb-2">Simple, transparent pricing</H2>
            <Subtitle className="pricing-subtitle text-center mb-12">
                The intelligence you need, priced for scale.
            </Subtitle>

            <div className="pricing-cards">
                {/* Free Plan */}
                <div className="pricing-card" aria-label="Free plan">
                    <div className="pricing-card-header">
                        <span className="plan-emoji" aria-hidden="true">🌱</span>
                        <H2 className="plan-name text-[1.5rem]!">{isPro ? "Free Tier" : "Active Plan"}</H2>
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
                    <UIButton variant="secondary" className="w-full" disabled>
                        {isPro ? "Legacy" : "Current"}
                    </UIButton>
                </div>

                {/* Founding Access Plan */}
                <div className="pricing-card pricing-card-pro" aria-label="Founding Access">
                    <div className="pricing-card-badge">Founding Access</div>
                    <div className="pricing-card-header">
                        <span className="plan-emoji" aria-hidden="true">🚀</span>
                        <H2 className="plan-name text-[1.5rem]! text-white!">Beta Program</H2>

                        <div className="plan-price">
                            <span className="price-amount">BETA</span>
                            <span className="price-period">/ program</span>
                        </div>
                        <div className="billing-msg">
                            Early access for founding users. Talk to us to shape the future.
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
                        <UIButton variant="primary" className="active w-full" disabled>
                            ✓ Beta Member
                        </UIButton>
                    ) : (
                        <UIButton
                            variant="primary"
                            className="w-full"
                            onClick={() => window.location.href = "mailto:hello@opiniondeck.com?subject=Founding Access Request"}
                        >
                            Claim Founding Access →
                        </UIButton>
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
                    color: rgba(255, 255, 255, 0.4);
                    margin-top: 4px;
                }
                [data-theme="light"] .billing-msg {
                    color: rgba(0, 0, 0, 0.5);
                }
            `}</style>
        </section>
    );
}
