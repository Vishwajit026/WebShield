import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(dateStr));
}

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <nav className="text-sm text-slate-500 mb-4">
            <Link to="/dashboard" className="hover:text-slate-300 transition-colors">Dashboard</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-300">Profile</span>
          </nav>
          <h1 className="text-2xl font-bold text-white">Your Profile</h1>
          <p className="text-slate-400 mt-1 text-sm">Account information and details</p>
        </div>

        {/* Profile card */}
        <div className="card p-6 mb-4">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-700/60">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-shield-600 to-shield-800 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{user.name}</h2>
              <p className="text-slate-400 text-sm">{user.email}</p>
            </div>
            {user.role === 'ADMIN' && (
              <div className="ml-auto">
                <span className="badge badge-blue text-xs">Administrator</span>
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="space-y-4">
            <ProfileField label="Full name" value={user.name} />
            <ProfileField label="Email address" value={user.email} />
            <ProfileField
              label="Account role"
              value={user.role === 'ADMIN' ? 'Administrator' : 'Standard User'}
              note={user.role === 'ADMIN' ? 'Administrative access enabled' : undefined}
            />
            <ProfileField label="Account created" value={formatDate(user.createdAt)} />
            <ProfileField label="Last login" value={formatDate(user.lastLoginAt)} />
          </div>
        </div>

        {/* Security section */}
        <div className="card p-6">
          <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
            <LockIcon className="w-4 h-4 text-shield-400" />
            Security
          </h3>
          <div className="space-y-3">
            <Link
              to="/sessions"
              className="flex items-center justify-between p-3 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <DevicesIcon className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">Active sessions</span>
              </div>
              <ChevronIcon className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Role changes require administrator action and cannot be performed here.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProfileField({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-700/40 last:border-0">
      <span className="text-sm text-slate-500 flex-shrink-0 w-36">{label}</span>
      <div className="text-right">
        <span className="text-sm text-white">{value}</span>
        {note && <p className="text-xs text-slate-500 mt-0.5">{note}</p>}
      </div>
    </div>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function DevicesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
