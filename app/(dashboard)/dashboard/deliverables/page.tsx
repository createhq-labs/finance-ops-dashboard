"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, PencilLine, Plus, RefreshCw, ShieldOff, X } from 'lucide-react';
import { KpiCard } from '../../../../components/dashboard/kpi-card';
import { PageHeader } from '../../../../components/dashboard/page-header';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { StatePanel } from '../../../../components/dashboard/state-panel';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { WorkspaceLoader } from '../../../../components/layout/workspace-loader';
import { canManageDeliverables, getDefaultDashboardPath } from '../../../../lib/client/dashboard-access';

type DeliverableLine = 'IM' | 'TM' | null;
type DeliverableLineValue = 'IM' | 'TM' | '';

type DeliverableItem = {
  id: string;
  name: string;
  business_line: DeliverableLine;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type DeliverablesResponse = {
  success: boolean;
  items?: DeliverableItem[];
  error?: string;
};

type FormState = {
  name: string;
  business_line: DeliverableLineValue;
  is_active: boolean;
};

type DeliverableLineFilter = 'all' | 'IM' | 'TM' | 'unassigned';

const BUSINESS_LINE_OPTIONS: Array<{ value: DeliverableLineValue; label: string }> = [
  { value: '', label: 'Unassigned' },
  { value: 'IM', label: 'IM' },
  { value: 'TM', label: 'TM' },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function lineLabel(value: DeliverableLine | '') {
  if (value === 'IM') return 'IM';
  if (value === 'TM') return 'TM';
  return 'Unassigned';
}

function compactButtonClass(primary = false) {
  return primary
    ? 'inline-flex items-center justify-center rounded-lg bg-[linear-gradient(135deg,var(--primary-strong),var(--accent))] px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60'
    : 'inline-flex items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60';
}

function getBadgeClass(active: boolean, line: DeliverableLine) {
  if (active) {
    return 'border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/14 dark:text-emerald-100';
  }

  if (line === 'IM') {
    return 'border-sky-200/70 bg-sky-50 text-sky-700 dark:border-sky-400/25 dark:bg-sky-400/14 dark:text-sky-100';
  }

  if (line === 'TM') {
    return 'border-violet-200/70 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-400/14 dark:text-violet-100';
  }

  return 'border-border bg-muted/40 text-muted-foreground';
}

export default function DeliverablesPage() {
  const { user, loading } = useDashboardSession();
  const [items, setItems] = useState<DeliverableItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [search, setSearch] = useState('');
  const [lineFilter, setLineFilter] = useState<DeliverableLineFilter>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DeliverableItem | null>(null);
  const [form, setForm] = useState<FormState>({ name: '', business_line: '', is_active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (!canManageDeliverables(user.role)) {
      window.location.replace(getDefaultDashboardPath(user.role));
    }
  }, [loading, user]);

  const loadDeliverables = useCallback(async (showRefresh = false) => {
    if (!user || !canManageDeliverables(user.role)) return;
    if (showRefresh) setRefreshing(true);
    else setPageLoading(true);
    setError('');

    try {
      const res = await fetch('/api/deliverables', { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as DeliverablesResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load deliverables.');
      }

      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load deliverables.');
    } finally {
      if (showRefresh) setRefreshing(false);
      else setPageLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !canManageDeliverables(user.role)) return;
    void loadDeliverables(false);
  }, [loadDeliverables, user]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (lineFilter === 'IM' || lineFilter === 'TM') {
        if (item.business_line !== lineFilter) return false;
      }
      if (lineFilter === 'unassigned' && item.business_line !== null) return false;
      if (statusFilter !== 'all' && (statusFilter === 'active' ? !item.is_active : item.is_active)) return false;
      if (query) {
        const haystack = `${item.name} ${item.business_line ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [items, lineFilter, search, statusFilter]);

  const stats = useMemo(() => {
    const active = items.filter((item) => item.is_active).length;
    const inactive = items.length - active;
    const im = items.filter((item) => item.business_line === 'IM').length;
    const tm = items.filter((item) => item.business_line === 'TM').length;
    return { active, inactive, im, tm };
  }, [items]);

  function openCreateModal() {
    setActionError('');
    setEditingItem(null);
    setForm({ name: '', business_line: '', is_active: true });
    setModalOpen(true);
  }

  function openEditModal(item: DeliverableItem) {
    setActionError('');
    setEditingItem(item);
    setForm({
      name: item.name,
      business_line: item.business_line ?? '',
      is_active: item.is_active,
    });
    setModalOpen(true);
  }

  async function saveDeliverable() {
    setSaving(true);
    setActionError('');

    try {
      const payload = {
        name: form.name,
        business_line: form.business_line || null,
        is_active: form.is_active,
      };

      const res = await fetch(editingItem ? `/api/deliverables/${editingItem.id}` : '/api/deliverables', {
        method: editingItem ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save deliverable.');
      }

      setModalOpen(false);
      await loadDeliverables(true);
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to save deliverable.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: DeliverableItem) {
    setActionError('');
    try {
      const res = await fetch(`/api/deliverables/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !item.is_active }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update deliverable.');
      }

      await loadDeliverables(true);
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to update deliverable.');
    }
  }

  if (loading || !user || !canManageDeliverables(user.role)) return null;
  if (pageLoading) {
    return <WorkspaceLoader variant="section" label="Loading deliverables..." />;
  }

  return (
    <>
      <div className="grid gap-4">
        <PageHeader
          className="gap-3 border-b-0 pb-1"
          title="Deliverables"
          description="Manage reusable deliverables that feed the intake form dropdowns."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadDeliverables(true)}
                className={compactButtonClass(false)}
                disabled={refreshing}
              >
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button type="button" onClick={openCreateModal} className={compactButtonClass(true)}>
                <Plus className="mr-2 h-3.5 w-3.5" />
                Add Deliverable
              </button>
            </div>
          }
        />

        <div className="grid gap-3 md:grid-cols-4">
          <KpiCard title="Total Deliverables" value={String(items.length)} hint="Available in form masters" variant="navy" compact />
          <KpiCard title="Active" value={String(stats.active)} hint="Shown to users" variant="teal" compact />
          <KpiCard title="Inactive" value={String(stats.inactive)} hint="Hidden from dropdowns" variant="danger" compact />
          <KpiCard title="IM / TM Split" value={`${stats.im} / ${stats.tm}`} hint="Business line assignment" variant="violet" compact />
        </div>

        <SectionCard title="Deliverables Directory" description="Search, edit, and deactivate reusable form options." contentClassName="grid gap-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.8fr)_180px_180px]">
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Search
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or line"
                className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              />
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Line
              <select
                value={lineFilter}
                onChange={(event) => setLineFilter(event.target.value as DeliverableLineFilter)}
                className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              >
                <option value="all">All Lines</option>
                <option value="IM">IM</option>
                <option value="TM">TM</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          {actionError ? <StatePanel tone="danger">{actionError}</StatePanel> : null}
          {error ? <StatePanel tone="danger">{error}</StatePanel> : null}

          <div className="overflow-hidden rounded-2xl border border-border/60">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-[1] bg-app">
                <tr>
                  {['Name', 'Business Line', 'Status', 'Updated', 'Actions'].map((heading) => (
                    <th key={heading} className="border-b border-border/60 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-sm text-muted-foreground">
                      No deliverables found.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="align-top hover:bg-muted/20">
                      <td className="border-b border-border/50 px-4 py-3">
                        <div className="text-sm font-medium text-foreground">{item.name}</div>
                      </td>
                      <td className="border-b border-border/50 px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getBadgeClass(item.is_active, item.business_line)}`}>
                          {lineLabel(item.business_line ?? '')}
                        </span>
                      </td>
                      <td className="border-b border-border/50 px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${item.is_active ? 'border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/14 dark:text-emerald-100' : 'border-border bg-muted/40 text-muted-foreground'}`}>
                          {item.is_active ? (
                            <><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Active</>
                          ) : (
                            <><ShieldOff className="mr-1 h-3.5 w-3.5" /> Inactive</>
                          )}
                        </span>
                      </td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(item.updated_at)}
                      </td>
                      <td className="border-b border-border/50 px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className={compactButtonClass(false)} onClick={() => openEditModal(item)}>
                            <PencilLine className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className={item.is_active ? compactButtonClass(false) : compactButtonClass(true)}
                            onClick={() => void toggleActive(item)}
                          >
                            {item.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{editingItem ? 'Edit Deliverable' : 'Add Deliverable'}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Update the reusable option used by the invoice intake form.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 px-5 py-5">
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Name
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                />
              </label>

              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Business Line
                <select
                  value={form.business_line}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      business_line: event.target.value as DeliverableLineValue,
                    }))
                  }
                  className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                >
                  {BUSINESS_LINE_OPTIONS.map((option) => (
                    <option key={String(option.value)} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                />
                Active
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button type="button" onClick={() => setModalOpen(false)} className={compactButtonClass(false)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveDeliverable()}
                className={compactButtonClass(true)}
                disabled={saving || !form.name.trim()}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
