"use client";

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { CheckCircle2, CircleOff, Copy, Info, KeyRound, UserPlus, X } from 'lucide-react';
import { FilterBar } from '../../../../components/dashboard/filter-bar';
import { KpiCard } from '../../../../components/dashboard/kpi-card';
import { PageHeader } from '../../../../components/dashboard/page-header';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { StatePanel } from '../../../../components/dashboard/state-panel';
import { SearchableSelect } from '../../../../components/forms/searchable-select';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { WorkspaceLoader } from '../../../../components/layout/workspace-loader';
import { canManageUsers, getDefaultDashboardPath } from '../../../../lib/client/dashboard-access';
import { ENABLE_TRANSFERRED_SUBMISSIONS } from '../../../../lib/shared/feature-flags';

type AppRole = 'employee' | 'team_lead' | 'finance' | 'admin' | 'developer';
type UserStatus = 'active' | 'inactive';
type BusinessLine = 'IM' | 'TM';

type TransferEligibilitySummary = {
  open_submission_count: number;
  mapped_team_lead_id: string | null;
  mapped_team_lead_name: string | null;
  can_transfer: boolean;
  blocked_reason: string | null;
};

type UserAuditSnapshot = {
  actor_user_id: string | null;
  actor_name: string;
  actor_email: string | null;
  action_type: string;
  created_at: string;
};

type ManagedUser = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  status: UserStatus;
  team_name: string | null;
  business_line: BusinessLine | null;
  created_at: string;
  updated_at: string;
  audit_summary?: {
    created: UserAuditSnapshot | null;
    updated: UserAuditSnapshot | null;
    deactivated: UserAuditSnapshot | null;
    password_reset: UserAuditSnapshot | null;
  } | null;
  transfer_summary?: TransferEligibilitySummary | null;
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
  business_line: BusinessLine | '';
};

