import fs from 'fs';
import { Role, AuditAction, ScanStatus, Severity } from '@prisma/client';
import prisma from '../lib/db';
import { AppError } from '../utils/errors';
import { writeAuditLog } from './auditLog.service';
import { REPORTS_STORAGE_DIR } from './report.service';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AdminPaginationParams {
  page?: number;
  limit?: number;
}

export interface AdminUserFilterParams extends AdminPaginationParams {
  search?: string;
  role?: string;
  status?: 'ALL' | 'ACTIVE' | 'SUSPENDED';
}

export interface AdminScanFilterParams extends AdminPaginationParams {
  status?: string;
  target?: string;
  userEmail?: string;
}

export interface AdminFindingFilterParams extends AdminPaginationParams {
  severity?: string;
  category?: string;
  scanner?: string;
  search?: string;
}

export interface AdminAuditLogFilterParams extends AdminPaginationParams {
  action?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

// ── 1. Admin Overview & Dashboard Metrics ─────────────────────────────────────

export async function getAdminOverview() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalUsers,
    activeUsersCount,
    suspendedUsersCount,
    totalScans,
    scansToday,
    activeScans,
    completedScans,
    failedScans,
    totalFindings,
    severityGroups,
    totalReports,
    recentFailedScans,
    recentAuditLogs,
    completedDurationScans,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { lastLoginAt: { gte: thirtyDaysAgo }, isSuspended: false } }),
    prisma.user.count({ where: { isSuspended: true } }),
    prisma.scan.count(),
    prisma.scan.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.scan.count({ where: { status: { in: [ScanStatus.QUEUED, ScanStatus.RUNNING] } } }),
    prisma.scan.count({ where: { status: ScanStatus.COMPLETED } }),
    prisma.scan.count({ where: { status: ScanStatus.FAILED } }),
    prisma.finding.count(),
    prisma.finding.groupBy({
      by: ['severity'],
      _count: { id: true },
    }),
    prisma.report.count(),
    prisma.scan.findMany({
      where: { status: ScanStatus.FAILED },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        target: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.scan.findMany({
      where: {
        status: ScanStatus.COMPLETED,
        startedAt: { not: null },
        completedAt: { not: null },
      },
      select: { startedAt: true, completedAt: true },
      take: 100,
      orderBy: { completedAt: 'desc' },
    }),
  ]);

  // Calculate average scan duration
  let averageScanDurationSeconds = 0;
  if (completedDurationScans.length > 0) {
    const totalMs = completedDurationScans.reduce((sum, s) => {
      if (s.startedAt && s.completedAt) {
        return sum + (s.completedAt.getTime() - s.startedAt.getTime());
      }
      return sum;
    }, 0);
    averageScanDurationSeconds = Math.round(totalMs / completedDurationScans.length / 1000);
  }

  // Calculate severity map
  const severityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  severityGroups.forEach(g => {
    const key = g.severity.toLowerCase() as keyof typeof severityCounts;
    if (severityCounts[key] !== undefined) {
      severityCounts[key] = g._count.id;
    }
  });

  return {
    metrics: {
      users: {
        total: totalUsers,
        active: activeUsersCount,
        suspended: suspendedUsersCount,
      },
      scans: {
        total: totalScans,
        today: scansToday,
        active: activeScans,
        completed: completedScans,
        failed: failedScans,
        averageDurationSeconds: averageScanDurationSeconds,
      },
      findings: {
        total: totalFindings,
        bySeverity: severityCounts,
      },
      reports: {
        total: totalReports,
      },
    },
    recentFailures: recentFailedScans.map(s => ({
      id: s.id,
      targetHostname: s.target.hostname,
      targetUrl: s.target.url,
      userEmail: s.user.email,
      errorMessage: s.errorMessage || 'Scan failed during assessment execution',
      createdAt: s.createdAt,
    })),
    recentAuditLogs: recentAuditLogs.map(l => ({
      id: l.id,
      action: l.action,
      userEmail: l.user?.email ?? 'System',
      ipAddress: l.ipAddress,
      metadata: l.metadata,
      createdAt: l.createdAt,
    })),
  };
}

