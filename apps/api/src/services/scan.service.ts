import { z } from 'zod';
import { Prisma, ScanStatus, Severity } from '@prisma/client';
import prisma from '../lib/db';
import { Errors } from '../utils/errors';
import { writeAuditLog } from './auditLog.service';
import {
  compareScans,
  ScannerEngine,
  validateAndNormalizeUrl,
  validateTargetDestination,
} from '@webshield/security-engine';
import config from '../config/env';

export const CreateScanSchema = z.object({
  url: z
    .string({ required_error: 'URL is required' })
    .trim()
    .min(1, 'URL cannot be empty')
    .max(2048, 'URL exceeds maximum length'),
});

export type CreateScanInput = z.infer<typeof CreateScanSchema>;

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

const engine = new ScannerEngine();

// Maximum concurrent active scans allowed per user
const MAX_ACTIVE_SCANS_PER_USER = 2;

/**
 * Creates a scan record and runs the security scanner engine against the target.
 */
export async function createAndRunScan(
  userId: string,
  input: CreateScanInput,
  meta: RequestMeta = {}
) {
  // 1. Concurrency limit check
  const activeScansCount = await prisma.scan.count({
    where: {
      userId,
      status: { in: ['QUEUED', 'RUNNING'] },
    },
  });

  if (activeScansCount >= MAX_ACTIVE_SCANS_PER_USER) {
    throw Errors.badRequest(
      `Active scan limit reached (${MAX_ACTIVE_SCANS_PER_USER}). Please wait for current scans to finish or cancel an active scan.`
    );
  }

  // 2. Validate & normalize URL
  let normalized;
  try {
    normalized = validateAndNormalizeUrl(input.url);
  } catch (err: unknown) {
    const error = err as Error;
    throw Errors.badRequest(error.message);
  }

  // 3. Perform early SSRF safety check
  const ssrfCheck = await validateTargetDestination(normalized.hostname);
  if (!ssrfCheck.isSafe) {
    throw Errors.badRequest(
      `SSRF Protection: ${ssrfCheck.reason ?? 'Target address is prohibited.'}`
    );
  }

  // 4. Find or create Target for the authenticated user
  let target = await prisma.target.findFirst({
    where: {
      userId,
      normalizedUrl: normalized.normalizedUrl,
    },
  });

  if (!target) {
    target = await prisma.target.create({
      data: {
        userId,
        url: input.url,
        normalizedUrl: normalized.normalizedUrl,
        hostname: normalized.hostname,
      },
    });
  }

  // 5. Create Scan record in QUEUED / RUNNING state
  const scan = await prisma.scan.create({
    data: {
      userId,
      targetId: target.id,
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  void writeAuditLog({
    userId,
    action: 'SCAN_CREATED',
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { scanId: scan.id, target: normalized.normalizedUrl },
  });

  // 6. Execute scanner engine
  try {
    const engineResult = await engine.runScan(normalized.normalizedUrl, {
      timeoutMs: config.scanner.timeout,
      maxRequests: config.scanner.maxRequests,
    });

    // Check if the scan was cancelled while the engine was running
    const currentScanState = await prisma.scan.findUnique({
      where: { id: scan.id },
      select: { status: true },
    });

    if (currentScanState?.status === 'CANCELLED') {
      return prisma.scan.findUnique({
        where: { id: scan.id },
        include: { target: true, findings: true },
      });
    }

    // 7. Save findings in transaction with scan update
    const updatedScan = await prisma.$transaction(async tx => {
      if (engineResult.findings.length > 0) {
        await tx.finding.createMany({
          data: engineResult.findings.map(f => ({
            scanId: scan.id,
            scanner: f.scanner,
            title: f.title,
            category: f.category,
            severity: f.severity as Severity,
            confidence: f.confidence,
            description: f.description,
            evidence: f.evidence ?? null,
            impact: f.impact ?? null,
            remediation: f.remediation ?? null,
            reference: f.reference ?? null,
            affectedComponent: f.affectedComponent ?? null,
          })),
        });
      }

      return tx.scan.update({
        where: { id: scan.id },
        data: {
          status: 'COMPLETED',
          completedAt: engineResult.completedAt,
          securityScore: engineResult.score.score,
          totalFindings: engineResult.score.totalFindings,
          criticalCount: engineResult.score.criticalCount,
          highCount: engineResult.score.highCount,
          mediumCount: engineResult.score.mediumCount,
          lowCount: engineResult.score.lowCount,
          infoCount: engineResult.score.infoCount,
        },
        include: {
          target: true,
          findings: true,
        },
      });
    });

    void writeAuditLog({
      userId,
      action: 'SCAN_COMPLETED',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        scanId: scan.id,
        score: engineResult.score.score,
        totalFindings: engineResult.score.totalFindings,
      },
    });

    return updatedScan;
  } catch (err: unknown) {
    const error = err as Error;

    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: error.message,
      },
    });

    void writeAuditLog({
      userId,
      action: 'SCAN_FAILED',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { scanId: scan.id, error: error.message },
    });

    throw Errors.badRequest(`Scan failed: ${error.message}`);
  }
}

/**
 * Retrieves a single scan by ID with strict ownership validation (IDOR protection).
 */
