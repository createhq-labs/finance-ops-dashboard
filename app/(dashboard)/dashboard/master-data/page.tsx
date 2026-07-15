"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, CheckCircle2, CircleOff, PencilLine, RefreshCw, Tag, TriangleAlert, UserRound, X } from 'lucide-react';
import { KpiCard } from '../../../../components/dashboard/kpi-card';
import { PageHeader } from '../../../../components/dashboard/page-header';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { StatePanel } from '../../../../components/dashboard/state-panel';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { WorkspaceLoader } from '../../../../components/layout/workspace-loader';
import { useDashboardRefresh } from '../../../../lib/client/use-dashboard-refresh';
import { handleAuthTokenRecoveryMessage } from '../../../../lib/client/auth-recovery';
import { canViewMasterData, getDefaultDashboardPath } from '../../../../lib/client/dashboard-access';

type ReviewStatus = 'pending' | 'approved' | 'rejected';
type ReviewType = 'agency' | 'brand' | 'creator' | 'agency_gst_address' | 'brand_gst_address';
type StatusFilter = ReviewStatus | 'all';
type TypeFilter = ReviewType | 'gst_address' | 'all';

type MasterDataReviewItem = {
  id: string;
  type: ReviewType;
  submitted_value: string;
  normalized_value: string;
  submitted_trade_name: string | null;
  payload?: {
    entity_type?: string;
    entity_name?: string;
    entity_trade_name?: string | null;
    gst_number?: string;
    address?: string;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    pincode?: string | null;
  } | null;
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
  entity_type: string;
  gst_number: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
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
  { value: 'gst_address', label: 'GST / Address' },
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
  if (value === 'agency_gst_address') return 'Agency GST';
  if (value === 'brand_gst_address') return 'Brand GST';
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
  if (type === 'agency' || type === 'agency_gst_address') {
    return 'border-sky-200/70 bg-sky-50 text-sky-700 dark:border-sky-400/25 dark:bg-sky-400/14 dark:text-sky-100';
  }

  if (type === 'brand' || type === 'brand_gst_address') {
    return 'border-violet-200/70 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-400/14 dark:text-violet-100';
  }

  return 'border-teal-200/70 bg-teal-50 text-teal-700 dark:border-teal-400/25 dark:bg-teal-400/14 dark:text-teal-100';
}

function getTypeIcon(type: ReviewType) {
  if (type === 'agency' || type === 'agency_gst_address') return <Building2 className="h-3.5 w-3.5" />;
  if (type === 'brand' || type === 'brand_gst_address') return <Tag className="h-3.5 w-3.5" />;
  return <UserRound className="h-3.5 w-3.5" />;
}

function getGstSummary(item: Pick<MasterDataReviewItem, 'payload'>) {
  const gst = String(item.payload?.gst_number ?? '').trim();
  const address = String(item.payload?.address ?? '').trim();
  return { gst, address };
}

function isGstAddressReviewType(type: ReviewType) {
  return type === 'agency_gst_address' || type === 'brand_gst_address';
}

function buildEditFormFromItem(item: MasterDataReviewItem): EditFormState {
  const payload = item.payload ?? null;
  const isGstReview = isGstAddressReviewType(item.type);
  return {
    submitted_value: isGstReview ? String(payload?.entity_name ?? item.submitted_value ?? '') : item.submitted_value,
    submitted_trade_name: isGstReview ? String(payload?.entity_trade_name ?? item.submitted_trade_name ?? '') : (item.submitted_trade_name ?? ''),
    edit_reason: '',
    entity_type: isGstReview ? String(payload?.entity_type ?? (item.type === 'agency_gst_address' ? 'Agency' : 'Brand')) : '',
    gst_number: isGstReview ? String(payload?.gst_number ?? '') : '',
    address: isGstReview ? String(payload?.address ?? '') : '',
    city: isGstReview ? String(payload?.city ?? '') : '',
    state: isGstReview ? String(payload?.state ?? '') : '',
    country: isGstReview ? String(payload?.country ?? '') : '',
    pincode: isGstReview ? String(payload?.pincode ?? '') : '',
  };
}

