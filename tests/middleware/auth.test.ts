import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock firestore and logger before importing
vi.mock('../../src/server/firestore.js', () => ({
    getAdminAuth: vi.fn(),
    getOrCreateUser: vi.fn(),
    getPlanConfig: vi.fn(),
    resolveUserConfig: vi.fn(),
}));

vi.mock('../../src/server/utils/logger.js', () => ({
    logContext: {
        run: vi.fn((_ctx: any, fn: () => void) => fn()),
    },
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../src/server/config.js', () => ({
    config: {
        isProd: false,
    },
}));

import { authMiddleware } from '../../src/server/middleware/auth.js';
import { getAdminAuth, getOrCreateUser, getPlanConfig, resolveUserConfig } from '../../src/server/firestore.js';

const mockedGetAdminAuth = vi.mocked(getAdminAuth);
const mockedGetOrCreateUser = vi.mocked(getOrCreateUser);
const mockedGetPlanConfig = vi.mocked(getPlanConfig);
const mockedResolveUserConfig = vi.mocked(resolveUserConfig);

function createMockReqResNext(headers: Record<string, string> = {}) {
    const req = {
        user: null,
        headers,
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;
    return { req, res, next };
}

describe('authMiddleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: non-production
        process.env.NODE_ENV = 'test';
    });

    it('sets req.user to null when no auth header present', async () => {
        const { req, res, next } = createMockReqResNext();

        await authMiddleware(req, res, next);

        expect(req.user).toBeNull();
        expect(next).toHaveBeenCalled();
    });

    it('sets req.user to null when auth header is not Bearer', async () => {
        const { req, res, next } = createMockReqResNext({
            authorization: 'Basic abc123',
        });

        await authMiddleware(req, res, next);

        expect(req.user).toBeNull();
        expect(next).toHaveBeenCalled();
    });

    it('grants pro access with dev bypass header in non-production', async () => {
        mockedGetPlanConfig.mockResolvedValue({
            discoveryLimit: 100,
            analysisLimit: 100,
            savedThreadLimit: 1000,
        } as any);

        const { req, res, next } = createMockReqResNext({
            'x-opiniondeck-dev': 'true',
        });

        await authMiddleware(req, res, next);

        expect(req.user).not.toBeNull();
        expect(req.user!.uid).toBe('dev-extension-user');
        expect(req.user!.plan).toBe('pro');
        expect(next).toHaveBeenCalled();
    });

    it('does NOT grant dev bypass in production', async () => {
        // Override config.isProd for this test
        const { config } = await import('../../src/server/config.js');
        (config as any).isProd = true;

        const { req, res, next } = createMockReqResNext({
            'x-opiniondeck-dev': 'true',
        });

        mockedGetAdminAuth.mockReturnValue(null as any);

        await authMiddleware(req, res, next);

        // In production without auth header, user stays null
        expect(req.user).toBeNull();
        expect(next).toHaveBeenCalled();

        // Reset
        (config as any).isProd = false;
    });

    it('verifies valid token and populates req.user', async () => {
        const mockAuth = {
            verifyIdToken: vi.fn().mockResolvedValue({
                uid: 'firebase-uid-123',
                email: 'user@example.com',
            }),
        };
        mockedGetAdminAuth.mockReturnValue(mockAuth as any);

        mockedGetOrCreateUser.mockResolvedValue({
            uid: 'firebase-uid-123',
            email: 'user@example.com',
            plan: 'starter',
            discoveryCount: 5,
            analysisCount: 3,
            savedThreadCount: 10,
        } as any);
        mockedGetPlanConfig.mockResolvedValue({
            discoveryLimit: 50,
            analysisLimit: 20,
            savedThreadLimit: 200,
        } as any);
        mockedResolveUserConfig.mockReturnValue({
            discoveryLimit: 50,
            analysisLimit: 20,
            savedThreadLimit: 200,
        } as any);

        const { req, res, next } = createMockReqResNext({
            authorization: 'Bearer valid-token-abc',
        });

        await authMiddleware(req, res, next);

        expect(mockAuth.verifyIdToken).toHaveBeenCalledWith('valid-token-abc');
        expect(req.user).not.toBeNull();
        expect(req.user!.uid).toBe('firebase-uid-123');
        expect(req.user!.plan).toBe('starter');
        expect(req.user!.usage.discoveryCount).toBe(5);
        expect(next).toHaveBeenCalled();
    });

    it('treats invalid token as unauthenticated', async () => {
        const mockAuth = {
            verifyIdToken: vi.fn().mockRejectedValue(new Error('Token expired')),
        };
        mockedGetAdminAuth.mockReturnValue(mockAuth as any);

        const { req, res, next } = createMockReqResNext({
            authorization: 'Bearer expired-token',
        });

        await authMiddleware(req, res, next);

        expect(req.user).toBeNull();
        expect(next).toHaveBeenCalled();
    });

    it('treats past_due plan as free for config lookup', async () => {
        const mockAuth = {
            verifyIdToken: vi.fn().mockResolvedValue({
                uid: 'uid-past-due',
                email: 'pastdue@example.com',
            }),
        };
        mockedGetAdminAuth.mockReturnValue(mockAuth as any);

        mockedGetOrCreateUser.mockResolvedValue({
            uid: 'uid-past-due',
            email: 'pastdue@example.com',
            plan: 'past_due',
            discoveryCount: 0,
            analysisCount: 0,
            savedThreadCount: 0,
        } as any);
        mockedGetPlanConfig.mockResolvedValue({ discoveryLimit: 3 } as any);
        mockedResolveUserConfig.mockReturnValue({ discoveryLimit: 3 } as any);

        const { req, res, next } = createMockReqResNext({
            authorization: 'Bearer some-token',
        });

        await authMiddleware(req, res, next);

        // Should call getPlanConfig with 'free' not 'past_due'
        expect(mockedGetPlanConfig).toHaveBeenCalledWith('free');
        expect(req.user!.plan).toBe('past_due'); // plan stays as-is on user object
    });
});
