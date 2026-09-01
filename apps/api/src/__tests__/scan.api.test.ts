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
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb({
        finding: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
        scan: {
          update: vi.fn().mockResolvedValue({
            id: 'scan_1',
            userId: 'user_a',
            targetId: 'target_1',
            status: 'COMPLETED',
            securityScore: 85,
            totalFindings: 2,
            target: { url: 'https://example.com', hostname: 'example.com' },
            findings: [],
          }),
        },
      });
    }),
  },
}));

// Mock Security Engine network scan to avoid real external requests in unit tests
vi.mock('@webshield/security-engine', async () => {
  const actual = await vi.importActual<typeof import('@webshield/security-engine')>(
    '@webshield/security-engine'
  );
  return {
    ...actual,
    validateTargetDestination: vi.fn().mockImplementation(async (hostname: string) => {
      const lower = hostname.toLowerCase();
      if (
        lower === 'localhost' ||
        lower.endsWith('.localhost') ||
        lower === '127.0.0.1' ||
        lower === '169.254.169.254'
      ) {
        return {
          isSafe: false,
          resolvedIps: [hostname],
          reason: `Target '${hostname}' resolves to a local, internal, or prohibited address.`,
        };
      }
      return {
        isSafe: true,
        resolvedIps: ['93.184.216.34'],
      };
    }),
    ScannerEngine: vi.fn().mockImplementation(() => ({
      runScan: vi.fn().mockResolvedValue({
        targetUrl: 'https://example.com',
        normalizedUrl: 'https://example.com/',
        hostname: 'example.com',
        startedAt: new Date(),
        completedAt: new Date(),
        findings: [
          {
            scanner: 'headers',
            title: 'Missing Content-Security-Policy Header',
            category: 'HTTP Headers',
            severity: 'MEDIUM',
            confidence: 'HIGH',
            description: 'CSP missing',
          },
        ],
        score: {
          score: 85,
          grade: 'Good',
          criticalCount: 0,
          highCount: 0,
          mediumCount: 1,
          lowCount: 0,
          infoCount: 0,
          totalFindings: 1,
        },
        executedScanners: ['headers'],
        scannerErrors: {},
      }),
    })),
  };
});

import prisma from '../lib/db';

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  target: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  scan: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  finding: {
    findMany: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

describe('Scan API Endpoints & Security Checks', () => {
  const userAToken = signAccessToken('user_a', 'USER');
  const userBToken = signAccessToken('user_b', 'USER');

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.scan.count.mockResolvedValue(1);
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      return { id: where.id, role: 'USER' };
    });
  });

  describe('POST /api/scans', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/scans').send({ url: 'https://example.com' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 422 for missing or invalid URL body', async () => {
      const res = await request(app)
        .post('/api/scans')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('rejects SSRF target localhost (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/scans')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ url: 'http://localhost:5000' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/SSRF Protection|prohibited/i);
    });

    it('rejects SSRF target 127.0.0.1 (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/scans')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ url: 'http://127.0.0.1:8080' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/SSRF Protection|private|prohibited/i);
    });

    it('rejects SSRF target cloud metadata 169.254.169.254 (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/scans')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ url: 'http://169.254.169.254/latest/meta-data/' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/SSRF Protection/i);
    });

    it('creates and executes scan on valid public target', async () => {
      mockPrisma.target.findFirst.mockResolvedValue(null);
      mockPrisma.target.create.mockResolvedValue({
        id: 'target_1',
        userId: 'user_a',
        url: 'https://example.com',
        normalizedUrl: 'https://example.com/',
        hostname: 'example.com',
      });
      mockPrisma.scan.create.mockResolvedValue({
        id: 'scan_1',
        userId: 'user_a',
        targetId: 'target_1',
        status: 'RUNNING',
      });

      const res = await request(app)
        .post('/api/scans')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ url: 'https://example.com' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scan).toHaveProperty('id');
    });
  });

  describe('GET /api/scans/:id (IDOR Protection)', () => {
    it('allows User A to view their own scan', async () => {
      mockPrisma.scan.findUnique.mockResolvedValue({
        id: 'scan_a1',
        userId: 'user_a',
        status: 'COMPLETED',
        securityScore: 92,
        target: { url: 'https://example.com' },
        findings: [],
      });

      const res = await request(app)
        .get('/api/scans/scan_a1')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scan.id).toBe('scan_a1');
    });

    it('IDOR: blocks User B from viewing User A scan (403 Forbidden)', async () => {
      mockPrisma.scan.findUnique.mockResolvedValue({
        id: 'scan_a1',
        userId: 'user_a', // belongs to User A
        status: 'COMPLETED',
        target: { url: 'https://example.com' },
        findings: [],
      });

      const res = await request(app)
        .get('/api/scans/scan_a1')
        .set('Authorization', `Bearer ${userBToken}`); // User B requesting

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 for non-existent scan', async () => {
      mockPrisma.scan.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/scans/nonexistent')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/scans/:id/findings (IDOR Protection)', () => {
    it('allows User A to view findings of their own scan', async () => {
      mockPrisma.scan.findUnique.mockResolvedValue({
        id: 'scan_a1',
        userId: 'user_a',
      });
      mockPrisma.finding.findMany.mockResolvedValue([
        {
          id: 'f1',
          scanId: 'scan_a1',
          title: 'Missing CSP',
          severity: 'MEDIUM',
          category: 'HTTP Headers',
        },
      ]);

      const res = await request(app)
        .get('/api/scans/scan_a1/findings')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.findings).toHaveLength(1);
    });

    it('IDOR: blocks User B from viewing findings of User A scan (403 Forbidden)', async () => {
      mockPrisma.scan.findUnique.mockResolvedValue({
        id: 'scan_a1',
        userId: 'user_a',
      });

      const res = await request(app)
        .get('/api/scans/scan_a1/findings')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/scans', () => {
    it('returns list of scans belonging to the authenticated user with pagination metadata', async () => {
      mockPrisma.scan.count.mockResolvedValue(1);
      mockPrisma.scan.findMany.mockResolvedValue([
        {
          id: 'scan_a1',
          userId: 'user_a',
          status: 'COMPLETED',
          target: { url: 'https://example.com' },
        },
      ]);

      const res = await request(app)
        .get('/api/scans?page=1&limit=10')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scans).toHaveLength(1);
      expect(res.body.data.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(mockPrisma.scan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user_a' }, take: 10, skip: 0 })
      );
    });

    it('caps excessive limit query to 100 max', async () => {
      mockPrisma.scan.count.mockResolvedValue(0);
      mockPrisma.scan.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/scans?limit=999999')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.limit).toBe(100);
      expect(mockPrisma.scan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });
  });
});
