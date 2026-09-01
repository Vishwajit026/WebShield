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
    scan: {
      count: vi.fn(),
      aggregate: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import prisma from '../lib/db';

const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  scan: {
    count: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

describe('Dashboard API Endpoints', () => {
  const userAToken = signAccessToken('user_a', 'USER');

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      return { id: where.id, role: 'USER' };
    });
  });

  describe('GET /api/dashboard/overview', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/dashboard/overview');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns calculated metrics for authenticated user', async () => {
      // Mock counts
      mockPrisma.scan.count
        .mockResolvedValueOnce(12) // totalScans
        .mockResolvedValueOnce(10) // completedScans
        .mockResolvedValueOnce(1)  // activeScans
        .mockResolvedValueOnce(1); // failedScans

      mockPrisma.scan.aggregate.mockResolvedValueOnce({
        _sum: {
          totalFindings: 25,
          criticalCount: 2,
          highCount: 5,
          mediumCount: 10,
          lowCount: 5,
          infoCount: 3,
        },
      });

      mockPrisma.scan.findFirst.mockResolvedValueOnce({
        id: 'scan_latest',
        securityScore: 82,
        status: 'COMPLETED',
        completedAt: new Date('2026-08-27T12:00:00Z'),
        totalFindings: 4,
        target: {
          url: 'https://example.com',
          hostname: 'example.com',
        },
      });

      mockPrisma.scan.findMany
        .mockResolvedValueOnce([
          {
            id: 'scan_latest',
            status: 'COMPLETED',
            securityScore: 82,
            totalFindings: 4,
            criticalCount: 0,
            highCount: 1,
            createdAt: new Date('2026-08-27T11:55:00Z'),
            completedAt: new Date('2026-08-27T12:00:00Z'),
            target: {
              url: 'https://example.com',
              hostname: 'example.com',
            },
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'scan_latest',
            status: 'COMPLETED',
            securityScore: 82,
            totalFindings: 4,
            criticalCount: 0,
            highCount: 1,
            createdAt: new Date('2026-08-27T11:55:00Z'),
            completedAt: new Date('2026-08-27T12:00:00Z'),
            target: {
              url: 'https://example.com',
              hostname: 'example.com',
            },
          },
        ]);

      const res = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(
        expect.objectContaining({
          totalScans: 12,
          completedScans: 10,
          activeScans: 1,
          failedScans: 1,
          totalFindings: 25,
          severityCounts: {
            critical: 2,
            high: 5,
            medium: 10,
            low: 5,
            info: 3,
          },
          latestScan: expect.objectContaining({
            id: 'scan_latest',
            securityScore: 82,
            grade: 'Good',
            hostname: 'example.com',
          }),
          recentScans: expect.any(Array),
        })
      );
    });

    it('handles empty state correctly when user has zero scans', async () => {
      mockPrisma.scan.count.mockResolvedValue(0);
      mockPrisma.scan.aggregate.mockResolvedValue({
        _sum: {
          totalFindings: null,
          criticalCount: null,
          highCount: null,
          mediumCount: null,
          lowCount: null,
          infoCount: null,
        },
      });
      mockPrisma.scan.findFirst.mockResolvedValue(null);
      mockPrisma.scan.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalScans).toBe(0);
      expect(res.body.data.totalFindings).toBe(0);
      expect(res.body.data.latestScan).toBeNull();
      expect(res.body.data.recentScans).toEqual([]);
    });
  });
});
