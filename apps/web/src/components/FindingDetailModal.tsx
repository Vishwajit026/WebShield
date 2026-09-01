import { useEffect, useState } from 'react';
import type { Finding } from '../types/api';
import SeverityBadge from './SeverityBadge';
import toast from 'react-hot-toast';

interface FindingDetailModalProps {
  finding: Finding | null;
  onClose: () => void;
}

export default function FindingDetailModal({ finding, onClose }: FindingDetailModalProps) {
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!finding) return null;

  const handleCopyEvidence = async () => {
    if (!finding.evidence) return;
    try {
      await navigator.clipboard.writeText(finding.evidence);
      setCopied(true);
      toast.success('Evidence copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy evidence');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="finding-detail-title"
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-surface-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-800 bg-surface-800/40">
          <div className="pr-6">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <SeverityBadge severity={finding.severity} size="md" />
              <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-surface-700 text-slate-300 border border-slate-700">
                {finding.category}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-mono text-slate-400 bg-surface-800 border border-slate-800">
                Confidence: {finding.confidence}
              </span>
            </div>
            <h2
              id="finding-detail-title"
              className="text-lg font-bold text-white tracking-tight leading-snug"
            >
              {finding.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-700 transition-colors flex-shrink-0"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-300">
          {/* Affected Component */}
          {finding.affectedComponent && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Affected Component
              </p>
              <div className="inline-block px-3 py-1 rounded bg-surface-800 border border-slate-700/80 font-mono text-xs text-shield-300">
                {finding.affectedComponent}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Description
            </p>
            <p className="text-slate-200 leading-relaxed bg-surface-800/30 p-3.5 rounded-xl border border-slate-800">
              {finding.description}
            </p>
          </div>

          {/* Evidence */}
          {finding.evidence && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Observed Evidence
                </p>
                <button
                  type="button"
                  onClick={handleCopyEvidence}
                  className="text-xs text-shield-400 hover:text-shield-300 transition-colors flex items-center gap-1 font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  {copied ? 'Copied' : 'Copy Evidence'}
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed select-text">
                {finding.evidence}
              </pre>
            </div>
          )}

          {/* Impact */}
          {finding.impact && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Security Impact
              </p>
              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-200/90 leading-relaxed text-xs">
                {finding.impact}
              </div>
            </div>
          )}

          {/* Remediation */}
          {finding.remediation && (
            <div>
              <p className="text-xs font-semibold text-shield-400 uppercase tracking-wider mb-1.5">
                Recommended Remediation
              </p>
              <div className="p-4 rounded-xl bg-shield-500/10 border border-shield-500/30 text-white leading-relaxed text-xs">
                <div className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-shield-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{finding.remediation}</span>
                </div>
              </div>
            </div>
          )}

          {/* Reference */}
          {finding.reference && (
            <div className="pt-2 border-t border-slate-800">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Reference & Guidelines
              </p>
              <a
                href={finding.reference}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-shield-400 hover:text-shield-300 transition-colors font-medium break-all hover:underline"
              >
                <span>{finding.reference}</span>
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-surface-800/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs py-2 px-4"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
