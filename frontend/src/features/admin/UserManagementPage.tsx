import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { ApiResponse, AdminUserListItem, PaginatedData } from '@/types/api';
import { useAuth } from '@/features/auth/AuthContext';
import { formatDate } from '@/lib/format';
import {
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  X,
} from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Status Action Modal State
  const [targetUser, setTargetUser] = useState<AdminUserListItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users list
  const { data, isLoading, isError } = useQuery({
    queryKey: ['adminUsers', { search: debouncedSearch, user_type: userTypeFilter, is_active: statusFilter, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (userTypeFilter) params.append('user_type', userTypeFilter);
      if (statusFilter !== '') params.append('is_active', statusFilter);
      params.append('page', page.toString());

      const res = await apiClient.get<ApiResponse<PaginatedData<AdminUserListItem>>>(
        `/admin/users/?${params.toString()}`
      );
      return res.data.data;
    },
  });

  // Calculate active admins count from results or metadata
  const activeAdminsCount = data?.results.filter(
    (u) => u.user_type === 'ADMIN' && u.is_active
  ).length || 0;

  // Mutation to activate / deactivate user
  const statusMutation = useMutation({
    mutationFn: async ({ uuid, newStatus }: { uuid: string; newStatus: boolean }) => {
      const res = await apiClient.patch<ApiResponse<AdminUserListItem>>(
        `/admin/users/${uuid}/status/`,
        { is_active: newStatus }
      );
      return res.data.data;
    },
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setSuccessToast(
        `User ${updatedUser.full_name || updatedUser.email} has been successfully ${
          updatedUser.is_active ? 'activated' : 'deactivated'
        }.`
      );
      setTargetUser(null);
      setActionError(null);
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      const message =
        err.response?.data?.data?.detail ||
        err.response?.data?.message ||
        'Failed to update user status.';
      setActionError(message);
    },
  });

  const handleOpenDialog = (u: AdminUserListItem) => {
    setActionError(null);
    setTargetUser(u);
  };

  const handleConfirmAction = () => {
    if (!targetUser) return;
    statusMutation.mutate({
      uuid: targetUser.uuid,
      newStatus: !targetUser.is_active,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-main">User Management</h1>
        <p className="text-sm text-text-muted">Manage access for FinPilot users.</p>
      </div>

      {/* Success Banner */}
      {successToast && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-gain flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span className="font-medium">{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="p-1 rounded-md text-green-700 hover:bg-green-100"
            aria-label="Dismiss toast"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between bg-surface p-4 rounded-xl border border-border shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-transparent text-text-main"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={userTypeFilter}
            onChange={(e) => {
              setUserTypeFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by role"
            className="text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="VIEWER">VIEWER</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
            className="text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-border bg-surface shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-text-muted">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-sm">Loading users...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-loss">Failed to load users list. Please try again.</div>
        ) : data?.results.length === 0 ? (
          <div className="p-12 text-center text-text-muted">No users found matching your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead className="bg-slate-50 text-text-muted text-xs uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3.5 sticky left-0 bg-slate-50 z-10">Name</th>
                  <th className="px-5 py-3.5">Email</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Last Login</th>
                  <th className="px-5 py-3.5">Joined Date</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.results.map((u) => {
                  const isCurrentLoggedInUser = currentUser?.id === u.id || currentUser?.email === u.email;
                  const isSoleAdmin = u.user_type === 'ADMIN' && u.is_active && activeAdminsCount <= 1;
                  const canDeactivate = !(isCurrentLoggedInUser || isSoleAdmin);

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-text-main sticky left-0 bg-surface group-hover:bg-slate-50 z-10 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{u.full_name || '—'}</span>
                          {isCurrentLoggedInUser && (
                            <span className="text-2xs px-2 py-0.5 rounded-full bg-blue-100 text-primary font-bold">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-text-main font-mono text-xs">{u.email}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            u.user_type === 'ADMIN'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {u.user_type === 'ADMIN' && <ShieldCheck className="h-3 w-3 mr-1" />}
                          {u.user_type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            u.is_active
                              ? 'bg-green-100 text-gain border border-green-200'
                              : 'bg-slate-100 text-text-muted border border-slate-200'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
                              u.is_active ? 'bg-green-600' : 'bg-slate-400'
                            }`}
                          />
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-text-muted text-xs">
                        {u.last_login ? formatDate(u.last_login.split('T')[0]) : 'Never'}
                      </td>
                      <td className="px-5 py-3.5 text-text-muted text-xs">
                        {formatDate(u.created.split('T')[0])}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {u.is_active ? (
                          <button
                            onClick={() => handleOpenDialog(u)}
                            disabled={!canDeactivate}
                            title={
                              isCurrentLoggedInUser
                                ? 'You cannot deactivate your own account'
                                : isSoleAdmin
                                ? 'Cannot deactivate the only active admin'
                                : 'Deactivate user'
                            }
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              !canDeactivate
                                ? 'opacity-40 cursor-not-allowed bg-slate-100 text-text-muted'
                                : 'text-loss bg-red-50 hover:bg-red-100 border border-red-200'
                            }`}
                          >
                            <UserX className="h-3.5 w-3.5" />
                            <span>Deactivate</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenDialog(u)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-gain bg-green-50 hover:bg-green-100 border border-green-200 transition-colors"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>Activate</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {data && data.count > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-slate-50/50 text-xs text-text-muted">
            <div>
              Showing <span className="font-semibold text-text-main">{data.results.length}</span> of{' '}
              <span className="font-semibold text-text-main">{data.count}</span> users
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!data.previous}
                className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-text-main disabled:opacity-40 hover:bg-slate-50 font-medium"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.next}
                className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-text-main disabled:opacity-40 hover:bg-slate-50 font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {targetUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-150 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  targetUser.is_active ? 'bg-red-100 text-loss' : 'bg-green-100 text-gain'
                }`}
              >
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 id="confirm-dialog-title" className="text-lg font-bold text-text-main">
                  {targetUser.is_active ? 'Deactivate User Account' : 'Activate User Account'}
                </h3>
                <p className="text-xs text-text-muted">
                  Please confirm the status update for this user.
                </p>
              </div>
            </div>

            {actionError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-loss">
                {actionError}
              </div>
            )}

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs space-y-2 text-text-main">
              <div>
                <span className="text-text-muted block">User:</span>
                <span className="font-semibold text-sm">{targetUser.full_name || 'No name'}</span>{' '}
                <span className="font-mono text-text-muted">({targetUser.email})</span>
              </div>
              <div>
                <span className="text-text-muted block">Role:</span>
                <span className="font-semibold">{targetUser.user_type}</span>
              </div>
              <div className="pt-2 border-t border-slate-200">
                {targetUser.is_active ? (
                  <p className="text-loss font-medium">
                    ⚠️ Deactivating this user will prevent them from logging in or making API requests immediately.
                  </p>
                ) : (
                  <p className="text-gain font-medium">
                    ✅ Activating this user will restore their ability to log into FinPilot.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setTargetUser(null);
                  setActionError(null);
                }}
                disabled={statusMutation.isPending}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-text-main hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={statusMutation.isPending}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-xs transition-opacity ${
                  targetUser.is_active
                    ? 'bg-loss hover:opacity-90'
                    : 'bg-gain hover:opacity-90'
                } disabled:opacity-50`}
              >
                {statusMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>
                  {targetUser.is_active
                    ? statusMutation.isPending
                      ? 'Deactivating...'
                      : 'Yes, Deactivate'
                    : statusMutation.isPending
                    ? 'Activating...'
                    : 'Yes, Activate'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
