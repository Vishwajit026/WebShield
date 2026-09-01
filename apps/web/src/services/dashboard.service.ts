import apiClient from '../lib/apiClient';
import type { ApiResponse, DashboardOverview } from '../types/api';

/**
 * Fetches calculated dashboard overview metrics for the authenticated user.
 */
export async function getDashboardOverview(): Promise<DashboardOverview> {
  const res = await apiClient.get<ApiResponse<DashboardOverview>>('/dashboard/overview');
  return res.data.data!;
}
