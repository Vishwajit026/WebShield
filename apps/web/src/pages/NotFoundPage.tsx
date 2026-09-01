import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function NotFoundPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center px-4 text-center">
      {/* Glow Effect */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-shield-500/10 border border-shield-500/30 flex items-center justify-center text-shield-400 mx-auto shadow-lg shadow-shield-500/5">
          <ShieldAlertIcon className="w-10 h-10" />
        </div>
        <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-surface-800 text-shield-400 border border-shield-500/30">
          404
        </span>
      </div>

      <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
        Target Not Found
      </h1>
      <p className="text-slate-400 mb-8 max-w-md text-sm sm:text-base leading-relaxed">
        The route you requested does not exist or may have been relocated. Verify the URL or return to safety.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        {isAuthenticated ? (
          <>
            <Link
              to="/dashboard"
              id="not-found-dashboard-btn"
              className="btn-primary flex items-center gap-2 text-sm px-5 py-2.5"
            >
              <DashboardIcon className="w-4 h-4" />
              Security Dashboard
            </Link>
            <Link
              to="/dashboard/scan"
              id="not-found-scan-btn"
              className="btn-secondary flex items-center gap-2 text-sm px-5 py-2.5"
            >
              <ScanIcon className="w-4 h-4" />
              Launch New Scan
            </Link>
          </>
        ) : (
          <>
            <Link
              to="/"
              id="not-found-home-btn"
              className="btn-primary flex items-center gap-2 text-sm px-5 py-2.5"
            >
              <HomeIcon className="w-4 h-4" />
              Return Home
            </Link>
            <Link
              to="/login"
              id="not-found-login-btn"
              className="btn-secondary flex items-center gap-2 text-sm px-5 py-2.5"
            >
              Sign In
            </Link>
          </>
        )}
      </div>

      <div className="mt-12 text-xs text-slate-600 font-mono">
        HTTP 404 &bull; WEBSHIELD ROUTER &bull; STATUS: UNMAPPED
      </div>
    </div>
  );
}

function ShieldAlertIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path
        d="M12 2L4 6v6c0 5.25 3.4 10.15 8 11.5C16.6 22.15 20 17.25 20 12V6L12 2z"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DashboardIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function ScanIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function HomeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
