"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KpiCard } from '../../../../components/dashboard/kpi-card';
import { FilterBar } from '../../../../components/dashboard/filter-bar';
import { PageHeader } from '../../../../components/dashboard/page-header';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { StatePanel } from '../../../../components/dashboard/state-panel';
import { SearchableSelect } from '../../../../components/forms/searchable-select';
import { handleAuthTokenRecoveryMessage } from '../../../../lib/client/auth-recovery';
import { SubmissionTable, type MasterDataCellKey, type MasterDataReviewSummary, type SubmissionRow } from '../../../../components/dashboard/submission-table';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { WorkspaceLoader } from '../../../../components/layout/workspace-loader';
import {
  CLOSURE_STATUS_OPTIONS,
  CREATOR_INVOICE_STATUS_OPTIONS,
  PAYMENT_MADE_STATUS_OPTIONS,
  PAYMENT_RECEIVED_STATUS_OPTIONS,
  formatInvoiceStatus,
} from '../../../../lib/client/finance-status';
import { canViewFinanceDashboard, getDefaultDashboardPath, getFinanceDashboardTitle } from '../../../../lib/client/dashboard-access';
import { pickProductReimbursementAttachment, pickReferencePoAttachment } from '../../../../lib/shared/submission-attachments';

type SubmissionAttachmentApiRow = {
  id: string;
  document_type: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  uploaded_at?: string | null;
};

type FinancePreviousSubmissionSnapshot = {
  proforma_invoice?: string | null;
  currency?: string | null;
  agency_brand_name?: string | null;
  agency_brand_trade_name?: string | null;
  gst_number?: string | null;
  address?: string | null;
  bill_due?: string | null;
  invoice_type?: string | null;
  deliverables?: string | null;
  creator_creators_name?: string | null;
  brand_name?: string | null;
  campaign_code?: string | null;
  campaign_name?: string | null;
  campaign_brand?: string | null;
  commercials?: number | string | null;
  additional_agency_commission?: number | string | null;
  reimbursement_amount?: number | string | null;
  reimbursement_receipts?: string | null;
  additional_information?: string | null;
  business_line?: 'TM' | 'IM' | null | string;
  entry_type?: 'SC' | 'MC' | null | string;
  entity_type?: 'Agency' | 'Brand' | null | string;
  client_type?: 'Indian' | 'Foreign' | null | string;
  agency_name?: string | null;
  agency_trade_name?: string | null;
  brand_trade_name?: string | null;
  intake_line_items?: SubmissionRow['intake_line_items'];
};

type FinanceApiRow = {
  id: string;
  proforma_invoice: string | null;
  agency_brand_name: string | null;
  agency_brand_trade_name: string | null;
  email_address: string | null;
  gst_number: string | null;
  address: string | null;
  bill_due: string | null;
  invoice_type: string | null;
  deliverables: string | null;
  creator_creators_name: string | null;
  brand_name: string | null;
  currency?: string | null;
  campaign_code?: string | null;
  campaign_name?: string | null;
  campaign_brand?: string | null;
  campaign_notes?: string | null;
  commercials: number | string | null;
  additional_agency_commission: number | string | null;
  reimbursement_amount: number | string | null;
  reimbursement_receipts: string | null;
  additional_information: string | null;
  previous_submission_id: string | null;
  previous_submission_pi?: string | null;
  version_status?: 'original' | 'resubmitted' | 'superseded';
  business_line?: 'TM' | 'IM' | null;
  entry_type?: 'SC' | 'MC' | null;
  entity_type?: 'Agency' | 'Brand' | null;
  client_type?: 'Indian' | 'Foreign' | null;
  agency_name?: string | null;
  agency_trade_name?: string | null;
  brand_trade_name?: string | null;
  finance_notes?: string | null;
  finance_external_notes?: string | null;
  finance_comment?: string | null;
  intake_line_items: SubmissionRow['intake_line_items'];
  intake_status: SubmissionRow['intake_status'];
  invoice_status: string | null;
  submitted_at: string | null;
  rejection_note: string | null;
  sync_status: SubmissionRow['sync_status'];
  submitted_by_name: string | null;
  submitted_by_email: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
  payment_received?: string | null;
  payment_received_status?: string | null;
  creator_invoice_status?: string | null;
  invoice_via_creators_received?: string | null;
  payment_made?: string | null;
  payment_made_status?: string | null;
  closed?: string | null;
  closure_status?: string | null;
  invoice_number?: string | null;
  debit_note_number?: string | null;
  submission_attachments?: SubmissionAttachmentApiRow[];
  previous_submission_snapshot?: FinancePreviousSubmissionSnapshot | null;
};

type FinanceAction =
  | 'approve'
  | 'reject'
  | 'request_resubmission'
  | 'mark_invoice_created'
  | 'add_debit_note'
  | 'update_payment_status'
  | 'close_submission';

type MasterDataReviewApiRow = {
  id: string;
  type: 'agency' | 'brand' | 'creator' | 'agency_gst_address' | 'brand_gst_address';
  status: 'pending' | 'approved' | 'rejected';
  submitted_value: string;
  submitted_trade_name?: string | null;
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
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_from_submission_id?: string | null;
};