export async function getScanById(scanId: string, requestingUserId: string) {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      target: true,
      findings: {
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      },
    },
  });

  if (!scan) {
    throw Errors.notFound('Scan not found.');
  }

  if (scan.userId !== requestingUserId) {
    throw Errors.forbidden('You do not have permission to view this scan.');
  }

  return scan;
}

/**
 * Cancels an active scan (QUEUED or RUNNING) belonging to the requesting user.
 */
export async function cancelScan(scanId: string, requestingUserId: string) {
  const scan = await getScanById(scanId, requestingUserId);

  if (scan.status !== 'QUEUED' && scan.status !== 'RUNNING') {
    throw Errors.badRequest(`Cannot cancel scan with status '${scan.status}'.`);
  }

  const updatedScan = await prisma.scan.update({
    where: { id: scanId },
    data: {
      status: 'CANCELLED',
      completedAt: new Date(),
      errorMessage: 'Scan cancelled by user.',
    },
    include: {
      target: true,
      findings: true,
    },
  });

  return updatedScan;
}

/**
 * Compares two completed scans belonging to the requesting user.
 */
export async function compareScansService(
  beforeScanId: string,
  afterScanId: string,
  requestingUserId: string
) {
  if (!beforeScanId || !afterScanId) {
    throw Errors.badRequest('Both before and after scan IDs are required for comparison.');
  }

  if (beforeScanId === afterScanId) {
    throw Errors.badRequest('Cannot compare a scan with itself.');
  }

  // 1. Fetch both scans with IDOR ownership validation
  const [beforeScan, afterScan] = await Promise.all([
    getScanById(beforeScanId, requestingUserId),
    getScanById(afterScanId, requestingUserId),
  ]);

  // 2. Ensure both scans are completed
  if (beforeScan.status !== 'COMPLETED') {
    throw Errors.badRequest(`Before scan '${beforeScanId}' is not completed.`);
  }

  if (afterScan.status !== 'COMPLETED') {
    throw Errors.badRequest(`After scan '${afterScanId}' is not completed.`);
  }

  // 3. Format findings for comparison engine
  const previousFindings = beforeScan.findings.map(f => ({
    scanner: f.scanner,
    title: f.title,
    category: f.category,
    severity: f.severity,
    confidence: f.confidence,
    description: f.description,
    evidence: f.evidence ?? undefined,
    impact: f.impact ?? undefined,
    remediation: f.remediation ?? undefined,
    reference: f.reference ?? undefined,
    affectedComponent: f.affectedComponent ?? undefined,
  }));

  const currentFindings = afterScan.findings.map(f => ({
    scanner: f.scanner,
    title: f.title,
    category: f.category,
    severity: f.severity,
    confidence: f.confidence,
    description: f.description,
    evidence: f.evidence ?? undefined,
    impact: f.impact ?? undefined,
    remediation: f.remediation ?? undefined,
    reference: f.reference ?? undefined,
    affectedComponent: f.affectedComponent ?? undefined,
  }));

  // 4. Run comparison engine
  const comparison = compareScans({
    previousScanId: beforeScan.id,
    currentScanId: afterScan.id,
    previousScore: beforeScan.securityScore,
    currentScore: afterScan.securityScore,
    previousFindings,
    currentFindings,
  });

  return {
    ...comparison,
    beforeTarget: beforeScan.target,
    afterTarget: afterScan.target,
    beforeStartedAt: beforeScan.startedAt,
    afterStartedAt: afterScan.startedAt,
    beforeCompletedAt: beforeScan.completedAt,
    afterCompletedAt: afterScan.completedAt,
  };
}

/**
 * Retrieves findings for a specific scan with IDOR checks and optional filters.
 */
export async function getScanFindings(
  scanId: string,
  requestingUserId: string,
  filters: { severity?: Severity; category?: string } = {}
) {
  // Check scan ownership first
  await getScanById(scanId, requestingUserId);

  const whereClause: {
    scanId: string;
    severity?: Severity;
    category?: { contains: string; mode: 'insensitive' };
  } = {
    scanId,
  };

  if (filters.severity) {
    whereClause.severity = filters.severity;
  }

  if (filters.category) {
    whereClause.category = {
      contains: filters.category,
      mode: 'insensitive',
    };
  }

  const findings = await prisma.finding.findMany({
    where: whereClause,
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
  });

  return findings;
}

export interface GetUserScansOptions {
  page?: number;
  limit?: number;
  status?: ScanStatus;
  search?: string;
}

/**
 * Lists scans for the authenticated user with pagination, search, and status filtering.
 */
export async function getUserScans(userId: string, options: GetUserScansOptions = {}) {
  const safeLimit = Math.min(Math.max(1, Number(options.limit) || 20), 100);
  const safePage = Math.max(1, Number(options.page) || 1);
  const skip = (safePage - 1) * safeLimit;

  const where: Prisma.ScanWhereInput = {
    userId,
  };

  if (options.status) {
    where.status = options.status;
  }

  if (options.search && options.search.trim()) {
    const searchTerm = options.search.trim();
    where.target = {
      OR: [
        { url: { contains: searchTerm, mode: 'insensitive' } },
        { hostname: { contains: searchTerm, mode: 'insensitive' } },
      ],
    };
  }

  const [total, scans] = await Promise.all([
    prisma.scan.count({ where }),
    prisma.scan.findMany({
      where,
      include: {
        target: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    }),
  ]);

  return {
    scans,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}
