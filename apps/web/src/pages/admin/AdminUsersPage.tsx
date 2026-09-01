import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { listAdminUsers, suspendUser, reactivateUser, updateUserRole } from '../../services/admin.service';
import { AdminUser, Role } from '../../types/api';

export const AdminUsersPage = () => {
  const { user: currentAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Action Modals State
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [actionType, setActionType] = useState<'SUSPEND' | 'REACTIVATE' | 'ROLE' | null>(null);
  const [targetRole, setTargetRole] = useState<Role>('USER');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', page, search, roleFilter, statusFilter],
    queryFn: () =>
      listAdminUsers({
        page,
        limit: 15,
        search: search.trim() || undefined,
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      }),
  });

  const suspendMutation = useMutation({
    mutationFn: (userId: string) => suspendUser(userId),
    onSuccess: () => {
      toast.success('User has been suspended and active sessions terminated');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      closeModal();
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed to suspend user');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (userId: string) => reactivateUser(userId),
    onSuccess: () => {
      toast.success('User account reactivated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      closeModal();
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed to reactivate user');
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) => updateUserRole(userId, role),
    onSuccess: () => {
      toast.success('User role updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      closeModal();
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update user role');
    },
  });

  const closeModal = () => {
    setSelectedUser(null);
    setActionType(null);
  };

  const handleConfirmAction = () => {
    if (!selectedUser) return;
    if (actionType === 'SUSPEND') {
      suspendMutation.mutate(selectedUser.id);
    } else if (actionType === 'REACTIVATE') {
      reactivateMutation.mutate(selectedUser.id);
    } else if (actionType === 'ROLE') {
      roleMutation.mutate({ userId: selectedUser.id, role: targetRole });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(dateStr));
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          User Management & Access Control
        </h1>
        <p className="text-slate-400 text-xs mt-1">
          Inspect registered accounts, enforce multi-tenant status, manage roles, and review session activities.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 border-slate-800 bg-surface-900/60 space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by email or name…"
              className="w-full pl-9 pr-4 py-2 bg-surface-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={roleFilter}
              onChange={e => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="bg-surface-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">All Roles</option>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>

            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-surface-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="SUSPENDED">Suspended Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 space-y-3 animate-pulse">
            <div className="h-6 bg-surface-800 rounded w-1/4" />
            <div className="h-12 bg-surface-800/60 rounded" />
            <div className="h-12 bg-surface-800/60 rounded" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-400">Failed to load user accounts.</div>
        ) : data?.users.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">No users matching search filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-surface-950 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th scope="col" className="px-6 py-3.5 font-semibold">User</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Role</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Status</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Scans / Reports</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Last Login</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {data?.users.map(u => {
                  const isSelf = u.id === currentAdmin?.id;
                  return (
                    <tr key={u.id} className="hover:bg-surface-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{u.name}</div>
                        <div className="text-slate-500 font-mono text-[11px] mt-0.5">{u.email}</div>
                      </td>

                      <td className="px-6 py-4">
                        {u.role === 'ADMIN' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            ADMIN
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            USER
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {u.isSuspended ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
                            SUSPENDED
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            ACTIVE
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-mono text-slate-200">{u.totalScans}</span> scans /{' '}
                        <span className="font-mono text-slate-400">{u.totalReports}</span> reports
                      </td>

                      <td className="px-6 py-4 text-slate-400 text-[11px]">
                        {formatDate(u.lastLoginAt)}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Role Change Trigger */}
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setTargetRole(u.role === 'ADMIN' ? 'USER' : 'ADMIN');
                              setActionType('ROLE');
                            }}
                            disabled={isSelf}
                            title={isSelf ? 'Cannot modify self role' : 'Change role'}
                            className="px-2.5 py-1 bg-surface-800 hover:bg-surface-700 disabled:opacity-40 text-slate-300 rounded-lg text-[11px] font-medium border border-slate-700 transition-colors"
                          >
                            {u.role === 'ADMIN' ? 'Demote' : 'Promote'}
                          </button>

                          {/* Suspend / Reactivate Trigger */}
                          {u.isSuspended ? (
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setActionType('REACTIVATE');
                              }}
                              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-medium transition-colors"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setActionType('SUSPEND');
                              }}
                              disabled={isSelf}
                              title={isSelf ? 'Cannot suspend your own account' : 'Suspend account'}
                              className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 text-red-300 border border-red-500/30 rounded-lg text-[11px] font-medium transition-colors"
                            >
                              Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 bg-surface-900 hover:bg-surface-800 disabled:opacity-50 text-slate-300 rounded text-xs transition-colors border border-slate-800"
          >
            Previous
          </button>
          <span className="text-xs text-slate-400">
            Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)
          </span>
          <button
            disabled={page >= data.pagination.totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 bg-surface-900 hover:bg-surface-800 disabled:opacity-50 text-slate-300 rounded text-xs transition-colors border border-slate-800"
          >
            Next
          </button>
        </div>
      )}

      {/* ── Action Confirmation Modal ─────────────────────────────── */}
      {selectedUser && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="max-w-md w-full p-6 rounded-2xl bg-surface-900 border border-slate-700 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">
              {actionType === 'SUSPEND' && 'Confirm Account Suspension'}
              {actionType === 'REACTIVATE' && 'Confirm Account Reactivation'}
              {actionType === 'ROLE' && 'Confirm Role Modification'}
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              {actionType === 'SUSPEND' && (
                <>
                  Are you sure you want to suspend account <strong className="text-white font-mono">{selectedUser.email}</strong>? All active user sessions will be immediately terminated and login attempts blocked.
                </>
              )}
              {actionType === 'REACTIVATE' && (
                <>
                  Are you sure you want to reactivate account <strong className="text-white font-mono">{selectedUser.email}</strong>? The user will be permitted to authenticate and initiate security scans again.
                </>
              )}
              {actionType === 'ROLE' && (
                <>
                  Are you sure you want to change the role for <strong className="text-white font-mono">{selectedUser.email}</strong> from <code className="text-amber-300 font-bold">{selectedUser.role}</code> to <code className="text-emerald-300 font-bold">{targetRole}</code>?
                </>
              )}
            </p>

            <div className="p-3 rounded-xl bg-surface-950 border border-slate-800 text-[11px] text-slate-400">
              <strong className="text-slate-300">Audit Notice: </strong>
              This administrative action will be immutably recorded in the security audit trail.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 bg-surface-800 hover:bg-surface-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={
                  suspendMutation.isPending || reactivateMutation.isPending || roleMutation.isPending
                }
                className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors ${
                  actionType === 'SUSPEND'
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-amber-600 hover:bg-amber-500'
                }`}
              >
                {suspendMutation.isPending || reactivateMutation.isPending || roleMutation.isPending
                  ? 'Processing...'
                  : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
