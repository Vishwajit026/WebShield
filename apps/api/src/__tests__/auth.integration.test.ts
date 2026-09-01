import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { hashPassword } from '../utils/password';
import { signAccessToken } from '../utils/jwt';

// ── Mock Prisma ───────────────────────────────────────────────────────────────

vi.mock('../lib/db', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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
    update: ReturnType<typeof vi.fn>;
  };
  session: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

describe('Auth API Integration Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  describe('POST /api/auth/register', () => {
    it('returns 201 with user data on valid registration', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user_123',
        name: 'Alice Smith',
        email: 'alice@example.com',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Smith',
          email: 'alice@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('alice@example.com');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('returns 422 for invalid password format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Smith',
          email: 'alice@example.com',
          password: 'short',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 200, access token, and sets HttpOnly cookie', async () => {
      const pwHash = await hashPassword('ValidPass123!');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_123',
        name: 'Alice Smith',
        email: 'alice@example.com',
        passwordHash: pwHash,
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({
        id: 'sess_123',
        userId: 'user_123',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'ValidPass123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user.email).toBe('alice@example.com');

      // Check HttpOnly cookie
      const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
      expect(cookies).toBeDefined();
      expect(cookies?.some(c => c.includes('ws_refresh=') && c.includes('HttpOnly'))).toBe(true);
    });

    it('returns 401 for incorrect credentials', async () => {
      const pwHash = await hashPassword('ValidPass123!');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_123',
        name: 'Alice Smith',
        email: 'alice@example.com',
        passwordHash: pwHash,
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns user profile when authenticated', async () => {
      const token = signAccessToken('user_123', 'USER');

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_123',
        name: 'Alice Smith',
        email: 'alice@example.com',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe('user_123');
    });

    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears refresh cookie and logs out', async () => {
      const token = signAccessToken('user_123', 'USER');

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', ['ws_refresh=mock_token_value']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
      expect(cookies).toBeDefined();
      expect(cookies?.some(c => c.includes('ws_refresh=;'))).toBe(true);
    });
  });
});
