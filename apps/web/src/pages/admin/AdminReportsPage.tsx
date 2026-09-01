import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { listAdminReports } from '../../services/admin.service';
import { downloadReportFile } from '../../services/report.service';
import ScoreGauge from '../../components/ScoreGauge';
import { AdminReport } from '../../types/api';

export const AdminReportsPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-reports', page, search],
    queryFn: () =>
      listAdminReports({
        page,
        limit: 15,
        search: search.trim() || undefined,
      }),
  });

  const handleDownload = async (report: AdminReport) => {
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
    <div className="space-y-8 animate-fade-in pb-12">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          Generated Security Reports
        </h1>
        <p className="text-slate-400 text-xs mt-1">
          Review, inspect, and download executive PDF assessment reports generated across tenant environments.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 border-slate-800 bg-surface-900/60">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by target hostname, filename, or user email…"
            className="w-full pl-9 pr-4 py-2 bg-surface-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-surface-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 space-y-3 animate-pulse">
            <div className="h-6 bg-surface-800 rounded w-1/4" />
            <div className="h-12 bg-surface-800/60 rounded" />
            <div className="h-12 bg-surface-800/60 rounded" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-400">Failed to load reports.</div>
        ) : data?.reports.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">No reports generated yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-surface-950 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Target</th>
                  <th className="px-6 py-3.5 font-semibold">Owner</th>
                  <th className="px-6 py-3.5 font-semibold">Security Score</th>
                  <th className="px-6 py-3.5 font-semibold">Filename & Size</th>
                  <th className="px-6 py-3.5 font-semibold">Generated</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {data?.reports.map(report => (
                  <tr key={report.id} className="hover:bg-surface-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white font-mono">{report.targetHostname || 'Target'}</div>
                      <div className="text-slate-500 truncate max-w-xs text-[11px] mt-0.5">{report.targetUrl}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-slate-200 font-medium">{report.user.name}</div>
                      <div className="text-slate-500 font-mono text-[11px]">{report.user.email}</div>
                    </td>

                    <td className="px-6 py-4">
                      {report.securityScore !== undefined && report.securityScore !== null ? (
                        <div className="flex items-center gap-2">
                          <ScoreGauge score={report.securityScore} size="sm" showLabel={false} />
                          <span className="font-bold text-white font-mono">{report.securityScore}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-slate-200 font-mono font-medium truncate max-w-xs">{report.fileName}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">{formatFileSize(report.fileSize)}</div>
                    </td>

                    <td className="px-6 py-4 text-slate-400 text-[11px]">
                      {formatDate(report.generatedAt || report.createdAt)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDownload(report)}
                        disabled={report.status !== 'COMPLETED' || downloadingId === report.id}
                        className="py-1 px-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-medium transition-all inline-flex items-center gap-1.5"
                      >
                        {downloadingId === report.id ? 'Downloading…' : 'Download PDF'}
                      </button>
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
            className="px-3 py-1.5 bg-surface-900 hover:bg-surface-800 disabled:opacity-50 text-slate-300 rounded text-xs transition-colors border border-slate-800"
          >
            Previous
          </button>
          <span className="text-xs text-slate-400">
            Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)
          </span>
          <button
            disabled={page >= data.pagination.totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 bg-surface-900 hover:bg-surface-800 disabled:opacity-50 text-slate-300 rounded text-xs transition-colors border border-slate-800"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
