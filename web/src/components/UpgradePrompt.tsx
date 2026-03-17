import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

interface UpgradePromptProps {
    totalComments: number;
    commentsShown: number;
}

export function UpgradePrompt({ totalComments, commentsShown }: UpgradePromptProps) {
    const { openUpgradeModal } = useAuth();
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return null;

    const handleUpgrade = () => {
        openUpgradeModal();
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
                        {" "}Get Founding Access to see the full thread.
                    </p>
                </div>
                <div className="upgrade-prompt-actions">
                    <button
                        className="upgrade-prompt-cta"
                        onClick={handleUpgrade}
                        aria-label="Get Founding Access to see all comments"
                    >
                        Unlock Deep Thread
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
