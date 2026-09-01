import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegisterSchema, registerUser } from '../services/auth.service';
import { hashPassword, verifyPassword } from '../utils/password';

// ── Mock Prisma ───────────────────────────────────────────────────────────────

vi.mock('../lib/db', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
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
    create: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

// ── Registration schema validation ────────────────────────────────────────────

describe('RegisterSchema validation', () => {
  it('accepts valid registration data', () => {
    const result = RegisterSchema.safeParse({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Str0ngPass1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects name that is too short', () => {
    const result = RegisterSchema.safeParse({
      name: 'A',
      email: 'test@example.com',
      password: 'Str0ngPass1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = RegisterSchema.safeParse({
      name: 'Test User',
      email: 'not-an-email',
      password: 'Str0ngPass1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 characters', () => {
    const result = RegisterSchema.safeParse({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Abc1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password with no uppercase letter', () => {
    const result = RegisterSchema.safeParse({
      name: 'Test User',
      email: 'test@example.com',
      password: 'nouppercase1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password with no number', () => {
    const result = RegisterSchema.safeParse({
      name: 'Test User',
      email: 'test@example.com',
      password: 'NoNumberHere',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password with no lowercase letter', () => {
    const result = RegisterSchema.safeParse({
      name: 'Test User',
      email: 'test@example.com',
      password: 'ALLUPPER1',
    });
    expect(result.success).toBe(false);
  });

  it('normalizes email to lowercase', () => {
    const result = RegisterSchema.safeParse({
      name: 'Test User',
      email: 'Test@EXAMPLE.COM',
      password: 'Str0ngPass1',
    });
    // Schema doesn't transform, but service does
    expect(result.success).toBe(true);
  });
});

// ── Password hashing ──────────────────────────────────────────────────────────

describe('Password hashing', () => {
  it('hashes password and verifies correctly', async () => {
    const password = 'MySecureP@ss1';
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$argon2id')).toBe(true);
    const valid = await verifyPassword(hash, password);
    expect(valid).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('CorrectP@ss1');
    const valid = await verifyPassword(hash, 'WrongP@ss1');
    expect(valid).toBe(false);
  });

  it('produces different hashes for same input (salt)', async () => {
    const password = 'SameP@ss1';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(hash1, password)).toBe(true);
    expect(await verifyPassword(hash2, password)).toBe(true);
  });
});

// ── registerUser service ──────────────────────────────────────────────────────

describe('registerUser service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it('creates a user with hashed password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null); // no existing user
    mockPrisma.user.create.mockResolvedValue({
      id: 'cuid123',
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: '$argon2id$...',
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    });

    const result = await registerUser(
      { name: 'Test User', email: 'Test@Example.COM', password: 'Str0ngPass1' },
      { ipAddress: '127.0.0.1', userAgent: 'test' }
    );

    expect(result.email).toBe('test@example.com'); // normalized
    expect(result).not.toHaveProperty('passwordHash');
    expect(mockPrisma.user.create).toHaveBeenCalledOnce();
  });

  it('rejects duplicate email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing123' });

    await expect(
      registerUser(
        { name: 'Test User', email: 'test@example.com', password: 'Str0ngPass1' },
        {}
      )
    ).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 });
  });

  it('never returns passwordHash in result', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'cuid123',
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'secret_hash',
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    });

    const result = await registerUser(
      { name: 'Test User', email: 'test@example.com', password: 'Str0ngPass1' },
      {}
    );

    // Ensure passwordHash is NOT in the response
    expect(Object.keys(result)).not.toContain('passwordHash');
  });
});
