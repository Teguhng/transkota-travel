import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import { z } from 'zod';
import {
  createApiRateLimiter,
  requireApiAbility,
  requireApiAuth,
  requireApiRole,
  validateBody,
  validateQuery,
} from '../../src/middlewares/api-auth.middleware.js';
import { csrfMiddleware } from '../../src/middlewares/csrf.middleware.js';
import {
  errorHandler,
  notFoundHandler,
} from '../../src/middlewares/error.middleware.js';
import { tokenService } from '../../src/services/token.service.js';

function createMockRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode: 200,
    body: undefined as unknown,
    redirectUrl: undefined as string | undefined,
    locals: {},
    setHeader(key: string, val: string) {
      headers[key] = val;
      return this;
    },
    getHeader(key: string) {
      return headers[key];
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    redirect(url: string) {
      this.redirectUrl = url;
      return this;
    },
    render(_view: string, data: unknown) {
      this.body = data;
      return this;
    },
  };
  return res as Response & {
    statusCode: number;
    body: any;
    redirectUrl?: string;
  };
}

describe('API Security & Validation Middleware Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('requireApiAuth (Sanctum Dual-Guard)', () => {
    it('should authenticate valid Bearer token and attach req.user + auth metadata', async () => {
      vi.spyOn(tokenService, 'verifyBearerToken').mockResolvedValue({
        tokenId: 12,
        abilities: ['*'],
        user: {
          id: 7,
          username: 'aziz',
          nama: 'Aziz',
          role: 'member',
          wajib_reset_password: 0,
        },
      });

      const req = {
        headers: { authorization: 'Bearer 12|' + 'a'.repeat(64) },
        method: 'POST',
        path: '/bookings',
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      await requireApiAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user?.id).toBe(7);
      expect(req.authMethod).toBe('bearer');
      expect(req.authTokenId).toBe(12);
    });

    it('should return 401 when Bearer token is invalid even if session exists', async () => {
      vi.spyOn(tokenService, 'verifyBearerToken').mockResolvedValue(null);

      const req = {
        headers: { authorization: 'Bearer bad-token' },
        session: {
          user: {
            id: 7,
            username: 'aziz',
            nama: 'Aziz',
            role: 'member',
            wajib_reset_password: 0,
          },
        },
        method: 'GET',
        path: '/auth/me',
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      await requireApiAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 PASSWORD_ACTIVATION_REQUIRED for legacy unactivated user on non-exempt path', async () => {
      vi.spyOn(tokenService, 'verifyBearerToken').mockResolvedValue({
        tokenId: 3,
        abilities: ['*'],
        user: {
          id: 1,
          username: 'admin_1',
          nama: 'Admin',
          role: 'admin',
          wajib_reset_password: 1,
        },
      });

      const req = {
        headers: { authorization: 'Bearer 3|' + 'c'.repeat(64) },
        method: 'GET',
        path: '/admin/metrics',
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      await requireApiAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body.error.code).toBe('PASSWORD_ACTIVATION_REQUIRED');
    });

    it('should allow stateful session POST when valid x-csrf-token header is provided', async () => {
      const req = {
        headers: { 'x-csrf-token': 'valid-csrf' },
        session: {
          csrfToken: 'valid-csrf',
          user: {
            id: 7,
            username: 'aziz',
            nama: 'Aziz',
            role: 'member',
            wajib_reset_password: 0,
          },
        },
        method: 'POST',
        path: '/bookings',
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      await requireApiAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.authMethod).toBe('session');
    });

    it('should reject stateful session POST with 403 CSRF_TOKEN_MISMATCH when CSRF token is missing', async () => {
      const req = {
        headers: {},
        session: {
          csrfToken: 'valid-csrf',
          user: {
            id: 7,
            username: 'aziz',
            nama: 'Aziz',
            role: 'member',
            wajib_reset_password: 0,
          },
        },
        method: 'POST',
        path: '/bookings',
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      await requireApiAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body.error.code).toBe('CSRF_TOKEN_MISMATCH');
    });

    it('should return 401 UNAUTHENTICATED when neither Bearer nor session exists', async () => {
      const req = {
        headers: {},
        method: 'GET',
        path: '/bookings',
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      await requireApiAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('requireApiRole & requireApiAbility', () => {
    it('should return 403 FORBIDDEN when member accesses admin/operator endpoint', () => {
      const guard = requireApiRole(['admin', 'operator']);
      const req = {
        user: {
          id: 7,
          username: 'aziz',
          nama: 'Aziz',
          role: 'member',
          wajib_reset_password: 0,
        },
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      guard(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should check token abilities cleanly', () => {
      const guard = requireApiAbility('bookings:write');
      const reqDenied = { authAbilities: ['bookings:read'] } as unknown as Request;
      const resDenied = createMockRes();
      const nextDenied = vi.fn() as NextFunction;

      guard(reqDenied, resDenied, nextDenied);
      expect(resDenied.statusCode).toBe(403);
      expect(resDenied.body.error.code).toBe('INSUFFICIENT_ABILITY');

      const reqWildcard = { authAbilities: ['*'] } as unknown as Request;
      const resAllowed = createMockRes();
      const nextAllowed = vi.fn() as NextFunction;
      guard(reqWildcard, resAllowed, nextAllowed);
      expect(nextAllowed).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateBody & validateQuery', () => {
    it('should return 400 VALIDATION_ERROR and cleanup uploaded temp file on invalid body', () => {
      const schema = z.object({ nama: z.string().min(3) });
      const unlinkSpy = vi.spyOn(fs, 'unlink').mockResolvedValue(undefined);

      const req = {
        body: { nama: 'a' },
        file: { path: '/tmp/orphan.jpg' },
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      validateBody(schema)(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(unlinkSpy).toHaveBeenCalledWith('/tmp/orphan.jpg');
    });

    it('should validate and store query parameters on req.validatedQuery', () => {
      const schema = z.object({ asal: z.coerce.number().int().positive() });
      const req = { query: { asal: '5' } } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      validateQuery(schema)(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect((req as any).validatedQuery).toEqual({ asal: 5 });
    });
  });

  describe('createApiRateLimiter', () => {
    it('should allow within quota and return 429 RATE_LIMIT_EXCEEDED once exceeded', () => {
      const limiter = createApiRateLimiter({
        windowMs: 60_000,
        max: 2,
        keyPrefix: 'test-limit',
      });
      const req = { ip: '127.0.0.1' } as unknown as Request;

      const res1 = createMockRes();
      const next1 = vi.fn() as NextFunction;
      limiter(req, res1, next1);
      expect(next1).toHaveBeenCalledTimes(1);

      const res2 = createMockRes();
      const next2 = vi.fn() as NextFunction;
      limiter(req, res2, next2);
      expect(next2).toHaveBeenCalledTimes(1);

      const res3 = createMockRes();
      const next3 = vi.fn() as NextFunction;
      limiter(req, res3, next3);
      expect(next3).not.toHaveBeenCalled();
      expect(res3.statusCode).toBe(429);
      expect(res3.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('csrfMiddleware & API error mapping', () => {
    it('should bypass HTML CSRF redirect check for /api/* routes', () => {
      const req = {
        session: {},
        method: 'POST',
        path: '/api/v1/auth/login',
        originalUrl: '/api/v1/auth/login',
        headers: {},
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should return structured JSON for API 404 and SQL errors without leaking details', () => {
      const req404 = {
        method: 'GET',
        path: '/api/v1/unknown',
        originalUrl: '/api/v1/unknown',
      } as unknown as Request;
      const res404 = createMockRes();
      notFoundHandler(req404, res404);
      expect(res404.statusCode).toBe(404);
      expect(res404.body.error.code).toBe('NOT_FOUND');

      vi.spyOn(console, 'error').mockImplementation(() => {});

      const reqSp = {
        path: '/api/v1/bookings',
        originalUrl: '/api/v1/bookings',
      } as unknown as Request;
      const resSp = createMockRes();
      errorHandler(
        { sqlState: '45000', sqlMessage: 'Kursi sudah diambil' },
        reqSp,
        resSp,
        vi.fn()
      );
      expect(resSp.statusCode).toBe(422);
      expect(resSp.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
      expect(resSp.body.error.message).toBe('Kursi sudah diambil');

      const resInternal = createMockRes();
      errorHandler(
        new Error('SELECT * FROM secret_table syntax error'),
        reqSp,
        resInternal,
        vi.fn()
      );
      expect(resInternal.statusCode).toBe(500);
      expect(resInternal.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(resInternal.body.error.message).not.toContain('secret_table');
    });
  });
});
