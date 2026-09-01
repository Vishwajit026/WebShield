import apiClient from '../lib/apiClient';
import { PaginatedTargetsResponse, TargetSummary } from '../types/api';

export interface GetTargetsParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function getUserTargets(params: GetTargetsParams = {}): Promise<PaginatedTargetsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);

  const qs = query.toString();
  const url = `/api/targets${qs ? `?${qs}` : ''}`;

  const res = await apiClient.get<PaginatedTargetsResponse>(url);
  return res.data;
}

export async function getTargetById(targetId: string): Promise<TargetSummary> {
  const res = await apiClient.get<TargetSummary>(`/api/targets/${targetId}`);
  return res.data;
}
