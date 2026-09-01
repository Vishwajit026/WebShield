import { useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAdminAuditLogs } from '../../services/admin.service';

export const AdminAuditLogsPage = () => {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-audit-logs', page, actionFilter],
    queryFn: () =>
      listAdminAuditLogs({
        page,
        limit: 25,
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
      }),
  });

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(dateStr));
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          Security Audit Trail
        </h1>
        <p className="text-slate-400 text-xs mt-1">
          Cryptographically-sequenced, immutable audit records capturing critical authentication, administrative, and assessment actions.
        </p>
      </div>

      {/* Filter and Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium">Filter Action:</span>
          <select
            value={actionFilter}
            onChange={e => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="bg-surface-900 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
          >
            <option value="ALL">All Recorded Actions</option>
            <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
            <option value="LOGIN_FAILED">LOGIN_FAILED</option>
            <option value="USER_SUSPENDED">USER_SUSPENDED</option>
            <option value="USER_REACTIVATED">USER_REACTIVATED</option>
            <option value="ROLE_CHANGED">ROLE_CHANGED</option>
            <option value="SCAN_CREATED">SCAN_CREATED</option>
            <option value="SCAN_COMPLETED">SCAN_COMPLETED</option>
            <option value="SCAN_FAILED">SCAN_FAILED</option>
            <option value="REPORT_GENERATED">REPORT_GENERATED</option>
            <option value="SESSION_REVOKED">SESSION_REVOKED</option>
            <option value="ALL_SESSIONS_REVOKED">ALL_SESSIONS_REVOKED</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-slate-500 text-[11px]">
          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Immutable Ledger: Audit events cannot be altered or deleted.</span>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-surface-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 space-y-3 animate-pulse">
            <div className="h-6 bg-surface-800 rounded w-1/4" />
            <div className="h-12 bg-surface-800/60 rounded" />
            <div className="h-12 bg-surface-800/60 rounded" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-400">Failed to load audit logs.</div>
        ) : data?.logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">No audit events match criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-surface-950 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Timestamp</th>
                  <th className="px-6 py-3.5 font-semibold">Action</th>
                  <th className="px-6 py-3.5 font-semibold">Initiator / User</th>
                  <th className="px-6 py-3.5 font-semibold">IP Address</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Context Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {data?.logs.map(log => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <Fragment key={log.id}>
                      <tr className="hover:bg-surface-800/40 transition-colors">
                        <td className="px-6 py-4 text-slate-400 text-[11px] whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.action.includes('SUSPEND') || log.action.includes('FAILED')
                                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                                : log.action.includes('ROLE') || log.action.includes('ADMIN')
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {log.user ? (
                            <div>
                              <div className="text-white font-sans font-semibold">{log.user.name}</div>
                              <div className="text-slate-500 text-[11px]">{log.user.email}</div>
                            </div>
                          ) : (
                            <span className="text-slate-500">System / Anonymous</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-slate-400 text-[11px]">
                          {log.ipAddress || '—'}
                        </td>

                        <td className="px-6 py-4 text-right">
                          {log.metadata ? (
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="px-2.5 py-1 rounded bg-surface-800 hover:bg-surface-700 text-amber-300 text-[10px] border border-slate-700 transition-colors"
                            >
                              {isExpanded ? 'Hide Payload' : 'View Payload'}
                            </button>
                          ) : (
                            <span className="text-slate-600 text-[11px]">None</span>
                          )}
                        </td>
                      </tr>

                      {isExpanded && log.metadata && (
                        <tr className="bg-surface-950/80">
                          <td colSpan={5} className="px-6 py-3">
                            <pre className="p-3 bg-surface-950 rounded-lg text-[11px] text-amber-200/90 font-mono overflow-x-auto border border-slate-800">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
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
