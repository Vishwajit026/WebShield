import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const { isAuthenticated, user, logout, isLoading } = useAuth();
  const location = useLocation();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
    await logout();
  };

  const navItems = [
    { label: 'Dashboard', to: '/dashboard', icon: <DashboardIcon /> },
    { label: 'New Scan', to: '/dashboard/scan', icon: <ScanIcon /> },
    { label: 'Scan History', to: '/dashboard/scans', icon: <HistoryIcon /> },
    { label: 'Compare Scans', to: '/dashboard/scans/compare', icon: <CompareIcon /> },
    { label: 'Target Assets', to: '/dashboard/targets', icon: <TargetsIcon /> },
    { label: 'Security Reports', to: '/dashboard/reports', icon: <ReportIcon /> },
    { label: 'Active Sessions', to: '/sessions', icon: <SessionsIcon /> },
    { label: 'User Profile', to: '/profile', icon: <ProfileIcon /> },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-surface-900 text-slate-100 antialiased">
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-surface-900/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand + Hamburger */}
            <div className="flex items-center gap-4">
              {isAuthenticated && (
                <button
                  type="button"
                  id="mobile-sidebar-toggle"
                  onClick={() => setMobileMenuOpen(prev => !prev)}
                  className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-800 transition-colors focus:outline-none focus:ring-2 focus:ring-shield-500"
                  aria-label="Toggle navigation menu"
                >
                  <MenuIcon className="w-5 h-5" />
                </button>
              )}

              <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-lg bg-shield-500/10 border border-shield-500/30 flex items-center justify-center text-shield-400 group-hover:text-shield-300 group-hover:border-shield-400/50 transition-all">
                  <ShieldIcon className="w-5 h-5" />
                </div>
                <span className="text-lg font-bold text-white tracking-tight">
                  Web<span className="text-shield-400">Shield</span>
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-800 text-slate-400 border border-slate-700">
                  SECURITY
                </span>
              </Link>
            </div>

            {/* Right: Authenticated User Controls */}
            {!isLoading && (
              <div className="flex items-center gap-3">
                {isAuthenticated ? (
                  <div className="flex items-center gap-3">
                    {user?.role === 'ADMIN' && (
                      <Link
                        to="/admin"
                        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        Admin Console
                      </Link>
                    )}

                    <div className="relative">
                      <button
                        id="user-menu-button"
                        type="button"
                        onClick={() => setUserDropdownOpen(prev => !prev)}
                        className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-700/80 bg-surface-800 hover:bg-surface-700 hover:border-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-shield-500"
                        aria-expanded={userDropdownOpen}
                      >
                        <div className="w-7 h-7 rounded-lg bg-shield-500/20 border border-shield-500/40 flex items-center justify-center text-xs font-bold text-shield-300">
                          {user?.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="hidden sm:block text-left">
                          <p className="text-xs font-semibold text-white leading-none">{user?.name}</p>
                          <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{user?.role}</p>
                        </div>
                        <ChevronDownIcon className="w-4 h-4 text-slate-400 hidden sm:block" />
                      </button>

                      {/* User dropdown menu */}
                      {userDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-surface-800 border border-slate-700 shadow-2xl py-1 z-50 animate-fade-in divide-y divide-slate-700/60">
                          <div className="px-4 py-2.5">
                            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                            <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                          </div>
                          <div className="py-1">
                            {user?.role === 'ADMIN' && (
                              <Link
                                to="/admin"
                                onClick={() => setUserDropdownOpen(false)}
                                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/10 transition-colors"
                              >
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                Admin Console
                              </Link>
                            )}
                            <Link
                              to="/profile"
                              onClick={() => setUserDropdownOpen(false)}
                              className="flex items-center gap-2 px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-surface-700 transition-colors"
                            >
                              <ProfileIcon className="w-4 h-4 text-slate-400" />
                              User Profile
                            </Link>
                            <Link
                              to="/sessions"
                              onClick={() => setUserDropdownOpen(false)}
                              className="flex items-center gap-2 px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-surface-700 transition-colors"
                            >
                              <SessionsIcon className="w-4 h-4 text-slate-400" />
                              Active Sessions
                            </Link>
                          </div>
                        <div className="py-1">
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left"
                          >
                            <LogoutIcon className="w-4 h-4" />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link to="/login" className="btn-secondary text-xs py-2 px-4">
                      Sign in
                    </Link>
                    <Link to="/register" className="btn-primary text-xs py-2 px-4">
                      Get Started
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Layout Body ──────────────────────────────────────── */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Authenticated Sidebar (Desktop) */}
        {isAuthenticated && (
          <aside className="hidden lg:flex flex-col w-64 border-r border-slate-800/80 p-4 shrink-0 bg-surface-900">
            <div className="space-y-1">
              <p className="px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Navigation
              </p>
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/dashboard'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-shield-500/10 text-shield-300 border border-shield-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-surface-800 border border-transparent'
                    }`
                  }
                >
                  <span className="w-5 h-5 flex items-center justify-center shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>

            {/* Assessment Environment Status */}
            <div className="mt-auto p-3.5 rounded-xl bg-surface-800/50 border border-slate-800 text-xs">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-slate-300 font-semibold">Engine Ready</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Non-destructive scanner with active SSRF protection.
              </p>
            </div>
          </aside>
        )}

        {/* Authenticated Sidebar (Mobile Drawer) */}
        {isAuthenticated && mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Slide-over panel */}
            <div className="relative w-64 max-w-[80vw] bg-surface-900 border-r border-slate-800 h-full p-4 flex flex-col z-10 animate-fade-in">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldIcon className="w-5 h-5 text-shield-400" />
                  <span className="font-bold text-white">WebShield</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                  aria-label="Close menu"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1">
                {navItems.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/dashboard'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-shield-500/10 text-shield-300 border border-shield-500/30'
                          : 'text-slate-400 hover:text-white hover:bg-surface-800'
                      }`
                    }
                  >
                    <span className="w-5 h-5 shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>

              <div className="mt-auto pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogoutIcon className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/80 bg-surface-900 text-slate-500 py-6 text-xs mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldIcon className="w-4 h-4 text-shield-500" />
            <span>WebShield Security Assessment Platform</span>
          </div>
          <p className="text-slate-600 text-center sm:text-right">
            Non-destructive checks. Does not replace full penetration testing.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ── Inline SVGs ──────────────────────────────────────────────────────────────

function ShieldIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path
        d="M12 2L4 6v6c0 5.25 3.4 10.15 8 11.5C16.6 22.15 20 17.25 20 12V6L12 2z"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <path d="M9 12l2.5 2.5L15.5 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 6 12 12 16 14" strokeLinecap="round" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function TargetsIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function SessionsIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function ProfileIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function XIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function ChevronDownIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
