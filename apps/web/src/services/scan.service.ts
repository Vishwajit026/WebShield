import apiClient from '../lib/apiClient';
import type {
  ApiResponse,
  Scan,
  Finding,
  CreateScanRequest,
  Severity,
  ScanComparisonResult,
} from '../types/api';

/**
 * Initiates a new security scan for the provided target URL.
 */
export async function createScan(data: CreateScanRequest): Promise<Scan> {
  const res = await apiClient.post<ApiResponse<{ scan: Scan }>>('/scans', data);
  return res.data.data!.scan;
}

/**
 * Retrieves a specific scan by ID with its target information.
 */
export async function getScanById(scanId: string): Promise<Scan> {
  const res = await apiClient.get<ApiResponse<{ scan: Scan }>>(`/scans/${scanId}`);
  return res.data.data!.scan;
}

/**
 * Cancels an active scan.
 */
export async function cancelScan(scanId: string): Promise<Scan> {
  const res = await apiClient.post<ApiResponse<{ scan: Scan }>>(`/scans/${scanId}/cancel`);
  return res.data.data!.scan;
}

/**
 * Compares two completed scans.
 */
export async function compareScans(
  beforeScanId: string,
  afterScanId: string
): Promise<ScanComparisonResult> {
  const res = await apiClient.get<ApiResponse<ScanComparisonResult>>(
    `/scans/compare?before=${encodeURIComponent(beforeScanId)}&after=${encodeURIComponent(
      afterScanId
    )}`
  );
  return res.data.data!;
}

/**
 * Retrieves the findings of a specific scan.
 */
export async function getScanFindings(
  scanId: string,
  filters?: { severity?: Severity; category?: string }
): Promise<Finding[]> {
  const params = new URLSearchParams();
  if (filters?.severity) params.append('severity', filters.severity);
  if (filters?.category) params.append('category', filters.category);

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiClient.get<ApiResponse<{ findings: Finding[] }>>(
    `/scans/${scanId}/findings${query}`
  );
  return res.data.data!.findings;
}

export interface GetUserScansParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface PaginatedScans {
  scans: Scan[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Lists the authenticated user's scans with pagination and filters.
 */
export async function getUserScans(params: GetUserScansParams = {}): Promise<PaginatedScans> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.status && params.status !== 'ALL') queryParams.append('status', params.status);
  if (params.search && params.search.trim()) queryParams.append('search', params.search.trim());

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const res = await apiClient.get<ApiResponse<{ scans: Scan[]; pagination: PaginatedScans['pagination'] }>>(
    `/scans${queryString}`
  );
  return {
    scans: res.data.data?.scans ?? [],
    pagination: res.data.data?.pagination ?? {
      total: res.data.data?.scans?.length ?? 0,
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      totalPages: 1,
    },
  };
}
