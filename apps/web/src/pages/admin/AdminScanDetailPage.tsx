import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAdminScanById } from '../../services/admin.service';
import StatusBadge from '../../components/StatusBadge';
import SeverityBadge from '../../components/SeverityBadge';
import ScoreGauge from '../../components/ScoreGauge';
import FindingDetailModal from '../../components/FindingDetailModal';
import { Finding } from '../../types/api';

export const AdminScanDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [inspectingFinding, setInspectingFinding] = useState<Finding | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-scan-detail', id],
    queryFn: () => getAdminScanById(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-surface-900 rounded w-1/4" />
        <div className="h-48 bg-surface-900 rounded-2xl" />
        <div className="h-64 bg-surface-900 rounded-2xl" />
      </div>
    );
  }

  if (error || !data?.scan) {
    return (
      <div className="p-8 bg-surface-900 border border-red-500/30 rounded-2xl text-center">
        <p className="text-sm font-semibold text-red-400">Scan not found or access error</p>
        <Link to="/admin/scans" className="text-xs text-slate-400 hover:text-white underline mt-2 block">
          Return to scans list
        </Link>
      </div>
    );
  }

  const { scan } = data;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(dateStr));
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link to="/admin" className="hover:text-white">Admin</Link>
        <span>/</span>
        <Link to="/admin/scans" className="hover:text-white">Scans</Link>
        <span>/</span>
        <span className="text-amber-400 font-mono">{scan.id.slice(0, 8)}…</span>
      </div>

      {/* Header Card */}
      <div className="card p-6 border-slate-800 bg-surface-900/60">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge status={scan.status} size="md" />
              <span className="text-xs text-slate-500 font-mono">ID: {scan.id}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white font-mono break-all">
              {scan.targetHostname}
            </h1>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-slate-400 mt-3">
              <div>
                <span className="text-slate-500">Owner: </span>
                <span className="text-slate-200 font-medium">{scan.user.name}</span>{' '}
                <span className="text-slate-500 font-mono">({scan.user.email})</span>
              </div>
              <div>
                <span className="text-slate-500">Executed: </span>
                <span className="text-slate-300">{formatDate(scan.startedAt || scan.createdAt)}</span>
              </div>
            </div>
          </div>

          {scan.securityScore !== null && (
            <div className="flex items-center gap-4 bg-surface-950 p-4 rounded-2xl border border-slate-800">
              <ScoreGauge score={scan.securityScore} size="sm" showLabel={false} />
              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Score</span>
                <p className="text-xl font-bold text-white font-mono">{scan.securityScore} / 100</p>
                <span className="text-[11px] text-slate-500">{scan.totalFindings} findings</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Findings Catalog */}
      <div className="card overflow-hidden border-slate-800 bg-surface-900/60">
        <div className="p-5 border-b border-slate-800">
          <h3 className="text-base font-bold text-white">
            Assessment Findings ({scan.findings?.length || 0})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Click any finding to inspect sanitized raw evidence, security impact, and remediation steps.
          </p>
        </div>

        {scan.findings?.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">Zero security findings identified.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-surface-950 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Severity</th>
                  <th className="px-6 py-3.5 font-semibold">Title</th>
                  <th className="px-6 py-3.5 font-semibold">Category</th>
                  <th className="px-6 py-3.5 font-semibold">Affected Component</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {scan.findings?.map(f => (
                  <tr
                    key={f.id}
                    onClick={() => setInspectingFinding(f)}
                    className="hover:bg-surface-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <SeverityBadge severity={f.severity} size="sm" />
                    </td>
                    <td className="px-6 py-4 font-semibold text-white max-w-sm">{f.title}</td>
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

      {inspectingFinding && (
        <FindingDetailModal
          finding={inspectingFinding}
          onClose={() => setInspectingFinding(null)}
        />
      )}
    </div>
  );
};