function buildEditPayloadFromForm(item: MasterDataReviewItem, form: EditFormState) {
  if (!isGstAddressReviewType(item.type)) {
    return item.payload ?? null;
  }

  return {
    entity_type: form.entity_type || (item.type === 'agency_gst_address' ? 'Agency' : 'Brand'),
    entity_name: form.submitted_value.trim(),
    entity_trade_name: form.submitted_trade_name.trim() || null,
    gst_number: form.gst_number.trim(),
    address: form.address.trim(),
    city: form.city.trim() || null,
    state: form.state.trim() || null,
    country: form.country.trim() || null,
    pincode: form.pincode.trim() || null,
  };
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

function summarizeItems(items: MasterDataReviewItem[]) {
  return {
    total: items.length,
    pending: items.filter((item) => item.status === 'pending').length,
    approved: items.filter((item) => item.status === 'approved').length,
    rejected: items.filter((item) => item.status === 'rejected').length,
  };
}

export default function MasterDataPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewId = searchParams.get('review_id');
  const deepLinkMode = searchParams.get('mode');
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
    entity_type: '',
    gst_number: '',
    address: '',
    city: '',
    state: '',
    country: '',
    pincode: '',
  });
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const lastHighlightedReviewIdRef = useRef<string | null>(null);

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

      const nextItems = Array.isArray(json.items) ? json.items : [];
      setItems(nextItems);
      setSummary(json.summary ?? summarizeItems(nextItems));
    } catch (nextError) {
      const nextMessage = nextError instanceof Error ? nextError.message : 'Failed to load master data reviews.';
      if (handleAuthTokenRecoveryMessage(nextMessage)) return;
      setError(nextMessage);
    } finally {
      if (showRefresh) setRefreshing(false);
      else setPageLoading(false);
    }
  }, []);


  useDashboardRefresh({
    enabled: Boolean(user && canViewMasterData(user.role)),
    refresh: async () => {
      await loadReviews(false);
    },
    intervalMs: 60000,
    refreshOnFocus: true,
  });

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (typeFilter === 'gst_address') return isGstAddressReviewType(item.type);
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      return true;
    });
  }, [items, statusFilter, typeFilter]);

  const availableTypes = useMemo(() => {
    const pool = items.filter((item) => statusFilter === 'all' || item.status === statusFilter);
    const next = new Set<TypeFilter>(pool.map((item) => item.type));
    if (pool.some((item) => isGstAddressReviewType(item.type))) next.add('gst_address');
    return next;
  }, [items, statusFilter]);


  const applyItemUpdate = useCallback((nextItem: MasterDataReviewItem) => {
    setItems((current) => {
      const next = current.map((item) => (item.id === nextItem.id ? { ...item, ...nextItem } : item));
      setSummary(summarizeItems(next));
      return next;
    });
  }, []);

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
    if (!reviewId) {
      lastHighlightedReviewIdRef.current = null;
      return;
    }
    if (filteredItems.length === 0) return;
    const match = filteredItems.find((item) => item.id === reviewId);
    if (!match) return;
    if (lastHighlightedReviewIdRef.current === reviewId) return;

    setHighlightedId(reviewId);
    const row = rowRefs.current[reviewId];
    if (row) {
      lastHighlightedReviewIdRef.current = reviewId;
      row.scrollIntoView({ block: 'center' });
      const timer = window.setTimeout(() => {
        if (lastHighlightedReviewIdRef.current === reviewId) {
          lastHighlightedReviewIdRef.current = null;
        }
      }, 2200);
      return () => window.clearTimeout(timer);
    }
  }, [filteredItems, reviewId]);

  useEffect(() => {
    if (!reviewId || deepLinkMode !== 'edit' || items.length === 0) return;
    const match = items.find((item) => item.id === reviewId);
    if (!match || match.status !== 'approved') return;

    setHighlightedId(reviewId);
    setViewItemId(null);
    setConfirmApproveId(null);
    setConfirmIgnoreId(null);
    setConfirmEditId(null);
    setEditItemId(match.id);
    setEditForm(buildEditFormFromItem(match));

    const params = new URLSearchParams(searchParams.toString());
    params.delete('mode');
    router.replace('/dashboard/master-data?' + params.toString(), { scroll: false });
  }, [deepLinkMode, items, reviewId, router, searchParams]);

  async function handleApprove(id: string) {
    setActionError('');
    setActionLoadingId(id);

    try {
      const res = await fetch(`/api/master-data/reviews/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; review?: MasterDataReviewItem; error?: string };
      if (!res.ok || !json.success || !json.review) {
        throw new Error(json.error || 'Failed to approve review.');
      }

      setConfirmApproveId(null);
      applyItemUpdate(json.review);
    } catch (nextError) {
      const nextMessage = nextError instanceof Error ? nextError.message : 'Failed to approve review.';
      if (handleAuthTokenRecoveryMessage(nextMessage)) return;
      setActionError(nextMessage);
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
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; review?: MasterDataReviewItem; error?: string };
      if (!res.ok || !json.success || !json.review) {
        throw new Error(json.error || 'Failed to ignore review.');
      }

      setConfirmIgnoreId(null);
      setIgnoreReasons((current) => ({ ...current, [id]: '' }));
      applyItemUpdate(json.review);
    } catch (nextError) {
      const nextMessage = nextError instanceof Error ? nextError.message : 'Failed to ignore review.';
      if (handleAuthTokenRecoveryMessage(nextMessage)) return;
      setActionError(nextMessage);
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
    setEditForm(buildEditFormFromItem(item));
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
          payload: buildEditPayloadFromForm(editItem, editForm),
          edit_reason: editForm.edit_reason,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; review?: MasterDataReviewItem; error?: string };
      if (!res.ok || !json.success || !json.review) {
        throw new Error(json.error || 'Failed to save master data edit.');
      }

      setEditItemId(null);
      applyItemUpdate(json.review);
    } catch (nextError) {
      const nextMessage = nextError instanceof Error ? nextError.message : 'Failed to save master data edit.';
      if (handleAuthTokenRecoveryMessage(nextMessage)) return;
      setActionError(nextMessage);
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
          description="Filter pending, approved, and ignored values across agency, brand, creator, and GST/address requests."
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
              <WorkspaceLoader variant="section" label="Loading reviews..." description="Pulling the current master data review queue." />
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
                            {getGstSummary(item).gst ? <div className="mt-1 text-xs text-sky-700 dark:text-sky-300">GST: {getGstSummary(item).gst}</div> : null}
                            {getGstSummary(item).address ? <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{getGstSummary(item).address}</div> : <div className="mt-1 text-xs text-muted-foreground">{item.normalized_value}</div>}
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

              {isGstAddressReviewType(viewItem.type) ? (
                <div className="grid gap-2.5 md:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-card p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">GST Number</div>
                    <div className="mt-1.5 text-sm font-semibold text-foreground">{viewItem.payload?.gst_number || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-card p-3 md:col-span-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Address</div>
                    <div className="mt-1.5 text-sm font-semibold text-foreground">{viewItem.payload?.address || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-card p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">City</div>
                    <div className="mt-1.5 text-sm font-semibold text-foreground">{viewItem.payload?.city || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-card p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">State</div>
                    <div className="mt-1.5 text-sm font-semibold text-foreground">{viewItem.payload?.state || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-card p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Country</div>
                    <div className="mt-1.5 text-sm font-semibold text-foreground">{viewItem.payload?.country || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-card p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Pincode</div>
                    <div className="mt-1.5 text-sm font-semibold text-foreground">{viewItem.payload?.pincode || '—'}</div>
                  </div>
                </div>
              ) : null}

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

                {isGstAddressReviewType(editItem.type) ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      GST Number
                      <input
                        value={editForm.gst_number}
                        onChange={(event) => setEditForm((current) => ({ ...current, gst_number: event.target.value }))}
                        className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                        placeholder="Enter GST number"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      Entity Type
                      <input
                        value={editForm.entity_type}
                        onChange={(event) => setEditForm((current) => ({ ...current, entity_type: event.target.value }))}
                        className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                        placeholder="Agency or Brand"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-foreground md:col-span-2">
                      Address
                      <textarea
                        value={editForm.address}
                        onChange={(event) => setEditForm((current) => ({ ...current, address: event.target.value }))}
                        className="min-h-20 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                        placeholder="Enter approved billing address"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      City
                      <input
                        value={editForm.city}
                        onChange={(event) => setEditForm((current) => ({ ...current, city: event.target.value }))}
                        className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                        placeholder="City"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      State
                      <input
                        value={editForm.state}
                        onChange={(event) => setEditForm((current) => ({ ...current, state: event.target.value }))}
                        className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                        placeholder="State"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      Country
                      <input
                        value={editForm.country}
                        onChange={(event) => setEditForm((current) => ({ ...current, country: event.target.value }))}
                        className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                        placeholder="Country"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      Pincode
                      <input
                        value={editForm.pincode}
                        onChange={(event) => setEditForm((current) => ({ ...current, pincode: event.target.value }))}
                        className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                        placeholder="Pincode"
                      />
                    </label>
                  </div>
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
                disabled={
                  actionLoadingId === editItem.id
                  || !editForm.submitted_value.trim()
                  || !editForm.edit_reason.trim()
                  || (isGstAddressReviewType(editItem.type) && (!editForm.gst_number.trim() || !editForm.address.trim()))
                }
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


