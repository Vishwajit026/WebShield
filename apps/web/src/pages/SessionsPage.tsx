import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSessions, revokeSession, revokeOtherSessions } from '../services/auth.service';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import type { Session } from '../types/api';

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateStr));
}

function parseUserAgent(ua: string | null): { browser: string; os: string } {
  if (!ua) return { browser: 'Unknown browser', os: 'Unknown device' };

  // Simple regex-based UA parsing (avoids library dependency in frontend)
  let browser = 'Unknown browser';
  let os = 'Unknown device';

  if (/Edg\//.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Google Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/MSIE|Trident/.test(ua)) browser = 'Internet Explorer';

  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';

  return { browser, os };
}

export default function SessionsPage() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isRevokingOthers, setIsRevokingOthers] = useState(false);

  const { data: sessions = [], isLoading, error } = useQuery({
    queryKey: ['sessions'],
    queryFn: getSessions,
    staleTime: 30_000,
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session revoked.');
    },
    onError: () => {
      toast.error('Failed to revoke session.');
    },
  });

  async function handleRevoke(sessionId: string) {
    setRevokingId(sessionId);
    try {
      await revokeMutation.mutateAsync(sessionId);
    } finally {
      setRevokingId(null);
    }
  }

  async function handleRevokeOthers() {
    setIsRevokingOthers(true);
    try {
      await revokeOtherSessions();
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('All other sessions revoked.');
    } catch {
      toast.error('Failed to revoke other sessions.');
    } finally {
      setIsRevokingOthers(false);
    }
  }

  const otherSessions = sessions.filter(s => !s.isCurrent);

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <nav className="text-sm text-slate-500 mb-4">
            <Link to="/dashboard" className="hover:text-slate-300 transition-colors">Dashboard</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-300">Sessions</span>
          </nav>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-white">Active Sessions</h1>
              <p className="text-slate-400 mt-1 text-sm">
                Devices currently signed in to your account
              </p>
            </div>
            {otherSessions.length > 0 && (
              <button
                onClick={handleRevokeOthers}
                disabled={isRevokingOthers}
                className="btn-secondary text-sm py-2 px-4 text-red-400 border-red-700/50 hover:border-red-500 disabled:opacity-50"
              >
                {isRevokingOthers ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    Revoking…
                  </span>
                ) : (
                  'Sign out other devices'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-shield-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="card p-6 text-center text-red-400 text-sm">
            Failed to load sessions. Please try again.
          </div>
        ) : sessions.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-slate-400 text-sm">No active sessions found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session: Session) => {
              const { browser, os } = parseUserAgent(session.userAgent);
              return (
                <SessionCard
                  key={session.id}
                  session={session}
                  browser={browser}
                  os={os}
                  onRevoke={() => handleRevoke(session.id)}
                  onLogout={logout}
                  isRevoking={revokingId === session.id}
                />
              );
            })}
          </div>
        )}

        <p className="mt-6 text-xs text-slate-600 text-center">
          Sessions expire after 7 days. Token details are never displayed.
        </p>
      </div>
    </div>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  browser,
  os,
  onRevoke,
  onLogout,
  isRevoking,
}: {
  session: Session;
  browser: string;
  os: string;
  onRevoke: () => void;
  onLogout: () => Promise<void>;
  isRevoking: boolean;
}) {
  return (
    <div className={`card p-5 ${session.isCurrent ? 'border-shield-700/60' : ''}`}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-surface-700 flex items-center justify-center flex-shrink-0 mt-0.5">
          <DeviceIcon className="w-5 h-5 text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-white">{browser}</p>
            {session.isCurrent && (
              <span className="badge bg-shield-900/60 text-shield-300 border border-shield-700/60 text-xs">
                Current session
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{os}</p>
          <p className="text-xs text-slate-500 mt-1.5">
            Started {formatDate(session.createdAt)}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            Expires {formatDate(session.expiresAt)}
          </p>
        </div>
        <div className="flex-shrink-0">
          {session.isCurrent ? (
            <button
              onClick={onLogout}
              className="text-xs text-red-400 hover:text-red-300 transition-colors py-1 px-2 rounded border border-red-700/40 hover:border-red-500/60"
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={onRevoke}
              disabled={isRevoking}
              className="text-xs text-slate-400 hover:text-red-400 transition-colors py-1 px-2 rounded border border-slate-700/60 hover:border-red-700/60 disabled:opacity-50"
            >
              {isRevoking ? (
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  Revoking
                </span>
              ) : (
                'Revoke'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DeviceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" strokeLinecap="round" />
    </svg>
  );
}
