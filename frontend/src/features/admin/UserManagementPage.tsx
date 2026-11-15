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
  UserPlus,
  MoreHorizontal,
  Eye,
  Pencil,
} from 'lucide-react';
import { UserDetailsModal } from './UserDetailsModal';

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

  // Create User Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createFullName, setCreateFullName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createRole, setCreateRole] = useState<'VIEWER' | 'ADMIN'>('VIEWER');
  const [createPassword, setCreatePassword] = useState('');
  const [createConfirmPassword, setCreateConfirmPassword] = useState('');
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // View/Edit User Modal State
  const [selectedUserForModal, setSelectedUserForModal] = useState<AdminUserListItem | null>(null);
  const [modalInitialMode, setModalInitialMode] = useState<'view' | 'edit'>('view');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  // Floating Action Menu State (positioned dynamically to prevent table overflow clipping)
  const [menuPosition, setMenuPosition] = useState<{
    user: AdminUserListItem;
    top?: number;
    bottom?: number;
    right: number;
  } | null>(null);

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

  // Mutation to create new user
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<AdminUserListItem>>(
        '/admin/users/',
        {
          full_name: createFullName,
          email: createEmail,
          user_type: createRole,
          password: createPassword,
        }
      );
      return res.data.data;
    },
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setSuccessToast(`User ${newUser.full_name || newUser.email} has been created successfully.`);
      setIsCreateOpen(false);
      setCreateFullName('');
      setCreateEmail('');
      setCreateRole('VIEWER');
      setCreatePassword('');
      setCreateConfirmPassword('');
      setCreateErrors({});
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      const data = err.response?.data?.data || {};
      const newErrors: Record<string, string> = {};
      if (data.email) newErrors.email = Array.isArray(data.email) ? data.email[0] : data.email;
      if (data.full_name) newErrors.fullName = Array.isArray(data.full_name) ? data.full_name[0] : data.full_name;
      if (data.password) newErrors.password = Array.isArray(data.password) ? data.password[0] : data.password;
      if (data.user_type) newErrors.role = Array.isArray(data.user_type) ? data.user_type[0] : data.user_type;
      if (data.detail) newErrors.general = data.detail;
      if (Object.keys(newErrors).length === 0) {
        newErrors.general = err.response?.data?.message || 'Failed to create user. Please check your inputs.';
      }
      setCreateErrors(newErrors);
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!createFullName.trim()) {
      errs.fullName = 'Full name is required.';
    }
    if (!createEmail.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createEmail.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!createPassword) {
      errs.password = 'Password is required.';
    } else if (createPassword.length < 8) {
      errs.password = 'Password must be at least 8 characters long.';
    }
    if (createPassword !== createConfirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }

    setCreateErrors({});
    createMutation.mutate();
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-main">User Management</h1>
          <p className="text-sm text-text-muted">Manage access for FinPilot users.</p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => {
              setCreateErrors({});
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            <span>Create User</span>
          </button>
        </div>
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
                {data?.results.map((u: AdminUserListItem) => {
                  const isCurrentLoggedIn = currentUser?.id === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-text-main sticky left-0 bg-surface z-10">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{u.full_name || '—'}</span>
                          {isCurrentLoggedIn && (
                            <span className="text-2xs bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-text-muted">{u.email}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                            u.user_type === 'ADMIN'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          <span>{u.user_type}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                            u.is_active
                              ? 'bg-green-100 text-gain'
                              : 'bg-red-100 text-loss'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              u.is_active ? 'bg-gain' : 'bg-loss'
                            }`}
                          />
                          <span>{u.is_active ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-text-muted">
                        {u.last_login ? formatDate(u.last_login.split('T')[0]) : 'Never'}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-text-muted">
                        {u.created ? formatDate(u.created.split('T')[0]) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (menuPosition?.user.id === u.id) {
                              setMenuPosition(null);
                              return;
                            }
                            const rect = e.currentTarget.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const openUpwards = spaceBelow < 190;
                            setMenuPosition({
                              user: u,
                              top: openUpwards ? undefined : rect.bottom + 4,
                              bottom: openUpwards ? window.innerHeight - rect.top + 4 : undefined,
                              right: Math.max(16, window.innerWidth - rect.right),
                            });
                          }}
                          aria-label={`Actions for ${u.full_name || u.email}`}
                          className={`p-1.5 rounded-lg border transition-colors focus:outline-none focus:ring-1 focus:ring-primary ${
                            menuPosition?.user.id === u.id
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-text-muted hover:text-text-main'
                          }`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Bar */}
        {data && data.count > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border text-xs text-text-muted bg-surface">
            <div>
              Showing <span className="font-semibold text-text-main">{data.results.length}</span> of{' '}
              <span className="font-semibold text-text-main">{data.count}</span> users
            </div>
            <div className="flex items-center gap-2">
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

      {/* Create User Modal */}
      {isCreateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-user-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-150 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div className="space-y-0.5">
                <h3 id="create-user-modal-title" className="text-lg font-bold text-text-main">
                  Create New User
                </h3>
                <p className="text-xs text-text-muted">
                  Add a new administrator or viewer to the FinPilot platform.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg p-1 text-text-muted hover:bg-slate-100 hover:text-text-main transition-colors"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createErrors.general && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-loss">
                {createErrors.general}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-main">
                  Full Name <span className="text-loss">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={createFullName}
                  onChange={(e) => setCreateFullName(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${
                    createErrors.fullName ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:ring-primary'
                  } bg-white text-text-main focus:outline-none focus:ring-1`}
                />
                {createErrors.fullName && (
                  <p className="text-2xs text-loss">{createErrors.fullName}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-main">
                  Email Address <span className="text-loss">*</span>
                </label>
                <input
                  type="email"
                  placeholder="user@finpilot.local"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${
                    createErrors.email ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:ring-primary'
                  } bg-white text-text-main focus:outline-none focus:ring-1`}
                />
                {createErrors.email && (
                  <p className="text-2xs text-loss">{createErrors.email}</p>
                )}
              </div>

              {/* Role */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-main">
                  Role <span className="text-loss">*</span>
                </label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as 'VIEWER' | 'ADMIN')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="VIEWER">VIEWER (Read-only access)</option>
                  <option value="ADMIN">ADMIN (Full management & ingestion access)</option>
                </select>
                {createErrors.role && (
                  <p className="text-2xs text-loss">{createErrors.role}</p>
                )}
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-text-main">
                    Password <span className="text-loss">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Min 8 characters"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${
                      createErrors.password ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:ring-primary'
                    } bg-white text-text-main focus:outline-none focus:ring-1`}
                  />
                  {createErrors.password && (
                    <p className="text-2xs text-loss">{createErrors.password}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-text-main">
                    Confirm Password <span className="text-loss">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Repeat password"
                    value={createConfirmPassword}
                    onChange={(e) => setCreateConfirmPassword(e.target.value)}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${
                      createErrors.confirmPassword ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:ring-primary'
                    } bg-white text-text-main focus:outline-none focus:ring-1`}
                  />
                  {createErrors.confirmPassword && (
                    <p className="text-2xs text-loss">{createErrors.confirmPassword}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={createMutation.isPending}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-text-main hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary-dark shadow-xs transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{createMutation.isPending ? 'Creating...' : 'Create User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Floating Action Menu (Never clipped by table overflow) */}
      {menuPosition && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuPosition(null)}
          />
          <div
            className="fixed z-50 w-44 rounded-xl border border-border bg-surface shadow-xl py-1 text-xs text-left animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: menuPosition.top !== undefined ? `${menuPosition.top}px` : undefined,
              bottom: menuPosition.bottom !== undefined ? `${menuPosition.bottom}px` : undefined,
              right: `${menuPosition.right}px`,
            }}
          >
            <button
              type="button"
              onClick={() => {
                const target = menuPosition.user;
                setMenuPosition(null);
                setSelectedUserForModal(target);
                setModalInitialMode('view');
                setIsUserModalOpen(true);
              }}
              className="w-full text-left px-3.5 py-2 flex items-center gap-2 hover:bg-slate-50 text-text-main font-medium transition-colors"
            >
              <Eye className="h-3.5 w-3.5 text-text-muted" />
              <span>View Details</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const target = menuPosition.user;
                setMenuPosition(null);
                setSelectedUserForModal(target);
                setModalInitialMode('edit');
                setIsUserModalOpen(true);
              }}
              className="w-full text-left px-3.5 py-2 flex items-center gap-2 hover:bg-slate-50 text-text-main font-medium transition-colors"
            >
              <Pencil className="h-3.5 w-3.5 text-primary" />
              <span>Edit User</span>
            </button>

            <div className="my-1 border-t border-border" />

            {menuPosition.user.is_active ? (
              <button
                type="button"
                disabled={
                  menuPosition.user.id === currentUser?.id ||
                  (menuPosition.user.user_type === 'ADMIN' && menuPosition.user.is_active && activeAdminsCount <= 1)
                }
                title={
                  menuPosition.user.id === currentUser?.id
                    ? 'You cannot deactivate your own admin account.'
                    : menuPosition.user.user_type === 'ADMIN' && menuPosition.user.is_active && activeAdminsCount <= 1
                    ? 'Cannot deactivate the only remaining active admin.'
                    : undefined
                }
                onClick={() => {
                  const target = menuPosition.user;
                  setMenuPosition(null);
                  handleOpenDialog(target);
                }}
                className="w-full text-left px-3.5 py-2 flex items-center gap-2 hover:bg-red-50 text-loss font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <UserX className="h-3.5 w-3.5" />
                <span>Deactivate User</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const target = menuPosition.user;
                  setMenuPosition(null);
                  handleOpenDialog(target);
                }}
                className="w-full text-left px-3.5 py-2 flex items-center gap-2 hover:bg-green-50 text-gain font-medium transition-colors"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Activate User</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* View/Edit User Details Modal */}
      <UserDetailsModal
        isOpen={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false);
          setSelectedUserForModal(null);
        }}
        targetUser={selectedUserForModal}
        initialMode={modalInitialMode}
        canEditRole={true}
        activeAdminsCount={activeAdminsCount}
        onSuccess={(updated) => {
          queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
          setSuccessToast(`User ${updated.full_name || updated.email} details updated.`);
          setTimeout(() => setSuccessToast(null), 4000);
        }}
      />
    </div>
  );
};