// ── 2. Admin System Health Check (Safe, No Secrets) ───────────────────────────

export async function getSystemHealth() {
  const startTime = Date.now();
  let dbStatus = 'healthy';
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch {
    dbStatus = 'unhealthy';
  }

  // Check report storage accessibility
  let storageStatus = 'healthy';
  try {
    if (!fs.existsSync(REPORTS_STORAGE_DIR)) {
      fs.mkdirSync(REPORTS_STORAGE_DIR, { recursive: true });
    }
    // Test write and cleanup a small check file
    const testPath = `${REPORTS_STORAGE_DIR}/.healthcheck`;
    fs.writeFileSync(testPath, 'ok');
    fs.unlinkSync(testPath);
  } catch {
    storageStatus = 'degraded';
  }

  const memoryUsage = process.memoryUsage();
  const uptime = Math.floor(process.uptime());

  return {
    status: dbStatus === 'healthy' && storageStatus === 'healthy' ? 'healthy' : 'degraded',
    components: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      scanner: {
        status: 'healthy',
        engine: 'Passive Modular Security Engine',
        protection: 'Active SSRF Guard & Rate Limiter',
      },
      application: {
        status: 'healthy',
        uptimeSeconds: uptime,
        memoryUsageMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        totalMemoryMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      },
      storage: {
        status: storageStatus,
      },
    },
    checkedAt: new Date().toISOString(),
    responseTimeMs: Date.now() - startTime,
  };
}

// ── 3. User Management ────────────────────────────────────────────────────────

export async function listAdminUsers(params: AdminUserFilterParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (params.search?.trim()) {
    const query = params.search.trim();
    where.OR = [
      { email: { contains: query, mode: 'insensitive' } },
      { name: { contains: query, mode: 'insensitive' } },
    ];
  }

  if (params.role && params.role !== 'ALL') {
    where.role = params.role as Role;
  }

  if (params.status === 'ACTIVE') {
    where.isSuspended = false;
  } else if (params.status === 'SUSPENDED') {
    where.isSuspended = true;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isSuspended: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            scans: true,
            reports: true,
            targets: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isSuspended: u.isSuspended,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      totalScans: u._count.scans,
      totalReports: u._count.reports,
      totalTargets: u._count.targets,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getAdminUserById(userId: string, adminId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isSuspended: true,
      createdAt: true,
      lastLoginAt: true,
      sessions: {
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
      },
      scans: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { target: true },
      },
      reports: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      _count: {
        select: { scans: true, targets: true, reports: true },
      },
    },
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Audit view event
  void writeAuditLog({
    userId: adminId,
    action: AuditAction.ADMIN_VIEWED_USER,
    metadata: { targetUserId: user.id, targetEmail: user.email },
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isSuspended: user.isSuspended,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      activeSessions: user.sessions,
      totalScans: user._count.scans,
      totalTargets: user._count.targets,
      totalReports: user._count.reports,
      recentScans: user.scans.map(s => ({
        id: s.id,
        targetHostname: s.target.hostname,
        targetUrl: s.target.url,
        status: s.status,
        securityScore: s.securityScore,
        createdAt: s.createdAt,
      })),
      recentReports: user.reports,
    },
  };
}

