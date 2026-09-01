import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getAdminOverview, getSystemHealth } from '../../services/admin.service';

export const AdminDashboardPage = () => {
  const { data: overview, isLoading: isOverviewLoading, error: overviewError } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: getAdminOverview,
    refetchInterval: 15000,
  });

  const { data: health } = useQuery({
    queryKey: ['admin-health-mini'],
    queryFn: getSystemHealth,
    refetchInterval: 30000,
  });

  if (isOverviewLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-surface-900 rounded w-1/4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-surface-900 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-surface-900 rounded-2xl" />
      </div>
    );
  }

  if (overviewError || !overview) {
    return (
      <div className="p-8 bg-surface-900 border border-red-500/30 rounded-2xl text-center">
        <p className="text-sm font-semibold text-red-400">Failed to load administrative overview</p>
        <p className="text-xs text-slate-400 mt-1">Please verify backend connectivity and admin authorization.</p>
      </div>
    );
  }

  const { metrics, recentFailures, recentAuditLogs } = overview;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header & Subsystem Capsule */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            System Administration Overview
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Global metrics, multi-tenant inventory, scanner performance, and real-time security events.
          </p>
        </div>

        <Link
          to="/admin/health"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-surface-900 hover:border-slate-700 transition-colors text-xs"
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              health?.status === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className="text-slate-300 font-medium">
            System Health: <strong className="text-white capitalize">{health?.status || 'Active'}</strong>
          </span>
        </Link>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="card p-5 border-slate-800 bg-surface-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Users</span>
            <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeWidth={2} />
                <circle cx="9" cy="7" r="4" strokeWidth={2} />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-white mt-3 font-mono">{metrics.users.total}</p>
          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
            <span>
              Active: <strong className="text-emerald-400">{metrics.users.active}</strong>
            </span>
            <span>•</span>
            <span>
              Suspended: <strong className="text-red-400">{metrics.users.suspended}</strong>
            </span>
          </div>
        </div>

        {/* Total Scans */}
        <div className="card p-5 border-slate-800 bg-surface-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Scans</span>
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="9" strokeWidth={2} />
                <path d="M12 3v4M12 17v4M3 12h4M17 12h4" strokeLinecap="round" strokeWidth={2} />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-white mt-3 font-mono">{metrics.scans.total}</p>
          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
            <span>
              Today: <strong className="text-white">{metrics.scans.today}</strong>
            </span>
            <span>•</span>
            <span>
              Active: <strong className="text-blue-400">{metrics.scans.active}</strong>
            </span>
          </div>
        </div>

        {/* Total Findings */}
        <div className="card p-5 border-slate-800 bg-surface-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Findings</span>
            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-white mt-3 font-mono">{metrics.findings.total}</p>
          <div className="flex items-center gap-2 text-[11px] mt-2">
            <span className="text-red-400 font-semibold">{metrics.findings.bySeverity.critical} Crit</span>
            <span className="text-orange-400 font-semibold">{metrics.findings.bySeverity.high} High</span>
            <span className="text-yellow-400 font-semibold">{metrics.findings.bySeverity.medium} Med</span>
          </div>
        </div>

        {/* Generated Reports */}
        <div className="card p-5 border-slate-800 bg-surface-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">PDF Reports</span>
            <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-white mt-3 font-mono">{metrics.reports.total}</p>
          <p className="text-[11px] text-slate-400 mt-2">
            Avg Duration: <strong className="text-slate-200">{metrics.scans.averageDurationSeconds}s</strong>
          </p>
        </div>
      </div>

      {/* Severity Breakdown Bar */}
      <div className="card p-6 border-slate-800 bg-surface-900/60">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
          Global Vulnerability Distribution
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
            <span className="text-[11px] font-semibold text-red-400 uppercase">Critical</span>
            <p className="text-xl font-bold text-white mt-1 font-mono">{metrics.findings.bySeverity.critical}</p>
          </div>
          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-center">
            <span className="text-[11px] font-semibold text-orange-400 uppercase">High</span>
            <p className="text-xl font-bold text-white mt-1 font-mono">{metrics.findings.bySeverity.high}</p>
          </div>
          <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-center">
            <span className="text-[11px] font-semibold text-yellow-400 uppercase">Medium</span>
            <p className="text-xl font-bold text-white mt-1 font-mono">{metrics.findings.bySeverity.medium}</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-center">
            <span className="text-[11px] font-semibold text-blue-400 uppercase">Low</span>
            <p className="text-xl font-bold text-white mt-1 font-mono">{metrics.findings.bySeverity.low}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-500/10 border border-slate-500/30 text-center col-span-2 sm:col-span-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Info</span>
            <p className="text-xl font-bold text-white mt-1 font-mono">{metrics.findings.bySeverity.info}</p>
          </div>
        </div>
      </div>

      {/* Grid: Recent Failures + Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Failures */}
        <div className="card p-6 border-slate-800 bg-surface-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Recent Failed Assessments
              </h3>
              <Link to="/admin/scans?status=FAILED" className="text-xs text-amber-400 hover:underline">
                View All
              </Link>
            </div>

            {recentFailures.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Zero recent scan failures recorded.
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentFailures.map(f => (
                  <div
                    key={f.id}
                    className="p-3 rounded-xl bg-surface-950 border border-red-500/20 text-xs flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-white font-semibold">{f.targetHostname}</span>
                      <span className="text-slate-500 text-[10px]">{new Date(f.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-red-300 text-[11px] truncate">{f.errorMessage}</p>
                    <span className="text-slate-500 text-[10px]">User: {f.userEmail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Audit Activity */}
        <div className="card p-6 border-slate-800 bg-surface-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Recent Audit Trail Events
              </h3>
              <Link to="/admin/audit-logs" className="text-xs text-amber-400 hover:underline">
                Full Audit Trail
              </Link>
            </div>

            {recentAuditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No recent audit events.
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentAuditLogs.map(log => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-surface-950 border border-slate-800 text-xs flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          {log.action}
                        </span>
                        <span className="text-slate-300 truncate font-mono text-[11px]">{log.userEmail}</span>
                      </div>
                      {log.ipAddress && (
                        <span className="text-slate-500 text-[10px] mt-0.5 block">IP: {log.ipAddress}</span>
                      )}
                    </div>
                    <span className="text-slate-500 text-[10px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
