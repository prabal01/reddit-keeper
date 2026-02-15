import React from "react";
import "./LegalPages.css";

interface LegalModalProps {
    title: string;
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

function LegalModal({ title, isOpen, onClose, children }: LegalModalProps) {
    if (!isOpen) return null;

    return (
        <div className="legal-modal-overlay" onClick={onClose}>
            <div className="legal-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="legal-modal-header">
                    <h2>{title}</h2>
                    <button className="close-btn" onClick={onClose} aria-label="Close">
                        &times;
                    </button>
                </div>
                <div className="legal-modal-body">{children}</div>
            </div>
        </div>
    );
}

export function ContactUs({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    return (
        <LegalModal title="Contact Us" isOpen={isOpen} onClose={onClose}>
            <p>We're here to help with any questions or technical issues.</p>
            <div className="contact-info">
                <h3>Support Email</h3>
                <p><a href="mailto:support@redditkeeper.com">support@redditkeeper.com</a></p>

                <h3>Response Time</h3>
                <p>We typically respond within 24-48 business hours.</p>

                <h3>Business Hours</h3>
                <p>Monday – Friday: 9:00 AM – 6:00 PM (IST)</p>
            </div>
        </LegalModal>
    );
}

export function RefundPolicy({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    return (
        <LegalModal title="Refund Policy" isOpen={isOpen} onClose={onClose}>
            <p>Your satisfaction is our priority.</p>
            <div className="policy-section">
                <h3>7-Day Money Back Guarantee</h3>
                <p>
                    If you are not satisfied with Reddit Keeper Pro, you can request a full refund within 7 days
                    of your initial purchase. No questions asked.
                </p>

                <h3>How to Request a Refund</h3>
                <p>
                    Please email us at <a href="mailto:support@redditkeeper.com">support@redditkeeper.com</a>
                    with your account email and transaction ID.
                </p>

                <h3>Exceptions</h3>
                <p>
                    Refunds are only available for the first purchase and cannot be claimed for subsequent
                    subscription renewals unless there was a technical failure on our part.
                </p>
            </div>
        </LegalModal>
    );
}

export function TermsOfService({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    return (
        <LegalModal title="Terms of Service" isOpen={isOpen} onClose={onClose}>
            <div className="policy-section">
                <h3>1. Acceptance of Terms</h3>
                <p>By using Reddit Keeper, you agree to these terms.</p>

                <h3>2. Usage License</h3>
                <p>
                    We provide a tool to export Reddit content. You are responsible for ensuring your use of
                    exported data complies with Reddit's Terms of Service and data privacy laws.
                </p>

                <h3>3. Pro Subscription</h3>
                <p>
                    Pro features are provided on a monthly subscription basis. You can cancel anytime via
                    the Billing Portal.
                </p>
            </div>
        </LegalModal>
    );
}

export function PrivacyPolicy({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    return (
        <LegalModal title="Privacy Policy" isOpen={isOpen} onClose={onClose}>
            <div className="policy-section">
                <h3>1. Data Collection</h3>
                <p>
                    We use Firebase Authentication (Google) to manage your account. We only store your
                    email address and subscription status.
                </p>

                <h3>2. Reddit Data</h3>
                <p>
                    We do not store the content of the Reddit threads you fetch. Data is processed in real-time
                    and sent directly to your browser.
                </p>

                <h3>3. Cookies</h3>
                <p>We only use essential cookies required for authentication. No tracking cookies are used.</p>
            </div>
        </LegalModal>
    );
}
