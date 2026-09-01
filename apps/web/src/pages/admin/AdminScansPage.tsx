import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listAdminScans } from '../../services/admin.service';
import StatusBadge from '../../components/StatusBadge';
import ScoreGauge from '../../components/ScoreGauge';

export const AdminScansPage = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [targetSearch, setTargetSearch] = useState('');
  const [userEmailSearch, setUserEmailSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-scans', page, statusFilter, targetSearch, userEmailSearch],
    queryFn: () =>
      listAdminScans({
        page,
        limit: 15,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        target: targetSearch.trim() || undefined,
        userEmail: userEmailSearch.trim() || undefined,
      }),
  });

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
          System-Wide Assessments
        </h1>
        <p className="text-slate-400 text-xs mt-1">
          Monitor and inspect security scans conducted across all tenant accounts in real-time.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 border-slate-800 bg-surface-900/60">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <input
              type="text"
              value={targetSearch}
              onChange={e => {
                setTargetSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search hostname or URL…"
              className="w-full pl-9 pr-4 py-2 bg-surface-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="relative">
            <input
              type="text"
              value={userEmailSearch}
              onChange={e => {
                setUserEmailSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by user email…"
              className="w-full pl-9 pr-4 py-2 bg-surface-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="RUNNING">RUNNING</option>
              <option value="QUEUED">QUEUED</option>
              <option value="FAILED">FAILED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scans Table */}
      <div className="bg-surface-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 space-y-3 animate-pulse">
            <div className="h-6 bg-surface-800 rounded w-1/4" />
            <div className="h-12 bg-surface-800/60 rounded" />
            <div className="h-12 bg-surface-800/60 rounded" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-400">Failed to load system scans.</div>
        ) : data?.scans.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">No assessments match filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-surface-950 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Target</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Initiated By</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Status</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Score</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Findings</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Executed</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {data?.scans.map(scan => (
                  <tr key={scan.id} className="hover:bg-surface-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white font-mono">{scan.targetHostname}</div>
                      <div className="text-slate-500 truncate max-w-xs text-[11px] mt-0.5">{scan.targetUrl}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-slate-200 font-medium">{scan.user.name}</div>
                      <div className="text-slate-500 font-mono text-[11px]">{scan.user.email}</div>
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge status={scan.status} size="sm" />
                    </td>

                    <td className="px-6 py-4">
                      {scan.securityScore !== null ? (
                        <div className="flex items-center gap-2">
                          <ScoreGauge score={scan.securityScore} size="sm" showLabel={false} />
                          <span className="font-bold text-white font-mono">{scan.securityScore}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        {scan.criticalCount > 0 && <span className="text-red-400 font-bold">{scan.criticalCount}C</span>}
                        {scan.highCount > 0 && <span className="text-orange-400 font-bold">{scan.highCount}H</span>}
                        {scan.mediumCount > 0 && <span className="text-yellow-400 font-bold">{scan.mediumCount}M</span>}
                        <span className="text-slate-500">({scan.totalFindings} total)</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-slate-400 text-[11px]">
                      {formatDate(scan.startedAt || scan.createdAt)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/admin/scans/${scan.id}`}
                        className="px-3 py-1 bg-surface-800 hover:bg-surface-700 text-amber-300 border border-slate-700 rounded-lg text-[11px] font-medium transition-colors inline-block"
                      >
                        Inspect
                      </Link>
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
