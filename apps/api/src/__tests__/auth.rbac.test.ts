import { describe, it, expect, vi } from 'vitest';
import { requireRole } from '../middleware/authenticate';
import { Role } from '@prisma/client';

// ── RBAC middleware tests ─────────────────────────────────────────────────────

// We mock Prisma for the authenticate middleware to avoid DB deps
vi.mock('../lib/db', () => ({
  default: {
    user: { findUnique: vi.fn() },
  },
}));

function makeReq(role?: Role, userId?: string) {
  return {
    user: role && userId ? { id: userId, role } : undefined,
    headers: {},
  } as unknown as import('express').Request;
}

function makeRes() {
  return {} as import('express').Response;
}

function makeNext() {
  return vi.fn() as unknown as import('express').NextFunction;
}

describe('requireRole middleware', () => {
  it('USER passes USER endpoint', () => {
    const req = makeReq(Role.USER, 'user123');
    const next = makeNext();

    requireRole(Role.USER)(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(); // called with no args = success
  });

  it('USER is denied ADMIN endpoint', () => {
    const req = makeReq(Role.USER, 'user123');
    const next = makeNext();

    requireRole(Role.ADMIN)(req, makeRes(), next);

    // next called with an error
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: 'FORBIDDEN' })
    );
  });

  it('ADMIN passes ADMIN endpoint', () => {
    const req = makeReq(Role.ADMIN, 'admin123');
    const next = makeNext();

    requireRole(Role.ADMIN)(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('ADMIN can also access USER endpoint (if allowed)', () => {
    const req = makeReq(Role.ADMIN, 'admin123');
    const next = makeNext();

    requireRole(Role.USER, Role.ADMIN)(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('unauthenticated user (no req.user) is rejected', () => {
    const req = makeReq(); // no user attached
    const next = makeNext();

    requireRole(Role.USER)(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, code: 'UNAUTHORIZED' })
    );
  });

  it('authorization is enforced server-side regardless of frontend claims', () => {
    // Simulate a request where someone forged a USER role in the body
    // The middleware only reads from req.user which comes from JWT verification
    const req = {
      user: { id: 'user123', role: Role.USER }, // Set by JWT middleware
      body: { role: 'ADMIN' }, // Forged body — should be ignored
    } as unknown as import('express').Request;

    const next = makeNext();
    requireRole(Role.ADMIN)(req, makeRes(), next);

    // Should be denied based on req.user.role (USER), not body.role (ADMIN)
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 })
    );
  });
});