export async function suspendUser(
  targetUserId: string,
  adminId: string,
  context: { ipAddress?: string; userAgent?: string } = {}
) {
  if (targetUserId === adminId) {
    throw new AppError('Administrators cannot suspend their own account.', 400, 'SELF_SUSPENSION_BLOCKED');
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    throw new AppError('Target user not found', 404, 'USER_NOT_FOUND');
  }

  if (targetUser.isSuspended) {
    throw new AppError('User is already suspended', 400, 'ALREADY_SUSPENDED');
  }

  // Last admin defense
  if (targetUser.role === Role.ADMIN) {
    const activeAdminCount = await prisma.user.count({
      where: { role: Role.ADMIN, isSuspended: false },
    });
    if (activeAdminCount <= 1) {
      throw new AppError('Cannot suspend the last remaining active administrator account.', 400, 'LAST_ADMIN_PROTECTED');
    }
  }

  // Suspend user and revoke all active sessions
  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: { isSuspended: true },
    }),
    prisma.session.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  // Log audit event
  await writeAuditLog({
    userId: adminId,
    action: AuditAction.USER_SUSPENDED,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      targetUserId: targetUser.id,
      targetEmail: targetUser.email,
      suspendedBy: adminId,
    },
  });

  return {
    id: updatedUser.id,
    email: updatedUser.email,
    isSuspended: updatedUser.isSuspended,
  };
}

export async function reactivateUser(
  targetUserId: string,
  adminId: string,
  context: { ipAddress?: string; userAgent?: string } = {}
) {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    throw new AppError('Target user not found', 404, 'USER_NOT_FOUND');
  }

  if (!targetUser.isSuspended) {
    throw new AppError('User is not suspended', 400, 'NOT_SUSPENDED');
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { isSuspended: false },
  });

  await writeAuditLog({
    userId: adminId,
    action: AuditAction.USER_REACTIVATED,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      targetUserId: targetUser.id,
      targetEmail: targetUser.email,
      reactivatedBy: adminId,
    },
  });

  return {
    id: updatedUser.id,
    email: updatedUser.email,
    isSuspended: updatedUser.isSuspended,
  };
}

export async function updateUserRole(
  targetUserId: string,
  newRole: Role,
  adminId: string,
  context: { ipAddress?: string; userAgent?: string } = {}
) {
  if (targetUserId === adminId && newRole !== Role.ADMIN) {
    throw new AppError('Administrators cannot remove their own admin privileges.', 400, 'SELF_DEMOTION_BLOCKED');
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    throw new AppError('Target user not found', 404, 'USER_NOT_FOUND');
  }

  if (targetUser.role === newRole) {
    return { id: targetUser.id, email: targetUser.email, role: targetUser.role };
  }

  // Last admin demotion defense
  if (targetUser.role === Role.ADMIN && newRole === Role.USER) {
    const adminCount = await prisma.user.count({
      where: { role: Role.ADMIN, isSuspended: false },
    });
    if (adminCount <= 1) {
      throw new AppError('Cannot demote the last remaining administrator.', 400, 'LAST_ADMIN_PROTECTED');
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole },
  });

  await writeAuditLog({
    userId: adminId,
    action: AuditAction.ROLE_CHANGED,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      targetUserId: targetUser.id,
      targetEmail: targetUser.email,
      previousRole: targetUser.role,
      newRole,
      changedBy: adminId,
    },
  });

  return {
    id: updatedUser.id,
    email: updatedUser.email,
    role: updatedUser.role,
  };
}

// ── 4. System-Wide Scan Management ────────────────────────────────────────────

