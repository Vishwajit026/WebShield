import apiClient from '@/lib/apiClient';
import type { HealthResponse } from '@/types/api';

/**
 * Health service — checks API connectivity.
 * Used to verify the backend is reachable.
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await apiClient.get<HealthResponse>('/health');
  return data;
}