type EditFormState = {
  full_name: string;
  role: AppRole;
  team_name: string;
  status: UserStatus;
  business_line: BusinessLine | '';
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
const BUSINESS_LINE_FILTERS: Array<{ value: BusinessLine | 'all'; label: string }> = [
  { value: 'all', label: 'All Lines' },
  { value: 'IM', label: 'IM' },
  { value: 'TM', label: 'TM' },
];

function getCreatableRoles(role: AppRole) {
  if (role === 'finance') return ['employee', 'team_lead'] as AppRole[];
  if (role === 'admin' || role === 'developer') {
    return ['employee', 'team_lead', 'finance', 'admin'] as AppRole[];
  }
  return [] as AppRole[];
}

function getEditableRoleOptions(actorRole: AppRole, targetRole: AppRole) {
  if (actorRole === 'finance') return [] as AppRole[];
  if (targetRole === 'employee' || targetRole === 'team_lead') {
    return ['employee', 'team_lead'] as AppRole[];
  }
  return [] as AppRole[];
}

function formatRoleLabel(role: AppRole) {
  if (role === 'team_lead') return 'Team Lead';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatBusinessLineLabel(line: BusinessLine | null | '', role?: AppRole) {
  if (!line && (role === 'finance' || role === 'admin' || role === 'developer')) return 'Overall Access';
  if (!line) return 'Unassigned';
  return line;
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

function formatAuditDateTime(value: string | null | undefined) {
  if (!value) return 'Not recorded yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded yet';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function UserAuditPopover({
  rect,
  user,
  section,
  onClose,
}: {
  rect: DOMRect;
  user: ManagedUser;
  section: 'created' | 'actions';
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [actionTab, setActionTab] = useState<'actions' | 'password'>('actions');

  useEffect(() => {
    setActionTab('actions');
  }, [section, user.id]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('[data-user-audit-popover="true"]')) return;
      onClose();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const created = user.audit_summary?.created ?? null;
  const updated = user.audit_summary?.updated ?? null;
  const deactivated = user.audit_summary?.deactivated ?? null;
  const passwordReset = user.audit_summary?.password_reset ?? null;
  const showingPasswordAudit = section === 'actions' && actionTab === 'password';

  return (
    <div
      ref={ref}
      data-user-audit-popover="true"
      className="fixed z-50 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-border/70 bg-card p-4 shadow-2xl"
      style={{
        top: Math.min(rect.bottom + 10, window.innerHeight - 240),
        left: Math.min(Math.max(12, rect.left - 120), window.innerWidth - 332),
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {section === 'created' ? 'Created Audit' : showingPasswordAudit ? 'Password Audit' : 'User Actions Audit'}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{user.full_name}</div>
        </div>
        <div className="flex items-center gap-2">
          {section === 'actions' ? (
            <button
              type="button"
              onClick={() => setActionTab((current) => (current === 'password' ? 'actions' : 'password'))}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                showingPasswordAudit
                  ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/12 dark:text-sky-200'
                  : 'border-border/70 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
              aria-label="Toggle password audit details"
            >
              <KeyRound className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            aria-label="Close audit details"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        {section === 'created' ? (
          <>
            <div className="rounded-xl border border-border/60 bg-muted/4 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Created At</div>
              <div className="mt-1 font-medium text-foreground">{formatAuditDateTime(created?.created_at ?? user.created_at)}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/4 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Created By</div>
              <div className="mt-1 font-medium text-foreground">{created?.actor_name ?? 'Not recorded yet'}</div>
            </div>
          </>
        ) : showingPasswordAudit ? (
          <>
            <div className="rounded-xl border border-border/60 bg-muted/4 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Password Updated At</div>
              <div className="mt-1 font-medium text-foreground">{passwordReset ? formatAuditDateTime(passwordReset.created_at) : 'Not recorded yet'}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/4 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Password Updated By</div>
              <div className="mt-1 font-medium text-foreground">{passwordReset?.actor_name ?? 'Not recorded yet'}</div>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-border/60 bg-muted/4 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Last Updated</div>
              <div className="mt-1 font-medium text-foreground">{updated ? formatAuditDateTime(updated.created_at) : 'Not recorded yet'}</div>
              <div className="mt-1 text-xs text-muted-foreground">By {updated?.actor_name ?? 'Not recorded yet'}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/4 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Deactivated Status</div>
              <div className="mt-1 font-medium text-foreground">{deactivated ? formatAuditDateTime(deactivated.created_at) : user.status === 'inactive' ? 'Not recorded yet' : 'Not deactivated'}</div>
              <div className="mt-1 text-xs text-muted-foreground">By {deactivated?.actor_name ?? (user.status === 'inactive' ? 'Not recorded yet' : '-')}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
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

function getBusinessLineClass(line: BusinessLine | null | '', role?: AppRole) {
  if (!line && (role === 'finance' || role === 'admin' || role === 'developer')) {
    return 'border-violet-200/70 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/12 dark:text-violet-200';
  }
  if (line === 'IM') {
    return 'border-cyan-200/70 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/12 dark:text-cyan-200';
  }
  if (line === 'TM') {
    return 'border-indigo-200/70 bg-indigo-50 text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-400/12 dark:text-indigo-200';
  }
  return 'border-border bg-muted/30 text-muted-foreground';
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
  if (actorRole === 'finance') return target.role === 'employee' || target.role === 'team_lead';
  if (actorRole === 'admin' || actorRole === 'developer') return target.role !== 'developer';
  return false;
}

function canToggleStatus(actorRole: AppRole, actorId: string, target: ManagedUser) {
  if (target.id === actorId) return false;
  return canEditUser(actorRole, target);
}

function canEditRole(actorRole: AppRole, actorId: string, target: ManagedUser) {
  if (target.id === actorId) return false;
  return actorRole !== 'finance' && (target.role === 'employee' || target.role === 'team_lead');
}

function canEditBusinessLine(actorRole: AppRole, target: ManagedUser) {
  if (actorRole === 'finance') return target.role === 'employee' || target.role === 'team_lead';
  if (actorRole === 'admin' || actorRole === 'developer') return target.role !== 'developer';
  return false;
}

function requiresBusinessLine(role: AppRole) {
  return role === 'employee' || role === 'team_lead';
}

function isOverallRole(role: AppRole) {
  return role === 'finance' || role === 'admin' || role === 'developer';
}

function canResetPasswordAction(actorRole: AppRole, actorId: string, target: ManagedUser) {
  if (target.id === actorId) return false;
  if (actorRole === 'finance') return target.role === 'employee' || target.role === 'team_lead';
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
  const [businessLineFilter, setBusinessLineFilter] = useState<BusinessLine | 'all'>('all');
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);
  const [confirmTransferId, setConfirmTransferId] = useState<string | null>(null);
  const [confirmRoleChange, setConfirmRoleChange] = useState(false);
  const [passwordReveal, setPasswordReveal] = useState<{ title: string; helper: string; name?: string; email?: string; temporaryPassword: string } | null>(null);
  const [auditPopover, setAuditPopover] = useState<{ rect: DOMRect; user: ManagedUser; section: 'created' | 'actions' } | null>(null);
  const [createForm, setCreateForm] = useState<CreateFormState>({
    full_name: '',
    email: '',
    role: 'employee',
    team_name: '',
    status: 'active',
    business_line: '',
  });
  const [editForm, setEditForm] = useState<EditFormState>({
    full_name: '',
    role: 'employee',
    team_name: '',
    status: 'active',
    business_line: '',
  });

  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  function resetUserFilters() {
    setSearchInput('');
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('all');
    setBusinessLineFilter('all');
  }

  useEffect(() => {
    if (loading || !user) return;
    if (!canManageUsers(user.role)) {
      router.replace(getDefaultDashboardPath(user.role));
    }
  }, [loading, router, user]);

  const loadUsers = useCallback(
    async (showRefresh = false) => {
      if (!user || !canManageUsers(user.role)) return;
      if (!showRefresh) setPageLoading(true);
      setError('');

      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (roleFilter !== 'all') params.set('role', roleFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (businessLineFilter !== 'all') params.set('business_line', businessLineFilter);

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
        if (!showRefresh) setPageLoading(false);
      }
    },
    [businessLineFilter, roleFilter, search, statusFilter, user]
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
  const transferUser = useMemo(
    () => (confirmTransferId ? users.find((entry) => entry.id === confirmTransferId) ?? null : null),
    [confirmTransferId, users]
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
      business_line: '',
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
      business_line: entry.business_line ?? '',
    });
  }

  async function handleCreateUser() {
    setActionError('');
    setActionLoading(true);

    try {
      const payload = {
        ...createForm,
        business_line: requiresBusinessLine(createForm.role) ? createForm.business_line : '',
      };

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

      if (requiresBusinessLine(editForm.role) && editForm.business_line) {
        payload.business_line = editForm.business_line;
      } else {
        payload.business_line = '';
      }

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


  async function handleTransferSubmissions(entry: ManagedUser) {
    setActionError('');
    setActionLoading(true);

    try {
      const res = await fetch(`/api/users/${entry.id}/transfer-open-submissions`, {
        method: 'POST',
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to transfer submissions.');
      }

      setConfirmTransferId(null);
      await loadUsers(true);
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to transfer submissions.');
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
          <FilterBar
            searchPlaceholder="Search by name or email"
            searchValue={searchInput}
            primaryFilters={[
              {
                key: 'role',
                label: 'Role',
                value: roleFilter,
                options: ROLE_FILTERS.map((entry) => ({ value: entry.value, label: entry.label })),
              },
              {
                key: 'status',
                label: 'Status',
                value: statusFilter,
                options: STATUS_OPTIONS.map((entry) => ({ value: entry.value, label: entry.label })),
              },
              {
                key: 'businessLine',
                label: 'Business Line',
                value: businessLineFilter,
                options: BUSINESS_LINE_FILTERS.map((entry) => ({ value: entry.value, label: entry.label })),
              },
            ]}
            advancedFilters={[]}
            onSearch={(value) => setSearchInput(value)}
            onPrimaryChange={(key, value) => {
              if (key === 'role') setRoleFilter((value || 'all') as AppRole | 'all');
              if (key === 'status') setStatusFilter((value || 'all') as UserStatus | 'all');
              if (key === 'businessLine') setBusinessLineFilter((value || 'all') as BusinessLine | 'all');
            }}
            onAdvancedChange={() => undefined}
            onReset={resetUserFilters}
          />

          {actionError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {actionError}
            </div>
          ) : null}

          {pageLoading ? (
            <WorkspaceLoader variant="section" label="Loading users..." description="Pulling the current dashboard user directory." />
          ) : error ? (
            <StatePanel variant="error" tone="danger" title="Unable to load users" description={error} />
          ) : users.length === 0 ? (
            <StatePanel variant="empty" title="No matching users" description="Adjust your filters or add a new dashboard user." icon={<CircleOff className="h-5 w-5" />} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
              <table className="min-w-full table-fixed border-collapse text-left">
                <thead className="bg-muted/10">
                  <tr className="border-b border-border/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <th className="border-r border-border/35 px-4 py-3">Name</th>
                    <th className="border-r border-border/35 px-4 py-3">Email</th>
                    <th className="border-r border-border/35 px-4 py-3">Role</th>
                    <th className="border-r border-border/35 px-4 py-3">Business Line</th>
                    <th className="border-r border-border/35 px-4 py-3">Status</th>
                    <th className="border-r border-border/35 px-4 py-3">Created At</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((entry) => {
                    const isSelf = entry.id === user.id;
                    const canEdit = canEditUser(user.role, entry);
                    const canToggle = canToggleStatus(user.role, user.id, entry);
                    const transferSummary = entry.transfer_summary ?? null;
                    const canTransferOwnership = ENABLE_TRANSFERRED_SUBMISSIONS
                      && entry.role === 'employee'
                      && entry.status === 'inactive'
                      && Boolean(transferSummary?.can_transfer);

                    return (
                      <tr key={entry.id} className="border-b border-border/50 bg-card text-[12px] text-foreground last:border-b-0">
                        <td className="border-b border-r border-border/35 px-4 py-2.5 align-top">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{entry.full_name}</span>
                            {isSelf ? (
                              <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                You
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="border-b border-r border-border/35 px-4 py-2.5 align-top text-[12px] text-muted-foreground">{entry.email}</td>
                        <td className="border-b border-r border-border/35 px-4 py-2.5 align-top">
                          <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${getRoleClass(entry.role)}`}>
                            {formatRoleLabel(entry.role)}
                          </span>
                        </td>
                      <td className="border-b border-r border-border/35 px-4 py-2.5 align-top">
                          <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${getBusinessLineClass(entry.business_line, entry.role)}`}>
                            {formatBusinessLineLabel(entry.business_line, entry.role)}
                          </span>
                        </td>
                        <td className="border-b border-r border-border/35 px-4 py-2.5 align-top">
                          <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStatusClass(entry.status)}`}>
                            {entry.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="border-b border-r border-border/35 px-4 py-2.5 align-top text-[12px] text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{formatDate(entry.created_at)}</span>
                            <button
                              type="button"
                              onClick={(event: ReactMouseEvent<HTMLButtonElement>) => setAuditPopover({ rect: event.currentTarget.getBoundingClientRect(), user: entry, section: 'created' })}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                              aria-label="Open user creation audit"
                              title="User audit"
                            >
                              <Info className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td className="border-b border-r border-border/35 px-4 py-2.5 align-top">
                          <div className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
                            {canEdit ? (
                              <button type="button" onClick={() => openEditModal(entry)} className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-card px-2.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60">
                                Edit
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">No access</span>
                            )}

                            {canToggle ? (
                              entry.status === 'active' ? (
                                <button type="button" onClick={() => setConfirmDeactivateId(entry.id)} className="inline-flex h-8 items-center justify-center rounded-lg border border-destructive/25 bg-card px-2.5 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-60">
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

                            {canTransferOwnership ? (
                              <button
                                type="button"
                                onClick={() => setConfirmTransferId(entry.id)}
                                className={compactButtonClass(false)}
                              >
                                Transfer Open Submissions
                              </button>
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

                            <button
                              type="button"
                              onClick={(event: ReactMouseEvent<HTMLButtonElement>) => setAuditPopover({ rect: event.currentTarget.getBoundingClientRect(), user: entry, section: 'actions' })}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                              aria-label="Open user action audit"
                              title="User audit"
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
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

      {auditPopover ? (
        <UserAuditPopover
          rect={auditPopover.rect}
          user={auditPopover.user}
          section={auditPopover.section}
          onClose={() => setAuditPopover(null)}
        />
      ) : null}

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
                  <SearchableSelect
                    value={createForm.role}
                    onChange={(next) => setCreateForm((current) => ({ ...current, role: next as AppRole }))}
                    options={creatableRoles.map((role) => ({ value: role, label: formatRoleLabel(role) }))}
                  />
                </label>

                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Status
                  <SearchableSelect
                    value={createForm.status}
                    onChange={(next) => setCreateForm((current) => ({ ...current, status: next as UserStatus }))}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' },
                    ]}
                  />
                </label>
              </div>

              <div className="grid gap-1.5 text-sm font-medium text-foreground">
                <label className="flex items-center justify-between gap-3">
                  <span>Business Line {requiresBusinessLine(createForm.role) ? <span className="text-danger">*</span> : null}</span>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {requiresBusinessLine(createForm.role) ? 'Required for employee/team lead' : 'Overall role'}
                  </span>
                </label>
                <SearchableSelect
                  value={createForm.business_line}
                  onChange={(next) =>
                    setCreateForm((current) => ({
                      ...current,
                      business_line: next as BusinessLine | '',
                    }))
                  }
                  options={[
                    { value: '', label: isOverallRole(createForm.role) ? 'Overall Access' : 'Unassigned' },
                    { value: 'IM', label: 'IM' },
                    { value: 'TM', label: 'TM' },
                  ]}
                  disabled={isOverallRole(createForm.role)}
                />
                <div className="text-xs text-muted-foreground">
                  {createForm.role === 'employee' || createForm.role === 'team_lead'
                    ? `${formatBusinessLineLabel(createForm.business_line, createForm.role)} ${formatRoleLabel(createForm.role)}`
                    : 'Overall access across both IM and TM business lines.'}
                </div>
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
              <button type="button" onClick={() => setCreateOpen(false)} className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-card px-2.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateUser()}
                className={compactButtonClass(true)}
                disabled={
                  actionLoading ||
                  !createForm.full_name.trim() ||
                  !createForm.email.trim() ||
                  (requiresBusinessLine(createForm.role) && !createForm.business_line)
                }
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
                  <SearchableSelect
                    value={editForm.status}
                    onChange={(next) => setEditForm((current) => ({ ...current, status: next as UserStatus }))}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive', disabled: editUser.id === user.id },
                    ]}
                  />
                </label>

                {canEditRole(user.role, user.id, editUser) ? (
                  <div className="grid gap-1.5 text-sm font-medium text-foreground">
                    <label className="grid gap-1.5">
                      <span>Role</span>
                      <SearchableSelect
                        value={editForm.role}
                        onChange={(next) => setEditForm((current) => ({ ...current, role: next as AppRole }))}
                        options={getEditableRoleOptions(user.role, editUser.role).map((role) => ({ value: role, label: formatRoleLabel(role) }))}
                      />
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Admin and developer can promote or demote between Employee and Team Lead only. Finance and Admin roles stay locked here.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-1.5 text-sm font-medium text-foreground">
                    <span>Role</span>
                    <div className="flex h-10 items-center rounded-xl border border-border bg-muted/20 px-3 text-sm text-muted-foreground">
                      {formatRoleLabel(editUser.role)}
                    </div>
                  </div>
                )}
              </div>

              {canEditBusinessLine(user.role, editUser) ? (
                <div className="grid gap-1.5 text-sm font-medium text-foreground">
                  <label className="flex items-center justify-between gap-3">
                    <span>Business Line</span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {requiresBusinessLine(editForm.role) ? 'Required for employee/team lead' : 'Overall role'}
                    </span>
                  </label>
                  <SearchableSelect
                    value={editForm.business_line}
                    onChange={(next) =>
                      setEditForm((current) => ({
                        ...current,
                        business_line: next as BusinessLine | '',
                      }))
                    }
                    options={[
                      { value: '', label: isOverallRole(editForm.role) ? 'Overall Access' : 'Unassigned' },
                      { value: 'IM', label: 'IM' },
                      { value: 'TM', label: 'TM' },
                    ]}
                    disabled={isOverallRole(editForm.role)}
                  />
                </div>
              ) : (
                <div className="grid gap-1.5 text-sm font-medium text-foreground">
                  <span>Business Line</span>
                  <div className="flex h-10 items-center rounded-xl border border-border bg-muted/20 px-3 text-sm text-muted-foreground">
                    {formatBusinessLineLabel(editUser.business_line, editUser.role)}
                  </div>
                </div>
              )}

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
              <button type="button" onClick={() => setEditUserId(null)} className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-card px-2.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleEditSubmit()}
                className={compactButtonClass(true)}
                disabled={
                  actionLoading ||
                  !editForm.full_name.trim() ||
                  (requiresBusinessLine(editForm.role) && !editForm.business_line)
                }
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
              <button type="button" onClick={() => setConfirmRoleChange(false)} className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-card px-2.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60">
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
              <button type="button" onClick={() => setConfirmDeactivateId(null)} className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-card px-2.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60">
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


      {transferUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">Transfer open submissions?</h2>
              <p className="mt-1 text-sm text-muted-foreground">This transfers only open submissions to the employee&apos;s mapped active team lead. Historical submitter identity stays unchanged.</p>
            </div>
            <div className="grid gap-3 px-5 py-5 text-sm text-foreground">
              <p><span className="font-semibold">Employee:</span> {transferUser.full_name}</p>
              <p><span className="font-semibold">Mapped team lead:</span> {transferUser.transfer_summary?.mapped_team_lead_name ?? '—'}</p>
              <p><span className="font-semibold">Open submissions:</span> {transferUser.transfer_summary?.open_submission_count ?? 0}</p>
              {transferUser.transfer_summary?.blocked_reason ? (
                <p className="text-destructive">{transferUser.transfer_summary.blocked_reason}</p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button type="button" onClick={() => setConfirmTransferId(null)} className={compactButtonClass(false)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleTransferSubmissions(transferUser)}
                className={compactButtonClass(true)}
                disabled={actionLoading || !transferUser.transfer_summary?.can_transfer}
              >
                Transfer Ownership
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
              <button type="button" onClick={() => setConfirmResetId(null)} className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-card px-2.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60">
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

