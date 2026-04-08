import { Router, Request, Response } from 'express';
import express from 'express';
import { createFoundingOrder, verifySignature } from './razorpay.js';
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

export default router;
