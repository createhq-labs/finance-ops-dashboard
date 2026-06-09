"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, CheckCircle2, CircleOff, Database, PencilLine, RefreshCw, Tag, TriangleAlert, UserRound, X } from 'lucide-react';
import { KpiCard } from '../../../../components/dashboard/kpi-card';
import { PageHeader } from '../../../../components/dashboard/page-header';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { StatePanel } from '../../../../components/dashboard/state-panel';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { canViewMasterData, getDefaultDashboardPath } from '../../../../lib/client/dashboard-access';

type ReviewStatus = 'pending' | 'approved' | 'rejected';
type ReviewType = 'agency' | 'brand' | 'creator';
type StatusFilter = ReviewStatus | 'all';
type TypeFilter = ReviewType | 'all';

type MasterDataReviewItem = {
  id: string;
  type: ReviewType;
  submitted_value: string;
  normalized_value: string;
  submitted_trade_name: string | null;
  status: ReviewStatus;
  created_from_submission_id: string | null;
  submitted_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  last_edited_by: string | null;
  last_edited_at: string | null;
  edit_reason: string | null;
  created_at: string;
  updated_at: string;
  submitted_by_name: string | null;
  submitted_by_email: string | null;
  reviewed_by_name: string | null;
  reviewed_by_email: string | null;
  last_edited_by_name: string | null;
  last_edited_by_email: string | null;
  submission_pi: string | null;
};

type ApiResponse = {
  success: boolean;
  items?: MasterDataReviewItem[];
  summary?: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  error?: string;
};

type EditFormState = {
  submitted_value: string;
  submitted_trade_name: string;
  edit_reason: string;
};

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Ignored' },
];

const TYPE_FILTERS: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all', label: 'All Types' },
  { value: 'agency', label: 'Agency' },
  { value: 'brand', label: 'Brand' },
  { value: 'creator', label: 'Creator' },
];

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTypeLabel(value: ReviewType) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatStatusLabel(value: ReviewStatus) {
  return value === 'rejected' ? 'Ignored' : value.charAt(0).toUpperCase() + value.slice(1);
}

function getStatusBadgeClass(status: ReviewStatus) {
  if (status === 'approved') {
    return 'border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/14 dark:text-emerald-100';
  }

  if (status === 'rejected') {
    return 'border-rose-200/70 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-400/14 dark:text-rose-100';
  }

  return 'border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/14 dark:text-amber-100';
}

function getTypeBadgeClass(type: ReviewType) {
  if (type === 'agency') {
    return 'border-sky-200/70 bg-sky-50 text-sky-700 dark:border-sky-400/25 dark:bg-sky-400/14 dark:text-sky-100';
  }

  if (type === 'brand') {
    return 'border-violet-200/70 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-400/14 dark:text-violet-100';
  }

  return 'border-teal-200/70 bg-teal-50 text-teal-700 dark:border-teal-400/25 dark:bg-teal-400/14 dark:text-teal-100';
}

function getTypeIcon(type: ReviewType) {
  if (type === 'agency') return <Building2 className="h-3.5 w-3.5" />;
  if (type === 'brand') return <Tag className="h-3.5 w-3.5" />;
  return <UserRound className="h-3.5 w-3.5" />;
}

function compactButtonClass(primary = false) {
  return primary
    ? 'inline-flex items-center justify-center rounded-lg bg-[linear-gradient(135deg,var(--primary-strong),var(--accent))] px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60'
    : 'inline-flex items-center justify-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors duration-150 hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60';
}

function ignoreButtonClass() {
  return 'inline-flex items-center justify-center rounded-lg border border-destructive/25 bg-card px-3 py-1.5 text-xs font-semibold text-destructive transition-colors duration-150 hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-60';
}

function getStatusFilterCount(value: StatusFilter, summary: { total: number; pending: number; approved: number; rejected: number }) {
  if (value === 'all') return summary.total;
  if (value === 'pending') return summary.pending;
  if (value === 'approved') return summary.approved;
  return summary.rejected;
}

function getSubmitterLabel(item: MasterDataReviewItem) {
  return item.submitted_by_name || item.submitted_by_email || item.submitted_by;
}

