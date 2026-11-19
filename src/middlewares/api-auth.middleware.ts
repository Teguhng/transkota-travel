import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import { ZodSchema } from 'zod';
import { tokenService } from '../services/token.service.js';
import { UserRole } from '../types/db.types.js';
import { apiError } from '../types/api.types.js';

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') {
    return null;
  }

  const parts = header.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1] || null;
}

function isActivationExemptPath(req: Request): boolean {
  const pathToCheck = req.path || '';
  return (
    pathToCheck.endsWith('/auth/activate') ||
    pathToCheck.endsWith('/auth/logout') ||
    pathToCheck.endsWith('/auth/logout-all')
  );
}

export async function requireApiAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const hasAuthHeader = typeof req.headers.authorization === 'string';
    const bearerToken = extractBearerToken(req);

    if (hasAuthHeader) {
      if (!bearerToken) {
        res.status(401).json(
          apiError(
            'UNAUTHORIZED',
            'Token autentikasi tidak valid, telah dicabut, atau kedaluwarsa.'
          )
        );
        return;
      }

      const verified = await tokenService.verifyBearerToken(bearerToken);
      if (!verified) {
        res.status(401).json(
          apiError(
            'UNAUTHORIZED',
            'Token autentikasi tidak valid, telah dicabut, atau kedaluwarsa.'
          )
        );
        return;
      }

      if (
        verified.user.wajib_reset_password === 1 &&
        !isActivationExemptPath(req)
      ) {
        res.status(403).json(
          apiError(
            'PASSWORD_ACTIVATION_REQUIRED',
            'Akun Anda memerlukan aktivasi kata sandi baru pada endpoint /api/v1/auth/activate.'
          )
        );
        return;
      }

      req.user = verified.user;
      req.authTokenId = verified.tokenId;
      req.authMethod = 'bearer';
      req.authAbilities = verified.abilities;
      next();
      return;
    }

    // Sanctum SPA Stateful Cookie fallback
    if (req.session && req.session.user) {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const expectedToken = (req.session as any).csrfToken;
        const submittedToken =
          req.headers['x-csrf-token'] ||
          req.headers['csrf-token'] ||
          req.body?._csrf ||
          req.query?._csrf;

        if (!expectedToken || !submittedToken || submittedToken !== expectedToken) {
          res.status(403).json(
            apiError(
              'CSRF_TOKEN_MISMATCH',
              'Token CSRF tidak valid untuk sesi cookie.'
            )
          );
          return;
        }
      }

      if (
        req.session.user.wajib_reset_password === 1 &&
        !isActivationExemptPath(req)
      ) {
        res.status(403).json(
          apiError(
            'PASSWORD_ACTIVATION_REQUIRED',
            'Akun Anda memerlukan aktivasi kata sandi baru pada endpoint /api/v1/auth/activate.'
          )
        );
        return;
      }

      req.user = req.session.user;
      req.authMethod = 'session';
      req.authAbilities = ['*'];
      next();
      return;
    }

    res.status(401).json(
      apiError(
        'UNAUTHENTICATED',
        'Autentikasi diperlukan (Bearer token atau sesi aktif).'
      )
    );
  } catch (err) {
    next(err);
  }
}

export function requireApiRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json(
        apiError(
          'FORBIDDEN',
          'Akses ditolak: Anda tidak memiliki izin untuk operasi ini.'
        )
      );
      return;
    }
    next();
  };
}

export function requireApiAbility(ability: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const abilities = req.authAbilities || [];
    if (!abilities.includes('*') && !abilities.includes(ability)) {
      res.status(403).json(
        apiError(
          'INSUFFICIENT_ABILITY',
          `Token tidak memiliki izin (${ability}).`
        )
      );
      return;
    }
    next();
  };
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      if (req.file?.path) {
        fs.unlink(req.file.path).catch(() => {});
      }
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      res.status(400).json(
        apiError('VALIDATION_ERROR', 'Validasi data gagal.', details)
      );
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.query ?? {});
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      res.status(400).json(
        apiError('VALIDATION_ERROR', 'Validasi parameter query gagal.', details)
      );
      return;
    }
    (req as any).validatedQuery = parsed.data;
    next();
  };
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function createApiRateLimiter(options: {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  maxEntries?: number;
}) {
  const store = new Map<string, RateLimitEntry>();
  const keyPrefix = options.keyPrefix || 'api';
  const maxEntries = options.maxEntries ?? 2000;

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${clientIp}`;

    let entry = store.get(key);
    if (!entry || entry.resetAt <= now) {
      if (entry) {
        store.delete(key);
      }

      if (store.size >= maxEntries) {
        for (const [k, existing] of store.entries()) {
          if (existing.resetAt <= now) {
            store.delete(k);
          }
        }
      }

      while (store.size >= maxEntries) {
        const oldestKey = store.keys().next().value;
        if (oldestKey === undefined) break;
        store.delete(oldestKey);
      }

      entry = {
        count: 1,
        resetAt: now + options.windowMs,
      };
      store.set(key, entry);
    } else {
      entry.count += 1;
    }

    const remaining = Math.max(0, options.max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(options.max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > options.max) {
      res.status(429).json(
        apiError(
          'RATE_LIMIT_EXCEEDED',
          'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.'
        )
      );
      return;
    }

    next();
  };
}
