import { Router, IRouter } from 'express';
import { authenticate, requireRole } from '../middleware/authenticate';
import { adminRateLimit } from '../middleware/rateLimiter';
import {
  getAdminOverviewController,
  getSystemHealthController,
  listAdminUsersController,
  getAdminUserByIdController,
  suspendUserController,
  reactivateUserController,
  updateUserRoleController,
  listAdminScansController,
  getAdminScanByIdController,
  listAdminFindingsController,
  listAdminReportsController,
  listAdminAuditLogsController,
} from '../controllers/admin.controller';

export const adminRouter: IRouter = Router();

// ── Security Barrier: All admin routes strictly enforce AUTH + ADMIN role ─────
adminRouter.use(authenticate);
adminRouter.use(requireRole('ADMIN'));

// ── Dashboard Overview & Health ──────────────────────────────────────────────
adminRouter.get('/overview', getAdminOverviewController);
adminRouter.get('/health', getSystemHealthController);

// ── User Management & Protection ─────────────────────────────────────────────
adminRouter.get('/users', listAdminUsersController);
adminRouter.get('/users/:id', getAdminUserByIdController);
adminRouter.post('/users/:id/suspend', adminRateLimit, suspendUserController);
adminRouter.post('/users/:id/reactivate', adminRateLimit, reactivateUserController);
adminRouter.post('/users/:id/role', adminRateLimit, updateUserRoleController);

// ── System Scans & Findings ──────────────────────────────────────────────────
adminRouter.get('/scans', listAdminScansController);
adminRouter.get('/scans/:id', getAdminScanByIdController);
adminRouter.get('/findings', listAdminFindingsController);

// ── Reports & Audit Logs ─────────────────────────────────────────────────────
adminRouter.get('/reports', listAdminReportsController);
adminRouter.get('/audit-logs', listAdminAuditLogsController);

export default adminRouter;
