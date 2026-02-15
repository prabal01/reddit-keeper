/**
 * Payment integration stub.
 * Replace this file with Cashfree, Stripe, or any payment provider later.
 * For now, plan upgrades are done manually via Firestore console.
 */

export function initPayments(): void {
    console.log("💰 Payments: Not configured (manual plan management via Firestore)");
}

export async function createCheckoutUrl(
    _uid: string,
    _email: string
): Promise<string> {
    throw new Error(
        "Payment provider not configured. To upgrade a user, set plan: \"pro\" in Firestore > users/{uid}."
    );
}

export async function createPortalUrl(_customerId: string): Promise<string> {
    throw new Error("Payment provider not configured.");
}

/**
 * Webhook verification stub — returns false since no provider is configured.
 */
export function verifyWebhook(
    _rawBody: Buffer,
    _signature: string
): boolean {
    return false;
}
