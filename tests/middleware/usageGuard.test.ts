import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock firestore before importing usageGuard
vi.mock('../../src/server/firestore.js', () => ({
    getOrCreateUser: vi.fn(),
    getPlanConfig: vi.fn(),
    resolveUserConfig: vi.fn(),
}));

import { usageGuard } from '../../src/server/middleware/usageGuard.js';
import { getOrCreateUser, getPlanConfig, resolveUserConfig } from '../../src/server/firestore.js';

const mockedGetOrCreateUser = vi.mocked(getOrCreateUser);
const mockedGetPlanConfig = vi.mocked(getPlanConfig);
const mockedResolveUserConfig = vi.mocked(resolveUserConfig);

function createMockReqResNext(user?: Request['user']) {
    const req = { user: user ?? null } as Request;
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;
    return { req, res, next };
}

describe('usageGuard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 when no user is authenticated', async () => {
        const { req, res, next } = createMockReqResNext(null);
        const guard = usageGuard('DISCOVERY');

        await guard(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('allows request when usage is under limit', async () => {
        const { req, res, next } = createMockReqResNext({
            uid: 'user1',
            email: 'test@test.com',
            plan: 'starter',
            config: {} as any,
            usage: { discoveryCount: 0, analysisCount: 0, savedThreadCount: 0 },
        });

        mockedGetOrCreateUser.mockResolvedValue({
            uid: 'user1',
            email: 'test@test.com',
            plan: 'starter',
            discoveryCount: 2,
            analysisCount: 0,
            savedThreadCount: 0,
        } as any);
        mockedGetPlanConfig.mockResolvedValue({ discoveryLimit: 10 } as any);
        mockedResolveUserConfig.mockReturnValue({ discoveryLimit: 10 } as any);

        const guard = usageGuard('DISCOVERY');
        await guard(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('blocks request when usage equals limit', async () => {
        const { req, res, next } = createMockReqResNext({
            uid: 'user1',
            email: 'test@test.com',
            plan: 'starter',
            config: {} as any,
            usage: { discoveryCount: 0, analysisCount: 0, savedThreadCount: 0 },
        });

        mockedGetOrCreateUser.mockResolvedValue({
            uid: 'user1',
            email: 'test@test.com',
            plan: 'starter',
            discoveryCount: 10,
        } as any);
        mockedGetPlanConfig.mockResolvedValue({ discoveryLimit: 10 } as any);
        mockedResolveUserConfig.mockReturnValue({ discoveryLimit: 10 } as any);

        const guard = usageGuard('DISCOVERY');
        await guard(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                code: 'LIMIT_REACHED_DISCOVERY',
                limit: 10,
                current: 10,
            })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it('blocks request when usage exceeds limit', async () => {
        const { req, res, next } = createMockReqResNext({
            uid: 'user1',
            email: 'test@test.com',
            plan: 'free',
            config: {} as any,
            usage: { discoveryCount: 0, analysisCount: 0, savedThreadCount: 0 },
        });

        mockedGetOrCreateUser.mockResolvedValue({
            uid: 'user1',
            email: 'test@test.com',
            plan: 'free',
            analysisCount: 5,
        } as any);
        mockedGetPlanConfig.mockResolvedValue({ analysisLimit: 3 } as any);
        mockedResolveUserConfig.mockReturnValue({ analysisLimit: 3 } as any);

        const guard = usageGuard('ANALYSIS');
        await guard(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'LIMIT_REACHED_ANALYSIS' })
        );
    });

    it('enforces SAVED_THREADS limit', async () => {
        const { req, res, next } = createMockReqResNext({
            uid: 'user1',
            email: 'test@test.com',
            plan: 'free',
            config: {} as any,
            usage: { discoveryCount: 0, analysisCount: 0, savedThreadCount: 0 },
        });

        mockedGetOrCreateUser.mockResolvedValue({
            uid: 'user1',
            email: 'test@test.com',
            plan: 'free',
            savedThreadCount: 50,
        } as any);
        mockedGetPlanConfig.mockResolvedValue({ savedThreadLimit: 50 } as any);
        mockedResolveUserConfig.mockReturnValue({ savedThreadLimit: 50 } as any);

        const guard = usageGuard('SAVED_THREADS');
        await guard(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'LIMIT_REACHED_SAVED' })
        );
    });

    it('fails closed when Firestore throws — returns 503', async () => {
        const { req, res, next } = createMockReqResNext({
            uid: 'user1',
            email: 'test@test.com',
            plan: 'free',
            config: {} as any,
            usage: { discoveryCount: 0, analysisCount: 0, savedThreadCount: 0 },
        });

        mockedGetOrCreateUser.mockRejectedValue(new Error('Firestore unavailable'));

        const guard = usageGuard('DISCOVERY');
        await guard(req, res, next);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' })
        );
        expect(next).not.toHaveBeenCalled();
    });
});
