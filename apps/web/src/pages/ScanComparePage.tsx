import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { compareScans, getUserScans } from '../services/scan.service';
import SeverityBadge from '../components/SeverityBadge';
import { FindingComparisonStatus } from '../types/api';

export const ScanComparePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlBeforeId = searchParams.get('before') || '';
  const urlAfterId = searchParams.get('after') || '';

  const [beforeId, setBeforeId] = useState<string>(urlBeforeId);
  const [afterId, setAfterId] = useState<string>(urlAfterId);
  const [activeTab, setActiveTab] = useState<FindingComparisonStatus | 'ALL'>('ALL');

  // Sync state with URL params
  useEffect(() => {
    if (urlBeforeId) setBeforeId(urlBeforeId);
    if (urlAfterId) setAfterId(urlAfterId);
  }, [urlBeforeId, urlAfterId]);

  // Fetch user's completed scans for the selector dropdowns
  const { data: scansData, isLoading: isLoadingScans } = useQuery({
    queryKey: ['completed-scans-for-compare'],
    queryFn: () => getUserScans({ limit: 50, status: 'COMPLETED' }),
  });

  const completedScans = scansData?.scans ?? [];

  // Fetch comparison data when both IDs are chosen
  const {
    data: comparison,
    isLoading: isLoadingComparison,
    error: comparisonError,
  } = useQuery({
    queryKey: ['scan-comparison', beforeId, afterId],
    queryFn: () => compareScans(beforeId, afterId),
    enabled: Boolean(beforeId && afterId && beforeId !== afterId),
  });

  const handleCompareSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (beforeId && afterId && beforeId !== afterId) {
      setSearchParams({ before: beforeId, after: afterId });
    }
  };

  const getStatusBadge = (status: FindingComparisonStatus) => {
    switch (status) {
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            ✓ RESOLVED
          </span>
        );
      case 'NEW':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
            + NEW RISK
          </span>
        );
      case 'PERSISTENT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-700/50 text-slate-300 border border-slate-600">
            PERSISTENT
          </span>
        );
      case 'CHANGED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            CHANGED
          </span>
        );
    }
  };

  const filteredFindings = comparison
    ? comparison.findings.filter(f => activeTab === 'ALL' || f.status === activeTab)
    : [];

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
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Scan Comparison & Trend
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Compare two historical scans to identify resolved vulnerabilities, persistent issues, and security score evolution.
          </p>
        </div>
        <Link
          to="/dashboard/scans"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 hover:text-white transition-colors"
        >
          View Scan History
        </Link>
      </div>

      {/* Scan Selectors Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <form onSubmit={handleCompareSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              1. Baseline Scan (Before)
            </label>
            <select
              value={beforeId}
              onChange={e => setBeforeId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              disabled={isLoadingScans || completedScans.length === 0}
            >
              <option value="">Select earlier baseline scan...</option>
              {completedScans.map(s => (
                <option key={`before-${s.id}`} value={s.id}>
                  {s.target?.hostname || s.id} — Score: {s.securityScore ?? 'N/A'} (
                  {new Date(s.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              2. Target Scan (After)
            </label>
            <select
              value={afterId}
              onChange={e => setAfterId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              disabled={isLoadingScans || completedScans.length === 0}
            >
              <option value="">Select recent comparison scan...</option>
              {completedScans.map(s => (
                <option key={`after-${s.id}`} value={s.id}>
                  {s.target?.hostname || s.id} — Score: {s.securityScore ?? 'N/A'} (
                  {new Date(s.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={!beforeId || !afterId || beforeId === afterId || isLoadingComparison}
              className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {isLoadingComparison ? 'Comparing...' : 'Compare Scans'}
            </button>
          </div>
        </form>

        {completedScans.length < 2 && !isLoadingScans && (
          <p className="text-xs text-amber-400/90 mt-3 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            You need at least two completed scans to perform comparative posture analysis.
          </p>
        )}
      </div>

      {/* Comparison Error */}
      {comparisonError && (
        <div className="p-4 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-300">
          {(comparisonError as Error).message || 'Failed to compare selected scans.'}
        </div>
      )}

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-6">
          {/* Delta Banner */}
          <div
            className={`p-6 rounded-xl border flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
              comparison.scoreDifference > 0
                ? 'bg-emerald-950/40 border-emerald-800/60'
                : comparison.scoreDifference < 0
                ? 'bg-red-950/40 border-red-800/60'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-2xl font-black ${
                    comparison.scoreDifference > 0
                      ? 'text-emerald-400'
                      : comparison.scoreDifference < 0
                      ? 'text-red-400'
                      : 'text-slate-300'
                  }`}
                >
                  {comparison.scoreDifference > 0 ? `+${comparison.scoreDifference}` : comparison.scoreDifference}
                </span>
                <span className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                  {comparison.scoreDifference > 0
                    ? 'Security Posture Improved'
                    : comparison.scoreDifference < 0
                    ? 'Security Posture Regressed'
                    : 'No Score Change'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Comparing Baseline (Score: {comparison.previousScore ?? 0}) to Current (Score:{' '}
                {comparison.currentScore ?? 0})
              </p>
            </div>

            {/* Metric Pills */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-center">
                <span className="block text-xs font-semibold text-emerald-400">
                  {comparison.resolvedCount} Resolved
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-center">
                <span className="block text-xs font-semibold text-red-400">
                  {comparison.newCount} New Risks
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-center">
                <span className="block text-xs font-semibold text-slate-400">
                  {comparison.persistentCount} Persistent
                </span>
              </div>
              {comparison.changedCount > 0 && (
                <div className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-center">
                  <span className="block text-xs font-semibold text-blue-400">
                    {comparison.changedCount} Changed
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Finding Comparison Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'ALL'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Differences ({comparison.findings.length})
            </button>
            <button
              onClick={() => setActiveTab('RESOLVED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'RESOLVED'
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Resolved ({comparison.resolvedCount})
            </button>
            <button
              onClick={() => setActiveTab('NEW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'NEW'
                  ? 'bg-red-950/80 text-red-400 border border-red-800/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              New Findings ({comparison.newCount})
            </button>
            <button
              onClick={() => setActiveTab('PERSISTENT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'PERSISTENT'
                  ? 'bg-slate-800 text-slate-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Persistent ({comparison.persistentCount})
            </button>
          </div>

          {/* Findings List */}
          <div className="space-y-3">
            {filteredFindings.length === 0 ? (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-sm">
                No findings in this category.
              </div>
            ) : (
              filteredFindings.map((f, index) => (
                <div
                  key={`${f.fingerprint}-${index}`}
                  className="p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors flex flex-col md:flex-row md:items-start md:justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(f.status)}
                      <SeverityBadge severity={f.severity} />
                      <span className="text-xs font-mono text-slate-500 uppercase px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                        {f.category}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-200">{f.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{f.description}</p>

                    {f.remediation && (
                      <div className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                        <strong className="text-emerald-400">Remediation: </strong>
                        {f.remediation}
                      </div>
                    )}
                  </div>

                  {f.affectedComponent && (
                    <div className="text-xs text-slate-500 font-mono whitespace-nowrap bg-slate-950 px-2 py-1 rounded border border-slate-800/60 self-start">
                      {f.affectedComponent}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
