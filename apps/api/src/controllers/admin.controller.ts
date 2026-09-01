import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import * as adminService from '../services/admin.service';

// ── Zod Validation Schemas ───────────────────────────────────────────────────

const UpdateRoleSchema = z.object({
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: "Role must be either 'USER' or 'ADMIN'" }),
  }),
});

// ── Controller Handlers ──────────────────────────────────────────────────────

export async function getAdminOverviewController(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await adminService.getAdminOverview();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getSystemHealthController(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await adminService.getSystemHealth();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listAdminUsersController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const search = req.query.search as string | undefined;
    const role = req.query.role as string | undefined;
    const status = req.query.status as 'ALL' | 'ACTIVE' | 'SUSPENDED' | undefined;

    const data = await adminService.listAdminUsers({ page, limit, search, role, status });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAdminUserByIdController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const data = await adminService.getAdminUserById(id, adminId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function suspendUserController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const data = await adminService.suspendUser(id, adminId, { ipAddress, userAgent });
    res.status(200).json({
      success: true,
      message: `User ${data.email} has been suspended.`,
      data: { user: data },
    });
  } catch (err) {
    next(err);
  }
}

export async function reactivateUserController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const data = await adminService.reactivateUser(id, adminId, { ipAddress, userAgent });
    res.status(200).json({
      success: true,
      message: `User ${data.email} has been reactivated.`,
      data: { user: data },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateUserRoleController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const { role } = UpdateRoleSchema.parse(req.body);
    const data = await adminService.updateUserRole(id, role, adminId, { ipAddress, userAgent });

    res.status(200).json({
      success: true,
      message: `User role updated to ${data.role}.`,
      data: { user: data },
    });
  } catch (err) {
    next(err);
  }
}

export async function listAdminScansController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const status = req.query.status as string | undefined;
    const target = req.query.target as string | undefined;
    const userEmail = req.query.userEmail as string | undefined;

    const data = await adminService.listAdminScans({ page, limit, status, target, userEmail });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAdminScanByIdController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const data = await adminService.getAdminScanById(id, adminId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listAdminFindingsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const severity = req.query.severity as string | undefined;
    const category = req.query.category as string | undefined;
    const scanner = req.query.scanner as string | undefined;
    const search = req.query.search as string | undefined;

    const data = await adminService.listAdminFindings({ page, limit, severity, category, scanner, search });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listAdminReportsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const search = req.query.search as string | undefined;

    const data = await adminService.listAdminReports({ page, limit, search });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listAdminAuditLogsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
    const action = req.query.action as string | undefined;
    const userId = req.query.userId as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const data = await adminService.listAdminAuditLogs({ page, limit, action, userId, startDate, endDate });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
