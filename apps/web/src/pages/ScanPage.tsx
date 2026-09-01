import { useState, type FormEvent, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createScan } from '../services/scan.service';

export default function ScanPage() {
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const navigate = useNavigate();

  const scanMutation = useMutation({
    mutationFn: (targetUrl: string) => createScan({ url: targetUrl }),
    onSuccess: scan => {
      toast.success('Security assessment initiated');
      navigate(`/dashboard/scans/${scan.id}`);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      const message =
        axiosErr.response?.data?.error?.message ??
        'Failed to initiate scan. Please verify target address.';
      toast.error(message);
    },
  });

  const validateInput = (inputUrl: string): string | null => {
    const trimmed = inputUrl.trim();
    if (!trimmed) {
      return 'Please enter a target URL.';
    }

    let parsed: URL;
    try {
      // If user typed without scheme, try prefixing https:// for parsing test
      const testUrl = trimmed.match(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//) ? trimmed : `https://${trimmed}`;
      parsed = new URL(testUrl);
    } catch {
      return 'Please enter a valid URL format (e.g. https://example.com).';
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'Only HTTP and HTTPS protocols are supported.';
    }

    return null;
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    if (validationError) setValidationError(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const error = validateInput(url);
    if (error) {
      setValidationError(error);
      return;
    }

    let targetToScan = url.trim();
    if (!targetToScan.match(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//)) {
      targetToScan = `https://${targetToScan}`;
    }

    scanMutation.mutate(targetToScan);
  };

  return (
    <div className="max-w-3xl mx-auto py-4 sm:py-8 space-y-8 animate-fade-in">
      {/* ── Page Title ─────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Start Security Scan
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
          Perform an automated, non-destructive security evaluation against HTTP headers, TLS/SSL
          certificates, and cookies.
        </p>
      </div>

      {/* ── Responsible Use Notice ──────────────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/5 border border-amber-500/30 text-amber-200/90 text-xs sm:text-sm flex items-start gap-3.5">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-amber-300">Authorized Testing Policy</p>
          <p className="mt-1 text-xs text-amber-200/80 leading-relaxed">
            Only scan websites and systems that you own or have explicit authorization to assess.
            All scan actions are recorded in an immutable audit log. Private network addresses and
            loopback targets are prohibited by server-side SSRF validation.
          </p>
        </div>
      </div>

      {/* ── Scan Form Card ──────────────────────────────────────── */}
      <div className="card p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="target-url" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Target Web Address
            </label>
            <div className="relative">
              <input
                id="target-url"
                type="text"
                value={url}
                onChange={handleInputChange}
                disabled={scanMutation.isPending}
                placeholder="https://example.com"
                className={`w-full px-4 py-3 bg-surface-700/80 border rounded-xl text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-shield-500 transition-all ${
                  validationError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-600 hover:border-slate-500'
                } disabled:opacity-50`}
              />
            </div>
            {validationError ? (
              <p className="text-xs text-red-400 mt-2 font-medium flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {validationError}
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 mt-2">
                Supported protocols: <span className="font-mono text-slate-400">https://</span>, <span className="font-mono text-slate-400">http://</span>. Internal and RFC 1918 IPs are rejected.
              </p>
            )}
          </div>

          {/* Assessment scope checklist */}
          <div className="p-4 rounded-xl bg-surface-800/60 border border-slate-800 space-y-2">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Security Checks Included in this Assessment
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-shield-400" />
                <span>HTTP Security Headers (CSP, HSTS, XFO)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-shield-400" />
                <span>TLS/SSL Protocol & Certificate Validity</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-shield-400" />
                <span>Cookie Attributes (Secure, HttpOnly, SameSite)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-shield-400" />
                <span>CORS & Information Disclosure Headers</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              id="start-scan-submit-btn"
              disabled={scanMutation.isPending}
              className="btn-primary w-full sm:w-auto px-8 py-3 text-sm font-semibold flex items-center justify-center gap-2"
            >
              {scanMutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Initiating Scan…</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Start Security Assessment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
