import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getScanById } from '../services/scan.service';
import { generateScanReport, downloadReportFile } from '../services/report.service';
import type { Finding, Severity } from '../types/api';
import StatusBadge from '../components/StatusBadge';
import SeverityBadge from '../components/SeverityBadge';
import ScoreGauge from '../components/ScoreGauge';
import FindingsChart from '../components/FindingsChart';
import FindingDetailModal from '../components/FindingDetailModal';

const SEVERITY_WEIGHT: Record<Severity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

export default function ScanResultsPage() {
  const { id } = useParams<{ id: string }>();

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedConfidence, setSelectedConfidence] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'severity' | 'title' | 'category'>('severity');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Report generation state
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Finding modal inspector state
  const [inspectingFinding, setInspectingFinding] = useState<Finding | null>(null);

  const {
    data: scan,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['scan', id],
    queryFn: () => getScanById(id!),
    enabled: !!id,
    refetchInterval: query => {
      const status = query.state.data?.status;
      if (status === 'QUEUED' || status === 'RUNNING') {
        return 2000; // Poll every 2s while in progress
      }
      return false; // Stop polling when finished
    },
  });

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(dateStr));
  };

  // Derive categories present in findings
  const availableCategories = useMemo(() => {
    if (!scan?.findings) return [];
    const set = new Set<string>();
    scan.findings.forEach(f => {
      if (f.category) set.add(f.category);
    });
    return Array.from(set).sort();
  }, [scan?.findings]);

  // Filter and sort findings
  const filteredFindings = useMemo(() => {
    if (!scan?.findings) return [];

    return scan.findings
      .filter(f => {
        // Severity filter
        if (selectedSeverity !== 'ALL' && f.severity !== selectedSeverity) return false;
        // Category filter
        if (selectedCategory !== 'ALL' && f.category !== selectedCategory) return false;
        // Confidence filter
        if (selectedConfidence !== 'ALL' && f.confidence !== selectedConfidence) return false;
        // Search query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const matchTitle = f.title.toLowerCase().includes(query);
          const matchCat = f.category.toLowerCase().includes(query);
          const matchComp = f.affectedComponent?.toLowerCase().includes(query) ?? false;
          const matchDesc = f.description.toLowerCase().includes(query);
          if (!matchTitle && !matchCat && !matchComp && !matchDesc) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'severity') {
          const weightA = SEVERITY_WEIGHT[a.severity] ?? 0;
          const weightB = SEVERITY_WEIGHT[b.severity] ?? 0;
          return sortOrder === 'desc' ? weightB - weightA : weightA - weightB;
        }
        if (sortBy === 'title') {
          return sortOrder === 'asc'
            ? a.title.localeCompare(b.title)
            : b.title.localeCompare(a.title);
        }
        if (sortBy === 'category') {
          return sortOrder === 'asc'
            ? a.category.localeCompare(b.category)
            : b.category.localeCompare(a.category);
        }
        return 0;
      });
  }, [
    scan?.findings,
    selectedSeverity,
    selectedCategory,
    selectedConfidence,
    searchQuery,
    sortBy,
    sortOrder,
  ]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 bg-surface-800 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 bg-surface-800 rounded-2xl" />
          <div className="h-64 bg-surface-800 rounded-2xl md:col-span-2" />
        </div>
        <div className="h-96 bg-surface-800 rounded-2xl" />
      </div>
    );
  }

  if (isError || !scan) {
    const axiosError = error as { response?: { status?: number; data?: { error?: { message?: string } } } };
    const status = axiosError.response?.status;
    const errorMessage =
      status === 404 || status === 403
        ? 'Scan not found or you do not have permission to view it.'
        : 'Failed to retrieve scan details.';

    return (
      <div className="p-12 text-center bg-surface-800/40 border border-slate-800 rounded-2xl max-w-xl mx-auto my-8">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Unable to Load Scan</h2>
        <p className="text-xs sm:text-sm text-slate-400 mb-6">{errorMessage}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/dashboard" className="btn-secondary text-xs py-2 px-4">
            Back to Dashboard
          </Link>
          <button type="button" onClick={() => refetch()} className="btn-primary text-xs py-2 px-4">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isRunning = scan.status === 'QUEUED' || scan.status === 'RUNNING';
  const isFailed = scan.status === 'FAILED';
  const isCompleted = scan.status === 'COMPLETED';

  const handleGenerateReport = async () => {
    if (!scan) return;
    try {
      setIsGeneratingReport(true);
      toast.loading('Generating executive PDF report...', { id: 'report-gen' });
      const report = await generateScanReport(scan.id);
      toast.success('Report generated! Downloading PDF...', { id: 'report-gen' });
      await downloadReportFile(report.id, report.fileName);
    } catch {
      toast.error('Failed to generate PDF report', { id: 'report-gen' });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* ── Breadcrumbs & Quick Back ───────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Link to="/dashboard" className="hover:text-white transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link to="/dashboard/scans" className="hover:text-white transition-colors">
            Scans
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-mono">{scan.id.slice(0, 8)}…</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isCompleted && (
            <button
              onClick={handleGenerateReport}
              disabled={isGeneratingReport}
              className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 shadow-sm"
            >
              {isGeneratingReport ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating Report...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Generate PDF Report
                </>
              )}
            </button>
          )}

          <Link
            to={`/dashboard/scans/compare?after=${scan.id}`}
            className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Compare Scan
          </Link>
          <Link
            to="/dashboard/scan"
            className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-shield-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Scan
          </Link>
        </div>
      </div>

      {/* ── Scan Results Header ─────────────────────────────────── */}
      <div className="card p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge status={scan.status} size="md" />
              <span className="text-xs text-slate-500 font-mono">ID: {scan.id}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-all font-mono">
              {scan.target?.url ?? scan.target?.normalizedUrl ?? 'Target'}
            </h1>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-slate-400 mt-3">
              <div>
                <span className="text-slate-500">Hostname: </span>
                <span className="text-slate-300 font-mono">{scan.target?.hostname}</span>
              </div>
              <div>
                <span className="text-slate-500">Started: </span>
                <span className="text-slate-300">{formatDate(scan.startedAt ?? scan.createdAt)}</span>
              </div>
              {scan.completedAt && (
                <div>
                  <span className="text-slate-500">Completed: </span>
                  <span className="text-slate-300">{formatDate(scan.completedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Score Capsule */}
          {isCompleted && scan.securityScore !== null && scan.securityScore !== undefined && (
            <div className="flex-shrink-0 bg-surface-800/80 border border-slate-700/80 p-4 rounded-2xl flex items-center gap-4">
              <ScoreGauge score={scan.securityScore} size="sm" showLabel={false} />
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  Security Rating
                </p>
                <p className="text-lg font-bold text-white">
                  {scan.securityScore >= 90
                    ? 'Excellent'
                    : scan.securityScore >= 75
                    ? 'Good'
                    : scan.securityScore >= 50
                    ? 'Moderate'
                    : scan.securityScore >= 25
                    ? 'Poor'
                    : 'Critical'}
                </p>
                <p className="text-[11px] text-slate-500">{scan.totalFindings} total findings</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Running / Queued Progress State ──────────────────────── */}
      {isRunning && (
        <div className="card p-12 text-center border-blue-500/30 bg-blue-500/5">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 mx-auto mb-4 animate-pulse">
            <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Security Assessment In Progress</h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed mb-4">
            Executing automated security engine checks across HTTP security headers, TLS configuration,
            and cookie attributes for <span className="font-mono text-white">{scan.target?.hostname}</span>.
          </p>
          <p className="text-[11px] text-slate-500">
            Real-time status updates are polling automatically. Please remain on this page.
          </p>
        </div>
      )}

      {/* ── Failed State ────────────────────────────────────────── */}
      {isFailed && (
        <div className="card p-8 border-red-500/30 bg-red-500/5 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Assessment Failed</h3>
          <p className="text-xs sm:text-sm text-red-300 max-w-md mx-auto mb-6">
            {scan.errorMessage || 'An error occurred during target evaluation.'}
          </p>
          <Link to="/dashboard/scan" className="btn-primary text-xs py-2.5 px-6">
            Configure New Scan
          </Link>
        </div>
      )}

      {/* ── Completed Results Section ───────────────────────────── */}
      {isCompleted && (
        <>
          {/* Overview Grid: Score Gauge + Findings Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score Card */}
            <div className="card p-6 flex flex-col items-center justify-center text-center">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-6">
                Security Score
              </h3>
              <ScoreGauge score={scan.securityScore} size="lg" />
              <p className="text-xs text-slate-400 mt-6 max-w-xs leading-relaxed">
                Calculated based on severity deductions for missing defense-in-depth headers and
                configuration attributes.
              </p>
            </div>

            {/* Findings Distribution Chart */}
            <div className="card p-6 lg:col-span-2 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Findings Distribution
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  {scan.totalFindings} findings identified
                </span>
              </div>
              <FindingsChart
                criticalCount={scan.criticalCount}
                highCount={scan.highCount}
                mediumCount={scan.mediumCount}
                lowCount={scan.lowCount}
                infoCount={scan.infoCount}
              />
            </div>
          </div>

          {/* ── Findings Section with Table, Filter, and Search ────── */}
          <div className="card overflow-hidden">
            {/* Filter and Search Bar */}
            <div className="p-6 border-b border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Assessment Findings ({filteredFindings.length})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click any finding row to view technical evidence, impact, and remediation steps.
                  </p>
                </div>

                {/* Search input */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search findings…"
                    className="w-full pl-9 pr-4 py-2 bg-surface-700/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-shield-500 focus:border-transparent transition-all"
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
              </div>

              {/* Filters & Sorting Controls */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {/* Severity filter */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium">Severity:</span>
                  <select
                    value={selectedSeverity}
                    onChange={e => setSelectedSeverity(e.target.value)}
                    className="bg-surface-700 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-shield-500"
                  >
                    <option value="ALL">All Severities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                    <option value="INFO">Info</option>
                  </select>
                </div>

                {/* Category filter */}
                {availableCategories.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-500 font-medium">Category:</span>
                    <select
                      value={selectedCategory}
                      onChange={e => setSelectedCategory(e.target.value)}
                      className="bg-surface-700 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-shield-500"
                    >
                      <option value="ALL">All Categories</option>
                      {availableCategories.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Confidence filter */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium">Confidence:</span>
                  <select
                    value={selectedConfidence}
                    onChange={e => setSelectedConfidence(e.target.value)}
                    className="bg-surface-700 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-shield-500"
                  >
                    <option value="ALL">All Confidence</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                {/* Sort selector */}
                <div className="flex items-center gap-1.5 text-xs ml-auto">
                  <span className="text-slate-500 font-medium">Sort:</span>
                  <select
                    value={`${sortBy}_${sortOrder}`}
                    onChange={e => {
                      const [field, order] = e.target.value.split('_') as [
                        'severity' | 'title' | 'category',
                        'asc' | 'desc'
                      ];
                      setSortBy(field);
                      setSortOrder(order);
                    }}
                    className="bg-surface-700 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-shield-500"
                  >
                    <option value="severity_desc">Severity (High → Low)</option>
                    <option value="severity_asc">Severity (Low → High)</option>
                    <option value="title_asc">Title (A → Z)</option>
                    <option value="title_desc">Title (Z → A)</option>
                    <option value="category_asc">Category (A → Z)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Findings Table */}
            {filteredFindings.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm font-semibold text-white mb-1">No findings matching criteria</p>
                <p className="text-xs text-slate-400">
                  Try adjusting your search query or severity filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-surface-800/60 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th scope="col" className="px-6 py-3.5 font-semibold">Severity</th>
                      <th scope="col" className="px-6 py-3.5 font-semibold">Title</th>
                      <th scope="col" className="px-6 py-3.5 font-semibold">Category</th>
                      <th scope="col" className="px-6 py-3.5 font-semibold">Confidence</th>
                      <th scope="col" className="px-6 py-3.5 font-semibold">Affected Component</th>
                      <th scope="col" className="px-6 py-3.5 font-semibold text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredFindings.map(finding => (
                      <tr
                        key={finding.id}
                        onClick={() => setInspectingFinding(finding)}
                        className="hover:bg-surface-800/50 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <SeverityBadge severity={finding.severity} size="sm" />
                        </td>
                        <td className="px-6 py-4 font-semibold text-white group-hover:text-shield-300 transition-colors max-w-sm">
                          {finding.title}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                          {finding.category}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                          {finding.confidence}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-shield-300 max-w-xs truncate">
                          {finding.affectedComponent || '—'}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <span className="text-xs text-shield-400 group-hover:text-shield-300 font-medium inline-flex items-center gap-1">
                            Inspect
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Scan Limitations Notice ────────────────────────────── */}
          <div className="p-4 rounded-2xl bg-surface-800/40 border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
            <svg className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="leading-relaxed">
              <strong className="text-slate-300">Assessment Scope Notice: </strong>
              WebShield performs non-destructive security checks and does not guarantee that a target
              is free from vulnerabilities. This assessment does not replace comprehensive manual
              penetration testing or source code audits.
            </p>
          </div>
        </>
      )}

      {/* ── Finding Inspection Modal ─────────────────────────────── */}
      {inspectingFinding && (
        <FindingDetailModal
          finding={inspectingFinding}
          onClose={() => setInspectingFinding(null)}
        />
      )}
    </div>
  );
}
