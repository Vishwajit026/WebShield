import { Navigate, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Wraps routes that require authentication.
 * Unauthenticated users are redirected to /login with the intended
 * destination preserved in location state.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-shield-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

/**
 * Wraps routes that require ADMIN role privileges.
 * Strictly checks role === 'ADMIN'.
 * If unauthorized, renders an explicit 403 Forbidden Access Denied state.
 */
export function AdminRoute() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Verifying administrative access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-900 p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-surface-800 border border-red-500/30 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <span className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">
            403 Forbidden
          </span>
          <h2 className="text-xl font-bold text-white mt-3 mb-2">Access Denied</h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            The requested area requires elevated <strong className="text-slate-200">ADMIN</strong> privileges. Your current account (<code className="text-shield-400 font-mono">{user?.email}</code>) has role <code className="text-slate-300 font-mono">{user?.role}</code>.
          </p>
          <Link
            to="/dashboard"
            className="btn-secondary text-xs py-2.5 px-6 inline-flex items-center gap-2 w-full justify-center"
          >
            Return to User Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

/**
 * Wraps routes that should redirect authenticated users away
 * (e.g., login/register pages).
 */
export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-900">
        <div className="w-8 h-8 border-2 border-shield-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
