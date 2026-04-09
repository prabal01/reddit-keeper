import { Router, Request, Response } from 'express';
import { registerUser, verifyInviteCode } from '../firestore.js';
import { addWaitlistEntry } from '../admin.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/register', authRateLimiter, async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return void res.status(400).json({ error: 'Email and password are required.' });
    }
    try {
        const result = await registerUser(email, password);
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (err: unknown) {
        logger.error({ err }, 'POST /api/auth/register failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reserved for future discount coupon validation — not exposed in the user-facing signup flow.
router.post('/verify-invite', authRateLimiter, async (req: Request, res: Response) => {
    const { code } = req.body;
    if (!code) return void res.status(400).json({ error: 'Code is required' });
    try {
        const result = await verifyInviteCode(code);
        res.json(result);
    } catch (err: unknown) {
        logger.error({ err }, 'POST /api/auth/verify-invite failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Public endpoint — no auth required
router.post('/waitlist', async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) return void res.status(400).json({ error: 'Email is required' });
    try {
        await addWaitlistEntry(email);
        res.json({ success: true });
    } catch (err: unknown) {
        logger.error({ err }, 'POST /api/waitlist failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
