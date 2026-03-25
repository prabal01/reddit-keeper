import { useState } from "react";

interface UpgradePromptProps {
    totalComments: number;
    commentsShown: number;
}

export function UpgradePrompt({ totalComments, commentsShown }: UpgradePromptProps) {
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return null;

    const handleUpgrade = () => {
        window.location.href = "mailto:hello@opiniondeck.com?subject=Full Thread Access Request&body=Hi, I would like to request full thread access for the following research: [Paste URL or Title here]";
    };

    const hiddenCount = totalComments - commentsShown;

    return (
        <div className="upgrade-prompt" role="alert">
            <div className="upgrade-prompt-content">
                <div className="upgrade-prompt-icon" aria-hidden="true">🔒</div>
                <div className="upgrade-prompt-text">
                    <p className="upgrade-prompt-title">
                        Showing {commentsShown} of {totalComments.toLocaleString()} comments
                    </p>
                    <p className="upgrade-prompt-desc">
                        {hiddenCount.toLocaleString()} more comments available.
                        {" "}Contact us for Founding Access during Beta.
                    </p>
                </div>
                <div className="upgrade-prompt-actions">
                    <button
                        className="upgrade-prompt-cta"
                        onClick={handleUpgrade}
                        aria-label="Contact for Founding Access"
                    >
                        Unlock Full Thread (Email)
                    </button>
                    <button
                        className="upgrade-prompt-dismiss"
                        onClick={() => setDismissed(true)}
                        aria-label="Dismiss upgrade prompt"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
}
