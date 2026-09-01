import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginUser, LoginSchema } from '../services/auth.service';
import { hashPassword } from '../utils/password';

// ── Mock Prisma ───────────────────────────────────────────────────────────────

vi.mock('../lib/db', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    session: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import prisma from '../lib/db';

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  session: { create: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

// ── LoginSchema validation ────────────────────────────────────────────────────

describe('LoginSchema validation', () => {
  it('accepts valid credentials', () => {
    const result = LoginSchema.safeParse({
      email: 'user@example.com',
      password: 'anypassword',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = LoginSchema.safeParse({
      email: 'not-an-email',
      password: 'anypassword',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = LoginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

// ── loginUser service ─────────────────────────────────────────────────────────

describe('loginUser service', () => {
  let validHash: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    validHash = await hashPassword('Str0ngPass1');
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.session.create.mockResolvedValue({
      id: 'session123',
      userId: 'user123',
      tokenHash: 'hash',
      userAgent: 'test',
      ipAddress: '127.0.0.1',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
    });
  });

  it('returns accessToken and refreshToken on valid credentials', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user123',
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: validHash,
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    });

    const result = await loginUser(
      { email: 'test@example.com', password: 'Str0ngPass1' },
      { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
    );

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects invalid password with generic error', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user123',
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: validHash,
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    });

    await expect(
      loginUser({ email: 'test@example.com', password: 'WrongPass1' }, {})
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
      message: 'Invalid email or password.',
    });
  });

  it('rejects non-existent email with the SAME generic error (no enumeration)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      loginUser({ email: 'nobody@example.com', password: 'AnyPass1' }, {})
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
      message: 'Invalid email or password.',
    });
  });

  it('creates a session on successful login', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user123',
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: validHash,
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    });

    await loginUser(
      { email: 'test@example.com', password: 'Str0ngPass1' },
      {}
    );

    expect(mockPrisma.session.create).toHaveBeenCalledOnce();
    // Token hash stored, not raw token
    const createCall = mockPrisma.session.create.mock.calls[0][0];
    expect(createCall.data).toHaveProperty('tokenHash');
    expect(createCall.data).not.toHaveProperty('refreshToken');
  });

  it('normalizes email before lookup (case-insensitive)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      loginUser({ email: 'TEST@EXAMPLE.COM', password: 'AnyPass1' }, {})
    ).rejects.toThrow();

    // Verify it was called with normalized (lowercase) email
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
    });
  });
});
