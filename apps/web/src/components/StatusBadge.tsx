import type { ScanStatus } from '../types/api';

interface StatusBadgeProps {
  status: ScanStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  switch (status) {
    case 'COMPLETED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Completed
        </span>
      );
    case 'RUNNING':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md font-medium border bg-blue-500/10 text-blue-400 border-blue-500/30 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
          Running…
        </span>
      );
    case 'QUEUED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md font-medium border bg-slate-500/10 text-slate-400 border-slate-500/30 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Queued
        </span>
      );
    case 'FAILED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md font-medium border bg-red-500/10 text-red-400 border-red-500/30 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          Failed
        </span>
      );
    case 'CANCELLED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md font-medium border bg-slate-600/10 text-slate-400 border-slate-600/30 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          Cancelled
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md font-medium border bg-slate-500/10 text-slate-400 border-slate-500/30 ${sizeClasses}`}
        >
          {status}
        </span>
      );
  }
}