function getReviewerLabel(item: MasterDataReviewItem) {
  return item.reviewed_by_name || item.reviewed_by_email || item.reviewed_by || '—';
}

function getEditorLabel(item: MasterDataReviewItem) {
  return item.last_edited_by_name || item.last_edited_by_email || item.last_edited_by || '—';
}

export default function MasterDataPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewId = searchParams.get('review_id');
  const { user, loading } = useDashboardSession();

  const [items, setItems] = useState<MasterDataReviewItem[]>([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(reviewId ? 'all' : 'pending');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmApproveId, setConfirmApproveId] = useState<string | null>(null);
  const [confirmIgnoreId, setConfirmIgnoreId] = useState<string | null>(null);
  const [ignoreReasons, setIgnoreReasons] = useState<Record<string, string>>({});
  const [highlightedId, setHighlightedId] = useState<string | null>(reviewId);
  const [viewItemId, setViewItemId] = useState<string | null>(null);
  const [confirmEditId, setConfirmEditId] = useState<string | null>(null);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    submitted_value: '',
    submitted_trade_name: '',
    edit_reason: '',
  });
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  useEffect(() => {
    if (loading || !user) return;
    if (!canViewMasterData(user.role)) {
      router.replace(getDefaultDashboardPath(user.role));
    }
  }, [loading, router, user]);

  const loadReviews = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setPageLoading(true);
    setError('');

    try {
      const res = await fetch('/api/master-data/reviews', { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as ApiResponse;

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load master data reviews.');
      }

      setItems(Array.isArray(json.items) ? json.items : []);
      if (json.summary) {
        setSummary(json.summary);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load master data reviews.');
    } finally {
      if (showRefresh) setRefreshing(false);
      else setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || !canViewMasterData(user.role)) return;
    void loadReviews(false);
  }, [loadReviews, user]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      return true;
    });
  }, [items, statusFilter, typeFilter]);

  const availableTypes = useMemo(() => {
    const pool = items.filter((item) => statusFilter === 'all' || item.status === statusFilter);
    return new Set(pool.map((item) => item.type));
  }, [items, statusFilter]);

  const viewItem = useMemo(
    () => (viewItemId ? items.find((item) => item.id === viewItemId) ?? null : null),
    [items, viewItemId]
  );

  const confirmEditItem = useMemo(
    () => (confirmEditId ? items.find((item) => item.id === confirmEditId) ?? null : null),
    [confirmEditId, items]
  );

  const editItem = useMemo(
    () => (editItemId ? items.find((item) => item.id === editItemId) ?? null : null),
    [editItemId, items]
  );

  useEffect(() => {
    if (!reviewId || filteredItems.length === 0) return;
    const match = filteredItems.find((item) => item.id === reviewId);
    if (!match) return;

    setHighlightedId(reviewId);
    const row = rowRefs.current[reviewId];
    if (row) {
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [filteredItems, reviewId]);

  async function handleApprove(id: string) {
    setActionError('');
    setActionLoadingId(id);

    try {
      const res = await fetch(`/api/master-data/reviews/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to approve review.');
      }

      setConfirmApproveId(null);
      await loadReviews(true);
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to approve review.');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleIgnore(id: string) {
    setActionError('');
    setActionLoadingId(id);

    try {
      const res = await fetch(`/api/master-data/reviews/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: ignoreReasons[id] || '' }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to ignore review.');
      }

      setConfirmIgnoreId(null);
      setIgnoreReasons((current) => ({ ...current, [id]: '' }));
      await loadReviews(true);
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to ignore review.');
    } finally {
      setActionLoadingId(null);
    }
  }

  function beginEdit(item: MasterDataReviewItem) {
    setConfirmApproveId(null);
    setConfirmIgnoreId(null);
    setViewItemId(null);
    setActionError('');
    setConfirmEditId(item.id);
    setEditForm({
      submitted_value: item.submitted_value,
      submitted_trade_name: item.submitted_trade_name ?? '',
      edit_reason: '',
    });
  }

  function continueEditing() {
    if (!confirmEditItem) return;
    if (!editForm.edit_reason.trim()) {
      setActionError('Edit reason is required before continuing.');
      return;
    }

    setActionError('');
    setConfirmEditId(null);
    setEditItemId(confirmEditItem.id);
  }

  async function handleSaveEdit() {
    if (!editItem) return;
    setActionError('');
    setActionLoadingId(editItem.id);

    try {
      const res = await fetch(`/api/master-data/reviews/${editItem.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submitted_value: editForm.submitted_value,
          submitted_trade_name: editItem.type === 'creator' ? null : editForm.submitted_trade_name,
          edit_reason: editForm.edit_reason,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save master data edit.');
      }

      setEditItemId(null);
      await loadReviews(true);
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to save master data edit.');
    } finally {
      setActionLoadingId(null);
    }
  }

  if (loading || !user || !canViewMasterData(user.role)) {
    return null;
  }

  return (
    <>
      <div className="grid gap-4">
      <PageHeader
        className="gap-3 border-b-0 pb-1"
        title="Master Data Review"
        description="Review new dropdown values from invoice intake and promote clean entries into master source tables."
        actions={(
          <button
            type="button"
            onClick={() => void loadReviews(true)}
            className={compactButtonClass(false)}
            disabled={refreshing || pageLoading}
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      />

        <div className="grid gap-3 md:grid-cols-3">
          <KpiCard title="Pending Review" value={String(summary.pending)} hint="Awaiting finance/admin review" variant="warning" compact />
          <KpiCard title="Approved Values" value={String(summary.approved)} hint="Promoted into master data source" variant="teal" compact />
          <KpiCard title="Ignored Requests" value={String(summary.rejected)} hint="Skipped during review" variant="danger" compact />
        </div>

        <SectionCard
          title="Review Queue"
          description="Filter pending, approved, and ignored values across agency, brand, and creator requests."
          actions={(
            <span className="rounded-full border border-sky-300/55 bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/18 dark:text-sky-100">
              {filteredItems.length} visible
            </span>
          )}
          contentClassName="grid gap-4"
        >
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((filter) => {
                const active = statusFilter === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setStatusFilter(filter.value)}
                    className={[
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150',
                      active
                        ? 'border-sky-300/70 bg-sky-100/95 text-sky-950 shadow-[0_4px_12px_rgba(56,189,248,0.12)] dark:border-sky-300/30 dark:bg-sky-400/16 dark:text-sky-50'
                        : 'border-sky-200/60 bg-sky-50/65 text-sky-800 hover:border-sky-300/45 hover:bg-sky-100/85 hover:text-sky-900 dark:border-sky-400/18 dark:bg-sky-400/8 dark:text-sky-100 dark:hover:bg-sky-400/14',
                    ].join(' ')}
                  >
                    {filter.label}
                    <span
                      className={[
                        'inline-flex min-w-5 items-center justify-center rounded-full border px-1.5 py-0.5 text-[11px] font-semibold',
                        active
                          ? 'border-blue-900/10 bg-[color:var(--primary-strong)] text-primary-foreground dark:border-sky-200/10 dark:bg-sky-200/85 dark:text-slate-950'
                          : 'border-sky-200/70 bg-sky-100 text-sky-700 dark:border-sky-400/22 dark:bg-sky-400/14 dark:text-sky-100',
                      ].join(' ')}
                    >
                      {getStatusFilterCount(filter.value, summary)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              {TYPE_FILTERS.filter((filter) => filter.value === 'all' || availableTypes.has(filter.value)).map((filter) => {
                const active = typeFilter === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setTypeFilter(filter.value)}
                    className={[
                      'inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150',
                      active
                        ? 'border-sky-300/70 bg-sky-100/95 text-sky-950 shadow-[0_4px_12px_rgba(56,189,248,0.12)] dark:border-sky-300/30 dark:bg-sky-400/16 dark:text-sky-50'
                        : 'border-sky-200/60 bg-sky-50/65 text-sky-800 hover:border-sky-300/45 hover:bg-sky-100/85 hover:text-sky-900 dark:border-sky-400/18 dark:bg-sky-400/8 dark:text-sky-100 dark:hover:bg-sky-400/14',
                    ].join(' ')}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            {actionError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {actionError}
              </div>
            ) : null}

            {pageLoading ? (
              <StatePanel variant="loading" title="Loading reviews" description="Pulling the current master data review queue." icon={<Database className="h-5 w-5" />} />
            ) : error ? (
              <StatePanel variant="error" tone="danger" title="Unable to load reviews" description={error} />
            ) : filteredItems.length === 0 ? (
              <StatePanel variant="empty" title="No matching reviews" description="Adjust the filters or wait for new invoice submissions to create dropdown review requests." icon={<CircleOff className="h-5 w-5" />} />
            ) : (
              <div className="max-h-[620px] overflow-x-auto overflow-y-auto rounded-xl border border-border/50">
                <table className="min-w-full table-fixed border-collapse text-left">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Submitted Value</th>
                      <th className="px-3 py-2">Trade Name</th>
                      <th className="px-3 py-2">Requested By</th>
                      <th className="px-3 py-2"><span className="inline-block leading-4">Source PI /<br />Submission</span></th>
                      <th className="px-3 py-2">Created At</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const isHighlighted = highlightedId === item.id;
                      const isPending = item.status === 'pending';
                      const isApproved = item.status === 'approved';
                      const isBusy = actionLoadingId === item.id;
                      const sourceLabel = item.submission_pi || (item.created_from_submission_id ? item.created_from_submission_id.slice(0, 8) : '—');

                      return (
                        <tr
                          key={item.id}
                          ref={(node) => {
                            rowRefs.current[item.id] = node;
                          }}
                          className={[
                            'border-b border-border/50 align-top text-sm text-foreground',
                            isHighlighted ? 'bg-primary/5 ring-1 ring-primary/20' : 'bg-card',
                          ].join(' ')}
                        >
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getTypeBadgeClass(item.type)}`}>
                              {getTypeIcon(item.type)}
                              {formatTypeLabel(item.type)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-[15px] font-semibold text-foreground">{item.submitted_value}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{item.normalized_value}</div>
                          </td>
                          <td className="px-3 py-3 text-[13px] text-muted-foreground">{item.submitted_trade_name || '—'}</td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-foreground">{getSubmitterLabel(item)}</div>
                            {item.submitted_by_email && item.submitted_by_name ? (
                              <div className="mt-1 text-xs text-muted-foreground">{item.submitted_by_email}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-foreground">{sourceLabel}</div>
                            {item.created_from_submission_id ? (
                              <div className="mt-1 text-xs text-muted-foreground">{item.created_from_submission_id.slice(0, 8)}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{formatDateTime(item.created_at)}</td>
                          <td className="px-3 py-3">
                            {isApproved ? (
                              <div className="grid gap-0.5">
                                <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium ${getStatusBadgeClass(item.status)}`}>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Approved
                                </span>
                                <span className="text-[11px] text-emerald-700/80 dark:text-emerald-200/80">
                                  Promoted to master data source
                                </span>
                              </div>
                            ) : (
                              <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${getStatusBadgeClass(item.status)}`}>
                                {formatStatusLabel(item.status)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {isPending ? (
                              <div className="grid gap-2">
                                {confirmApproveId === item.id ? (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void handleApprove(item.id)}
                                      disabled={isBusy}
                                      className={compactButtonClass(true)}
                                    >
                                      Confirm Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmApproveId(null)}
                                      disabled={isBusy}
                                      className={compactButtonClass(false)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmIgnoreId(null);
                                      setConfirmApproveId(item.id);
                                    }}
                                    disabled={isBusy}
                                    className={compactButtonClass(true)}
                                  >
                                    Approve
                                  </button>
                                )}

                                {confirmIgnoreId === item.id ? (
                                  <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-3">
                                    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                                      Ignore reason (optional)
                                      <input
                                        value={ignoreReasons[item.id] ?? ''}
                                        onChange={(event) =>
                                          setIgnoreReasons((current) => ({
                                            ...current,
                                            [item.id]: event.target.value,
                                          }))
                                        }
                                        className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                                        placeholder="Ignored by finance"
                                      />
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => void handleIgnore(item.id)}
                                        disabled={isBusy}
                                        className={ignoreButtonClass()}
                                      >
                                        Confirm Ignore
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmIgnoreId(null)}
                                        disabled={isBusy}
                                        className={compactButtonClass(false)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmApproveId(null);
                                      setConfirmIgnoreId(item.id);
                                    }}
                                    disabled={isBusy}
                                    className={ignoreButtonClass()}
                                  >
                                    Ignore
                                  </button>
                                )}
                              </div>
                            ) : isApproved ? (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setViewItemId(item.id)}
                                  className={compactButtonClass(false)}
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => beginEdit(item)}
                                  className={compactButtonClass(false)}
                                >
                                  Edit
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setViewItemId(item.id)}
                                className="inline-flex items-center justify-center rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors duration-150 hover:bg-muted/35"
                              >
                                View
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
          </div>
        </SectionCard>
      </div>

      {viewItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Master Data Review Details</h2>
                <p className="mt-1 text-sm text-muted-foreground">Audit timeline for this master data record.</p>
              </div>
              <button type="button" onClick={() => setViewItemId(null)} className="rounded-lg border border-destructive/20 p-2 text-destructive transition-colors hover:bg-destructive/5 hover:text-destructive/80">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 px-5 py-4 text-sm text-foreground">
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(viewItem.status)}`}>
                  {viewItem.status === 'approved' ? 'Approved' : formatStatusLabel(viewItem.status)}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getTypeBadgeClass(viewItem.type)}`}>
                  {getTypeIcon(viewItem.type)}
                  {formatTypeLabel(viewItem.type)}
                </span>
                {viewItem.last_edited_at ? (
                  <span className="inline-flex rounded-full border border-sky-200/70 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
                    Edited Once
                  </span>
                ) : null}
              </div>

              <div className="grid gap-2.5 md:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-card p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Current Value</div>
                  <div className="mt-1.5 text-sm font-semibold text-foreground">{viewItem.submitted_value}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-card p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Current Trade Name</div>
                  <div className="mt-2 text-sm font-semibold text-foreground">{viewItem.submitted_trade_name || '—'}</div>
                </div>
              </div>

              <div className="grid gap-2 rounded-xl border border-border/70 bg-card p-2.5">
                {viewItem.status === 'approved' ? (
                  <div className="relative pl-7">
                    <span className="absolute left-0 top-0 flex h-5 w-5 items-center justify-center rounded-full border border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                    <div className="text-sm font-semibold text-foreground">Approved</div>
                    <div className="mt-0.5 text-sm text-foreground">{getReviewerLabel(viewItem)}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(viewItem.reviewed_at)}</div>
                  </div>
                ) : null}

                {viewItem.last_edited_at ? (
                  <div className="relative pl-7">
                    <span className="absolute left-0 top-0 flex h-5 w-5 items-center justify-center rounded-full border border-sky-200/70 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
                      <PencilLine className="h-3.5 w-3.5" />
                    </span>
                    <div className="text-sm font-semibold text-foreground">Last Edited</div>
                    <div className="mt-0.5 text-sm text-foreground">{getEditorLabel(viewItem)}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(viewItem.last_edited_at)}</div>
                    <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Reason</div>
                    <div className="mt-0.5 text-sm text-foreground">{viewItem.edit_reason || '—'}</div>
                  </div>
                ) : null}
              </div>

              {viewItem.status === 'rejected' ? (
                <div className="rounded-xl border border-rose-200/70 bg-rose-50/60 p-3 dark:border-rose-400/20 dark:bg-rose-400/10">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Ignore Reason</div>
                  <div className="mt-1 text-sm text-foreground">{viewItem.rejection_reason || 'Ignored by finance'}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {confirmEditItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-xl">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">Edit Approved Master Data</h2>
            </div>
            <div className="grid gap-4 px-5 py-5">
              <div className="rounded-2xl border border-destructive/20 border-l-4 border-l-destructive bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-destructive">
                    <TriangleAlert className="h-4.5 w-4.5" />
                  </span>
                  <div className="grid gap-2">
                    <div className="text-sm font-semibold text-foreground">Editing approved master data:</div>
                    <ul className="grid gap-1 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-destructive" />Already available in employee dropdowns</li>
                      <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-destructive" />Changes affect future selections</li>
                      <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-destructive" />Existing submissions will not be modified</li>
                      <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-destructive" />Edit reason is required</li>
                    </ul>
                  </div>
                </div>
              </div>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Edit Reason
                <textarea
                  value={editForm.edit_reason}
                  onChange={(event) => setEditForm((current) => ({ ...current, edit_reason: event.target.value }))}
                  className="min-h-24 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  placeholder="Example: Fixed spelling, removed test value, standardized naming..."
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button type="button" onClick={() => setConfirmEditId(null)} className={compactButtonClass(false)}>
                Cancel
              </button>
              <button type="button" onClick={continueEditing} className={compactButtonClass(true)} disabled={!editForm.edit_reason.trim()}>
                Continue Editing
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl max-h-[calc(100vh-2rem)]">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Edit Approved Master Data</h2>
                <p className="mt-1 text-sm text-muted-foreground">Update the approved source value safely. Historical submissions will remain unchanged.</p>
              </div>
              <button type="button" onClick={() => setEditItemId(null)} className="rounded-lg border border-destructive/20 bg-card p-2 text-destructive transition-colors hover:bg-destructive/5 hover:text-destructive/80">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid auto-rows-max content-start flex-1 gap-4 overflow-y-auto px-5 py-5">
              <div className="grid items-start gap-2 md:grid-cols-3">
                <div className="self-start rounded-lg border border-sky-200/70 bg-sky-50/70 p-2.5 text-sm dark:border-sky-400/20 dark:bg-sky-400/10 min-h-[72px]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Type</div>
                  <div className="mt-1 text-[15px] font-semibold leading-5 text-sky-900 dark:text-sky-100">{formatTypeLabel(editItem.type)}</div>
                </div>
                <div className="self-start rounded-lg border border-emerald-200/70 bg-emerald-50/60 p-2.5 text-sm dark:border-emerald-400/20 dark:bg-emerald-400/10 min-h-[72px]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Current Value</div>
                  <div className="mt-1 text-[15px] font-semibold leading-5 text-emerald-900 dark:text-emerald-100">{editItem.submitted_value}</div>
                </div>
                <div className="self-start rounded-lg border border-violet-200/70 bg-violet-50/60 p-2.5 text-sm dark:border-violet-400/20 dark:bg-violet-400/10 min-h-[72px]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Current Trade Name</div>
                  <div className="mt-1 text-[15px] font-semibold leading-5 text-violet-900 dark:text-violet-100">{editItem.submitted_trade_name || '—'}</div>
                </div>
              </div>

              <div className="grid gap-4">
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Type New Value
                  <input
                    value={editForm.submitted_value}
                    onChange={(event) => setEditForm((current) => ({ ...current, submitted_value: event.target.value }))}
                    className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                    placeholder="Enter corrected value"
                  />
                </label>

                {editItem.type !== 'creator' ? (
                  <label className="grid gap-2 text-sm font-medium text-foreground">
                    New Trade Name
                    <input
                      value={editForm.submitted_trade_name}
                      onChange={(event) => setEditForm((current) => ({ ...current, submitted_trade_name: event.target.value }))}
                      className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      placeholder="Optional trade name"
                    />
                  </label>
                ) : null}

                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Edit Reason
                  <textarea
                    value={editForm.edit_reason}
                    onChange={(event) => setEditForm((current) => ({ ...current, edit_reason: event.target.value }))}
                    className="min-h-20 rounded-xl border border-primary/15 bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                    placeholder="Example: Fixed spelling, removed test value, standardized naming..."
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button type="button" onClick={() => setEditItemId(null)} className={compactButtonClass(false)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                className={compactButtonClass(true)}
                disabled={actionLoadingId === editItem.id || !editForm.submitted_value.trim() || !editForm.edit_reason.trim()}
              >
                <PencilLine className="mr-2 h-3.5 w-3.5" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}




