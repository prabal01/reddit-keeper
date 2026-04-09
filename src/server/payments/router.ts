import { Router, Request, Response } from 'express';
import express from 'express';
import { createFoundingOrder, verifySignature } from './razorpay.js';
import { createDodoCheckoutSession, verifyDodoWebhookSignature, type DodoPlan } from './dodo.js';
import { authMiddleware } from '../middleware/auth.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/create-order', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Please sign in to upgrade.' });
    try {
        const order = await createFoundingOrder(req.user.uid);
        res.json(order);
    } catch (err: unknown) {
        logger.error({ err }, 'POST /api/payments/create-order failed');
        res.status(500).json({ error: 'Failed to create payment order.' });
    }
});

router.post('/webhook', express.json(), async (req: Request, res: Response) => {
    const secret = config.razorpayWebhookSecret;
    const signature = req.headers['x-razorpay-signature'] as string;

    if (secret && signature) {
        const isValid = verifySignature(JSON.stringify(req.body), signature, secret);
        if (!isValid) {
            logger.error('Invalid Razorpay webhook signature');
            res.status(400).send('Invalid signature');
            return;
        }
    }

    const event = req.body.event;
    logger.info({ event }, 'Razorpay webhook received');

    if (event === 'order.paid') {
        const { notes } = req.body.payload.order.entity;
        const userId = notes?.userId;
        if (userId) {
            logger.info({ userId }, 'Upgrading user to pro via Razorpay');
            const { updateUserPlan } = await import('../firestore.js');
            await updateUserPlan(userId, 'pro');
        }
    }

    res.json({ status: 'ok' });
});

// ── Dodo Payments ──────────────────────────────────────────────────────────────

router.post('/dodo/create-session', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Please sign in to upgrade.' });
    const { plan } = req.body as { plan?: DodoPlan };
    if (!plan || !['starter', 'professional'].includes(plan)) {
        return void res.status(400).json({ error: 'Invalid plan. Must be "starter" or "professional".' });
    }
    try {
        const session = await createDodoCheckoutSession(req.user.uid, plan, req.user.email);
        res.json(session);
    } catch (err: unknown) {
        logger.error({ err }, 'POST /api/payments/dodo/create-session failed');
        res.status(500).json({ error: 'Failed to create checkout session.' });
    }
});

router.post('/dodo/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    try {
        const rawBody = req.body.toString();
        const headers = {
            'webhook-id': req.headers['webhook-id'] as string,
            'webhook-signature': req.headers['webhook-signature'] as string,
            'webhook-timestamp': req.headers['webhook-timestamp'] as string,
        };

        const event = verifyDodoWebhookSignature(rawBody, headers);
        logger.info({ type: event.type }, 'Dodo webhook received');

        if (event.type === 'payment.succeeded' || event.type === 'subscription.active') {
            const userId = event.data?.metadata?.userId || event.data?.payment?.metadata?.userId;
            const plan = event.data?.metadata?.plan || event.data?.payment?.metadata?.plan;
            if (userId && plan) {
                logger.info({ userId, plan }, 'Upgrading user via Dodo payment');
                const { updateUserPlan } = await import('../firestore.js');
                await updateUserPlan(userId, plan as any);
            } else {
                logger.warn({ event }, 'Dodo webhook: missing userId or plan in metadata');
            }
        }

        res.json({ status: 'ok' });
    } catch (err: unknown) {
        logger.error({ err }, 'Dodo webhook processing failed');
        res.status(400).json({ error: 'Webhook processing failed' });
    }
});

export default router;
