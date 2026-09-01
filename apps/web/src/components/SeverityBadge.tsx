import type { Severity } from '../types/api';

interface SeverityBadgeProps {
  severity: Severity;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

function getSeverityColor(severity: Severity) {
  switch (severity) {
    case 'CRITICAL':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/30',
        dot: 'bg-red-500',
      };
    case 'HIGH':
      return {
        bg: 'bg-orange-500/10',
        text: 'text-orange-400',
        border: 'border-orange-500/30',
        dot: 'bg-orange-500',
      };
    case 'MEDIUM':
      return {
        bg: 'bg-yellow-500/10',
        text: 'text-yellow-400',
        border: 'border-yellow-500/30',
        dot: 'bg-yellow-500',
      };
    case 'LOW':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        dot: 'bg-blue-400',
      };
    case 'INFO':
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
        dot: 'bg-slate-400',
      };
  }
}

export default function SeverityBadge({
  severity,
  size = 'md',
  showDot = true,
}: SeverityBadgeProps) {
  const styles = getSeverityColor(severity);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm font-semibold',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-medium border ${styles.bg} ${styles.text} ${styles.border} ${sizeClasses}`}
      role="status"
      aria-label={`Severity: ${severity}`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${styles.dot} flex-shrink-0`}
          aria-hidden="true"
        />
      )}
      <span>{severity}</span>
    </span>
  );
}
