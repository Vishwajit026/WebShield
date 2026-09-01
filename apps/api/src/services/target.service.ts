import prisma from '../lib/db';
import { Errors } from '../utils/errors';

export interface GetTargetsOptions {
  page?: number;
  limit?: number;
  search?: string;
}

export interface TargetSummary {
  id: string;
  url: string;
  normalizedUrl: string;
  hostname: string;
  createdAt: Date;
  updatedAt: Date;
  totalScans: number;
  latestScan?: {
    id: string;
    status: string;
    securityScore: number | null;
    completedAt: Date | null;
    createdAt: Date;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    infoCount: number;
  };
}

export interface PaginatedTargetsResult {
  targets: TargetSummary[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Lists all target assets owned by a specific user with aggregated scan metrics and pagination.
 */
export async function getUserTargets(
  userId: string,
  options: GetTargetsOptions = {}
): Promise<PaginatedTargetsResult> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 10));
  const skip = (page - 1) * limit;

  const whereClause: {
    userId: string;
    OR?: Array<
      | { url: { contains: string; mode: 'insensitive' } }
      | { hostname: { contains: string; mode: 'insensitive' } }
    >;
  } = {
    userId,
  };

  if (options.search && options.search.trim() !== '') {
    const term = options.search.trim();
    whereClause.OR = [
      { url: { contains: term, mode: 'insensitive' } },
      { hostname: { contains: term, mode: 'insensitive' } },
    ];
  }

  const [total, targets] = await Promise.all([
    prisma.target.count({ where: whereClause }),
    prisma.target.findMany({
      where: whereClause,
      include: {
        scans: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            securityScore: true,
            completedAt: true,
            createdAt: true,
            criticalCount: true,
            highCount: true,
            mediumCount: true,
            lowCount: true,
            infoCount: true,
          },
        },
        _count: {
          select: { scans: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const targetSummaries: TargetSummary[] = targets.map(t => ({
    id: t.id,
    url: t.url,
    normalizedUrl: t.normalizedUrl,
    hostname: t.hostname,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    totalScans: t._count.scans,
    latestScan: t.scans[0]
      ? {
          id: t.scans[0].id,
          status: t.scans[0].status,
          securityScore: t.scans[0].securityScore,
          completedAt: t.scans[0].completedAt,
          createdAt: t.scans[0].createdAt,
          criticalCount: t.scans[0].criticalCount,
          highCount: t.scans[0].highCount,
          mediumCount: t.scans[0].mediumCount,
          lowCount: t.scans[0].lowCount,
          infoCount: t.scans[0].infoCount,
        }
      : undefined,
  }));

  return {
    targets: targetSummaries,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieves a single target asset by ID with ownership verification.
 */
export async function getTargetById(targetId: string, userId: string): Promise<TargetSummary> {
  const target = await prisma.target.findFirst({
    where: {
      id: targetId,
      userId,
    },
    include: {
      scans: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          securityScore: true,
          completedAt: true,
          createdAt: true,
          criticalCount: true,
          highCount: true,
          mediumCount: true,
          lowCount: true,
          infoCount: true,
        },
      },
      _count: {
        select: { scans: true },
      },
    },
  });

  if (!target) {
    throw Errors.notFound('Target not found.');
  }

  return {
    id: target.id,
    url: target.url,
    normalizedUrl: target.normalizedUrl,
    hostname: target.hostname,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
    totalScans: target._count.scans,
    latestScan: target.scans[0]
      ? {
          id: target.scans[0].id,
          status: target.scans[0].status,
          securityScore: target.scans[0].securityScore,
          completedAt: target.scans[0].completedAt,
          createdAt: target.scans[0].createdAt,
          criticalCount: target.scans[0].criticalCount,
          highCount: target.scans[0].highCount,
          mediumCount: target.scans[0].mediumCount,
          lowCount: target.scans[0].lowCount,
          infoCount: target.scans[0].infoCount,
        }
      : undefined,
  };
}
