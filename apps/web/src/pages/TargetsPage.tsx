import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getUserTargets } from '../services/target.service';
import StatusBadge from '../components/StatusBadge';
import ScoreGauge from '../components/ScoreGauge';

export const TargetsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['user-targets', page, appliedSearch],
    queryFn: () => getUserTargets({ page, limit: 12, search: appliedSearch }),
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(search);
    setPage(1);
  };

  const handleScanTarget = (url: string) => {
    navigate('/dashboard/scan', { state: { prefillUrl: url } });
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            Assessed Target Assets
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage and monitor your assessed domains, endpoints, and historical posture evolutions.
          </p>
        </div>

        <Link
          to="/dashboard/scan"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all shadow-sm self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add / Scan Target
        </Link>
      </div>

      {/* Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search targets by hostname or URL..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <svg
              className="w-4 h-4 text-slate-500 absolute left-3 top-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Targets Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-48 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 bg-red-900/20 border border-red-800 rounded-xl text-red-300 text-sm">
          Failed to load targets.
        </div>
      ) : data?.targets.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-200">No targets found</h3>
          <p className="text-sm text-slate-400 mt-1 mb-4">
            {appliedSearch
              ? 'No targets matched your search query.'
              : 'You have not scanned any targets yet.'}
          </p>
          <Link
            to="/dashboard/scan"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
          >
            Start Your First Scan
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.targets.map(t => (
            <div
              key={t.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between shadow-sm space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-200 text-sm truncate" title={t.hostname}>
                      {t.hostname}
                    </h3>
                    <p className="text-xs text-slate-400 truncate mt-0.5" title={t.url}>
                      {t.url}
                    </p>
                  </div>
                  {t.latestScan?.status && (
                    <StatusBadge status={t.latestScan.status} />
                  )}
                </div>

                {t.latestScan?.securityScore !== undefined && t.latestScan?.securityScore !== null ? (
                  <div className="flex items-center gap-4 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    <ScoreGauge score={t.latestScan.securityScore} size="sm" showLabel={false} />
                    <div className="text-xs space-y-1">
                      <span className="text-slate-400 block">Latest Security Score</span>
                      <span className="font-bold text-slate-200 text-sm">
                        {t.latestScan.securityScore} / 100
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-950/40 rounded-lg text-xs text-slate-500 border border-slate-800/40">
                    No completed scan score available.
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Total Scans: <strong className="text-slate-300">{t.totalScans}</strong></span>
                  <span>
                    Last Scanned:{' '}
                    <strong className="text-slate-300">
                      {t.latestScan?.completedAt
                        ? new Date(t.latestScan.completedAt).toLocaleDateString()
                        : 'Never'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Card Actions */}
              <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                <button
                  onClick={() => handleScanTarget(t.url)}
                  className="flex-1 py-1.5 px-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Scan Target
                </button>

                {t.latestScan && (
                  <Link
                    to={`/dashboard/scans/${t.latestScan.id}`}
                    className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                  >
                    Results
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
