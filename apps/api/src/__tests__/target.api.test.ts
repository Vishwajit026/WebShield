import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { signAccessToken } from '../utils/jwt';

// ── Mock Prisma ───────────────────────────────────────────────────────────────

vi.mock('../lib/db', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    target: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import prisma from '../lib/db';

const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  target: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

describe('Target Management API Endpoints & IDOR Isolation', () => {
  const userAToken = signAccessToken('user_a', 'USER');
  const userBToken = signAccessToken('user_b', 'USER');

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      return { id: where.id, role: 'USER' };
    });
  });

  describe('GET /api/targets', () => {
    it('returns paginated list of targets scoped to authenticated user', async () => {
      mockPrisma.target.count.mockResolvedValue(1);
      mockPrisma.target.findMany.mockResolvedValue([
        {
          id: 'target_1',
          userId: 'user_a',
          url: 'https://example.com',
          normalizedUrl: 'https://example.com/',
          hostname: 'example.com',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { scans: 3 },
          scans: [
            {
              id: 'scan_1',
              status: 'COMPLETED',
              securityScore: 88,
              completedAt: new Date(),
              createdAt: new Date(),
              criticalCount: 0,
              highCount: 0,
              mediumCount: 1,
              lowCount: 2,
              infoCount: 1,
            },
          ],
        },
      ]);

      const res = await request(app)
        .get('/api/targets?page=1&limit=10')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.targets).toHaveLength(1);
      expect(res.body.targets[0].hostname).toBe('example.com');
      expect(res.body.targets[0].totalScans).toBe(3);
      expect(res.body.targets[0].latestScan.securityScore).toBe(88);
      expect(mockPrisma.target.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user_a' } })
      );
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/targets');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/targets/:id', () => {
    it('allows User A to view their own target', async () => {
      mockPrisma.target.findFirst.mockResolvedValue({
        id: 'target_1',
        userId: 'user_a',
        url: 'https://example.com',
        normalizedUrl: 'https://example.com/',
        hostname: 'example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { scans: 1 },
        scans: [],
      });

      const res = await request(app)
        .get('/api/targets/target_1')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('target_1');
    });

    it('IDOR: returns 404 when User B requests User A target', async () => {
      mockPrisma.target.findFirst.mockResolvedValue(null); // findFirst filters by userId: 'user_b' -> not found

      const res = await request(app)
        .get('/api/targets/target_1')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
