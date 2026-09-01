import apiClient from '../lib/apiClient';
import type {
  ApiResponse,
  AdminOverview,
  SystemHealth,
  PaginatedAdminUsersResponse,
  AdminUserDetail,
  PaginatedAdminScansResponse,
  AdminScan,
  Finding,
  Report,
  PaginatedAdminFindingsResponse,
  PaginatedAdminReportsResponse,
  PaginatedAdminAuditLogsResponse,
  Role,
} from '../types/api';

/**
 * Fetches high-level administrative KPIs, severity distributions, failures, and recent audit logs.
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  const res = await apiClient.get<ApiResponse<AdminOverview>>('/admin/overview');
  return res.data.data!;
}

/**
 * Fetches real-time safe system health statuses (Database, Scanner, App, Storage).
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const res = await apiClient.get<ApiResponse<SystemHealth>>('/admin/health');
  return res.data.data!;
}

/**
 * Lists system users with search, role filter, status filter, and pagination.
 */
export async function listAdminUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
} = {}): Promise<PaginatedAdminUsersResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.role) query.set('role', params.role);
  if (params.status) query.set('status', params.status);

  const qs = query.toString();
  const res = await apiClient.get<ApiResponse<PaginatedAdminUsersResponse>>(
    `/admin/users${qs ? `?${qs}` : ''}`
  );
  return res.data.data!;
}

/**
 * Fetches single user detail inspector.
 */
export async function getAdminUserById(id: string): Promise<AdminUserDetail['user']> {
  const res = await apiClient.get<ApiResponse<AdminUserDetail>>(`/admin/users/${id}`);
  return res.data.data!.user;
}

/**
 * Suspends target user account and revokes active sessions.
 */
export async function suspendUser(id: string): Promise<void> {
  await apiClient.post<ApiResponse<{ user: unknown }>>(`/admin/users/${id}/suspend`);
}

/**
 * Reactivates suspended user account.
 */
export async function reactivateUser(id: string): Promise<void> {
  await apiClient.post<ApiResponse<{ user: unknown }>>(`/admin/users/${id}/reactivate`);
}

/**
 * Changes user role (USER <-> ADMIN).
 */
export async function updateUserRole(id: string, role: Role): Promise<void> {
  await apiClient.post<ApiResponse<{ user: unknown }>>(`/admin/users/${id}/role`, { role });
}

/**
 * Lists system-wide scans with filtering and pagination.
 */
export async function listAdminScans(params: {
  page?: number;
  limit?: number;
  status?: string;
  target?: string;
  userEmail?: string;
} = {}): Promise<PaginatedAdminScansResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.target) query.set('target', params.target);
  if (params.userEmail) query.set('userEmail', params.userEmail);

  const qs = query.toString();
  const res = await apiClient.get<ApiResponse<PaginatedAdminScansResponse>>(
    `/admin/scans${qs ? `?${qs}` : ''}`
  );
  return res.data.data!;
}

/**
 * Fetches full scan detail for admin.
 */
export async function getAdminScanById(id: string): Promise<{
  scan: AdminScan & { findings: Finding[]; reports: Report[] };
}> {
  const res = await apiClient.get<ApiResponse<{ scan: AdminScan & { findings: Finding[]; reports: Report[] } }>>(
    `/admin/scans/${id}`
  );
  return res.data.data!;
}

/**
 * Lists system-wide findings.
 */
export async function listAdminFindings(params: {
  page?: number;
  limit?: number;
  severity?: string;
  category?: string;
  scanner?: string;
  search?: string;
} = {}): Promise<PaginatedAdminFindingsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.severity) query.set('severity', params.severity);
  if (params.category) query.set('category', params.category);
  if (params.scanner) query.set('scanner', params.scanner);
  if (params.search) query.set('search', params.search);

  const qs = query.toString();
  const res = await apiClient.get<ApiResponse<PaginatedAdminFindingsResponse>>(
    `/admin/findings${qs ? `?${qs}` : ''}`
  );
  return res.data.data!;
}

/**
 * Lists system-wide generated reports.
 */
export async function listAdminReports(params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<PaginatedAdminReportsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);

  const qs = query.toString();
  const res = await apiClient.get<ApiResponse<PaginatedAdminReportsResponse>>(
    `/admin/reports${qs ? `?${qs}` : ''}`
  );
  return res.data.data!;
}

/**
 * Lists system audit logs.
 */
export async function listAdminAuditLogs(params: {
  page?: number;
  limit?: number;
  action?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
} = {}): Promise<PaginatedAdminAuditLogsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.action) query.set('action', params.action);
  if (params.userId) query.set('userId', params.userId);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);

  const qs = query.toString();
  const res = await apiClient.get<ApiResponse<PaginatedAdminAuditLogsResponse>>(
    `/admin/audit-logs${qs ? `?${qs}` : ''}`
  );
  return res.data.data!;
}
