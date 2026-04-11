import DodoPayments from 'dodopayments';
import { Webhook } from 'standardwebhooks';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

let _client: DodoPayments | null = null;

function getClient(): DodoPayments {
    if (!_client) {
        _client = new DodoPayments({
            bearerToken: config.dodoApiKey || '',
            environment: config.dodoEnvironment as 'test_mode' | 'live_mode' ?? 'test_mode',
        });
    }
    return _client;
}

export type DodoPlan = 'starter' | 'professional';

export async function createDodoCheckoutSession(
    userId: string,
    plan: DodoPlan,
    email: string
): Promise<{ checkout_url: string; session_id: string }> {
    const client = getClient();

    const productId = plan === 'starter'
        ? config.dodoStarterProductId
        : config.dodoProProductId;

    if (!productId) {
        throw new Error(`Dodo product ID not configured for plan: ${plan}`);
    }

    const appUrl = process.env.APP_URL || 'https://app.opiniondeck.com';

    const session = await client.checkoutSessions.create({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email },
        metadata: { userId, plan },
        return_url: `${appUrl}/pricing?checkout=success&plan=${plan}`,
    });

    logger.info({ userId, plan, session_id: (session as any).session_id }, 'Dodo checkout session created');

    return {
        checkout_url: (session as any).checkout_url,
        session_id: (session as any).session_id,
    };
}

export function verifyDodoWebhookSignature(
    rawBody: string,
    headers: Record<string, string>
): any {
    const secret = config.dodoWebhookSecret;
    if (!secret) {
        logger.warn('DODO_WEBHOOK_SECRET not set — skipping signature verification');
        return JSON.parse(rawBody);
    }

    try {
        const wh = new Webhook(secret);
        return wh.verify(rawBody, headers);
    } catch (err) {
        throw new Error('Invalid Dodo webhook signature');
    }
}