type MasterDataReviewMap = Record<string, Partial<Record<MasterDataCellKey, MasterDataReviewSummary>>>;

type FinanceEditableField =
  | 'intake_status'
  | 'invoice_status'
  | 'creator_invoice_received'
  | 'payment_received'
  | 'payment_made'
  | 'closed_status'
  | 'rejection_note'
  | 'finance_notes'
  | 'finance_external_notes'
  | 'finance_comment'
  | 'invoice_number'
  | 'debit_note_number';

// Intentionally disabled until the finance read-only submission workflow is finalized.
const ENABLE_FINANCE_VIEW_ACTION = false;

const PAYMENT_RECEIVED_VALUES = PAYMENT_RECEIVED_STATUS_OPTIONS.map((option) => option.value);
const PAYMENT_MADE_VALUES = PAYMENT_MADE_STATUS_OPTIONS.map((option) => option.value);
const CLOSURE_VALUES = CLOSURE_STATUS_OPTIONS.map((option) => option.value);
const CREATOR_INVOICE_VALUES = CREATOR_INVOICE_STATUS_OPTIONS.map((option) => option.value);

function normalizeCreatorInvoice(value: string | null | undefined) {
  const normalized = normalizeStatusToken(value);
  if (!normalized) return '';
  if (normalized === 'received') return 'received';
  if (normalized === 'part_payment_against_advance') return 'part_payment_against_advance';
  if (normalized === 'not_received') return 'not_received';
  if (normalized === 'multiple_creators') return 'multiple_creators';
  if (normalized === 'gst_left') return 'gst_left';
  return 'pending';
}

