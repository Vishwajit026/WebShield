import fs from 'fs';
import path from 'path';
import prisma from '../lib/db';
import { AppError } from '../utils/errors';
import { buildReportData } from './pdf/reportDataBuilder';
import { generatePdfReport } from './pdf/pdfGenerator';
import { writeAuditLog } from './auditLog.service';
import { AuditAction } from '@prisma/client';

export const REPORTS_STORAGE_DIR = path.resolve(__dirname, '../../storage/reports');

/**
 * Ensures the reports storage directory exists.
 */
function ensureStorageDirectory() {
  if (!fs.existsSync(REPORTS_STORAGE_DIR)) {
    fs.mkdirSync(REPORTS_STORAGE_DIR, { recursive: true });
  }
}

/**
 * Sanitizes a string for use in a file name.
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '-').replace(/-+/g, '-');
}

export interface ReportSummaryDto {
  id: string;
  scanId: string;
  status: string;
  fileName: string;
  fileSize: number | null;
  createdAt: Date;
  generatedAt: Date | null;
  targetHostname?: string;
  targetUrl?: string;
  securityScore?: number | null;
}

/**
 * Generates a professional PDF report from a completed scan.
 */
export async function generateReport(scanId: string, userId: string): Promise<ReportSummaryDto> {
  // 1. Verify scan exists and belongs to user
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      target: true,
      findings: true,
    },
  });

  if (!scan) {
    throw new AppError('Scan not found', 404, 'SCAN_NOT_FOUND');
  }

  if (scan.userId !== userId) {
    throw new AppError('Access denied', 403, 'FORBIDDEN');
  }

  if (scan.status !== 'COMPLETED') {
    throw new AppError('Cannot generate report for non-completed scan', 400, 'SCAN_NOT_COMPLETED');
  }

  // 2. Check if a valid report already exists on disk
  const existingReport = await prisma.report.findFirst({
    where: { scanId, userId, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
  });

  if (existingReport && fs.existsSync(existingReport.filePath)) {
    return {
      id: existingReport.id,
      scanId: existingReport.scanId,
      status: existingReport.status,
      fileName: existingReport.fileName,
      fileSize: existingReport.fileSize,
      createdAt: existingReport.createdAt,
      generatedAt: existingReport.generatedAt,
      targetHostname: scan.target.hostname,
      targetUrl: scan.target.url,
      securityScore: scan.securityScore,
    };
  }

  ensureStorageDirectory();

  // 3. Create report record in GENERATING status
  const hostname = scan.target.hostname || 'target';
  const dateStr = new Date().toISOString().split('T')[0];
  const safeFileName = sanitizeFileName(`webshield-${hostname}-${dateStr}.pdf`);

  const report = await prisma.report.create({
    data: {
      scanId: scan.id,
      userId,
      status: 'GENERATING',
      fileName: safeFileName,
      filePath: '',
    },
  });

  const finalFilePath = path.join(REPORTS_STORAGE_DIR, `${report.id}.pdf`);

  try {
    // 4. Build report data structure
    const reportData = buildReportData({
      reportId: report.id,
      scan,
    });

    // 5. Generate PDF and write to storage
    const writeStream = fs.createWriteStream(finalFilePath);
    await generatePdfReport(reportData, writeStream);

    const stats = fs.statSync(finalFilePath);

    // 6. Update database record
    const updatedReport = await prisma.report.update({
      where: { id: report.id },
      data: {
        status: 'COMPLETED',
        filePath: finalFilePath,
        fileSize: stats.size,
        generatedAt: new Date(),
      },
    });

    // 7. Audit log event
    await writeAuditLog({
      userId,
      action: AuditAction.REPORT_GENERATED,
      metadata: {
        reportId: updatedReport.id,
        scanId: scan.id,
        targetHostname: scan.target.hostname,
        fileSize: stats.size,
      },
    });

    return {
      id: updatedReport.id,
      scanId: updatedReport.scanId,
      status: updatedReport.status,
      fileName: updatedReport.fileName,
      fileSize: updatedReport.fileSize,
      createdAt: updatedReport.createdAt,
      generatedAt: updatedReport.generatedAt,
      targetHostname: scan.target.hostname,
      targetUrl: scan.target.url,
      securityScore: scan.securityScore,
    };
  } catch (error) {
    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: 'FAILED',
        errorMessage: (error as Error).message || 'Failed to generate PDF document',
      },
    });
    throw new AppError('Failed to generate PDF report', 500, 'REPORT_GENERATION_FAILED');
  }
}

/**
 * Retrieves report metadata by ID with strict user authorization.
 */
export async function getReportById(reportId: string, userId: string): Promise<ReportSummaryDto> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      scan: {
        include: { target: true },
      },
    },
  });

  if (!report) {
    throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');
  }

  if (report.userId !== userId) {
    throw new AppError('Access denied', 403, 'FORBIDDEN');
  }

  return {
    id: report.id,
    scanId: report.scanId,
    status: report.status,
    fileName: report.fileName,
    fileSize: report.fileSize,
    createdAt: report.createdAt,
    generatedAt: report.generatedAt,
    targetHostname: report.scan.target?.hostname,
    targetUrl: report.scan.target?.url,
    securityScore: report.scan.securityScore,
  };
}

/**
 * Returns a readable stream for secure PDF download.
 */
export async function getReportFileStream(
  reportId: string,
  userId: string
): Promise<{ stream: fs.ReadStream; fileName: string; fileSize: number }> {
  // Prevent any path traversal in reportId
  if (reportId.includes('..') || reportId.includes('/') || reportId.includes('\\')) {
    throw new AppError('Invalid report identifier', 400, 'INVALID_REPORT_ID');
  }

  const report = await prisma.report.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');
  }

  if (report.userId !== userId) {
    throw new AppError('Access denied', 403, 'FORBIDDEN');
  }

  if (report.status !== 'COMPLETED' || !report.filePath) {
    throw new AppError('Report is not ready for download', 400, 'REPORT_NOT_READY');
  }

  // Canonical path verification: must reside inside REPORTS_STORAGE_DIR
  const resolvedPath = path.resolve(report.filePath);
  const normalizedStorageDir = path.resolve(REPORTS_STORAGE_DIR);

  if (!resolvedPath.startsWith(normalizedStorageDir)) {
    throw new AppError('Access denied', 403, 'PATH_TRAVERSAL_DETECTED');
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new AppError('Report file missing on server', 404, 'FILE_NOT_FOUND');
  }

  const stats = fs.statSync(resolvedPath);
  const stream = fs.createReadStream(resolvedPath);

  return {
    stream,
    fileName: report.fileName,
    fileSize: stats.size,
  };
}

/**
 * Lists user reports with pagination.
 */
export async function listUserReports(
  userId: string,
  params: { page?: number; limit?: number } = {}
) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where: { userId },
      include: {
        scan: {
          include: { target: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.report.count({ where: { userId } }),
  ]);

  const dtos: ReportSummaryDto[] = reports.map(r => ({
    id: r.id,
    scanId: r.scanId,
    status: r.status,
    fileName: r.fileName,
    fileSize: r.fileSize,
    createdAt: r.createdAt,
    generatedAt: r.generatedAt,
    targetHostname: r.scan.target?.hostname,
    targetUrl: r.scan.target?.url,
    securityScore: r.scan.securityScore,
  }));

  return {
    reports: dtos,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}
