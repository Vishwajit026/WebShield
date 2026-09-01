import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getUserReports, downloadReportFile } from '../services/report.service';
import ScoreGauge from '../components/ScoreGauge';
import { Report } from '../types/api';

export const ReportsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['user-reports', page],
    queryFn: () => getUserReports({ page, limit: 10 }),
  });

  const handleDownload = async (report: Report) => {
    try {
      setDownloadingId(report.id);
      await downloadReportFile(report.id, report.fileName);
      toast.success('Report downloaded successfully');
    } catch {
      toast.error('Failed to download report PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(dateStr));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <svg
              className="w-6 h-6 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Security Assessment Reports
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Generated client-ready executive security reports and PDF exports from completed assessments.
          </p>
        </div>

        <Link
          to="/dashboard/scans"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 hover:text-white transition-colors"
        >
          Scan History
        </Link>
      </div>

      {/* Reports Table / Content */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 space-y-4 animate-pulse">
            <div className="h-6 bg-slate-800 rounded w-1/4" />
            <div className="h-16 bg-slate-800/60 rounded" />
            <div className="h-16 bg-slate-800/60 rounded" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-300">
            Failed to load generated reports.
          </div>
        ) : data?.reports.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-200">No reports generated yet</h3>
            <p className="text-sm text-slate-400 mt-1 mb-4">
              You can generate a PDF executive report from any completed scan in your Scan History.
            </p>
            <Link
              to="/dashboard/scans"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
            >
              Browse Completed Scans
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Target</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Security Score</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">File Details</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Generated Date</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Status</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {data?.reports.map(report => (
                  <tr key={report.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-100 font-mono text-sm">
                        {report.targetHostname || 'Target'}
                      </div>
                      <div className="text-slate-500 truncate max-w-xs text-xs mt-0.5">
                        {report.targetUrl}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {report.securityScore !== undefined && report.securityScore !== null ? (
                        <div className="flex items-center gap-2">
                          <ScoreGauge score={report.securityScore} size="sm" showLabel={false} />
                          <span className="font-bold text-slate-200 text-sm">
                            {report.securityScore} / 100
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-slate-200 font-mono font-medium truncate max-w-xs">
                        {report.fileName}
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        Size: {formatFileSize(report.fileSize)}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-slate-400">
                      {formatDate(report.generatedAt || report.createdAt)}
                    </td>

                    <td className="px-6 py-4">
                      {report.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Ready
                        </span>
                      ) : report.status === 'GENERATING' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse">
                          Generating...
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
                          Failed
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          to={`/dashboard/scans/${report.scanId}`}
                          className="text-xs text-slate-400 hover:text-slate-200 font-medium"
                        >
                          View Scan
                        </Link>
                        <button
                          onClick={() => handleDownload(report)}
                          disabled={report.status !== 'COMPLETED' || downloadingId === report.id}
                          className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-all shadow-sm inline-flex items-center gap-1.5"
                        >
                          {downloadingId === report.id ? (
                            <span>Downloading...</span>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                />
                              </svg>
                              Download PDF
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded text-xs transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-slate-400">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <button
            disabled={page >= data.pagination.totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded text-xs transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
