import { ScanStatus } from '@prisma/client';
import prisma from '../lib/db';

export interface ScoreTrendPoint {
  scanId: string;
  targetUrl: string;
  hostname: string;
  score: number;
  completedAt: Date;
}

export interface DashboardOverview {
  totalScans: number;
  completedScans: number;
  activeScans: number; // QUEUED + RUNNING
  failedScans: number;
  totalFindings: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  latestScan: {
    id: string;
    targetUrl: string;
    hostname: string;
    status: ScanStatus;
    securityScore: number | null;
    grade: 'Excellent' | 'Good' | 'Moderate' | 'Poor' | 'Critical' | null;
    completedAt: Date | null;
    totalFindings: number;
  } | null;
  recentScans: Array<{
    id: string;
    targetUrl: string;
    hostname: string;
    status: ScanStatus;
    securityScore: number | null;
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    createdAt: Date;
    completedAt: Date | null;
  }>;
  scoreTrend: ScoreTrendPoint[];
}

export function getScoreGrade(score: number | null): 'Excellent' | 'Good' | 'Moderate' | 'Poor' | 'Critical' | null {
  if (score === null || score === undefined) return null;
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Moderate';
  if (score >= 25) return 'Poor';
  return 'Critical';
}

/**
 * Calculates aggregate security statistics, historical score trend, and recent scan data for the user.
 */
export async function getDashboardOverview(userId: string): Promise<DashboardOverview> {
  const [
    totalScans,
    completedScans,
    activeScans,
    failedScans,
    findingAggregations,
    latestCompletedScan,
    recentScans,
    historicalCompletedScans,
  ] = await Promise.all([
    // Total scans count for user
    prisma.scan.count({
      where: { userId },
    }),

    // Completed scans
    prisma.scan.count({
      where: { userId, status: 'COMPLETED' },
    }),

    // Active (queued or running) scans
    prisma.scan.count({
      where: { userId, status: { in: ['QUEUED', 'RUNNING'] } },
    }),

    // Failed / cancelled scans
    prisma.scan.count({
      where: { userId, status: { in: ['FAILED', 'CANCELLED'] } },
    }),

    // Sum of finding counts from completed scans
    prisma.scan.aggregate({
      where: { userId, status: 'COMPLETED' },
      _sum: {
        totalFindings: true,
        criticalCount: true,
        highCount: true,
        mediumCount: true,
        lowCount: true,
        infoCount: true,
      },
    }),

    // Latest completed scan for security score card
    prisma.scan.findFirst({
      where: { userId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      include: { target: true },
    }),

    // Recent 5 scans
    prisma.scan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { target: true },
    }),

    // Last 10 completed scans with scores for score trend visualization
    prisma.scan.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        securityScore: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
      include: { target: true },
    }),
  ]);

  // Order chronologically (oldest to newest) for trend display
  const scoreTrend: ScoreTrendPoint[] = historicalCompletedScans
    .slice()
    .reverse()
    .map(s => ({
      scanId: s.id,
      targetUrl: s.target.url,
      hostname: s.target.hostname,
      score: s.securityScore!,
      completedAt: s.completedAt ?? s.createdAt,
    }));

  return {
    totalScans,
    completedScans,
    activeScans,
    failedScans,
    totalFindings: findingAggregations._sum.totalFindings ?? 0,
    severityCounts: {
      critical: findingAggregations._sum.criticalCount ?? 0,
      high: findingAggregations._sum.highCount ?? 0,
      medium: findingAggregations._sum.mediumCount ?? 0,
      low: findingAggregations._sum.lowCount ?? 0,
      info: findingAggregations._sum.infoCount ?? 0,
    },
    latestScan: latestCompletedScan
      ? {
          id: latestCompletedScan.id,
          targetUrl: latestCompletedScan.target.url,
          hostname: latestCompletedScan.target.hostname,
          status: latestCompletedScan.status,
          securityScore: latestCompletedScan.securityScore,
          grade: getScoreGrade(latestCompletedScan.securityScore),
          completedAt: latestCompletedScan.completedAt,
          totalFindings: latestCompletedScan.totalFindings,
        }
      : null,
    recentScans: recentScans.map(s => ({
      id: s.id,
      targetUrl: s.target.url,
      hostname: s.target.hostname,
      status: s.status,
      securityScore: s.securityScore,
      totalFindings: s.totalFindings,
      criticalCount: s.criticalCount,
      highCount: s.highCount,
      createdAt: s.createdAt,
      completedAt: s.completedAt,
    })),
    scoreTrend,
  };
}
