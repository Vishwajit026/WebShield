import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { signAccessToken } from '../utils/jwt';

// ── Mock Prisma ───────────────────────────────────────────────────────────────

vi.mock('../lib/db', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    session: {
      updateMany: vi.fn(),
    },
    scan: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    finding: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    report: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      if (Array.isArray(cb)) {
        return Promise.all(cb);
      }
      return cb({});
    }),
  },
}));

import prisma from '../lib/db';

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  session: { updateMany: ReturnType<typeof vi.fn> };
  scan: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  finding: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
  report: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

describe('Admin API & RBAC Security Verification', () => {
  const normalUserToken = signAccessToken('user_regular', 'USER');
  const adminUserToken = signAccessToken('admin_master', 'ADMIN');

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});

    // Default user lookup mock
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === 'user_regular') {
        return { id: 'user_regular', role: 'USER', isSuspended: false, email: 'user@example.com' };
      }
      if (where.id === 'admin_master') {
        return { id: 'admin_master', role: 'ADMIN', isSuspended: false, email: 'admin@webshield.io' };
      }
      if (where.id === 'suspended_user') {
        return { id: 'suspended_user', role: 'USER', isSuspended: true, email: 'suspended@example.com' };
      }
      return null;
    });
  });

  describe('1. Strict RBAC Gatekeeping: USER vs ADMIN', () => {
    it('rejects regular USER from accessing /api/admin/overview with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${normalUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/admin/overview');
      expect(res.status).toBe(401);
    });

    it('rejects regular USER from /api/admin/users with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${normalUserToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects regular USER from /api/admin/audit-logs with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${normalUserToken}`);

      expect(res.status).toBe(403);
    });

    it('allows ADMIN to access /api/admin/overview with 200 OK and metrics', async () => {
      mockPrisma.user.count.mockResolvedValue(10);
      mockPrisma.scan.count.mockResolvedValue(25);
      mockPrisma.finding.count.mockResolvedValue(40);
      mockPrisma.finding.groupBy.mockResolvedValue([
        { severity: 'HIGH', _count: { id: 10 } },
        { severity: 'MEDIUM', _count: { id: 30 } },
      ]);
      mockPrisma.report.count.mockResolvedValue(5);
      mockPrisma.scan.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${adminUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics.users.total).toBe(10);
      expect(res.body.data.metrics.findings.bySeverity.high).toBe(10);
    });

    it('allows ADMIN to access /api/admin/health with safe status (no secret exposure)', async () => {
      const res = await request(app)
        .get('/api/admin/health')
        .set('Authorization', `Bearer ${adminUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.components.database.status).toBe('healthy');
      expect(res.body.data.components.scanner.status).toBe('healthy');
      // Ensure no raw passwords or internal secrets leaked
      expect(JSON.stringify(res.body)).not.toContain('DATABASE_URL');
      expect(JSON.stringify(res.body)).not.toContain('JWT_SECRET');
    });
  });

  describe('2. User Suspension, Reactivation & Self-Protection Rules', () => {
    it('suspends an active user, revokes sessions, and logs USER_SUSPENDED', async () => {
      const targetUser = {
        id: 'target_u1',
        email: 'badactor@example.com',
        role: 'USER',
        isSuspended: false,
      };

      mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === 'admin_master') {
          return { id: 'admin_master', role: 'ADMIN', isSuspended: false, email: 'admin@webshield.io' };
        }
        if (where.id === 'target_u1') {
          return targetUser;
        }
        return null;
      });

      mockPrisma.user.update.mockResolvedValue({
        ...targetUser,
        isSuspended: true,
      });
      mockPrisma.session.updateMany.mockResolvedValue({ count: 2 });

      const res = await request(app)
        .post('/api/admin/users/target_u1/suspend')
        .set('Authorization', `Bearer ${adminUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.isSuspended).toBe(true);
    });

    it('Self-Protection: blocks admin from suspending their own account (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/admin/users/admin_master/suspend')
        .set('Authorization', `Bearer ${adminUserToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_SUSPENSION_BLOCKED');
    });

    it('Last-Admin Defense: blocks suspending the only active administrator (400 Bad Request)', async () => {
      mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === 'admin_master') {
          return { id: 'admin_master', role: 'ADMIN', isSuspended: false };
        }
        if (where.id === 'other_admin') {
          return { id: 'other_admin', role: 'ADMIN', isSuspended: false, email: 'other@admin.io' };
        }
        return null;
      });

      mockPrisma.user.count.mockResolvedValue(1); // Only 1 active admin exists

      const res = await request(app)
        .post('/api/admin/users/other_admin/suspend')
        .set('Authorization', `Bearer ${adminUserToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('LAST_ADMIN_PROTECTED');
    });

    it('reactivates a suspended user and logs USER_REACTIVATED', async () => {
      const targetUser = {
        id: 'target_u2',
        email: 'reformed@example.com',
        role: 'USER',
        isSuspended: true,
      };

      mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === 'admin_master') {
          return { id: 'admin_master', role: 'ADMIN', isSuspended: false };
        }
        if (where.id === 'target_u2') {
          return targetUser;
        }
        return null;
      });

      mockPrisma.user.update.mockResolvedValue({
        ...targetUser,
        isSuspended: false,
      });

      const res = await request(app)
        .post('/api/admin/users/target_u2/reactivate')
        .set('Authorization', `Bearer ${adminUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.isSuspended).toBe(false);
    });
  });

  describe('3. Role Management & Privilege Escalation Defenses', () => {
    it('promotes regular USER to ADMIN and logs ROLE_CHANGED', async () => {
      const targetUser = {
        id: 'target_promote',
        email: 'promoted@example.com',
        role: 'USER',
        isSuspended: false,
      };

      mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === 'admin_master') {
          return { id: 'admin_master', role: 'ADMIN', isSuspended: false };
        }
        if (where.id === 'target_promote') {
          return targetUser;
        }
        return null;
      });

      mockPrisma.user.update.mockResolvedValue({
        ...targetUser,
        role: 'ADMIN',
      });

      const res = await request(app)
        .post('/api/admin/users/target_promote/role')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ role: 'ADMIN' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('ADMIN');
    });

    it('Self-Demotion Defense: blocks admin from demoting themselves (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/admin/users/admin_master/role')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ role: 'USER' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_DEMOTION_BLOCKED');
    });

    it('Last-Admin Demotion Defense: blocks demoting the last remaining admin (400 Bad Request)', async () => {
      mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === 'admin_master') {
          return { id: 'admin_master', role: 'ADMIN', isSuspended: false };
        }
        if (where.id === 'other_admin') {
          return { id: 'other_admin', role: 'ADMIN', isSuspended: false, email: 'other@admin.io' };
        }
        return null;
      });

      mockPrisma.user.count.mockResolvedValue(1); // Only 1 active admin

      const res = await request(app)
        .post('/api/admin/users/other_admin/role')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ role: 'USER' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('LAST_ADMIN_PROTECTED');
    });
  });

  describe('4. Suspended User Access Enforcement', () => {
    it('blocks a suspended user token from accessing any authenticated endpoint (403 Forbidden)', async () => {
      const suspendedToken = signAccessToken('suspended_user', 'USER');

      const res = await request(app)
        .get('/api/scans')
        .set('Authorization', `Bearer ${suspendedToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/suspended/i);
    });
  });

  describe('5. Admin Audit Logs Explorer', () => {
    it('returns filtered audit logs with pagination', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log_1',
          action: 'ROLE_CHANGED',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          metadata: { previousRole: 'USER', newRole: 'ADMIN' },
          createdAt: new Date(),
          user: { id: 'admin_master', name: 'Admin', email: 'admin@webshield.io', role: 'ADMIN' },
        },
      ]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/admin/audit-logs?action=ROLE_CHANGED&page=1&limit=10')
        .set('Authorization', `Bearer ${adminUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logs).toHaveLength(1);
      expect(res.body.data.logs[0].action).toBe('ROLE_CHANGED');
    });
  });
});
