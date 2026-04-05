import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { stealthClient } from './lib/stealth-client.js';
import { z } from 'zod';

const app = express();
const PORT = process.env.PORT || 3002;
const INTERNAL_SECRET = process.env.INTERNAL_FETCH_SECRET;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Middleware: Check Internal Secret
const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!INTERNAL_SECRET) {
        console.warn('[AUTH] INTERNAL_FETCH_SECRET not set. Allowing all requests (Insecure).');
        return next();
    }
    
    if (authHeader !== `Bearer ${INTERNAL_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized: Invalid Internal Secret' });
    }
    next();
};

app.use(authMiddleware);

// Health Check
app.get('/health', async (req, res) => {
    res.json({
        status: 'ok',
        region: 'Local (Home Bridge)',
        userAgent: process.env.REDDIT_USER_AGENT,
    });
});

const FetchSchema = z.object({
    url: z.string().url(),
});

// Generic Fetch Endpoint (Limited)
app.post('/fetch', async (req, res) => {
    try {
        const { url } = FetchSchema.parse(req.body);
        console.log(`[SERVER] Request for: ${url}`);
        
        const data = await stealthClient.fetchJson(url);
        res.json(data);
    } catch (err: any) {
        console.error(`[SERVER_ERROR] ${err.message}`);
        res.status(err.status || 500).json({ 
            error: err.message,
            stack: err.stack
        });
    }
});

app.listen(PORT, () => {
    console.log(`[SERVER] Reddit-Fetcher (Stealth Mode) running on port ${PORT}`);
    console.log(`[SERVER] Ready for tunnel at http://localhost:${PORT}`);
});
