import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../app';
import { signAccessToken } from '../utils/jwt';
import { REPORTS_STORAGE_DIR } from '../services/report.service';

// ── Mock Prisma ───────────────────────────────────────────────────────────────

vi.mock('../lib/db', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    scan: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    report: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
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
  };
  report: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

describe('Report API Endpoints & Security Checks', () => {
  const userAToken = signAccessToken('user_a', 'USER');
  const userBToken = signAccessToken('user_b', 'USER');

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      return { id: where.id, role: 'USER' };
    });
  });

  describe('POST /api/scans/:id/reports', () => {
    it('generates a new PDF report for a completed scan owned by user', async () => {
      const mockScan = {
        id: 'scan_comp_1',
        userId: 'user_a',
        status: 'COMPLETED',
        securityScore: 88,
        startedAt: new Date('2026-08-27T10:00:00Z'),
        completedAt: new Date('2026-08-27T10:00:04Z'),
        totalFindings: 1,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 1,
        lowCount: 0,
        infoCount: 0,
        target: {
          id: 't-1',
          userId: 'user_a',
          url: 'https://example.com',
          normalizedUrl: 'https://example.com',
          hostname: 'example.com',
        },
        findings: [
          {
            id: 'f-1',
            scanId: 'scan_comp_1',
            scanner: 'headers',
            title: 'Missing CSP',
            category: 'HEADERS',
            severity: 'MEDIUM',
            confidence: 'HIGH',
            description: 'CSP is missing.',
            evidence: 'headers: none',
            impact: 'XSS risk',
            remediation: 'Add CSP',
            reference: 'https://owasp.org',
            affectedComponent: 'CSP',
          },
        ],
      };

      mockPrisma.scan.findUnique.mockResolvedValue(mockScan);
      mockPrisma.report.findFirst.mockResolvedValue(null); // No previous report

      const mockCreatedReport = {
        id: 'report_new_1',
        scanId: 'scan_comp_1',
        userId: 'user_a',
        status: 'GENERATING',
        fileName: 'webshield-example.com-2026-08-27.pdf',
        filePath: '',
      };

      mockPrisma.report.create.mockResolvedValue(mockCreatedReport);
      mockPrisma.report.update.mockResolvedValue({
        ...mockCreatedReport,
        status: 'COMPLETED',
        filePath: path.join(REPORTS_STORAGE_DIR, 'report_new_1.pdf'),
        fileSize: 12345,
        generatedAt: new Date(),
        createdAt: new Date(),
      });

      const res = await request(app)
        .post('/api/scans/scan_comp_1/reports')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.report.id).toBe('report_new_1');
      expect(res.body.data.report.status).toBe('COMPLETED');
      expect(res.body.data.report.targetHostname).toBe('example.com');
      // Ensure local server file paths are not exposed
      expect(res.body.data.report.filePath).toBeUndefined();
    });

    it('IDOR: prevents User B from generating report for User A scan (403 Forbidden)', async () => {
      mockPrisma.scan.findUnique.mockResolvedValue({
        id: 'scan_comp_1',
        userId: 'user_a', // Owned by User A
        status: 'COMPLETED',
        target: { hostname: 'example.com' },
      });

      const res = await request(app)
        .post('/api/scans/scan_comp_1/reports')
        .set('Authorization', `Bearer ${userBToken}`); // User B requesting

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects report generation for non-completed scans (400 Bad Request)', async () => {
      mockPrisma.scan.findUnique.mockResolvedValue({
        id: 'scan_running_1',
        userId: 'user_a',
        status: 'RUNNING',
        target: { hostname: 'example.com' },
      });

      const res = await request(app)
        .post('/api/scans/scan_running_1/reports')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/non-completed scan/i);
    });
  });

  describe('GET /api/reports/:id', () => {
    it('returns report metadata for authorized owner', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({
        id: 'rep_1',
        scanId: 'scan_1',
        userId: 'user_a',
        status: 'COMPLETED',
        fileName: 'webshield-example.com-2026-08-27.pdf',
        fileSize: 45000,
        createdAt: new Date(),
        generatedAt: new Date(),
        scan: {
          securityScore: 92,
          target: { hostname: 'example.com', url: 'https://example.com' },
        },
      });

      const res = await request(app)
        .get('/api/reports/rep_1')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.report.id).toBe('rep_1');
      expect(res.body.data.report.targetHostname).toBe('example.com');
    });

    it('IDOR: rejects User B when accessing User A report metadata (403 Forbidden)', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({
        id: 'rep_1',
        userId: 'user_a', // Owned by User A
        scan: { target: {} },
      });

      const res = await request(app)
        .get('/api/reports/rep_1')
        .set('Authorization', `Bearer ${userBToken}`); // User B requesting

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/reports/:id/download', () => {
    it('streams PDF binary with proper attachment headers for owner', async () => {
      // Create a temporary dummy file in storage dir for test
      if (!fs.existsSync(REPORTS_STORAGE_DIR)) {
        fs.mkdirSync(REPORTS_STORAGE_DIR, { recursive: true });
      }
      const testFilePath = path.join(REPORTS_STORAGE_DIR, 'rep_stream_test.pdf');
      fs.writeFileSync(testFilePath, '%PDF-1.4 test binary dummy content');

      mockPrisma.report.findUnique.mockResolvedValue({
        id: 'rep_stream_test',
        scanId: 'scan_1',
        userId: 'user_a',
        status: 'COMPLETED',
        fileName: 'webshield-example.com-2026-08-27.pdf',
        filePath: testFilePath,
      });

      const res = await request(app)
        .get('/api/reports/rep_stream_test/download')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment; filename="webshield-example.com-2026-08-27.pdf"');
      expect(Buffer.isBuffer(res.body) || typeof res.text === 'string').toBe(true);

      // Cleanup
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    });

    it('Path Traversal Prevention: rejects malicious traversal reportId (400 Bad Request)', async () => {
      const res = await request(app)
        .get('/api/reports/..%2F..%2Fetc%2Fpasswd/download')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Invalid report identifier/i);
    });

    it('IDOR: rejects User B when attempting to download User A report (403 Forbidden)', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({
        id: 'rep_1',
        userId: 'user_a',
        status: 'COMPLETED',
        filePath: path.join(REPORTS_STORAGE_DIR, 'rep_1.pdf'),
      });

      const res = await request(app)
        .get('/api/reports/rep_1/download')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/reports', () => {
    it('returns paginated list of reports for the authenticated user', async () => {
      mockPrisma.report.findMany.mockResolvedValue([
        {
          id: 'rep_1',
          scanId: 'scan_1',
          userId: 'user_a',
          status: 'COMPLETED',
          fileName: 'webshield-site1.com-2026-08-27.pdf',
          fileSize: 50000,
          createdAt: new Date(),
          generatedAt: new Date(),
          scan: {
            securityScore: 90,
            target: { hostname: 'site1.com', url: 'https://site1.com' },
          },
        },
      ]);
      mockPrisma.report.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/reports?page=1&limit=10')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reports).toHaveLength(1);
      expect(res.body.data.reports[0].targetHostname).toBe('site1.com');
      expect(res.body.data.pagination.total).toBe(1);
    });
  });
});
