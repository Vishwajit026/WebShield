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
      create: vi.fn(),
    },
    scan: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    finding: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({})),
  },
}));

import prisma from '../lib/db';

const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  scan: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

describe('Scan Comparison & Cancellation API Endpoints', () => {
  const userAToken = signAccessToken('user_a', 'USER');
  const userBToken = signAccessToken('user_b', 'USER');

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      return { id: where.id, role: 'USER' };
    });
  });

  describe('GET /api/scans/compare', () => {
    it('compares two completed scans for the authenticated user', async () => {
      const scan1 = {
        id: 'scan_1',
        userId: 'user_a',
        status: 'COMPLETED',
        securityScore: 70,
        startedAt: new Date('2026-08-01T10:00:00Z'),
        completedAt: new Date('2026-08-01T10:00:05Z'),
        target: { id: 't1', url: 'https://example.com', hostname: 'example.com' },
        findings: [
          {
            id: 'f1',
            scanner: 'headers',
            category: 'HEADERS',
            title: 'Missing Content-Security-Policy Header',
            severity: 'MEDIUM',
            confidence: 'HIGH',
            description: 'CSP missing',
            affectedComponent: 'HTTP Response Headers',
          },
          {
            id: 'f2',
            scanner: 'headers',
            category: 'HEADERS',
            title: 'Missing Strict-Transport-Security (HSTS) Header',
            severity: 'MEDIUM',
            confidence: 'HIGH',
            description: 'HSTS missing',
            affectedComponent: 'HTTP Response Headers',
          },
        ],
      };

      const scan2 = {
        id: 'scan_2',
        userId: 'user_a',
        status: 'COMPLETED',
        securityScore: 85,
        startedAt: new Date('2026-08-02T10:00:00Z'),
        completedAt: new Date('2026-08-02T10:00:05Z'),
        target: { id: 't1', url: 'https://example.com', hostname: 'example.com' },
        findings: [
          {
            id: 'f3',
            scanner: 'headers',
            category: 'HEADERS',
            title: 'Missing Strict-Transport-Security (HSTS) Header',
            severity: 'MEDIUM',
            confidence: 'HIGH',
            description: 'HSTS missing',
            affectedComponent: 'HTTP Response Headers',
          },
        ],
      };

      mockPrisma.scan.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === 'scan_1') return scan1;
        if (where.id === 'scan_2') return scan2;
        return null;
      });

      const res = await request(app)
        .get('/api/scans/compare?before=scan_1&after=scan_2')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.previousScore).toBe(70);
      expect(res.body.data.currentScore).toBe(85);
      expect(res.body.data.scoreDifference).toBe(15); // +15 improvement

      expect(res.body.data.resolvedCount).toBe(1);
      expect(res.body.data.persistentCount).toBe(1);
      expect(res.body.data.newCount).toBe(0);

      const resolved = res.body.data.findings.filter((f: { status: string }) => f.status === 'RESOLVED');
      expect(resolved).toHaveLength(1);
      expect(resolved[0].title).toBe('Missing Content-Security-Policy Header');
    });

    it('IDOR: prevents User B from comparing scans belonging to User A (403 Forbidden)', async () => {
      mockPrisma.scan.findUnique.mockResolvedValue({
        id: 'scan_1',
        userId: 'user_a', // belongs to User A
        status: 'COMPLETED',
        findings: [],
      });

      const res = await request(app)
        .get('/api/scans/compare?before=scan_1&after=scan_2')
        .set('Authorization', `Bearer ${userBToken}`); // User B requesting

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects comparison when scans are not completed (400 Bad Request)', async () => {
      mockPrisma.scan.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === 'scan_1') {
          return { id: 'scan_1', userId: 'user_a', status: 'RUNNING', findings: [] };
        }
        return { id: 'scan_2', userId: 'user_a', status: 'COMPLETED', findings: [] };
      });

      const res = await request(app)
        .get('/api/scans/compare?before=scan_1&after=scan_2')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/not completed/i);
    });
  });

  describe('POST /api/scans/:id/cancel', () => {
    it('cancels a running scan for authenticated user', async () => {
      mockPrisma.scan.findUnique.mockResolvedValue({
        id: 'scan_running_1',
        userId: 'user_a',
        status: 'RUNNING',
      });

      mockPrisma.scan.update.mockResolvedValue({
        id: 'scan_running_1',
        userId: 'user_a',
        status: 'CANCELLED',
      });

      const res = await request(app)
        .post('/api/scans/scan_running_1/cancel')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scan.status).toBe('CANCELLED');
    });

    it('rejects cancellation of an already COMPLETED scan (400 Bad Request)', async () => {
      mockPrisma.scan.findUnique.mockResolvedValue({
        id: 'scan_done_1',
        userId: 'user_a',
        status: 'COMPLETED',
      });

      const res = await request(app)
        .post('/api/scans/scan_done_1/cancel')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Cannot cancel/i);
    });

    it('IDOR: prevents User B from cancelling User A scan (403 Forbidden)', async () => {
      mockPrisma.scan.findUnique.mockResolvedValue({
        id: 'scan_running_1',
        userId: 'user_a',
        status: 'RUNNING',
      });

      const res = await request(app)
        .post('/api/scans/scan_running_1/cancel')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Concurrency Limits', () => {
    it('blocks scan creation when user has >= 2 active scans (400 Bad Request)', async () => {
      mockPrisma.scan.count.mockResolvedValue(2); // 2 active scans already running

      const res = await request(app)
        .post('/api/scans')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ url: 'https://example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Active scan limit reached/i);
    });
  });
});