export async function listAdminScans(params: AdminScanFilterParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (params.status && params.status !== 'ALL') {
    where.status = params.status as ScanStatus;
  }

  if (params.target?.trim()) {
    where.target = {
      OR: [
        { hostname: { contains: params.target.trim(), mode: 'insensitive' } },
        { url: { contains: params.target.trim(), mode: 'insensitive' } },
      ],
    };
  }

  if (params.userEmail?.trim()) {
    where.user = {
      email: { contains: params.userEmail.trim(), mode: 'insensitive' },
    };
  }

  const [scans, total] = await Promise.all([
    prisma.scan.findMany({
      where,
      include: {
        target: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.scan.count({ where }),
  ]);

  return {
    scans: scans.map(s => ({
      id: s.id,
      targetHostname: s.target.hostname,
      targetUrl: s.target.url,
      user: s.user,
      status: s.status,
      securityScore: s.securityScore,
      totalFindings: s.totalFindings,
      criticalCount: s.criticalCount,
      highCount: s.highCount,
      mediumCount: s.mediumCount,
      lowCount: s.lowCount,
      infoCount: s.infoCount,
      errorMessage: s.errorMessage,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      createdAt: s.createdAt,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getAdminScanById(scanId: string, adminId: string) {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      target: true,
      user: { select: { id: true, name: true, email: true, role: true } },
      findings: {
        orderBy: { createdAt: 'asc' },
      },
      reports: true,
    },
  });

  if (!scan) {
    throw new AppError('Scan not found', 404, 'SCAN_NOT_FOUND');
  }

  void writeAuditLog({
    userId: adminId,
    action: AuditAction.ADMIN_VIEWED_SCAN,
    metadata: { scanId: scan.id, targetHostname: scan.target.hostname },
  });

  return { scan };
}

// ── 5. System-Wide Findings Explorer ──────────────────────────────────────────

export async function listAdminFindings(params: AdminFindingFilterParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (params.severity && params.severity !== 'ALL') {
    where.severity = params.severity as Severity;
  }

  if (params.category && params.category !== 'ALL') {
    where.category = params.category;
  }

  if (params.scanner && params.scanner !== 'ALL') {
    where.scanner = params.scanner;
  }

  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { affectedComponent: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [findings, total] = await Promise.all([
    prisma.finding.findMany({
      where,
      include: {
        scan: {
          include: {
            target: true,
            user: { select: { id: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.finding.count({ where }),
  ]);

  return {
    findings: findings.map(f => ({
      id: f.id,
      scanId: f.scanId,
      scanner: f.scanner,
      title: f.title,
      category: f.category,
      severity: f.severity,
      confidence: f.confidence,
      description: f.description,
      evidence: f.evidence,
      impact: f.impact,
      remediation: f.remediation,
      reference: f.reference,
      affectedComponent: f.affectedComponent,
      createdAt: f.createdAt,
      targetHostname: f.scan.target.hostname,
      targetUrl: f.scan.target.url,
      userEmail: f.scan.user.email,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

// ── 6. System-Wide Reports Management ─────────────────────────────────────────

export async function listAdminReports(params: AdminPaginationParams & { search?: string }) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { fileName: { contains: q, mode: 'insensitive' } },
      { user: { email: { contains: q, mode: 'insensitive' } } },
      { scan: { target: { hostname: { contains: q, mode: 'insensitive' } } } },
    ];
  }

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        scan: { include: { target: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.report.count({ where }),
  ]);

  return {
    reports: reports.map(r => ({
      id: r.id,
      scanId: r.scanId,
      status: r.status,
      fileName: r.fileName,
      fileSize: r.fileSize,
      createdAt: r.createdAt,
      generatedAt: r.generatedAt,
      user: r.user,
      targetHostname: r.scan.target?.hostname,
      targetUrl: r.scan.target?.url,
      securityScore: r.scan.securityScore,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

// ── 7. System Audit Logs Inspector (Strictly Read-Only) ───────────────────────

export async function listAdminAuditLogs(params: AdminAuditLogFilterParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 25));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (params.action && params.action !== 'ALL') {
    where.action = params.action as AuditAction;
  }

  if (params.userId?.trim()) {
    where.userId = params.userId.trim();
  }

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      (where.createdAt as Record<string, Date>).gte = new Date(params.startDate);
    }
    if (params.endDate) {
      (where.createdAt as Record<string, Date>).lte = new Date(params.endDate);
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map(l => ({
      id: l.id,
      action: l.action,
      user: l.user,
      ipAddress: l.ipAddress,
      userAgent: l.userAgent,
      metadata: l.metadata,
      createdAt: l.createdAt,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}
