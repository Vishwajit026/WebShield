import apiClient, { getAccessToken } from '../lib/apiClient';
import type { ApiResponse, Report, PaginatedReportsResponse } from '../types/api';

/**
 * Triggers report generation for a completed scan.
 */
export async function generateScanReport(scanId: string): Promise<Report> {
  const res = await apiClient.post<ApiResponse<{ report: Report }>>(`/scans/${scanId}/reports`);
  return res.data.data!.report;
}

/**
 * Retrieves report metadata.
 */
export async function getReportById(reportId: string): Promise<Report> {
  const res = await apiClient.get<ApiResponse<{ report: Report }>>(`/reports/${reportId}`);
  return res.data.data!.report;
}

/**
 * Downloads a generated PDF report securely as an attachment.
 */
export async function downloadReportFile(reportId: string, fileName: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`/api/reports/${reportId}/download`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to download report PDF');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || `webshield-report-${reportId}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Lists user reports with pagination.
 */
export async function getUserReports(
  params: { page?: number; limit?: number } = {}
): Promise<PaginatedReportsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const res = await apiClient.get<ApiResponse<PaginatedReportsResponse>>(`/reports${qs ? `?${qs}` : ''}`);
  return res.data.data!;
}
