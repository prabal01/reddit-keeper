import Razorpay from 'razorpay';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

// Initialize Razorpay
// Keys should be provided in .env
const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

if (!key_id || !key_secret) {
    logger.warn('RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing. Payments will fail.');
}

export const razorpay = new Razorpay({
    key_id: key_id || 'dummy',
    key_secret: key_secret || 'dummy',
});

/**
 * Create a Razorpay order for Founding Access
 * Amount: $19 = ~1590 INR (approximately, using fixed INR for Razorpay India)
 * We will use 1599 INR as the fixed price for Founding Access.
 */
export async function createFoundingOrder(userId: string) {
    const options = {
        amount: 159900, // Amount in paise (1599.00 INR)
        currency: 'INR',
        receipt: `receipt_founding_${userId}_${Date.now()}`,
        notes: {
            userId: userId,
            plan: 'pro',
            type: 'founding_access'
        }
    };

    try {
        const order = await razorpay.orders.create(options);
        logger.info({ orderId: order.id, userId }, 'Created Razorpay order');
        return order;
    } catch (error) {
        logger.error({ error, userId }, 'Failed to create Razorpay order');
        throw error;
    }
}

/**
 * Verify Razorpay Webhook Signature
 */
export function verifySignature(body: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

    return expectedSignature === signature;
}
