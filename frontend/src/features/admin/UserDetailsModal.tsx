import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { ApiResponse, AdminUserListItem, User } from '@/types/api';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/features/auth/AuthContext';
import {
  X,
  ShieldCheck,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  Clock,
  Mail,
  Copy,
  Check,
  KeyRound,
  UserCheck,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetUser: AdminUserListItem | User | null;
  initialMode?: 'view' | 'edit';
  canEditRole?: boolean;
  activeAdminsCount?: number;
  onSuccess?: (updatedUser: AdminUserListItem) => void;
}

export const UserDetailsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  targetUser,
  initialMode = 'view',
  canEditRole = false,
  activeAdminsCount = 1,
  onSuccess,
}) => {
  const { user: currentUser, updateUser } = useAuth();

  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'VIEWER'>('VIEWER');
  const [isActive, setIsActive] = useState(true);
  const [confirmEmailChange, setConfirmEmailChange] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Sync state whenever modal opens or target user changes
  useEffect(() => {
    if (targetUser && isOpen) {
      const userEmail = targetUser.email || '';
      setFullName(targetUser.full_name || '');
      setEmail(userEmail);
      setOriginalEmail(userEmail);
      setRole(targetUser.user_type);
      setIsActive(targetUser.is_active ?? true);
      setMode(initialMode);
      setConfirmEmailChange(false);
      setErrors({});
      setSuccessMessage(null);
      setCopiedEmail(false);
    }
  }, [targetUser, isOpen, initialMode]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !targetUser) return null;

  const isCurrentLoggedIn =
    currentUser?.id === targetUser.id || (currentUser?.uuid && currentUser.uuid === targetUser.uuid);
  const isLastActiveAdmin =
    targetUser.user_type === 'ADMIN' && (targetUser.is_active ?? true) && activeAdminsCount <= 1;

  const isEmailModified = email.trim().toLowerCase() !== originalEmail.toLowerCase();

  const handleCopyEmail = (em: string) => {
    navigator.clipboard.writeText(em);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccessMessage(null);

    const validationErrors: Record<string, string> = {};
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      validationErrors.fullName = 'Full name is required.';
    }
    if (!trimmedEmail) {
      validationErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      validationErrors.email = 'Enter a valid email address (e.g. user@finpilot.local).';
    }

    if (isEmailModified && !confirmEmailChange) {
      validationErrors.emailConfirm =
        'Please confirm that you understand this will change the user login credentials.';
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, any> = {
        full_name: trimmedName,
        email: trimmedEmail,
      };

      if (canEditRole) {
        payload.user_type = role;
        payload.is_active = isActive;
      }

      const endpoint = targetUser.uuid
        ? `/admin/users/${targetUser.uuid}/`
        : `/auth/me/`;

      const res = await apiClient.patch<ApiResponse<AdminUserListItem>>(endpoint, payload);
      const updated = res.data.data;

      // Update current user in auth context if updating self
      if (isCurrentLoggedIn) {
        updateUser({
          full_name: updated.full_name,
          email: updated.email,
          user_type: updated.user_type,
          is_active: updated.is_active,
        });
      }

      setOriginalEmail(updated.email);
      setSuccessMessage(
        isEmailModified
          ? `User details and login email updated to ${updated.email}.`
          : 'User details updated successfully.'
      );
      onSuccess?.(updated);

      setTimeout(() => {
        setMode('view');
        setConfirmEmailChange(false);
        setSuccessMessage(null);
      }, 1400);
    } catch (err: any) {
      const errData = err.response?.data?.data || {};
      const newErrors: Record<string, string> = {};
      if (errData.email) newErrors.email = Array.isArray(errData.email) ? errData.email[0] : errData.email;
      if (errData.full_name) newErrors.fullName = Array.isArray(errData.full_name) ? errData.full_name[0] : errData.full_name;
      if (errData.user_type) newErrors.role = Array.isArray(errData.user_type) ? errData.user_type[0] : errData.user_type;
      if (errData.is_active) newErrors.isActive = Array.isArray(errData.is_active) ? errData.is_active[0] : errData.is_active;
      if (errData.detail) newErrors.general = errData.detail;
      if (Object.keys(newErrors).length === 0) {
        newErrors.general = err.response?.data?.message || 'Failed to update user details. Please check inputs.';
      }
      setErrors(newErrors);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string | null, em: string) => {
    if (name?.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    return em.slice(0, 2).toUpperCase();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-surface border border-border shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <UserCheck className="h-4 w-4" />
            </span>
            <div>
              <h2 id="user-modal-title" className="text-sm font-bold text-text-main">
                {mode === 'edit' ? 'Edit User Details' : 'User Details'}
              </h2>
              <p className="text-2xs text-text-muted">
                {mode === 'edit'
                  ? 'Update user account information and access level'
                  : 'Account information and assigned access level'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-text-muted hover:text-text-main hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success Banner */}
        {successMessage && (
          <div className="mx-6 mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-gain flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-gain" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}

        {/* General Error Banner */}
        {errors.general && (
          <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-loss flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-loss" />
            <span className="font-medium">{errors.general}</span>
          </div>
        )}

        {/* VIEW MODE */}
        {mode === 'view' ? (
          <div className="p-6 space-y-6">
            {/* Identity Card Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-slate-50/60">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary flex items-center justify-center font-bold text-base border border-primary/20 shrink-0">
                  {getInitials(targetUser.full_name, targetUser.email)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-main text-base">
                      {targetUser.full_name || 'No Name Provided'}
                    </span>
                    {isCurrentLoggedIn && (
                      <span className="text-3xs bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">
                        You
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                    <span className="font-mono text-text-main">{targetUser.email}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyEmail(targetUser.email)}
                      title="Copy email address"
                      className="text-text-muted hover:text-primary transition-colors p-0.5 rounded"
                    >
                      {copiedEmail ? (
                        <Check className="h-3 w-3 text-gain" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                    targetUser.user_type === 'ADMIN'
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{targetUser.user_type}</span>
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                    targetUser.is_active
                      ? 'bg-green-100 text-gain border border-green-200'
                      : 'bg-red-100 text-loss border border-red-200'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      targetUser.is_active ? 'bg-gain' : 'bg-loss'
                    }`}
                  />
                  <span>{targetUser.is_active ? 'Active' : 'Inactive'}</span>
                </span>
              </div>
            </div>

            {/* Account Details Attributes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border border-border bg-surface">
                <div className="text-text-muted font-medium flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  <span>Assigned Role</span>
                </div>
                <div className="text-sm font-semibold text-text-main">
                  {targetUser.user_type}
                </div>
                <div className="text-3xs text-text-muted mt-0.5">
                  {targetUser.user_type === 'ADMIN'
                    ? 'Full admin privileges and batch imports'
                    : 'Standard read-only portfolio access'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-surface">
                <div className="text-text-muted font-medium flex items-center gap-1.5 mb-1">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  <span>Account Status</span>
                </div>
                <div className="text-sm font-semibold text-text-main">
                  {targetUser.is_active ? 'Active' : 'Inactive'}
                </div>
                <div className="text-3xs text-text-muted mt-0.5">
                  {targetUser.is_active
                    ? 'Authorized for sign-in and platform usage'
                    : 'Account suspended from signing in'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-surface">
                <div className="text-text-muted font-medium flex items-center gap-1.5 mb-1">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span>Last Active Session</span>
                </div>
                <div className="text-sm font-medium text-text-main">
                  {'last_login' in targetUser && targetUser.last_login
                    ? formatDate(targetUser.last_login.split('T')[0])
                    : 'Never logged in'}
                </div>
                <div className="text-3xs text-text-muted mt-0.5">Most recent authenticated visit</div>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-surface">
                <div className="text-text-muted font-medium flex items-center gap-1.5 mb-1">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>Account Created</span>
                </div>
                <div className="text-sm font-medium text-text-main">
                  {'created' in targetUser && targetUser.created
                    ? formatDate(targetUser.created.split('T')[0])
                    : '—'}
                </div>
                <div className="text-3xs text-text-muted mt-0.5">Initial onboarding date</div>
              </div>
            </div>

            {/* Modal Footer in View Mode */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              {canEditRole ? (
                <div className="text-2xs text-text-muted">
                  You have administrative permissions to edit this account.
                </div>
              ) : (
                <div className="text-2xs text-text-muted italic">
                  View-only access. Role editing is restricted to administrators.
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-text-main hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>

                {canEditRole && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('edit');
                      setConfirmEmailChange(false);
                      setErrors({});
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-xs font-semibold text-white hover:bg-primary-dark shadow-xs transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Edit User</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* EDIT MODE */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-text-main mb-1.5">
                Full Name <span className="text-loss">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-1 bg-surface text-text-main ${
                  errors.fullName
                    ? 'border-loss focus:border-loss focus:ring-loss'
                    : 'border-slate-300 focus:border-primary focus:ring-primary'
                }`}
              />
              {errors.fullName && <p className="mt-1 text-xs text-loss">{errors.fullName}</p>}
            </div>

            {/* Email Address with Careful Update Handling */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-text-main">
                  Email Address (Login Identifier) <span className="text-loss">*</span>
                </label>
                {isEmailModified && (
                  <span className="text-3xs font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                    Modified
                  </span>
                )}
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) {
                      setErrors((prev) => ({ ...prev, email: '' }));
                    }
                  }}
                  placeholder="e.g. jane.doe@finpilot.local"
                  className={`w-full pl-9 pr-3 py-2 text-sm font-mono rounded-lg border focus:outline-none focus:ring-1 bg-surface text-text-main ${
                    errors.email
                      ? 'border-loss focus:border-loss focus:ring-loss'
                      : isEmailModified
                      ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500 bg-amber-50/20'
                      : 'border-slate-300 focus:border-primary focus:ring-primary'
                  }`}
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-loss font-medium">{errors.email}</p>}

              {/* Careful Email Change Warning & Confirmation */}
              {isEmailModified && (
                <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs space-y-2.5 animate-in fade-in">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-amber-900 leading-relaxed">
                      <span className="font-semibold">Login Identifier Change:</span> Changing this email
                      updates the user's primary login credential.
                      {isCurrentLoggedIn ? (
                        <span className="block mt-0.5 text-amber-800">
                          You are editing your own email. You will use{' '}
                          <strong className="font-mono text-amber-950 font-bold">
                            {email.trim().toLowerCase() || '...'}
                          </strong>{' '}
                          on your next sign-in.
                        </span>
                      ) : (
                        <span className="block mt-0.5 text-amber-800">
                          The user must sign in using{' '}
                          <strong className="font-mono text-amber-950 font-bold">
                            {email.trim().toLowerCase() || '...'}
                          </strong>{' '}
                          starting immediately.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-amber-200/80">
                    <label className="flex items-start gap-2 cursor-pointer select-none text-xs text-amber-900 font-medium">
                      <input
                        type="checkbox"
                        checked={confirmEmailChange}
                        onChange={(e) => {
                          setConfirmEmailChange(e.target.checked);
                          if (errors.emailConfirm) {
                            setErrors((prev) => ({ ...prev, emailConfirm: '' }));
                          }
                        }}
                        className="mt-0.5 rounded border-amber-300 text-primary focus:ring-primary h-4 w-4"
                      />
                      <span>I understand and confirm updating the login email to this address.</span>
                    </label>
                    {errors.emailConfirm && (
                      <p className="mt-1 text-xs text-loss font-medium pl-6">{errors.emailConfirm}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Role and Status Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-text-main mb-1.5">Role</label>
                <select
                  value={role}
                  disabled={!canEditRole || isLastActiveAdmin}
                  onChange={(e) => setRole(e.target.value as 'ADMIN' | 'VIEWER')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-surface text-text-main focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:bg-slate-100"
                >
                  <option value="VIEWER">VIEWER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                {isLastActiveAdmin && (
                  <p className="mt-1 text-3xs text-amber-600">
                    Cannot demote the only remaining active admin.
                  </p>
                )}
                {errors.role && <p className="mt-1 text-xs text-loss">{errors.role}</p>}
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-text-main mb-1.5">Account Status</label>
                <select
                  value={isActive ? 'true' : 'false'}
                  disabled={!canEditRole || isCurrentLoggedIn || isLastActiveAdmin}
                  onChange={(e) => setIsActive(e.target.value === 'true')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-surface text-text-main focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:bg-slate-100"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
                {isCurrentLoggedIn ? (
                  <p className="mt-1 text-3xs text-text-muted">
                    You cannot deactivate your own account.
                  </p>
                ) : isLastActiveAdmin ? (
                  <p className="mt-1 text-3xs text-amber-600">
                    Cannot deactivate the only active admin.
                  </p>
                ) : null}
                {errors.isActive && <p className="mt-1 text-xs text-loss">{errors.isActive}</p>}
              </div>
            </div>

            {/* Modal Footer in Edit Mode */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setMode('view');
                  setEmail(originalEmail);
                  setConfirmEmailChange(false);
                  setErrors({});
                }}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-text-main hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (isEmailModified && !confirmEmailChange)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-xs font-semibold text-white hover:bg-primary-dark shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
