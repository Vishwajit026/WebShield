import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getDashboardOverview } from '../services/dashboard.service';
import ScoreGauge from '../components/ScoreGauge';
import StatusBadge from '../components/StatusBadge';
import { ScoreTrendChart } from '../components/ScoreTrendChart';

export default function DashboardPage() {
  const {
    data: overview,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['dashboardOverview'],
    queryFn: getDashboardOverview,
    staleTime: 10_000,
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(dateStr));
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-surface-800 rounded-lg w-1/4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-surface-800 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-64 bg-surface-800 rounded-xl lg:col-span-1" />
          <div className="h-64 bg-surface-800 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (isError || !overview) {
    return (
      <div className="p-8 text-center bg-surface-800/40 border border-slate-800 rounded-2xl">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-white mb-1">Failed to load dashboard data</h3>
        <p className="text-xs text-slate-400 mb-4">
          An error occurred while communicating with the security assessment service.
        </p>
        <button type="button" onClick={() => refetch()} className="btn-secondary text-xs py-2 px-4">
          Retry
        </button>
      </div>
    );
  }

  const hasScans = overview.totalScans > 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Security Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time security posture and assessment metrics for your authorized targets.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/dashboard/scans/compare"
            className="btn-secondary inline-flex items-center gap-2 text-xs py-2 px-3.5"
          >
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Compare Scans
          </Link>
          <Link
            to="/dashboard/scan"
            className="btn-primary inline-flex items-center gap-2 text-xs py-2.5 px-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Security Scan
          </Link>
        </div>
      </div>

      {/* ── High-Level Metric Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Scans"
          value={overview.totalScans}
          subtitle="All-time assessments"
          icon={<ScanStackIcon />}
        />
        <MetricCard
          title="Completed"
          value={overview.completedScans}
          subtitle="Successfully analyzed"
          icon={<CheckCircleIcon />}
          textColor="text-emerald-400"
        />
        <MetricCard
          title="Active Scans"
          value={overview.activeScans}
          subtitle={overview.activeScans > 0 ? 'Analyzing targets…' : 'None in progress'}
          icon={<PulseIcon active={overview.activeScans > 0} />}
          textColor={overview.activeScans > 0 ? 'text-blue-400' : 'text-slate-300'}
        />
        <MetricCard
          title="Total Findings"
          value={overview.totalFindings}
          subtitle="Across completed scans"
          icon={<AlertShieldIcon />}
          textColor={overview.totalFindings > 0 ? 'text-yellow-400' : 'text-slate-300'}
        />
      </div>

      {/* ── Empty State if no scans ─────────────────────────────── */}
      {!hasScans ? (
        <div className="p-12 text-center bg-surface-800/40 border border-slate-800 rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-shield-500/10 border border-shield-500/30 flex items-center justify-center text-shield-400 mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path d="M12 2L4 6v6c0 5.25 3.4 10.15 8 11.5C16.6 22.15 20 17.25 20 12V6L12 2z" />
              <path d="M9 12l2.5 2.5L15.5 10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No scans yet</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
            Start your first security assessment to evaluate HTTP security headers, TLS configuration,
            cookie attributes, and CORS policies for your web application.
          </p>
          <Link to="/dashboard/scan" className="btn-primary inline-flex items-center gap-2 py-2.5 px-6 text-sm">
            Start Your First Scan
          </Link>
        </div>
      ) : (
        <>
          {/* ── Score Progression Trend ─────────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 tracking-tight flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Historical Security Trend
            </h3>
            <ScoreTrendChart data={overview.scoreTrend} />
          </div>

          {/* ── Mid Section: Score Card & Severity Summary ──────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Latest Security Score */}
            <div className="card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    Latest Security Score
                  </h3>
                  {overview.latestScan && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      {formatDate(overview.latestScan.completedAt)}
                    </span>
                  )}
                </div>
                {overview.latestScan ? (
                  <div className="py-2 flex flex-col items-center">
                    <ScoreGauge score={overview.latestScan.securityScore} size="md" />
                    <div className="mt-4 text-center">
                      <p className="text-xs text-slate-400 font-medium truncate max-w-xs">
                        Target:{' '}
                        <span className="text-white font-mono">{overview.latestScan.hostname}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {overview.latestScan.totalFindings} total findings identified
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No completed scan scores available.
                  </div>
                )}
              </div>

              {overview.latestScan && (
                <div className="pt-4 mt-2 border-t border-slate-800 flex items-center justify-between">
                  <Link
                    to={`/dashboard/scans/${overview.latestScan.id}`}
                    className="text-xs text-shield-400 hover:text-shield-300 font-medium inline-flex items-center gap-1 transition-colors"
                  >
                    View results →
                  </Link>
                  <Link
                    to={`/dashboard/scans/compare?after=${overview.latestScan.id}`}
                    className="text-xs text-slate-400 hover:text-emerald-400 font-medium transition-colors"
                  >
                    Compare scan
                  </Link>
                </div>
              )}
            </div>

            {/* Finding Severity Summary */}
            <div className="card p-6 lg:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    Findings by Severity
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Aggregated across all completed scans
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                  <SeverityCountCard
                    label="Critical"
                    count={overview.severityCounts.critical}
                    textColor="text-red-400"
                    borderColor="border-red-500/30"
                    bgColor="bg-red-500/5"
                  />
                  <SeverityCountCard
                    label="High"
                    count={overview.severityCounts.high}
                    textColor="text-orange-400"
                    borderColor="border-orange-500/30"
                    bgColor="bg-orange-500/5"
                  />
                  <SeverityCountCard
                    label="Medium"
                    count={overview.severityCounts.medium}
                    textColor="text-yellow-400"
                    borderColor="border-yellow-500/30"
                    bgColor="bg-yellow-500/5"
                  />
                  <SeverityCountCard
                    label="Low"
                    count={overview.severityCounts.low}
                    textColor="text-blue-400"
                    borderColor="border-blue-500/30"
                    bgColor="bg-blue-500/5"
                  />
                  <SeverityCountCard
                    label="Info"
                    count={overview.severityCounts.info}
                    textColor="text-slate-400"
                    borderColor="border-slate-500/30"
                    bgColor="bg-slate-500/5"
                  />
                </div>
              </div>

              {/* Responsible note */}
              <div className="mt-6 p-3 rounded-xl bg-surface-800/40 border border-slate-800 text-[11px] text-slate-500 flex items-center gap-2">
                <svg className="w-4 h-4 text-shield-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Findings indicate potential misconfigurations or missing defensive security controls.
                </span>
              </div>
            </div>
          </div>

          {/* ── Recent Scans Table ─────────────────────────────────── */}
          <div className="card overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Recent Scans</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Latest security assessments conducted on your account.
                </p>
              </div>
              <Link
                to="/dashboard/scans"
                className="text-xs font-semibold text-shield-400 hover:text-shield-300 transition-colors"
              >
                View all scan history →
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-surface-800/60 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Target</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Security Score</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Findings</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Status</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Date</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {overview.recentScans.map(scan => (
                    <tr
                      key={scan.id}
                      className="hover:bg-surface-800/40 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4 font-mono font-medium text-white max-w-xs truncate">
                        <Link to={`/dashboard/scans/${scan.id}`} className="hover:text-shield-300">
                          {scan.hostname || scan.targetUrl}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        {scan.securityScore !== null ? (
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
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-mono">
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
                        {formatDate(scan.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            to={`/dashboard/scans/compare?after=${scan.id}`}
                            className="text-xs text-slate-400 hover:text-emerald-400 font-medium"
                          >
                            Compare
                          </Link>
                          <Link
                            to={`/dashboard/scans/${scan.id}`}
                            className="inline-flex items-center gap-1 text-xs text-shield-400 hover:text-shield-300 font-medium"
                          >
                            Details
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Metric Cards ─────────────────────────────────────────────────────────────

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  textColor = 'text-white',
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: ReactNode;
  textColor?: string;
}) {
  return (
    <div className="card p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        <div className="w-8 h-8 rounded-lg bg-surface-700/60 border border-slate-700 flex items-center justify-center text-slate-300">
          {icon}
        </div>
      </div>
      <div>
        <p className={`text-2xl sm:text-3xl font-black tracking-tight ${textColor}`}>{value}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</p>
      </div>
    </div>
  );
}

function SeverityCountCard({
  label,
  count,
  textColor,
  borderColor,
  bgColor,
}: {
  label: string;
  count: number;
  textColor: string;
  borderColor: string;
  bgColor: string;
}) {
  return (
    <div className={`p-4 rounded-xl border ${borderColor} ${bgColor} text-center`}>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold mt-1 ${textColor}`}>{count}</p>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function ScanStackIcon() {
  return (
    <svg className="w-4 h-4 text-shield-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PulseIcon({ active }: { active: boolean }) {
  return (
    <span className="relative flex h-3 w-3">
      {active && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
      )}
      <span className={`relative inline-flex rounded-full h-3 w-3 ${active ? 'bg-blue-500' : 'bg-slate-500'}`} />
    </span>
  );
}

function AlertShieldIcon() {
  return (
    <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}
