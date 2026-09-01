import { describe, it, expect, vi, beforeEach } from 'vitest';
import { revokeSession, revokeOtherSessions, getActiveSessions } from '../services/session.service';

// ── Mock Prisma ───────────────────────────────────────────────────────────────

vi.mock('../lib/db', () => ({
  default: {
    session: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import prisma from '../lib/db';

const mockPrisma = prisma as unknown as {
  session: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

// ── Session revocation ────────────────────────────────────────────────────────

describe('revokeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it('successfully revokes own session', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({
      id: 'session123',
      userId: 'user123',
      revokedAt: null,
    });
    mockPrisma.session.update.mockResolvedValue({});

    await expect(
      revokeSession('session123', 'user123', { ipAddress: '127.0.0.1' })
    ).resolves.toBeUndefined();

    expect(mockPrisma.session.update).toHaveBeenCalledWith({
      where: { id: 'session123' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  // ── IDOR/BOLA Test ────────────────────────────────────────────────────────
  it('IDOR: User A cannot revoke User B session', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({
      id: 'session-of-user-b',
      userId: 'user-b-id',
      revokedAt: null,
    });

    await expect(
      revokeSession('session-of-user-b', 'user-a-id', {})
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });

    // Ensure the session was NOT updated
    expect(mockPrisma.session.update).not.toHaveBeenCalled();
  });

  it('returns 404 for non-existent session', async () => {
    mockPrisma.session.findUnique.mockResolvedValue(null);

    await expect(
      revokeSession('nonexistent', 'user123', {})
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('is idempotent for already-revoked session', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({
      id: 'session123',
      userId: 'user123',
      revokedAt: new Date(), // already revoked
    });

    await expect(
      revokeSession('session123', 'user123', {})
    ).resolves.toBeUndefined();

    // Should NOT call update again
    expect(mockPrisma.session.update).not.toHaveBeenCalled();
  });
});

// ── Get active sessions ───────────────────────────────────────────────────────

describe('getActiveSessions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only active (non-revoked, non-expired) sessions', async () => {
    const futureDateStr = new Date(Date.now() + 1000000).toISOString();
    mockPrisma.session.findMany.mockResolvedValue([
      {
        id: 'sess1',
        userAgent: 'Chrome/Test',
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
        expiresAt: new Date(futureDateStr),
      },
    ]);

    const sessions = await getActiveSessions('user123');

    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('sess1');
    // Ensure no tokenHash in result
    expect(sessions[0]).not.toHaveProperty('tokenHash');
  });
});

// ── Revoke other sessions ─────────────────────────────────────────────────────

describe('revokeOtherSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it('revokes all sessions except current', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ id: 'current-session' });
    mockPrisma.session.updateMany.mockResolvedValue({ count: 2 });

    const count = await revokeOtherSessions('user123', 'current-token-hash', {});

    expect(count).toBe(2);
    expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user123',
        revokedAt: null,
        NOT: { id: 'current-session' },
      },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
