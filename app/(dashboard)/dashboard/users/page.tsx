"use client";

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleOff, Copy, RefreshCw, ShieldCheck, UserPlus, X } from 'lucide-react';
import { KpiCard } from '../../../../components/dashboard/kpi-card';
import { PageHeader } from '../../../../components/dashboard/page-header';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { StatePanel } from '../../../../components/dashboard/state-panel';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { canManageUsers, getDefaultDashboardPath } from '../../../../lib/client/dashboard-access';

type AppRole = 'employee' | 'team_lead' | 'finance' | 'admin' | 'developer';
type UserStatus = 'active' | 'inactive';

type ManagedUser = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  status: UserStatus;
  team_name: string | null;
  created_at: string;
  updated_at: string;
};

type UsersResponse = {
  success: boolean;
  users?: ManagedUser[];
  error?: string;
};

type CreateFormState = {
  full_name: string;
  email: string;
  role: AppRole;
  team_name: string;
  status: UserStatus;
};

type EditFormState = {
  full_name: string;
  role: AppRole;
  team_name: string;
  status: UserStatus;
};

const STATUS_OPTIONS: Array<{ value: UserStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const ROLE_FILTERS: Array<{ value: AppRole | 'all'; label: string }> = [
  { value: 'all', label: 'All Roles' },
  { value: 'employee', label: 'Employee' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'finance', label: 'Finance' },
  { value: 'admin', label: 'Admin' },
  { value: 'developer', label: 'Developer' },
];

function getCreatableRoles(role: AppRole) {
  if (role === 'finance') return ['employee'] as AppRole[];
  if (role === 'admin' || role === 'developer') {
    return ['employee', 'team_lead', 'finance', 'admin'] as AppRole[];
  }
  return [] as AppRole[];
}

function formatRoleLabel(role: AppRole) {
  if (role === 'team_lead') return 'Team Lead';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusClass(status: UserStatus) {
  return status === 'active'
    ? 'border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/12 dark:text-emerald-200'
    : 'border-rose-200/70 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/12 dark:text-rose-200';
}

function getRoleClass(role: AppRole) {
  if (role === 'team_lead') {
    return 'border-sky-200/70 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/12 dark:text-sky-200';
  }
  if (role === 'finance') {
    return 'border-indigo-200/70 bg-indigo-50 text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-400/12 dark:text-indigo-200';
  }
  if (role === 'admin') {
    return 'border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/12 dark:text-amber-200';
  }
  if (role === 'developer') {
    return 'border-border bg-muted/40 text-muted-foreground';
  }
  return 'border-slate-200/70 bg-slate-50 text-slate-700 dark:border-slate-400/20 dark:bg-slate-400/12 dark:text-slate-200';
}

function compactButtonClass(primary = false) {
  return primary
    ? 'inline-flex items-center justify-center rounded-lg bg-[linear-gradient(135deg,var(--primary-strong),var(--accent))] px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60'
    : 'inline-flex items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60';
}

function destructiveButtonClass() {
  return 'inline-flex items-center justify-center rounded-lg border border-destructive/25 bg-card px-3 py-2 text-sm font-semibold text-destructive transition-colors duration-150 hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-60';
}

function canEditUser(actorRole: AppRole, target: ManagedUser) {
  if (actorRole === 'finance') return target.role === 'employee';
  if (actorRole === 'admin' || actorRole === 'developer') return target.role !== 'developer';
  return false;
}

function canToggleStatus(actorRole: AppRole, actorId: string, target: ManagedUser) {
  if (target.id === actorId) return false;
  return canEditUser(actorRole, target);
}

function canEditRole(actorRole: AppRole, actorId: string, target: ManagedUser) {
  if (target.id === actorId) return false;
  return actorRole !== 'finance' && target.role !== 'developer';
}

function canResetPasswordAction(actorRole: AppRole, actorId: string, target: ManagedUser) {
  if (target.id === actorId) return false;
  if (actorRole === 'finance') return target.role === 'employee';
  return actorRole === 'admin' || actorRole === 'developer' ? target.role !== 'developer' : false;
}

export default function UsersManagementPage() {
  const router = useRouter();
  const { user, loading } = useDashboardSession();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<AppRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);
  const [confirmRoleChange, setConfirmRoleChange] = useState(false);
  const [passwordReveal, setPasswordReveal] = useState<{ title: string; helper: string; name?: string; email?: string; temporaryPassword: string } | null>(null);
  const [createForm, setCreateForm] = useState<CreateFormState>({
    full_name: '',
    email: '',
    role: 'employee',
    team_name: '',
    status: 'active',
  });
  const [editForm, setEditForm] = useState<EditFormState>({
    full_name: '',
    role: 'employee',
    team_name: '',
    status: 'active',
  });

  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (loading || !user) return;
    if (!canManageUsers(user.role)) {
      router.replace(getDefaultDashboardPath(user.role));
    }
  }, [loading, router, user]);

  const loadUsers = useCallback(
    async (showRefresh = false) => {
      if (!user || !canManageUsers(user.role)) return;
      if (showRefresh) setRefreshing(true);
      else setPageLoading(true);
      setError('');

      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (roleFilter !== 'all') params.set('role', roleFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);

        const url = params.toString() ? `/api/users?${params.toString()}` : '/api/users';
        const res = await fetch(url, { cache: 'no-store' });
        const json = (await res.json().catch(() => ({}))) as UsersResponse;

        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to load users.');
        }

        setUsers(Array.isArray(json.users) ? json.users : []);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load users.');
      } finally {
        if (showRefresh) setRefreshing(false);
        else setPageLoading(false);
      }
    },
    [roleFilter, search, statusFilter, user]
  );

  useEffect(() => {
    if (!user || !canManageUsers(user.role)) return;
    void loadUsers(false);
  }, [loadUsers, user]);

  const editUser = useMemo(
    () => (editUserId ? users.find((entry) => entry.id === editUserId) ?? null : null),
    [editUserId, users]
  );

  const deactivateUser = useMemo(
    () => (confirmDeactivateId ? users.find((entry) => entry.id === confirmDeactivateId) ?? null : null),
    [confirmDeactivateId, users]
  );
  const resetUser = useMemo(
    () => (confirmResetId ? users.find((entry) => entry.id === confirmResetId) ?? null : null),
    [confirmResetId, users]
  );

  const creatableRoles = useMemo(() => (user ? getCreatableRoles(user.role) : []), [user]);
  const privilegedCount = useMemo(
    () => users.filter((entry) => entry.role === 'finance' || entry.role === 'admin' || entry.role === 'developer').length,
    [users]
  );

  function resetCreateForm() {
    setCreateForm({
      full_name: '',
      email: '',
      role: creatableRoles[0] ?? 'employee',
      team_name: '',
      status: 'active',
    });
  }

  function openCreateModal() {
    resetCreateForm();
    setActionError('');
    setCreateOpen(true);
  }

  function openEditModal(entry: ManagedUser) {
    setActionError('');
    setEditUserId(entry.id);
    setEditForm({
      full_name: entry.full_name,
      role: entry.role,
      team_name: entry.team_name ?? '',
      status: entry.status,
    });
  }

  async function handleCreateUser() {
    setActionError('');
    setActionLoading(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        user?: ManagedUser;
        temporary_password?: string;
      };

      if (!res.ok || !json.success || !json.user || !json.temporary_password) {
        throw new Error(json.error || 'Failed to create user.');
      }

      setCreateOpen(false);
      setPasswordReveal({
        title: 'User Created Successfully',
        helper: 'Share this password securely with the user. The password will not be shown again.',
        name: json.user.full_name,
        email: json.user.email,
        temporaryPassword: json.temporary_password,
      });
      await loadUsers(true);
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to create user.');
    } finally {
      setActionLoading(false);
    }
  }

  async function saveEdit() {
    if (!editUser) return;
    setActionError('');
    setActionLoading(true);

    try {
      const payload: Record<string, string> = {
        full_name: editForm.full_name,
        team_name: editForm.team_name,
        status: editForm.status,
      };

      if (user && canEditRole(user.role, user.id, editUser)) {
        payload.role = editForm.role;
      }

      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update user.');
      }

      setConfirmRoleChange(false);
      setEditUserId(null);
      await loadUsers(true);
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to update user.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEditSubmit() {
    if (!editUser) return;
    const roleChanged = editForm.role !== editUser.role;
    const requiresConfirm = roleChanged && (editForm.role === 'finance' || editForm.role === 'admin');

    if (requiresConfirm) {
      setConfirmRoleChange(true);
      return;
    }

    await saveEdit();
  }

  async function handleStatusToggle(entry: ManagedUser, nextStatus: UserStatus) {
    setActionError('');
    setActionLoading(true);

    try {
      const res = await fetch(`/api/users/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update user status.');
      }

      setConfirmDeactivateId(null);
      await loadUsers(true);
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to update user status.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResetPassword(entry: ManagedUser) {
    setActionError('');
    setActionLoading(true);

    try {
      const res = await fetch(`/api/users/${entry.id}/reset-password`, {
        method: 'POST',
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        temporary_password?: string;
      };
      if (!res.ok || !json.success || !json.temporary_password) {
        throw new Error(json.error || 'Failed to reset password.');
      }

      setConfirmResetId(null);
      setPasswordReveal({
        title: 'Password Reset Successful',
        helper: 'Share this password securely with the user. The password will not be shown again.',
        temporaryPassword: json.temporary_password,
      });
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to reset password.');
    } finally {
      setActionLoading(false);
    }
  }

  async function copyPassword(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setActionError('Unable to copy password. Please copy it manually.');
    }
  }

  if (loading || !user || !canManageUsers(user.role)) return null;

  return (
    <>
      <div className="grid gap-4">
        <PageHeader
          className="gap-3 border-b-0 pb-1"
          title="Users"
          description="Manage dashboard users and role access."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadUsers(true)}
                className={compactButtonClass(false)}
                disabled={refreshing || pageLoading}
              >
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button type="button" onClick={openCreateModal} className={compactButtonClass(true)}>
                <UserPlus className="mr-2 h-3.5 w-3.5" />
                Add User
              </button>
            </div>
          }
        />

        <div className="grid gap-3 md:grid-cols-4">
          <KpiCard title="Total Users" value={String(users.length)} hint="Provisioned dashboard profiles" variant="navy" compact />
          <KpiCard title="Active" value={String(users.filter((entry) => entry.status === 'active').length)} hint="Can sign in right now" variant="teal" compact />
          <KpiCard title="Inactive" value={String(users.filter((entry) => entry.status === 'inactive').length)} hint="Blocked from dashboard access" variant="danger" compact />
          <KpiCard title="Access Managers" value={String(privilegedCount)} hint="Finance, admin, and developer roles" variant="violet" compact />
        </div>

        <SectionCard
          title="Users Directory"
          description="Search, filter, provision, and maintain dashboard access safely."
          contentClassName="grid gap-4"
        >
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.8fr)_220px_220px]">
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Search
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name or email"
                className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              />
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Role
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as AppRole | 'all')}
                className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              >
                {ROLE_FILTERS.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as UserStatus | 'all')}
                className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              >
                {STATUS_OPTIONS.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {actionError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {actionError}
            </div>
          ) : null}

          {pageLoading ? (
            <StatePanel variant="loading" title="Loading users" description="Pulling the current dashboard user directory." icon={<ShieldCheck className="h-5 w-5" />} />
          ) : error ? (
            <StatePanel variant="error" tone="danger" title="Unable to load users" description={error} />
          ) : users.length === 0 ? (
            <StatePanel variant="empty" title="No matching users" description="Adjust your filters or add a new dashboard user." icon={<CircleOff className="h-5 w-5" />} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="min-w-full table-fixed border-collapse text-left">
                <thead className="bg-muted/15">
                  <tr className="border-b border-border/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">Created At</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((entry) => {
                    const isSelf = entry.id === user.id;
                    const canEdit = canEditUser(user.role, entry);
                    const canToggle = canToggleStatus(user.role, user.id, entry);

                    return (
                      <tr key={entry.id} className="border-b border-border/50 bg-card text-sm text-foreground last:border-b-0">
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{entry.full_name}</span>
                            {isSelf ? (
                              <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                You
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground">{entry.email}</td>
                        <td className="px-4 py-3 align-top">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getRoleClass(entry.role)}`}>
                            {formatRoleLabel(entry.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClass(entry.status)}`}>
                            {entry.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground">{entry.team_name || '—'}</td>
                        <td className="px-4 py-3 align-top text-muted-foreground">{formatDate(entry.created_at)}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-2">
                            {canEdit ? (
                              <button type="button" onClick={() => openEditModal(entry)} className={compactButtonClass(false)}>
                                Edit
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">No access</span>
                            )}

                            {canToggle ? (
                              entry.status === 'active' ? (
                                <button type="button" onClick={() => setConfirmDeactivateId(entry.id)} className={destructiveButtonClass()}>
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleStatusToggle(entry, 'active')}
                                  className={compactButtonClass(false)}
                                  disabled={actionLoading}
                                >
                                  Activate
                                </button>
                              )
                            ) : isSelf ? (
                              <span className="text-xs text-muted-foreground">Self protected</span>
                            ) : null}

                            {canResetPasswordAction(user.role, user.id, entry) ? (
                              <button
                                type="button"
                                onClick={() => setConfirmResetId(entry.id)}
                                className={compactButtonClass(false)}
                              >
                                Reset Password
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Add User</h2>
                <p className="mt-1 text-sm text-muted-foreground">Create a dashboard user and provision matching Supabase auth access.</p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 px-5 py-5">
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Full Name
                <input
                  value={createForm.full_name}
                  onChange={(event) => setCreateForm((current) => ({ ...current, full_name: event.target.value }))}
                  className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                />
              </label>

              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Email
                <input
                  value={createForm.email}
                  onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                  className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  placeholder="name@create.wtf"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Role
                  <select
                    value={createForm.role}
                    onChange={(event) => setCreateForm((current) => ({ ...current, role: event.target.value as AppRole }))}
                    className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  >
                    {creatableRoles.map((role) => (
                      <option key={role} value={role}>
                        {formatRoleLabel(role)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Status
                  <select
                    value={createForm.status}
                    onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as UserStatus }))}
                    className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Team Name
                <input
                  value={createForm.team_name}
                  onChange={(event) => setCreateForm((current) => ({ ...current, team_name: event.target.value }))}
                  className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  placeholder="Optional"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button type="button" onClick={() => setCreateOpen(false)} className={compactButtonClass(false)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateUser()}
                className={compactButtonClass(true)}
                disabled={actionLoading || !createForm.full_name.trim() || !createForm.email.trim()}
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Edit User</h2>
                <p className="mt-1 text-sm text-muted-foreground">Update profile details and dashboard access safely.</p>
              </div>
              <button type="button" onClick={() => setEditUserId(null)} className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 px-5 py-5">
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Full Name
                <input
                  value={editForm.full_name}
                  onChange={(event) => setEditForm((current) => ({ ...current, full_name: event.target.value }))}
                  className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Status
                  <select
                    value={editForm.status}
                    onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as UserStatus }))}
                    className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  >
                    <option value="active">Active</option>
                    <option value="inactive" disabled={editUser.id === user.id}>
                      Inactive
                    </option>
                  </select>
                </label>

                {canEditRole(user.role, user.id, editUser) ? (
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    Role
                    <select
                      value={editForm.role}
                      onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value as AppRole }))}
                      className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                    >
                      {getCreatableRoles(user.role).map((role) => (
                        <option key={role} value={role}>
                          {formatRoleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="grid gap-1.5 text-sm font-medium text-foreground">
                    <span>Role</span>
                    <div className="flex h-10 items-center rounded-xl border border-border bg-muted/20 px-3 text-sm text-muted-foreground">
                      {formatRoleLabel(editUser.role)}
                    </div>
                  </div>
                )}
              </div>

              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Team Name
                <input
                  value={editForm.team_name}
                  onChange={(event) => setEditForm((current) => ({ ...current, team_name: event.target.value }))}
                  className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  placeholder="Optional"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button type="button" onClick={() => setEditUserId(null)} className={compactButtonClass(false)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleEditSubmit()}
                className={compactButtonClass(true)}
                disabled={actionLoading || !editForm.full_name.trim()}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmRoleChange && editUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">Confirm Role Change</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You are changing this user to a higher-access role. Please confirm before saving.
              </p>
            </div>
            <div className="px-5 py-5 text-sm text-foreground">
              <p>
                Change <span className="font-semibold">{editUser.full_name}</span> to{' '}
                <span className="font-semibold">{formatRoleLabel(editForm.role)}</span>?
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button type="button" onClick={() => setConfirmRoleChange(false)} className={compactButtonClass(false)}>
                Cancel
              </button>
              <button type="button" onClick={() => void saveEdit()} className={compactButtonClass(true)} disabled={actionLoading}>
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deactivateUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">Deactivate this user?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                They will no longer be able to access the dashboard.
              </p>
            </div>
            <div className="px-5 py-5 text-sm text-foreground">
              <p>
                You are deactivating <span className="font-semibold">{deactivateUser.full_name}</span>.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button type="button" onClick={() => setConfirmDeactivateId(null)} className={compactButtonClass(false)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleStatusToggle(deactivateUser, 'inactive')}
                className={destructiveButtonClass()}
                disabled={actionLoading}
              >
                Deactivate User
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resetUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
            <div className="border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Reset Password?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  A new temporary password will be generated for this user.
                </p>
              </div>
            </div>
            <div className="px-5 py-5 text-sm text-foreground">
              <p>
                Generate a new temporary password for <span className="font-semibold">{resetUser.full_name}</span>?
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button type="button" onClick={() => setConfirmResetId(null)} className={compactButtonClass(false)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleResetPassword(resetUser)}
                className={compactButtonClass(true)}
                disabled={actionLoading}
              >
                Generate New Password
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {passwordReveal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{passwordReveal.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{passwordReveal.helper}</p>
              </div>
              <span className="rounded-full border border-emerald-200/70 bg-emerald-50 p-2 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/12 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            </div>
            <div className="grid gap-3 px-5 py-5 text-sm text-foreground">
              {passwordReveal.name ? (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Name</div>
                  <div className="mt-1 font-medium">{passwordReveal.name}</div>
                </div>
              ) : null}
              {passwordReveal.email ? (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Email</div>
                  <div className="mt-1 font-medium">{passwordReveal.email}</div>
                </div>
              ) : null}
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Temporary Password</div>
                <div className="mt-1 rounded-xl border border-border bg-muted/20 px-3 py-2 font-mono text-sm">
                  {passwordReveal.temporaryPassword}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={() => void copyPassword(passwordReveal.temporaryPassword)}
                className={compactButtonClass(false)}
              >
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copy Password
              </button>
              <button type="button" onClick={() => setPasswordReveal(null)} className={compactButtonClass(true)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
