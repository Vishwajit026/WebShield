import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAdminFindings } from '../../services/admin.service';
import SeverityBadge from '../../components/SeverityBadge';
import FindingDetailModal from '../../components/FindingDetailModal';
import { AdminFinding, Finding } from '../../types/api';

export const AdminFindingsPage = () => {
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [inspectingFinding, setInspectingFinding] = useState<Finding | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-findings', page, severityFilter, categoryFilter, search],
    queryFn: () =>
      listAdminFindings({
        page,
        limit: 20,
        severity: severityFilter !== 'ALL' ? severityFilter : undefined,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        search: search.trim() || undefined,
      }),
  });

  const handleInspect = (f: AdminFinding) => {
    setInspectingFinding({
      id: f.id,
      scanId: f.scanId,
      scanner: f.scanner,
      title: f.title,
      category: f.category,
      severity: f.severity,
      confidence: f.confidence,
      description: f.description,
      evidence: f.evidence,
      impact: f.impact,
      remediation: f.remediation,
      reference: f.reference,
      affectedComponent: f.affectedComponent,
      createdAt: f.createdAt,
    });
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          Global Findings Explorer
        </h1>
        <p className="text-slate-400 text-xs mt-1">
          Explore and query security vulnerabilities and configuration findings discovered across all targets.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 border-slate-800 bg-surface-900/60 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search findings by title, component, or description…"
            className="w-full pl-9 pr-4 py-2 bg-surface-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={severityFilter}
            onChange={e => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
            className="bg-surface-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="INFO">Info</option>
          </select>

          <select
            value={categoryFilter}
            onChange={e => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="bg-surface-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="ALL">All Categories</option>
            <option value="Security Headers">Security Headers</option>
            <option value="Cookie Security">Cookie Security</option>
            <option value="TLS / SSL">TLS / SSL</option>
            <option value="CORS Security">CORS Security</option>
            <option value="Well-Known Disclosure">Well-Known Disclosure</option>
          </select>
        </div>
      </div>

      {/* Findings Table */}
      <div className="bg-surface-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 space-y-3 animate-pulse">
            <div className="h-6 bg-surface-800 rounded w-1/4" />
            <div className="h-12 bg-surface-800/60 rounded" />
            <div className="h-12 bg-surface-800/60 rounded" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-400">Failed to load findings.</div>
        ) : data?.findings.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">No findings matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-surface-950 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Severity</th>
                  <th className="px-6 py-3.5 font-semibold">Title</th>
                  <th className="px-6 py-3.5 font-semibold">Target Domain</th>
                  <th className="px-6 py-3.5 font-semibold">Category</th>
                  <th className="px-6 py-3.5 font-semibold">Affected Component</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {data?.findings.map(f => (
                  <tr
                    key={f.id}
                    onClick={() => handleInspect(f)}
                    className="hover:bg-surface-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <SeverityBadge severity={f.severity} size="sm" />
                    </td>
                    <td className="px-6 py-4 font-semibold text-white max-w-sm">{f.title}</td>
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-300">{f.targetHostname}</td>
                    <td className="px-6 py-4 text-slate-400">{f.category}</td>
                    <td className="px-6 py-4 font-mono text-[11px] text-amber-300 max-w-xs truncate">
                      {f.affectedComponent || '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-amber-400 text-xs font-medium">Inspect →</span>
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

      {inspectingFinding && (
        <FindingDetailModal
          finding={inspectingFinding}
          onClose={() => setInspectingFinding(null)}
        />
      )}
    </div>
  );
};
