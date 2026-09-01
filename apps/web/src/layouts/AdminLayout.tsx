import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Admin Overview', to: '/admin', icon: <OverviewIcon /> },
    { label: 'User Management', to: '/admin/users', icon: <UsersIcon /> },
    { label: 'System Scans', to: '/admin/scans', icon: <ScansIcon /> },
    { label: 'Findings Explorer', to: '/admin/findings', icon: <FindingsIcon /> },
    { label: 'Reports Catalog', to: '/admin/reports', icon: <ReportsIcon /> },
    { label: 'Audit Trail', to: '/admin/audit-logs', icon: <AuditIcon /> },
    { label: 'System Health', to: '/admin/health', icon: <HealthIcon /> },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-surface-950 text-slate-100 antialiased font-sans">
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-amber-500/20 bg-surface-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand + Admin Pill */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(prev => !prev)}
                className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-800 transition-colors"
                aria-label="Toggle navigation menu"
              >
                <MenuIcon className="w-5 h-5" />
              </button>

              <Link to="/admin" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:text-amber-300 transition-all">
                  <AdminShieldIcon className="w-5 h-5" />
                </div>
                <span className="text-lg font-bold text-white tracking-tight">
                  Web<span className="text-amber-400">Shield</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ADMIN CONSOLE
                </span>
              </Link>
            </div>

            {/* Right: Switch to User App & Profile */}
            <div className="flex items-center gap-3">
              <Link
                to="/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-surface-800 text-xs font-medium text-slate-300 hover:text-white hover:bg-surface-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-shield-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                User Workspace
              </Link>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-surface-900 text-xs">
                <div className="w-6 h-6 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold text-[11px]">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <span className="font-semibold text-white truncate max-w-[120px] block">{user?.email}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => logout()}
                className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Sign Out"
              >
                <LogoutIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Layout Body ──────────────────────────────────────── */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-slate-800/80 p-4 shrink-0 bg-surface-950">
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-bold text-amber-400/80 uppercase tracking-wider mb-2">
              System Administration
            </p>
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-surface-900 border border-transparent'
                  }`
                }
              >
                <span className="w-5 h-5 flex items-center justify-center shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>

          <div className="mt-auto p-3.5 rounded-xl bg-surface-900 border border-amber-500/20 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-300 font-semibold">RBAC Active</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              All admin mutations and access logs are recorded immutably.
            </p>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-64 max-w-[80vw] bg-surface-950 border-r border-slate-800 h-full p-4 flex flex-col z-10 animate-fade-in">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <AdminShieldIcon className="w-5 h-5 text-amber-400" />
                  <span className="font-bold text-white">Admin Console</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1">
                {navItems.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/admin'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                          : 'text-slate-400 hover:text-white hover:bg-surface-900'
                      }`
                    }
                  >
                    <span className="w-5 h-5 shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>

              <div className="mt-auto pt-4 border-t border-slate-800 space-y-2">
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 bg-surface-900 border border-slate-800 rounded-lg"
                >
                  Return to User App
                </Link>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogoutIcon className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Admin Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/80 bg-surface-950 text-slate-500 py-4 text-xs mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AdminShieldIcon className="w-4 h-4 text-amber-500" />
            <span className="font-medium text-slate-400">WebShield Enterprise Administration</span>
          </div>
          <span className="text-slate-600">Zero Trust Role-Based Access Control</span>
        </div>
      </footer>
    </div>
  );
}

// ── Inline SVGs ──────────────────────────────────────────────────────────────

function AdminShieldIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path
        d="M12 2L4 6v6c0 5.25 3.4 10.15 8 11.5C16.6 22.15 20 17.25 20 12V6L12 2z"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OverviewIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function ScansIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function FindingsIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function AuditIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function HealthIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
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
