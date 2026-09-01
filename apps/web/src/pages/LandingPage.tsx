import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const capabilities = [
  {
    icon: (
      <svg className="w-6 h-6 text-shield-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    title: 'Multi-Vector Header & TLS Analysis',
    description:
      'Passive assessment of HSTS, CSP, X-Frame-Options, Cookie security flags, CORS origins, Information Disclosure, and TLS protocol cipher suites.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-shield-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    title: 'Multi-Layer SSRF Defense & IP Pinning',
    description:
      'Zero-trust scanner pipeline with synchronous DNS resolution, private IP blocklists, RFC1918 filtering, and socket IP pinning against DNS rebinding.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-shield-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: 'Executive PDF Security Reporting',
    description:
      'Stream-based multi-page A4 PDF export featuring executive summaries, score breakdowns, prioritized findings, remediation guides, and legal disclaimers.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-shield-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Zero Trust RBAC & Self-Protection',
    description:
      'Strict backend role enforcement (USER vs ADMIN), immutable audit trail, last-admin safeguards, and instant session invalidation upon suspension.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-shield-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Scan Comparison & Posture Tracking',
    description:
      'Compare consecutive scans on target assets to track new, recurring, and resolved findings with score delta indicators and trend metrics.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-shield-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 14 14" />
      </svg>
    ),
    title: 'Multi-Tier Rate Limiting & Auditing',
    description:
      'Granular per-endpoint rate limits for auth, scanner execution, PDF generation, and administrative actions with comprehensive audit logging.',
  },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex flex-col">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-20 sm:py-28 px-4">
        {/* Background glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="w-[600px] h-[600px] rounded-full bg-shield-600/10 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-shield-500/10 text-shield-400 border border-shield-500/30 mb-8">
            <span className="w-2 h-2 rounded-full bg-shield-400 animate-pulse" />
            Enterprise-Grade Security Assessment Platform
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-tight mb-6">
            Web<span className="text-shield-400">Shield</span>
          </h1>

          <p className="text-xl sm:text-2xl text-slate-300 font-light mb-4 tracking-tight">
            Passive Web Security Scanner &amp; Vulnerability Assessment Engine
          </p>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Assess HTTP headers, SSL/TLS configurations, cookie policies, CORS settings, information disclosures, and generate executive PDF security reports.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                id="hero-dashboard-btn"
                className="btn-primary text-base px-8 py-3 w-full sm:w-auto text-center"
              >
                Go to Security Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  id="hero-register-btn"
                  className="btn-primary text-base px-8 py-3 w-full sm:w-auto text-center"
                >
                  Get Started Free
                </Link>
                <Link
                  to="/login"
                  id="hero-login-btn"
                  className="btn-secondary text-base px-8 py-3 w-full sm:w-auto text-center"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Capabilities Grid ────────────────────────────────────── */}
      <section className="py-16 px-4 border-t border-slate-800/80">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Core Security Capabilities
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Non-destructive, passive security assessment with zero exploitation risks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map(cap => (
              <div
                key={cap.title}
                className="card p-6 border-slate-800/80 hover:border-slate-700 bg-surface-800/60 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-shield-500/10 border border-shield-500/20 flex items-center justify-center mb-4 group-hover:border-shield-500/40 transition-colors">
                  {cap.icon}
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{cap.title}</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                  {cap.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Responsible Use Notice ───────────────────────────────── */}
      <section className="py-12 px-4 border-t border-slate-800/80">
        <div className="max-w-4xl mx-auto">
          <div className="card p-6 border-shield-500/30 bg-shield-950/20">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-shield-500/10 border border-shield-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-shield-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm mb-1">
                  Responsible-Use &amp; Authorization Notice
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  WebShield performs safe, passive security assessments. Only scan domains and web properties you own or have explicit authorization to assess. WebShield does not perform intrusive exploitation and does not replace comprehensive manual penetration testing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
