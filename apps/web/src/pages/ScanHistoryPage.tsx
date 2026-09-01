import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getUserScans } from '../services/scan.service';
import StatusBadge from '../components/StatusBadge';

export default function ScanHistoryPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['scanHistory', { page, limit, status, search }],
    queryFn: () => getUserScans({ page, limit, status, search }),
    staleTime: 5_000,
  });

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(dateStr));
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const scans = data?.scans ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 1 };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Scan History
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Historical security assessments conducted by your account.
          </p>
        </div>
        <Link
          to="/dashboard/scan"
          className="btn-primary inline-flex items-center gap-2 text-xs py-2.5 px-4 self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Scan
        </Link>
      </div>

      {/* ── Filters & Search Controls ───────────────────────────── */}
      <div className="card p-4 sm:p-6 space-y-4">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          {/* Search bar */}
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by target URL or host…"
              className="w-full pl-9 pr-4 py-2 bg-surface-700/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-shield-500 transition-all"
            />
            <svg
              className="w-4 h-4 text-slate-500 absolute left-3 top-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Status filter & Page limit */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-medium">Status:</span>
              <select
                value={status}
                onChange={e => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="bg-surface-700 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-shield-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="RUNNING">Running</option>
                <option value="FAILED">Failed</option>
                <option value="QUEUED">Queued</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-medium">Show:</span>
              <select
                value={limit}
                onChange={e => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-surface-700 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-shield-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </form>
      </div>

      {/* ── Scans Table ─────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-surface-800 rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <p className="text-sm text-red-400 font-medium mb-2">Failed to load scan history</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="btn-secondary text-xs py-1.5 px-4"
            >
              Retry
            </button>
          </div>
        ) : scans.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-700/60 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-white mb-1">No scan records found</h3>
            <p className="text-xs text-slate-400 mb-6 max-w-sm mx-auto">
              {search || status !== 'ALL'
                ? 'No scans match your specified filters. Try resetting the search filters.'
                : 'You have not run any security assessments yet.'}
            </p>
            {!search && status === 'ALL' && (
              <Link to="/dashboard/scan" className="btn-primary text-xs py-2.5 px-5">
                Start Your First Scan
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-surface-800/60 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Target</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Score</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Findings</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Status</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Started</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Completed</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {scans.map(scan => (
                    <tr
                      key={scan.id}
                      className="hover:bg-surface-800/50 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4 font-mono font-medium text-white max-w-xs truncate">
                        <Link to={`/dashboard/scans/${scan.id}`} className="hover:text-shield-300">
                          {scan.target?.hostname || scan.target?.url || '—'}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        {scan.securityScore !== null && scan.securityScore !== undefined ? (
                          <span
                            className={`font-bold ${
                              scan.securityScore >= 90
                                ? 'text-emerald-400'
                                : scan.securityScore >= 75
                                ? 'text-sky-400'
                                : scan.securityScore >= 50
                                ? 'text-amber-400'
                                : 'text-red-400'
                            }`}
                          >
                            {scan.securityScore} / 100
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white">{scan.totalFindings}</span>
                          {scan.criticalCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 text-[10px]">
                              {scan.criticalCount}C
                            </span>
                          )}
                          {scan.highCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 text-[10px]">
                              {scan.highCount}H
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={scan.status} size="sm" />
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-[11px]">
                        {formatDate(scan.startedAt ?? scan.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-[11px]">
                        {formatDate(scan.completedAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/dashboard/scans/${scan.id}`}
                          className="inline-flex items-center gap-1 text-xs text-shield-400 hover:text-shield-300 font-medium"
                        >
                          View Results
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-800 bg-surface-800/40 flex items-center justify-between flex-wrap gap-4 text-xs text-slate-400">
              <div>
                Showing{' '}
                <span className="font-semibold text-white">
                  {scans.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-white">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>{' '}
                of <span className="font-semibold text-white">{pagination.total}</span> scans
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-2 font-mono text-slate-300">
                  Page {pagination.page} of {pagination.totalPages || 1}
                </span>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
