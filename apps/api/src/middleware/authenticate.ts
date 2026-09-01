import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt';
import { Errors } from '../utils/errors';
import prisma from '../lib/db';

// ── Augment Express Request type ──────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface AuthenticatedUser {
  id: string;
  role: Role;
}

// ── authenticate middleware ────────────────────────────────────────────────────

/**
 * Validates the Bearer access token from the Authorization header.
 * Attaches { id, role } to req.user.
 *
 * NEVER trust role or userId sent in request body/params.
 * All auth context comes from the verified JWT only.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw Errors.unauthorized();
    }

    const token = authHeader.slice(7);

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw Errors.unauthorized('Invalid or expired access token.');
    }

    if (!payload.sub || !payload.role) {
      throw Errors.unauthorized('Malformed token claims.');
    }

    // Verify user still exists in DB and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, isSuspended: true },
    });

    if (!user) {
      throw Errors.unauthorized('Account no longer exists.');
    }

    if (user.isSuspended) {
      throw Errors.forbidden('Account has been suspended. Please contact administrator.');
    }

    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

// ── requireRole middleware factory ────────────────────────────────────────────

/**
 * Enforces role-based access control.
 * Must be used AFTER authenticate middleware.
 *
 * Usage: router.get('/admin/...', authenticate, requireRole('ADMIN'), handler)
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(Errors.unauthorized());
    }

    if (!roles.includes(req.user.role)) {
      return next(Errors.forbidden());
    }

    next();
  };
}
