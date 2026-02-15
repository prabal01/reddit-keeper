import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { createCheckoutSession } from "../lib/api";

interface UpgradePromptProps {
    totalComments: number;
    commentsShown: number;
    commentLimit: number;
}

export function UpgradePrompt({ totalComments, commentsShown, commentLimit }: UpgradePromptProps) {
    const { user, signInWithGoogle } = useAuth();
    const [upgrading, setUpgrading] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return null;

    const handleUpgrade = async () => {
        if (!user) {
            try {
                await signInWithGoogle();
            } catch {
                return;
            }
        }

        setUpgrading(true);
        try {
            const url = await createCheckoutSession();
            window.location.href = url;
        } catch (err) {
            console.error("Upgrade error:", err);
        } finally {
            setUpgrading(false);
        }
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
                        {" "}Upgrade to Pro to see the full thread.
                    </p>
                </div>
                <div className="upgrade-prompt-actions">
                    <button
                        className="upgrade-prompt-cta"
                        onClick={handleUpgrade}
                        disabled={upgrading}
                        aria-label="Upgrade to Pro for $5 per month to see all comments"
                    >
                        {upgrading ? "Redirecting..." : "Upgrade — $5/mo"}
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
