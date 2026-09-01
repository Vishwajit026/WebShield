import { useQuery } from '@tanstack/react-query';
import { getSystemHealth } from '../../services/admin.service';

export const AdminHealthPage = () => {
  const { data: health, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-system-health'],
    queryFn: getSystemHealth,
    refetchInterval: 10000,
  });

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m ${s}s`;
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Subsystem Health & Monitoring
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Real-time component health checks, database latency, process memory, and scanner availability.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-3.5 py-1.5 bg-surface-900 hover:bg-surface-800 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white rounded-xl transition-colors inline-flex items-center gap-2"
        >
          <svg className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Status
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-44 bg-surface-900 rounded-2xl" />
          ))}
        </div>
      ) : !health ? (
        <div className="p-8 bg-surface-900 border border-red-500/30 rounded-2xl text-center text-xs text-red-400">
          Failed to retrieve subsystem health telemetry.
        </div>
      ) : (
        <>
          {/* Global Banner */}
          <div
            className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              health.status === 'healthy'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-3.5 h-3.5 rounded-full ${
                  health.status === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <div>
                <p className="font-bold text-sm text-white capitalize">
                  Overall System Status: {health.status}
                </p>
                <p className="text-xs opacity-80">
                  All critical assessment subsystems responding normally (Response: {health.responseTimeMs}ms)
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Checked: {new Date(health.checkedAt).toLocaleTimeString()}
            </span>
          </div>

          {/* Component Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Database Component */}
            <div className="card p-6 border-slate-800 bg-surface-900/60 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7c0-2-1.5-3-3.5-3h-9C5.5 4 4 5 4 7z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3" />
                      </svg>
                    </span>
                    <h3 className="font-bold text-white text-sm">PostgreSQL Database</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {health.components.database.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mt-2">
                  Relational persistence layer for tenant accounts, scans, finding entities, and audit records.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Query Ping Latency:</span>
                <span className="text-emerald-400 font-bold">{health.components.database.latencyMs} ms</span>
              </div>
            </div>

            {/* Scanner Engine Component */}
            <div className="card p-6 border-slate-800 bg-surface-900/60 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </span>
                    <h3 className="font-bold text-white text-sm">Security Scanner Engine</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {health.components.scanner.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mt-2">
                  Passive assessment orchestrator running HTTP, Cookie, TLS, and CORS inspection modules.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Security Guard:</span>
                <span className="text-emerald-400 font-bold">{health.components.scanner.protection}</span>
              </div>
            </div>

            {/* Application Process Component */}
            <div className="card p-6 border-slate-800 bg-surface-900/60 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                    </span>
                    <h3 className="font-bold text-white text-sm">Node.js API Runtime</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {health.components.application.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mt-2">
                  Express API service with in-memory token verification and centralized rate limiting.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Uptime:</span>
                <span className="text-white font-bold">{formatUptime(health.components.application.uptimeSeconds)}</span>
              </div>
            </div>

            {/* Storage Component */}
            <div className="card p-6 border-slate-800 bg-surface-900/60 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                      </svg>
                    </span>
                    <h3 className="font-bold text-white text-sm">PDF Storage Subsystem</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {health.components.storage.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mt-2">
                  Canonical report storage path with automated path-traversal boundary protections.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Memory Allocated:</span>
                <span className="text-white font-bold">{health.components.application.memoryUsageMb} MB</span>
              </div>
            </div>
          </div>

          {/* Privacy & Safe Telemetry Notice */}
          <div className="p-4 rounded-2xl bg-surface-900 border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="leading-relaxed">
              <strong className="text-slate-300">Sanitized Telemetry Notice: </strong>
              Administrative health endpoints enforce strict data minimization. Database credentials, connection strings, JWT secrets, filesystem absolute paths, and internal network IP addresses are never exposed.
            </p>
          </div>
        </>
      )}
    </div>
  );
};
