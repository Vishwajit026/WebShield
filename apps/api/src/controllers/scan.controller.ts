import { Request, Response, NextFunction } from 'express';
import { Severity, ScanStatus } from '@prisma/client';
import {
  CreateScanSchema,
  cancelScan,
  compareScansService,
  createAndRunScan,
  getScanById,
  getScanFindings,
  getUserScans,
} from '../services/scan.service';

function getIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown'
  );
}

// ── POST /api/scans ───────────────────────────────────────────────────────────

export async function createScan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = CreateScanSchema.parse(req.body);
    const userId = req.user!.id;

    const scan = await createAndRunScan(userId, input, {
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      data: { scan },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/scans/compare ────────────────────────────────────────────────────

export async function compareScansController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const beforeId = typeof req.query.before === 'string' ? req.query.before : '';
    const afterId = typeof req.query.after === 'string' ? req.query.after : '';

    const comparison = await compareScansService(beforeId, afterId, userId);

    res.status(200).json({
      success: true,
      data: comparison,
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/scans/:id/cancel ────────────────────────────────────────────────

export async function cancelScanController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const scan = await cancelScan(id, userId);

    res.status(200).json({
      success: true,
      data: { scan },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/scans/:id ────────────────────────────────────────────────────────

export async function getScan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const scan = await getScanById(id, userId);

    res.status(200).json({
      success: true,
      data: { scan },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/scans/:id/findings ───────────────────────────────────────────────

export async function getFindings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { severity, category } = req.query;

    const findings = await getScanFindings(id, userId, {
      severity: severity as Severity | undefined,
      category: typeof category === 'string' ? category : undefined,
    });

    res.status(200).json({
      success: true,
      data: { findings },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/scans ────────────────────────────────────────────────────────────

export async function listScans(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const status =
      typeof req.query.status === 'string' && req.query.status !== 'ALL'
        ? (req.query.status as ScanStatus)
        : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const result = await getUserScans(userId, { page, limit, status, search });

    res.status(200).json({
      success: true,
      data: {
        scans: result.scans,
        pagination: result.pagination,
      },
    });
  } catch (err) {
    next(err);
  }
}