function normalizeStatusToken(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function normalizeBusinessLine(value: string | null | undefined): 'TM' | 'IM' | null {
  const normalized = normalizeStatusToken(value);
  if (normalized === 'tm' || normalized === 'talent_management') return 'TM';
  if (normalized === 'im' || normalized === 'influencer_marketing') return 'IM';
  return null;
}

function normalizePaymentReceived(value: string | null | undefined) {
  const normalized = normalizeStatusToken(value);
  if (!normalized) return '';
  if (normalized === 'advance_received') return 'advance_received';
  if (normalized === 'gst_left') return 'gst_left';
  if (normalized === 'past_due') return 'past_due';
  if (normalized === 'advance_past_due') return 'advance_past_due';
  if (normalized === 'partial_left') return 'partial_left';
  if (normalized === 'credit_note_issued') return 'credit_note_issued';
  if (normalized === 'full') return 'full';
  if (normalized === 'received') return 'full';
  if (normalized === 'not_received') return 'not_received';
  return 'pending';
}

function normalizePaymentMade(value: string | null | undefined) {
  const normalized = normalizeStatusToken(value);
  if (!normalized) return '';
  if (normalized === 'part_payment_against_advance') return 'part_payment_against_advance';
  if (normalized === 'multiple_creators') return 'multiple_creators';
  if (normalized === 'gst_left') return 'gst_left';
  if (normalized === 'full') return 'full';
  if (normalized === 'paid') return 'paid';
  if (normalized === 'not_paid') return 'not_paid';
  return 'pending';
}

function normalizeClosedStatus(value: string | null | undefined) {
  const normalized = normalizeStatusToken(value);
  if (!normalized) return '';
  if (normalized === 'closed') return 'closed';
  if (normalized === 'issues') return 'issues';
  if (normalized === 'gst_left') return 'gst_left';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'cancelled';
  return 'open';
}

function hasStartedLifecycleStatus(value: string | null | undefined) {
  const normalized = normalizeStatusToken(value);
  return Boolean(normalized && normalized !== 'pending');
}

function normalizeInvoiceStatus(value: string | null | undefined) {
  const normalized = normalizeStatusToken(value);
  if (!normalized) return '';
  if (normalized === 'invoice_created') return 'invoice_created';
  if (normalized === 'po_created_estimate' || normalized === 'po_createdestimate') return 'po_created_estimate';
  if (normalized === 'invoice_cancelled') return 'invoice_cancelled';
  if (normalized === 'debit_note') return 'debit_note';
  if (normalized === 'invoice_plus_debit_note') return 'invoice_plus_debit_note';
  return 'invoice_pending';
}



function mergeSubmissionRows(current: SubmissionRow[], incoming: SubmissionRow[]) {
  const merged = new Map<string, SubmissionRow>();
  for (const row of current) merged.set(row.id, row);
  for (const row of incoming) merged.set(row.id, row);
  return Array.from(merged.values()).sort((left, right) => {
    const leftTime = new Date(left.submitted_at || '').getTime();
    const rightTime = new Date(right.submitted_at || '').getTime();
    return rightTime - leftTime;
  });
}

function mapPreviousSubmissionSnapshot(snapshot: FinancePreviousSubmissionSnapshot | null | undefined): Partial<SubmissionRow> | null {
  if (!snapshot) return null;

  return {
    pi: snapshot.proforma_invoice ?? '',
    entity: snapshot.agency_brand_name || '-',
    amount: Number(snapshot.commercials ?? 0),
    currency: snapshot.currency || 'INR',
    trade_name: snapshot.agency_brand_trade_name || null,
    gst_number: snapshot.gst_number || null,
    address: snapshot.address || null,
    bill_due: snapshot.bill_due || null,
    invoice_type: snapshot.invoice_type || null,
    creator_creators_name: snapshot.creator_creators_name || null,
    brand_name: snapshot.brand_name || null,
    campaign_code: snapshot.campaign_code || null,
    campaign_name: snapshot.campaign_name || null,
    campaign_brand: snapshot.campaign_brand || null,
    deliverables: snapshot.deliverables || null,
    additional_agency_commission: Number(snapshot.additional_agency_commission ?? 0),
    reimbursement_amount: Number(snapshot.reimbursement_amount ?? 0),
    reimbursement_receipts: snapshot.reimbursement_receipts || null,
    additional_information: snapshot.additional_information || null,
    business_line: normalizeBusinessLine(snapshot.business_line),
    entry_type: snapshot.entry_type || null,
    entity_type: snapshot.entity_type || null,
    client_type: snapshot.client_type || null,
    agency_name: snapshot.agency_name || null,
    agency_trade_name: snapshot.agency_trade_name || null,
    brand_trade_name: snapshot.brand_trade_name || null,
    intake_line_items: snapshot.intake_line_items || [],
  };
}

function mapFinanceSubmissionRow(item: FinanceApiRow): SubmissionRow {
  return {
    id: String(item.id),
    pi: item.proforma_invoice ?? '',
    entity: item.agency_brand_name || '-',
    amount: Number(item.commercials ?? 0),
    currency: item.currency || 'INR',
    owner_name: item.submitted_by_name || undefined,
    submitter_email: item.submitted_by_email || item.email_address || undefined,
    intake_status: item.intake_status,
    invoice_status: item.invoice_status || '-',
    sync_status: item.sync_status || 'pending_sheet_sync',
    submitted_at: item.submitted_at || new Date().toISOString(),
    rejection_note: item.rejection_note || null,
    trade_name: item.agency_brand_trade_name || null,
    gst_number: item.gst_number || null,
    address: item.address || null,
    bill_due: item.bill_due || null,
    invoice_type: item.invoice_type || null,
    creator_creators_name: item.creator_creators_name || null,
    brand_name: item.brand_name || null,
    campaign_code: item.campaign_code || null,
    campaign_name: item.campaign_name || null,
    campaign_brand: item.campaign_brand || null,
    campaign_notes: item.campaign_notes || null,
    deliverables: item.deliverables || null,
    invoice_number: item.invoice_number || null,
    debit_note_number: item.debit_note_number || null,
    additional_agency_commission: Number(item.additional_agency_commission ?? 0),
    reimbursement_amount: Number(item.reimbursement_amount ?? 0),
    reimbursement_receipts: item.reimbursement_receipts || null,
    additional_information: item.additional_information || null,
    previous_submission_id: item.previous_submission_id || null,
    previous_submission_pi: item.previous_submission_pi || null,
    previous_submission_snapshot: mapPreviousSubmissionSnapshot(item.previous_submission_snapshot),
    version_status: item.version_status || 'original',
    business_line: normalizeBusinessLine(item.business_line),
    entry_type: item.entry_type || null,
    entity_type: item.entity_type || null,
    client_type: item.client_type || null,
    agency_name: item.agency_name || null,
    agency_trade_name: item.agency_trade_name || null,
    brand_trade_name: item.brand_trade_name || null,
    finance_notes: item.finance_notes || null,
    finance_external_notes: item.finance_external_notes || null,
    finance_comment: item.finance_comment || undefined,
    reviewed_at: item.reviewed_at || null,
    reviewed_by_name: item.reviewed_by_name || null,
    intake_line_items: item.intake_line_items || [],
    product_reimbursement_attachment: pickProductReimbursementAttachment(item.submission_attachments),
    reference_po_attachment: pickReferencePoAttachment(item.submission_attachments),
    invoice_status_started: Boolean(String(item.invoice_status || '').trim() && String(item.invoice_status || '') !== '-'),
    creator_invoice_received_started: hasStartedLifecycleStatus(item.creator_invoice_status || item.invoice_via_creators_received),
    payment_received_started: hasStartedLifecycleStatus(item.payment_received_status || item.payment_received),
    payment_made_started: hasStartedLifecycleStatus(item.payment_made_status || item.payment_made),
    creator_invoice_received: normalizeCreatorInvoice(item.creator_invoice_status || item.invoice_via_creators_received),
    payment_received: normalizePaymentReceived(item.payment_received_status || item.payment_received),
    payment_made: normalizePaymentMade(item.payment_made_status || item.payment_made),
    closed_status: normalizeClosedStatus(item.closure_status || item.closed),
  };
}
function mapMasterDataReviews(items: MasterDataReviewApiRow[]): MasterDataReviewMap {
  const next: MasterDataReviewMap = {};

  for (const item of items) {
    const submissionId = String(item.created_from_submission_id || '').trim();
    if (!submissionId) continue;

    const summary: MasterDataReviewSummary = {
      id: String(item.id),
      type: item.type,
      status: item.status,
      submitted_value: item.submitted_value,
      submitted_trade_name: item.submitted_trade_name ?? null,
      payload: item.payload ?? null,
      reviewed_by_name: item.reviewed_by_name ?? null,
      reviewed_at: item.reviewed_at ?? null,
      rejection_reason: item.rejection_reason ?? null,
      created_from_submission_id: submissionId,
    };

    const bucket = next[submissionId] ?? {};
    if (item.type === 'agency') {
      bucket.agency_name ??= summary;
      bucket.agency_trade_name ??= summary;
    } else if (item.type === 'brand') {
      bucket.brand_name ??= summary;
      bucket.brand_trade_name ??= summary;
    } else if (item.type === 'agency_gst_address' || item.type === 'brand_gst_address') {
      bucket.gst_number ??= summary;
    } else {
      bucket.creator_name ??= summary;
    }
    next[submissionId] = bucket;
  }

  return next;
}

export default function FinanceReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useDashboardSession();
  const isMountedRef = useRef(true);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [masterDataReviewsBySubmission, setMasterDataReviewsBySubmission] = useState<MasterDataReviewMap>({});
  const [rowsLoading, setRowsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [rowsError, setRowsError] = useState('');
  const [query, setQuery] = useState('');
  const [businessLineFilter, setBusinessLineFilter] = useState<'all' | 'TM' | 'IM'>('all');
  const [intakeStatusFilter, setIntakeStatusFilter] = useState<'all' | 'submitted' | 'accepted' | 'rejected' | 'declined'>('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [creatorInvoiceReceivedFilter, setCreatorInvoiceReceivedFilter] = useState<'all' | string>('all');
  const [paymentReceivedFilter, setPaymentReceivedFilter] = useState<'all' | string>('all');
  const [paymentMadeFilter, setPaymentMadeFilter] = useState<'all' | string>('all');
  const [closedStatusFilter, setClosedStatusFilter] = useState<'all' | string>('all');
  const [versionStatusFilter, setVersionStatusFilter] = useState<'all' | 'original' | 'resubmitted' | 'superseded'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [highlightedSubmissionId, setHighlightedSubmissionId] = useState<string | null>(null);
  const [deepLinkNotice, setDeepLinkNotice] = useState('');
  const handledSubmissionIdRef = useRef<string | null>(null);
  const loadingSubmissionIdRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadMasterDataReviews = useCallback(async () => {
    const res = await fetch('/api/master-data/reviews?status=all&type=all', { method: 'GET', cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || 'Failed to load master data reviews.');
    }
    return mapMasterDataReviews((json.items ?? []) as MasterDataReviewApiRow[]);
  }, []);

  const loadFinanceSubmissions = useCallback(async (offset = 0, append = false) => {
    if (!user) return;

    if (isMountedRef.current) {
      if (append) {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        setRowsLoading(true);
        setRowsError('');
      }
    }

    const params = new URLSearchParams({
      limit: '50',
      offset: String(offset),
    });
    if (query.trim()) params.set('query', query.trim());
    if (businessLineFilter !== 'all') params.set('business_line', businessLineFilter);
    if (intakeStatusFilter !== 'all') params.set('intake_status', intakeStatusFilter);
    if (employeeFilter !== 'all') params.set('employee', employeeFilter);
    if (invoiceStatusFilter !== 'all') params.set('invoice_status', invoiceStatusFilter);
    if (creatorInvoiceReceivedFilter !== 'all') params.set('creator_invoice_received', creatorInvoiceReceivedFilter);
    if (paymentReceivedFilter !== 'all') params.set('payment_received', paymentReceivedFilter);
    if (paymentMadeFilter !== 'all') params.set('payment_made', paymentMadeFilter);
    if (closedStatusFilter !== 'all') params.set('closed_status', closedStatusFilter);
    if (versionStatusFilter !== 'all') params.set('version_status', versionStatusFilter);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);

    const [res, masterDataReviewMap] = await Promise.all([
      fetch('/api/submissions/finance?' + params.toString(), { method: 'GET', cache: 'no-store' }),
      append ? Promise.resolve(null) : loadMasterDataReviews().catch(() => ({} as MasterDataReviewMap)),
    ]);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || 'Failed to load finance submissions.');
    }

    const mapped = ((json.submissions ?? []) as FinanceApiRow[]).map(mapFinanceSubmissionRow);

    if (isMountedRef.current) {
      setRows((current) => (append ? mergeSubmissionRows(current, mapped) : mapped));
      setHasMore(Boolean(json.has_more));
      setNextOffset(typeof json.next_offset === 'number' ? json.next_offset : null);
      if (!append && masterDataReviewMap) {
        setMasterDataReviewsBySubmission(masterDataReviewMap);
      }
    }
    if (append) {
      loadingMoreRef.current = false;
      if (isMountedRef.current) setLoadingMore(false);
    } else if (isMountedRef.current) {
      setRowsLoading(false);
    }
  }, [
    businessLineFilter,
    closedStatusFilter,
    creatorInvoiceReceivedFilter,
    dateFrom,
    dateTo,
    employeeFilter,
    intakeStatusFilter,
    invoiceStatusFilter,
    loadMasterDataReviews,
    paymentMadeFilter,
    paymentReceivedFilter,
    query,
    user,
    versionStatusFilter,
  ]);

  useEffect(() => {
    let active = true;
    if (!user) return;
    if (!canViewFinanceDashboard(user.role)) return;
    setRows([]);
    setHasMore(false);
    setNextOffset(null);
    void loadFinanceSubmissions(0, false).catch((error) => {
      if (active) {
        const nextMessage = error instanceof Error ? error.message : 'Failed to load finance submissions.';
        if (handleAuthTokenRecoveryMessage(nextMessage)) return;
        setRowsError(nextMessage);
        setRowsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [user, loadFinanceSubmissions]);

  useEffect(() => {
    if (loading || !user) return;
    if (!canViewFinanceDashboard(user.role)) {
      router.replace(getDefaultDashboardPath(user.role));
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!hasMore || loadingMore || loadingMoreRef.current) return undefined;
    const target = loadMoreRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextOffset !== null && !loadingMoreRef.current) {
          observer.disconnect();
          void loadFinanceSubmissions(nextOffset, true).catch((error) => {
            loadingMoreRef.current = false;
            const nextMessage = error instanceof Error ? error.message : 'Failed to load finance submissions.';
        if (handleAuthTokenRecoveryMessage(nextMessage)) return;
        setRowsError(nextMessage);
            setLoadingMore(false);
          });
        }
      },
      { rootMargin: '180px 0px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadFinanceSubmissions, loadingMore, nextOffset]);

  useEffect(() => {
    if (!highlightedSubmissionId) return undefined;
    const timer = window.setTimeout(() => {
      setHighlightedSubmissionId((current) => (current === highlightedSubmissionId ? null : current));
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [highlightedSubmissionId]);

  useEffect(() => {
    const submissionId = searchParams.get('submission_id')?.trim();
    if (!submissionId) {
      handledSubmissionIdRef.current = null;
      loadingSubmissionIdRef.current = null;
      setDeepLinkNotice('');
      return;
    }

    if (rows.some((entry) => entry.id === submissionId)) {
      if (handledSubmissionIdRef.current !== submissionId) {
        handledSubmissionIdRef.current = submissionId;
        setDeepLinkNotice('');
        setHighlightedSubmissionId(submissionId);
      }
      return;
    }

    if (!user || handledSubmissionIdRef.current === submissionId || loadingSubmissionIdRef.current === submissionId) {
      return;
    }

    loadingSubmissionIdRef.current = submissionId;
    let cancelled = false;

    void (async () => {
      try {
        const params = new URLSearchParams({ submission_id: submissionId, limit: '1', offset: '0' });
        const res = await fetch('/api/submissions/finance?' + params.toString(), { method: 'GET', cache: 'no-store' });
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; submissions?: FinanceApiRow[]; error?: string };
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Failed to locate submission.');
        }

        const item = json.submissions?.[0];
        if (!item) {
          if (!cancelled) setDeepLinkNotice('Submission not found in current view.');
          return;
        }

        if (!cancelled) {
          setRows((current) => mergeSubmissionRows(current, [mapFinanceSubmissionRow(item)]));
          setDeepLinkNotice('');
          setHighlightedSubmissionId(submissionId);
          handledSubmissionIdRef.current = submissionId;
        }
      } catch {
        if (!cancelled) setDeepLinkNotice('Submission not found in current view.');
      } finally {
        if (!cancelled) {
          handledSubmissionIdRef.current = submissionId;
          loadingSubmissionIdRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rows, searchParams, user, highlightedSubmissionId]);

  const employeeDirectory = useMemo(() => {
    const next: Record<string, string> = {};
    rows.forEach((entry) => {
      const email = String(entry.submitter_email || '').trim();
      if (!email) return;
      const ownerName = String(entry.owner_name || '').trim();
      next[email] = ownerName;
    });
    return next;
  }, [rows]);

  const employeeOptions = useMemo(
    () => Object.keys(employeeDirectory).sort((left, right) => left.localeCompare(right)),
    [employeeDirectory]
  );
  const invoiceStatusOptions = useMemo(
    () => Array.from(new Set(rows.map((entry) => entry.invoice_status).filter((status) => Boolean(status && status !== '-')))),
    [rows]
  );

  function applyUpdatedSubmission(targetRow: SubmissionRow, updated: Record<string, string | null | undefined>) {
    const has = (key: string) => Object.prototype.hasOwnProperty.call(updated, key);
    setRows((current) =>
      current.map((entry) =>
        entry.id !== targetRow.id
          ? entry
          : {
              ...entry,
              intake_status: (updated.intake_status as SubmissionRow['intake_status'] | undefined) ?? entry.intake_status,
              invoice_status: updated.invoice_status ?? entry.invoice_status,
              invoice_status_started: has('invoice_status')
                ? Boolean(String(updated.invoice_status || '').trim() && String(updated.invoice_status || '') !== '-')
                : entry.invoice_status_started,
              invoice_number: has('invoice_number') ? (updated.invoice_number ?? null) : entry.invoice_number,
              debit_note_number: has('debit_note_number') ? (updated.debit_note_number ?? null) : entry.debit_note_number,
              finance_notes: has('finance_notes') ? (updated.finance_notes ?? null) : entry.finance_notes,
              finance_external_notes: has('finance_external_notes') ? (updated.finance_external_notes ?? null) : entry.finance_external_notes,
              finance_comment: has('finance_comment')
                ? (updated.finance_comment ?? null)
                : has('rejection_note')
                  ? (updated.rejection_note ?? null)
                  : entry.finance_comment,
              creator_invoice_received_started: has('creator_invoice_status')
                ? hasStartedLifecycleStatus(updated.creator_invoice_status)
                : entry.creator_invoice_received_started,
              creator_invoice_received: has('creator_invoice_status')
                ? normalizeCreatorInvoice(updated.creator_invoice_status)
                : entry.creator_invoice_received,
              payment_received_started: has('payment_received_status')
                ? hasStartedLifecycleStatus(updated.payment_received_status)
                : entry.payment_received_started,
              payment_received: has('payment_received_status')
                ? normalizePaymentReceived(updated.payment_received_status)
                : entry.payment_received,
              payment_made_started: has('payment_made_status')
                ? hasStartedLifecycleStatus(updated.payment_made_status)
                : entry.payment_made_started,
              payment_made: has('payment_made_status')
                ? normalizePaymentMade(updated.payment_made_status)
                : entry.payment_made,
              closed_status: has('closure_status')
                ? normalizeClosedStatus(updated.closure_status)
                : entry.closed_status,
              rejection_note: has('rejection_note') ? (updated.rejection_note ?? null) : entry.rejection_note,
              reviewed_at: updated.reviewed_at ?? new Date().toISOString(),
              reviewed_by_name: user?.full_name || entry.reviewed_by_name,
            }
      )
    );
  }

  async function executeFinanceAction(targetRow: SubmissionRow, action: FinanceAction, extra: Record<string, string> = {}) {
    const response = await fetch('/api/submissions/finance/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: targetRow.id,
        action,
        ...extra,
      }),
    });

    const body = await response.json().catch(() => ({}));
    return { response, body };
  }

  async function handleMasterDataReviewAction(review: MasterDataReviewSummary, action: 'approve' | 'reject') {
    const endpoint = `/api/master-data/reviews/${review.id}/${action === 'approve' ? 'approve' : 'reject'}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: action === 'reject' ? JSON.stringify({ rejection_reason: 'Ignored by finance' }) : undefined,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.success) {
      return { success: false, message: body?.error || 'Failed to update master data review.' };
    }

    const nextReview: MasterDataReviewSummary = {
      ...review,
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_by_name: user?.full_name || 'Finance Team',
      reviewed_at: new Date().toISOString(),
      rejection_reason: action === 'reject' ? 'Ignored by finance' : null,
    };

    setMasterDataReviewsBySubmission((current) => {
      const submissionId = review.created_from_submission_id;
      if (!submissionId) return current;
      const bucket = { ...(current[submissionId] ?? {}) };
      const applyReview = (key: MasterDataCellKey) => {
        if (bucket[key]?.id === review.id) {
          bucket[key] = nextReview;
        }
      };
      if (review.type === 'agency') {
        applyReview('agency_name');
        applyReview('agency_trade_name');
      } else if (review.type === 'brand') {
        applyReview('brand_name');
        applyReview('brand_trade_name');
      } else if (review.type === 'agency_gst_address' || review.type === 'brand_gst_address') {
        applyReview('gst_number');
      } else {
        applyReview('creator_name');
      }
      return { ...current, [submissionId]: bucket };
    });

    return { success: true, review: nextReview, message: body?.message || 'Master data review updated.' };
  }

  async function updateFinanceCell(targetRow: SubmissionRow, field: FinanceEditableField, value: string) {
    if (!user || !canViewFinanceDashboard(user.role)) {
      return { success: false, message: 'Unauthorized' };
    }

    let action: FinanceAction;
    let payload: Record<string, string> = {};

    if (field === 'intake_status') {
      if (value === 'accepted') {
        action = 'approve';
      } else if (value === 'rejected') {
        const note = String(targetRow.finance_comment || targetRow.rejection_note || '').trim();
        if (!note) {
          return { success: false, message: 'Resubmission note is required before requesting resubmission.' };
        }
        action = 'request_resubmission';
        payload = { rejection_note: note };
      } else if (value === 'declined') {
        const note = String(targetRow.finance_comment || targetRow.rejection_note || '').trim();
        action = 'reject';
        if (note) payload = { rejection_note: note };
      } else {
        return { success: false, message: 'Submitted state is controlled by submission workflow.' };
      }
    } else if (field === 'invoice_status') {
      action = 'mark_invoice_created';
      payload = { invoice_status: value };
    } else if (field === 'invoice_number') {
      action = 'mark_invoice_created';
      payload = { invoice_number: value };
    } else if (field === 'debit_note_number') {
      action = 'mark_invoice_created';
      payload = { debit_note_number: value };
    } else if (field === 'creator_invoice_received') {
      action = 'update_payment_status';
      payload = { creator_invoice_status: value };
    } else if (field === 'payment_received') {
      action = 'update_payment_status';
      payload = { payment_received_status: value };
    } else if (field === 'payment_made') {
      action = 'update_payment_status';
      payload = { payment_made_status: value };
    } else if (field === 'closed_status') {
      action = 'close_submission';
      payload = { closure_status: value };
    } else if (field === 'rejection_note') {
      action = 'request_resubmission';
      payload = { rejection_note: value };
    } else if (field === 'finance_external_notes') {
      action = 'update_payment_status';
      payload = { finance_external_notes: value };
    } else {
      action = 'update_payment_status';
      payload = { finance_notes: value };
    }

    const { response, body } = await executeFinanceAction(targetRow, action, payload);
    if (!response.ok || !body?.success) {
      return { success: false, message: body?.error || 'Finance action failed.' };
    }
    const updated = body?.submission || {};
    applyUpdatedSubmission(targetRow, updated);
    return {
      success: true,
      message: body?.message || (body?.changed === false ? 'No changes were needed.' : 'Saved'),
      nextValue: value,
      nextRowPatch: {
        intake_status: updated.intake_status,
        invoice_status: updated.invoice_status,
        invoice_number: updated.invoice_number,
        debit_note_number: updated.debit_note_number,
        finance_notes: updated.finance_notes ?? targetRow.finance_notes,
        finance_external_notes: updated.finance_external_notes ?? targetRow.finance_external_notes,
        finance_comment: updated.finance_comment,
        creator_invoice_received: updated.creator_invoice_status,
        payment_received: updated.payment_received_status,
        payment_made: updated.payment_made_status,
        closed_status: updated.closure_status,
        reviewed_at: updated.reviewed_at ?? new Date().toISOString(),
        reviewed_by_name: user.full_name,
      },
    };
  }

  const pendingCount = rows.filter((entry) => entry.intake_status === 'submitted').length;
  const acceptedCount = rows.filter((entry) => entry.intake_status === 'accepted').length;
  const rejectedCount = rows.filter((entry) => entry.intake_status === 'rejected').length;

  function resetAllFilters() {
    setQuery('');
    setBusinessLineFilter('all');
    setIntakeStatusFilter('all');
    setEmployeeFilter('all');
    setInvoiceStatusFilter('all');
    setCreatorInvoiceReceivedFilter('all');
    setPaymentReceivedFilter('all');
    setPaymentMadeFilter('all');
    setClosedStatusFilter('all');
    setVersionStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  }


  if (loading || !user || !canViewFinanceDashboard(user.role)) return null;

    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <PageHeader
          title={getFinanceDashboardTitle(user.role)}
          description="Review submissions, update invoice and payment stages, and request corrected resubmissions."
          className="gap-3 border-b-0 pb-0"
        />
  
        <section style={{ display: 'grid', gap: 12, marginTop: -4, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <KpiCard title="Pending Review" value={String(pendingCount)} hint="Requires finance action" variant="warning" compact />
          <KpiCard title="Accepted" value={String(acceptedCount)} hint="Approved by finance" variant="teal" compact />
          <KpiCard title="Resubmission Requested" value={String(rejectedCount)} hint="Returned with notes" variant="danger" compact />
        </section>

      <SectionCard padding={16} className="overflow-visible">
        <FilterBar
          searchPlaceholder="Search PI, creator, agency, or brand"
          searchValue={query}
          primaryFilters={[
            {
              key: 'businessLine',
              label: 'Business Line',
              value: businessLineFilter,
              options: [
                { value: 'all', label: 'All Business Lines' },
                { value: 'TM', label: 'TM' },
                { value: 'IM', label: 'IM' },
              ],
            },
            {
              key: 'status',
              label: 'Status',
              value: intakeStatusFilter,
              options: [
                { value: 'all', label: 'All Statuses' },
                { value: 'submitted', label: 'Submitted' },
                { value: 'accepted', label: 'Accepted' },
                { value: 'rejected', label: 'Resubmission Requested' },
                { value: 'declined', label: 'Rejected' },
              ],
            },
            {
              key: 'employee',
              label: 'Employee',
              value: employeeFilter === 'all' ? '' : employeeFilter,
              options: employeeOptions.map((email) => ({
                value: email,
                label: email,
              })),
              placeholder: 'Search employee email',
              searchTextByOption: Object.fromEntries(
                employeeOptions.map((email) => [email, email + ' ' + (employeeDirectory[email] || '')])
              ),
            },
          ]}
          advancedFilters={[
            { key: 'dateFrom', label: 'Date From', value: dateFrom, type: 'date' },
            { key: 'dateTo', label: 'Date To', value: dateTo, type: 'date' },
            {
              key: 'invoiceStatus',
              label: 'Invoice Status',
              value: invoiceStatusFilter,
              type: 'select',
              options: [
                { value: 'all', label: 'All' },
                ...invoiceStatusOptions.map((status) => ({ value: status, label: formatInvoiceStatus(status) })),
              ],
            },
            {
              key: 'creatorInvoice',
              label: 'Creator Invoice Received',
              value: creatorInvoiceReceivedFilter,
              type: 'select',
              options: [{ value: 'all', label: 'All' }, ...CREATOR_INVOICE_STATUS_OPTIONS],
            },
            {
              key: 'paymentReceived',
              label: 'Payment Received',
              value: paymentReceivedFilter,
              type: 'select',
              options: [{ value: 'all', label: 'All' }, ...PAYMENT_RECEIVED_STATUS_OPTIONS],
            },
            {
              key: 'paymentMade',
              label: 'Payment Made',
              value: paymentMadeFilter,
              type: 'select',
              options: [{ value: 'all', label: 'All' }, ...PAYMENT_MADE_STATUS_OPTIONS],
            },
            {
              key: 'closedStatus',
              label: 'Closed Status',
              value: closedStatusFilter,
              type: 'select',
              options: [{ value: 'all', label: 'All' }, ...CLOSURE_STATUS_OPTIONS],
            },
            {
              key: 'versionStatus',
              label: 'Version Status',
              value: versionStatusFilter,
              type: 'select',
              options: [
                { value: 'all', label: 'All' },
                { value: 'original', label: 'Original' },
                { value: 'resubmitted', label: 'Resubmitted' },
                { value: 'superseded', label: 'Superseded' },
              ],
            },
          ]}
          onSearch={setQuery}
          onPrimaryChange={(key, value) => {
            if (key === 'businessLine') setBusinessLineFilter((value || 'all') as 'all' | 'TM' | 'IM');
            if (key === 'status') setIntakeStatusFilter((value || 'all') as 'all' | 'submitted' | 'accepted' | 'rejected' | 'declined');
            if (key === 'employee') setEmployeeFilter(value || 'all');
          }}
          onAdvancedChange={(filters) => {
            setDateFrom(filters.dateFrom || '');
            setDateTo(filters.dateTo || '');
            setInvoiceStatusFilter(filters.invoiceStatus || 'all');
            setCreatorInvoiceReceivedFilter((filters.creatorInvoice || 'all') as 'all' | 'received' | 'pending');
            setPaymentReceivedFilter(filters.paymentReceived || 'all');
            setPaymentMadeFilter(filters.paymentMade || 'all');
            setClosedStatusFilter(filters.closedStatus || 'all');
            setVersionStatusFilter((filters.versionStatus || 'all') as 'all' | 'original' | 'resubmitted' | 'superseded');
          }}
          onReset={resetAllFilters}
        />
      </SectionCard>

      {rowsLoading ? <WorkspaceLoader variant="section" label="Loading finance submissions..." /> : null}
      {rowsError ? <StatePanel tone="danger">{rowsError}</StatePanel> : null}
      {deepLinkNotice ? <p className="text-xs text-muted-foreground">{deepLinkNotice}</p> : null}

      {!rowsLoading && !rowsError ? (
        <div className="grid gap-3">
          <SubmissionTable
            rows={rows}
            onOpen={ENABLE_FINANCE_VIEW_ACTION ? (id) => router.push('/dashboard/submissions/new?view_id=' + id) : undefined}
            hideActions={!ENABLE_FINANCE_VIEW_ACTION}
            emptyLabel="No finance submissions found for the current filters."
            viewer={user.role === 'admin' ? 'admin' : 'finance'}
            getActionLabel={() => 'View / Edit'}
            onFinanceUpdate={updateFinanceCell}
            masterDataReviewsBySubmission={masterDataReviewsBySubmission}
            onMasterDataReviewAction={handleMasterDataReviewAction}
            highlightedRowId={highlightedSubmissionId}
            paginationFooter={(
              <div>
                <div className="border-b border-border/50 px-4 py-2 text-center text-xs text-muted-foreground">
                  PI numbering now continues from 466. Older submissions will be migrated shortly.
                </div>
                {rows.length > 0 ? (
                  hasMore ? (
                    <div className="flex flex-col items-center gap-3 px-3 py-3">
                      <div ref={loadMoreRef} className="h-1 w-full" aria-hidden="true" />
                      <button className="btn" type="button" onClick={() => void loadFinanceSubmissions(nextOffset || 0, true)} disabled={loadingMore || nextOffset === null}>
                        {loadingMore ? 'Loading more...' : 'Load More'}
                      </button>
                    </div>
                  ) : (
                    <p className="px-3 py-3 text-center text-xs text-muted-foreground">You&apos;ve reached the latest finance submissions.</p>
                  )
                ) : null}
              </div>
            )}
          />
        </div>
      ) : null}


    </div>
  );
}









