import { useState } from "react";
import { ContactUs, RefundPolicy, TermsOfService, PrivacyPolicy } from "./LegalPages";

export function Footer() {
    const [activeModal, setActiveModal] = useState<string | null>(null);

    const closeModal = () => setActiveModal(null);

    return (
        <footer className="app-footer">
            <div className="footer-content">
                <p className="copyright">
                    &copy; {new Date().getFullYear()} Reddit Keeper. Built with ❤️ for the community.
                </p>
                <nav className="footer-links">
                    <button onClick={() => setActiveModal("contact")}>Contact Us</button>
                    <button onClick={() => setActiveModal("refund")}>Refund Policy</button>
                    <button onClick={() => setActiveModal("terms")}>Terms</button>
                    <button onClick={() => setActiveModal("privacy")}>Privacy</button>
                </nav>
            </div>

            <ContactUs isOpen={activeModal === "contact"} onClose={closeModal} />
            <RefundPolicy isOpen={activeModal === "refund"} onClose={closeModal} />
            <TermsOfService isOpen={activeModal === "terms"} onClose={closeModal} />
            <PrivacyPolicy isOpen={activeModal === "privacy"} onClose={closeModal} />
        </footer>
    );
}
