"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KpiCard } from '../../../../components/dashboard/kpi-card';
import { PageHeader } from '../../../../components/dashboard/page-header';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { StatePanel } from '../../../../components/dashboard/state-panel';
import { SubmissionDrawer } from '../../../../components/dashboard/submission-drawer';
import { SubmissionTable, type SubmissionRow } from '../../../../components/dashboard/submission-table';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import {
  CLOSURE_STATUS_OPTIONS,
  CREATOR_INVOICE_STATUS_OPTIONS,
  INVOICE_STATUS_OPTIONS,
  PAYMENT_MADE_STATUS_OPTIONS,
  PAYMENT_RECEIVED_STATUS_OPTIONS,
  formatClosureStatus,
  formatCreatorInvoiceStatus,
  formatInvoiceStatus,
  formatPaymentMadeStatus,
  formatPaymentReceivedStatus,
} from '../../../../lib/client/finance-status';
import { canViewFinanceDashboard, getDefaultDashboardPath, getDrawerViewerRole, getFinanceDashboardTitle } from '../../../../lib/client/dashboard-access';

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
  business_line?: 'TM' | 'IM' | null;
  entry_type?: 'SC' | 'MC' | null;
  entity_type?: 'Agency' | 'Brand' | null;
  client_type?: 'Indian' | 'Foreign' | null;
  agency_name?: string | null;
  agency_trade_name?: string | null;
  brand_trade_name?: string | null;
  finance_notes?: string | null;
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
};

type FinanceAction =
  | 'approve'
  | 'reject'
  | 'request_resubmission'
  | 'mark_invoice_created'
  | 'add_debit_note'
  | 'update_payment_status'
  | 'close_submission';

type FinanceEditableField =
  | 'intake_status'
  | 'invoice_status'
  | 'creator_invoice_received'
  | 'payment_received'
  | 'payment_made'
  | 'closed_status'
  | 'rejection_note'
  | 'finance_notes'
  | 'finance_comment'
  | 'invoice_number'
  | 'debit_note_number';

const PAYMENT_RECEIVED_VALUES = PAYMENT_RECEIVED_STATUS_OPTIONS.map((option) => option.value);
const PAYMENT_MADE_VALUES = PAYMENT_MADE_STATUS_OPTIONS.map((option) => option.value);
const CLOSURE_VALUES = CLOSURE_STATUS_OPTIONS.map((option) => option.value);
const CREATOR_INVOICE_VALUES = CREATOR_INVOICE_STATUS_OPTIONS.map((option) => option.value);

function normalizeCreatorInvoice(value: string | null | undefined) {
  const normalized = normalizeStatusToken(value);
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
  if (normalized === 'closed') return 'closed';
  if (normalized === 'issues') return 'issues';
  if (normalized === 'gst_left') return 'gst_left';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'cancelled';
  return 'open';
}

function normalizeInvoiceStatus(value: string | null | undefined) {
  const normalized = normalizeStatusToken(value);
  if (normalized === 'invoice_created') return 'invoice_created';
  if (normalized === 'po_created_estimate' || normalized === 'po_createdestimate') return 'po_created_estimate';
  if (normalized === 'invoice_cancelled') return 'invoice_cancelled';
  if (normalized === 'debit_note') return 'debit_note';
  if (normalized === 'invoice_plus_debit_note') return 'invoice_plus_debit_note';
  return 'invoice_pending';
}

function formatDateDigitsInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDateFilterInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const display = formatDateDigitsInput(value);

  if (!digits.length) {
    return { display: '', iso: '', complete: false, valid: true };
  }

  if (digits.length < 8) {
    return { display, iso: '', complete: false, valid: true };
  }

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));

  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
    return { display, iso: '', complete: true, valid: false };
  }

  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00`);
  const isValid = !Number.isNaN(date.getTime())
    && date.getFullYear() === year
    && date.getMonth() + 1 === month
    && date.getDate() === day;

  return {
    display,
    iso: isValid ? iso : '',
    complete: true,
    valid: isValid,
  };
}

function formatDateFilterInput(value: string) {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

function TrackingRow({
  label,
  value,
  fieldKey,
  isEditing,
  actionSubmitting,
  onEdit,
  onCancel,
  children,
}: {
  label: string;
  value: string;
  fieldKey: string;
  isEditing: boolean;
  actionSubmitting: boolean;
  onEdit?: (fieldKey: string) => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="surface" style={{ padding: 12, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div className="text-muted" style={{ fontSize: 12 }}>{label}</div>
          <div style={{ fontWeight: 600 }}>{value}</div>
        </div>
        {!isEditing ? (
          <button
            className="btn"
            type="button"
            disabled={actionSubmitting}
            onClick={() => onEdit?.(fieldKey)}
          >
            Edit
          </button>
        ) : (
          <button className="btn" type="button" disabled={actionSubmitting} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      {isEditing ? children : null}
    </div>
  );
}

function DateFilterInput({
  label,
  committedValue,
  onCommit,
}: {
  label: string;
  committedValue: string;
  onCommit: (value: string) => void;
}) {
  const [inputValue, setInputValue] = useState(() => formatDateFilterInput(committedValue));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setInputValue(formatDateFilterInput(committedValue));
    if (!committedValue) setInvalid(false);
  }, [committedValue]);

  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        className={`intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20 ${invalid ? 'border-destructive focus:border-destructive focus:ring-destructive/15' : ''}`}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={inputValue}
        onChange={(e) => {
          const parsed = parseDateFilterInput(e.target.value);
          setInputValue(parsed.display);
          if (!parsed.display) {
            setInvalid(false);
            onCommit('');
            return;
          }
          if (!parsed.complete) {
            setInvalid(false);
            return;
          }
          if (!parsed.valid) {
            setInvalid(true);
            return;
          }
          setInvalid(false);
          onCommit(parsed.iso);
        }}
      />
      {invalid ? <span className="text-xs text-destructive">Enter a valid date.</span> : null}
    </label>
  );
}

export default function FinanceReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useDashboardSession();
  const isMountedRef = useRef(true);
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [rowsError, setRowsError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [businessLineFilter, setBusinessLineFilter] = useState<'all' | 'TM' | 'IM'>('all');
  const [intakeStatusFilter, setIntakeStatusFilter] = useState<'all' | 'submitted' | 'accepted' | 'rejected'>('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [creatorInvoiceReceivedFilter, setCreatorInvoiceReceivedFilter] = useState<'all' | string>('all');
  const [paymentReceivedFilter, setPaymentReceivedFilter] = useState<'all' | string>('all');
  const [paymentMadeFilter, setPaymentMadeFilter] = useState<'all' | string>('all');
  const [closedStatusFilter, setClosedStatusFilter] = useState<'all' | string>('all');
  const [versionStatusFilter, setVersionStatusFilter] = useState<'all' | 'original' | 'resubmitted' | 'superseded'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [rejectionNote, setRejectionNote] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [debitNoteNumber, setDebitNoteNumber] = useState('');
  const [creatorInvoiceStatus, setCreatorInvoiceStatus] = useState<string>('pending');
  const [invoiceStatusValue, setInvoiceStatusValue] = useState<string>('invoice_pending');
  const [paymentReceivedStatus, setPaymentReceivedStatus] = useState<string>('pending');
  const [paymentMadeStatus, setPaymentMadeStatus] = useState<string>('pending');
  const [closureStatus, setClosureStatus] = useState<string>('open');
  const [actionLoadingKey, setActionLoadingKey] = useState<FinanceAction | null>(null);
  const [actionSuccess, setActionSuccess] = useState('');
  const [editingField, setEditingField] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function loadFinanceSubmissions() {
    if (isMountedRef.current) {
      setRowsLoading(true);
      setRowsError('');
    }

    const res = await fetch('/api/submissions/finance', { method: 'GET', cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || 'Failed to load finance submissions.');
    }

    const mapped = ((json.submissions ?? []) as FinanceApiRow[]).map((item): SubmissionRow => ({
      id: String(item.id),
      pi: item.proforma_invoice ?? '',
      entity: item.agency_brand_name || '-',
      amount: Number(item.commercials ?? 0),
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
      business_line: normalizeBusinessLine(item.business_line),
      entry_type: item.entry_type || null,
      entity_type: item.entity_type || null,
      client_type: item.client_type || null,
      agency_name: item.agency_name || null,
      agency_trade_name: item.agency_trade_name || null,
      brand_trade_name: item.brand_trade_name || null,
      finance_notes: item.finance_notes || null,
      finance_comment: item.finance_comment || undefined,
      reviewed_at: item.reviewed_at || null,
      reviewed_by_name: item.reviewed_by_name || null,
      intake_line_items: item.intake_line_items || [],
      creator_invoice_received: normalizeCreatorInvoice(item.creator_invoice_status || item.invoice_via_creators_received),
      payment_received: normalizePaymentReceived(item.payment_received_status || item.payment_received),
      payment_made: normalizePaymentMade(item.payment_made_status || item.payment_made),
      closed_status: normalizeClosedStatus(item.closure_status || item.closed),
    }));

    const piById = new Map(mapped.map((entry) => [entry.id, entry.pi]));
    const newerByPreviousId = new Set(mapped.map((entry) => entry.previous_submission_id).filter(Boolean));
    const versioned = mapped.map((entry) => ({
      ...entry,
      previous_submission_pi: entry.previous_submission_id ? piById.get(entry.previous_submission_id) || null : null,
      version_status: entry.previous_submission_id
        ? 'resubmitted'
        : newerByPreviousId.has(entry.id)
          ? 'superseded'
          : 'original',
    })) satisfies SubmissionRow[];

    if (isMountedRef.current) {
      setRows(versioned);
      setRowsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    if (!user) return;
    if (!canViewFinanceDashboard(user.role)) return;
    void loadFinanceSubmissions().catch((error) => {
      if (active) {
        setRowsError(error instanceof Error ? error.message : 'Failed to load finance submissions.');
        setRowsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (loading || !user) return;
    if (!canViewFinanceDashboard(user.role)) {
      router.replace(getDefaultDashboardPath(user.role));
    }
  }, [loading, router, user]);

  useEffect(() => {
    const submissionId = searchParams.get('submission_id');
    if (!submissionId) return;
    if (rows.some((entry) => entry.id === submissionId)) {
      setOpenId(submissionId);
    }
  }, [rows, searchParams]);

  const row = useMemo(() => rows.find((entry) => entry.id === openId) || null, [rows, openId]);

  useEffect(() => {
    if (!row || editingField) return;
    setRejectionNote(row.rejection_note || '');
    setCreatorInvoiceStatus(CREATOR_INVOICE_VALUES.includes(String(row.creator_invoice_received || 'pending')) ? String(row.creator_invoice_received || 'pending') : 'pending');
    setInvoiceStatusValue(normalizeInvoiceStatus(row.invoice_status));
    setPaymentReceivedStatus(PAYMENT_RECEIVED_VALUES.includes(String(row.payment_received || 'pending')) ? String(row.payment_received || 'pending') : 'pending');
    setPaymentMadeStatus(PAYMENT_MADE_VALUES.includes(String(row.payment_made || 'pending')) ? String(row.payment_made || 'pending') : 'pending');
    setClosureStatus(CLOSURE_VALUES.includes(String(row.closed_status || 'open')) ? String(row.closed_status || 'open') : 'open');
    setActionError('');
    setActionSuccess('');
  }, [row, editingField]);

  const employeeOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.flatMap((entry) => [entry.owner_name, entry.submitter_email]).filter(Boolean))
      ) as string[],
    [rows]
  );
  const invoiceStatusOptions = useMemo(
    () => Array.from(new Set(rows.map((entry) => entry.invoice_status).filter((status) => Boolean(status && status !== '-')))),
    [rows]
  );

  const filteredRows = useMemo(() => {
    return rows.filter((entry) => {
      const effectiveBusinessLine = normalizeBusinessLine(entry.business_line || null);
      if (businessLineFilter !== 'all' && effectiveBusinessLine !== businessLineFilter) return false;
      if (intakeStatusFilter !== 'all' && entry.intake_status !== intakeStatusFilter) return false;
      if (employeeFilter !== 'all' && entry.owner_name !== employeeFilter && entry.submitter_email !== employeeFilter) return false;
      if (invoiceStatusFilter !== 'all' && entry.invoice_status !== invoiceStatusFilter) return false;
      if (creatorInvoiceReceivedFilter !== 'all' && entry.creator_invoice_received !== creatorInvoiceReceivedFilter) return false;
      if (paymentReceivedFilter !== 'all' && entry.payment_received !== paymentReceivedFilter) return false;
      if (paymentMadeFilter !== 'all' && entry.payment_made !== paymentMadeFilter) return false;
      if (closedStatusFilter !== 'all' && entry.closed_status !== closedStatusFilter) return false;
      if (versionStatusFilter !== 'all' && (entry.version_status || 'original') !== versionStatusFilter) return false;
      if (dateFrom && new Date(entry.submitted_at) < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && new Date(entry.submitted_at) > new Date(`${dateTo}T23:59:59`)) return false;

      const haystack = [
        entry.pi,
        entry.entity,
        entry.owner_name,
        entry.submitter_email,
        entry.creator_creators_name,
        entry.brand_name,
        entry.agency_name,
        entry.agency_trade_name,
        entry.brand_trade_name,
        entry.campaign_code,
        entry.campaign_name,
        entry.campaign_brand,
        ...(entry.intake_line_items ?? []).flatMap((item) => [item.creator_name, item.brand_name, item.deliverable_name]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [
    rows,
    businessLineFilter,
    intakeStatusFilter,
    employeeFilter,
    invoiceStatusFilter,
    creatorInvoiceReceivedFilter,
    paymentReceivedFilter,
    paymentMadeFilter,
    closedStatusFilter,
    versionStatusFilter,
    dateFrom,
    dateTo,
    query,
  ]);

  function getActionLabel(action: FinanceAction) {
    if (actionLoadingKey !== action) {
      if (action === 'approve') return 'Approve';
      if (action === 'reject') return 'Reject';
      if (action === 'request_resubmission') return 'Request Resubmission';
      if (action === 'mark_invoice_created') return 'Mark Invoice Created';
      if (action === 'add_debit_note') return 'Add Debit Note';
      if (action === 'update_payment_status') return 'Update Payment Status';
      return 'Save Closure';
    }

    if (action === 'approve') return 'Approving...';
    if (action === 'reject') return 'Rejecting...';
    if (action === 'request_resubmission') return 'Saving...';
    if (action === 'mark_invoice_created') return 'Saving...';
    if (action === 'add_debit_note') return 'Saving...';
    if (action === 'update_payment_status') return 'Updating...';
    return 'Saving...';
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

  async function runFinanceAction(action: FinanceAction, extra: Record<string, string> = {}) {
    if (!row) return;
    if (actionSubmitting) return;
    if (!user || !canViewFinanceDashboard(user.role)) return;
    setActionSubmitting(true);
    setActionLoadingKey(action);
    setActionError('');
    setActionSuccess('');

    const { response, body } = await executeFinanceAction(row, action, extra);
    if (!response.ok || !body?.success) {
      setActionSubmitting(false);
      setActionLoadingKey(null);
      setActionError(body?.error || 'Finance action failed.');
      return;
    }
    try {
      await loadFinanceSubmissions();
      setActionSuccess(body?.message || (body?.changed === false ? 'No changes were needed.' : 'Finance action saved successfully.'));
      if (body?.changed !== false) setEditingField(null);
    } catch (error) {
      setRowsError(error instanceof Error ? error.message : 'Failed to refresh finance submissions.');
    } finally {
      setActionSubmitting(false);
      setActionLoadingKey(null);
    }
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
        action = 'request_resubmission';
        payload = { rejection_note: targetRow.rejection_note || 'Please review and resubmit.' };
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
    } else {
      action = 'update_payment_status';
      payload = { finance_notes: value };
    }

    const { response, body } = await executeFinanceAction(targetRow, action, payload);
    if (!response.ok || !body?.success) {
      return { success: false, message: body?.error || 'Finance action failed.' };
    }
    const updated = body?.submission || {};
    setRows((current) =>
      current.map((entry) =>
        entry.id !== targetRow.id
          ? entry
          : {
              ...entry,
              intake_status: updated.intake_status ?? entry.intake_status,
              invoice_status: updated.invoice_status ?? entry.invoice_status,
              invoice_number: updated.invoice_number ?? entry.invoice_number,
              debit_note_number: updated.debit_note_number ?? entry.debit_note_number,
              finance_notes: updated.finance_notes ?? entry.finance_notes,
              finance_comment: updated.finance_comment ?? entry.finance_comment,
              creator_invoice_received: updated.creator_invoice_status ?? entry.creator_invoice_received,
              payment_received: updated.payment_received_status ?? entry.payment_received,
              payment_made: updated.payment_made_status ?? entry.payment_made,
              closed_status: updated.closure_status ?? entry.closed_status,
              rejection_note: updated.rejection_note ?? entry.rejection_note,
              reviewed_at: updated.reviewed_at ?? new Date().toISOString(),
              reviewed_by_name: user.full_name,
            }
      )
    );
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

  const pendingCount = filteredRows.filter((entry) => entry.intake_status === 'submitted').length;
  const acceptedCount = filteredRows.filter((entry) => entry.intake_status === 'accepted').length;
  const rejectedCount = filteredRows.filter((entry) => entry.intake_status === 'rejected').length;
  const activeAdvancedFilterCount = [
    invoiceStatusFilter !== 'all',
    creatorInvoiceReceivedFilter !== 'all',
    paymentReceivedFilter !== 'all',
    paymentMadeFilter !== 'all',
    closedStatusFilter !== 'all',
    versionStatusFilter !== 'all',
    Boolean(dateFrom),
    Boolean(dateTo),
  ].filter(Boolean).length;

  function resetAdvancedFilters() {
    setInvoiceStatusFilter('all');
    setCreatorInvoiceReceivedFilter('all');
    setPaymentReceivedFilter('all');
    setPaymentMadeFilter('all');
    setClosedStatusFilter('all');
    setVersionStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  }
  const financePanel = row ? (
    <div className="surface" style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div>
        <strong>Finance Review</strong>
        <p className="text-muted" style={{ margin: '4px 0 0' }}>
          Mark the submission as checked if no mistakes were found, or request resubmission if the employee needs to correct something.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 12 }} className="surface">
        <label className="intake-field">
          <span className="intake-label">Resubmission Note</span>
          <textarea
            className="intake-input intake-textarea"
            rows={3}
            value={rejectionNote}
            onChange={(e) => setRejectionNote(e.target.value)}
            placeholder="Only used when requesting resubmission."
          />
        </label>
      </div>

      {actionError ? <p className="text-danger" style={{ margin: 0 }}>{actionError}</p> : null}
      {actionSuccess ? <p style={{ margin: 0, color: 'var(--success, #16a34a)' }}>{actionSuccess}</p> : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" type="button" disabled={actionSubmitting} onClick={() => void runFinanceAction('approve')}>
          {actionLoadingKey === 'approve' ? 'Marking...' : 'Mark as Checked'}
        </button>
        <button className="btn" type="button" disabled={actionSubmitting} onClick={() => void runFinanceAction('request_resubmission', { rejection_note: rejectionNote })}>
          {getActionLabel('request_resubmission')}
        </button>
      </div>

      <div>
        <strong>Finance Tracking</strong>
        <p className="text-muted" style={{ margin: '4px 0 0' }}>
          Update finance lifecycle fields one at a time. Current values stay separate from editable controls.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <TrackingRow
          label="Invoice Status"
          value={formatInvoiceStatus(row.invoice_status)}
          fieldKey="invoice_status"
          isEditing={editingField === 'invoice_status'}
          actionSubmitting={actionSubmitting}
          onEdit={() => {
            setInvoiceStatusValue(normalizeInvoiceStatus(row.invoice_status));
            setEditingField('invoice_status');
          }}
          onCancel={() => setEditingField(null)}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <select className="intake-input" value={invoiceStatusValue} onChange={(e) => setInvoiceStatusValue(e.target.value)}>
              {INVOICE_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button className="btn" type="button" disabled={actionSubmitting} onClick={() => void runFinanceAction('mark_invoice_created', { invoice_status: invoiceStatusValue })}>
              {actionLoadingKey === 'mark_invoice_created' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </TrackingRow>

        <TrackingRow
          label="Creator Invoice"
          value={formatCreatorInvoiceStatus(row.creator_invoice_received || 'pending')}
          fieldKey="creator_invoice_status"
          isEditing={editingField === 'creator_invoice_status'}
          actionSubmitting={actionSubmitting}
          onEdit={() => {
            setCreatorInvoiceStatus(CREATOR_INVOICE_VALUES.includes(String(row.creator_invoice_received || 'pending')) ? String(row.creator_invoice_received || 'pending') : 'pending');
            setEditingField('creator_invoice_status');
          }}
          onCancel={() => setEditingField(null)}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <select className="intake-input" value={creatorInvoiceStatus} onChange={(e) => setCreatorInvoiceStatus(e.target.value)}>
              {CREATOR_INVOICE_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              className="btn"
              type="button"
              disabled={actionSubmitting}
              onClick={() => void runFinanceAction('update_payment_status', { creator_invoice_status: creatorInvoiceStatus })}
            >
              {actionLoadingKey === 'update_payment_status' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </TrackingRow>

        <TrackingRow
          label="Payment Received"
          value={formatPaymentReceivedStatus(row.payment_received || 'pending')}
          fieldKey="payment_received_status"
          isEditing={editingField === 'payment_received_status'}
          actionSubmitting={actionSubmitting}
          onEdit={() => {
            setPaymentReceivedStatus(PAYMENT_RECEIVED_VALUES.includes(String(row.payment_received || 'pending')) ? String(row.payment_received || 'pending') : 'pending');
            setEditingField('payment_received_status');
          }}
          onCancel={() => setEditingField(null)}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <select className="intake-input" value={paymentReceivedStatus} onChange={(e) => setPaymentReceivedStatus(e.target.value)}>
              {PAYMENT_RECEIVED_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              className="btn"
              type="button"
              disabled={actionSubmitting}
              onClick={() => void runFinanceAction('update_payment_status', { payment_received_status: paymentReceivedStatus })}
            >
              {actionLoadingKey === 'update_payment_status' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </TrackingRow>

        <TrackingRow
          label="Payment Made"
          value={formatPaymentMadeStatus(row.payment_made || 'pending')}
          fieldKey="payment_made_status"
          isEditing={editingField === 'payment_made_status'}
          actionSubmitting={actionSubmitting}
          onEdit={() => {
            setPaymentMadeStatus(PAYMENT_MADE_VALUES.includes(String(row.payment_made || 'pending')) ? String(row.payment_made || 'pending') : 'pending');
            setEditingField('payment_made_status');
          }}
          onCancel={() => setEditingField(null)}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <select className="intake-input" value={paymentMadeStatus} onChange={(e) => setPaymentMadeStatus(e.target.value)}>
              {PAYMENT_MADE_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              className="btn"
              type="button"
              disabled={actionSubmitting}
              onClick={() => void runFinanceAction('update_payment_status', { payment_made_status: paymentMadeStatus })}
            >
              {actionLoadingKey === 'update_payment_status' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </TrackingRow>

        <TrackingRow
          label="Closure Status"
          value={formatClosureStatus(row.closed_status || 'open')}
          fieldKey="closure_status"
          isEditing={editingField === 'closure_status'}
          actionSubmitting={actionSubmitting}
          onEdit={() => {
            setClosureStatus(CLOSURE_VALUES.includes(String(row.closed_status || 'open')) ? String(row.closed_status || 'open') : 'open');
            setEditingField('closure_status');
          }}
          onCancel={() => setEditingField(null)}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <select className="intake-input" value={closureStatus} onChange={(e) => setClosureStatus(e.target.value)}>
              {CLOSURE_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button className="btn" type="button" disabled={actionSubmitting} onClick={() => void runFinanceAction('close_submission', { closure_status: closureStatus })}>
              {actionLoadingKey === 'close_submission' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </TrackingRow>

        <TrackingRow
          label="Invoice Number"
          value={row.invoice_number || 'Not set'}
          fieldKey="invoice_number"
          isEditing={editingField === 'invoice_number'}
          actionSubmitting={actionSubmitting}
          onEdit={() => {
            setInvoiceNumber(row.invoice_number || '');
            setEditingField('invoice_number');
          }}
          onCancel={() => setEditingField(null)}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <input className="intake-input" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Enter invoice number" />
            <button
              className="btn"
              type="button"
              disabled={actionSubmitting}
              onClick={() => void runFinanceAction('mark_invoice_created', { invoice_number: invoiceNumber })}
            >
              {actionLoadingKey === 'mark_invoice_created' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </TrackingRow>

        <TrackingRow
          label="Debit Note Number"
          value={row.debit_note_number || 'Not set'}
          fieldKey="debit_note_number"
          isEditing={editingField === 'debit_note_number'}
          actionSubmitting={actionSubmitting}
          onEdit={() => {
            setDebitNoteNumber(row.debit_note_number || '');
            setEditingField('debit_note_number');
          }}
          onCancel={() => setEditingField(null)}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <input className="intake-input" value={debitNoteNumber} onChange={(e) => setDebitNoteNumber(e.target.value)} placeholder="Enter debit note number" />
            <button
              className="btn"
              type="button"
              disabled={actionSubmitting}
              onClick={() => void runFinanceAction('mark_invoice_created', { debit_note_number: debitNoteNumber })}
            >
              {actionLoadingKey === 'mark_invoice_created' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </TrackingRow>

        <div className="surface" style={{ padding: 12 }}>
          <div className="text-muted" style={{ fontSize: 12 }}>Finance Notes</div>
          <div style={{ fontWeight: 600 }}>{row.finance_notes || 'No finance notes yet.'}</div>
        </div>
      </div>
    </div>
  ) : null;

  if (loading || !user || !canViewFinanceDashboard(user.role)) return null;

    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <PageHeader
          title={getFinanceDashboardTitle(user.role)}
          description="Review submissions, update invoice and payment stages, and request corrected resubmissions."
          className="gap-3 border-b-0 pb-0"
        />

        <section style={{ display: 'grid', gap: 12, marginTop: -4, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <KpiCard title="Pending Review" value={String(pendingCount)} hint="Requires finance action" compact />
          <KpiCard title="Accepted" value={String(acceptedCount)} hint="Approved by finance" compact />
          <KpiCard title="Rejected" value={String(rejectedCount)} hint="Returned with notes" compact />
        </section>

      <SectionCard padding={16}>
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.7fr))_auto]">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Search</span>
              <input className="intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search PI, creator, agency, or brand" />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Business Line</span>
              <select className="intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20" value={businessLineFilter} onChange={(e) => setBusinessLineFilter(e.target.value as 'all' | 'TM' | 'IM')}>
                <option value="all">All</option>
                <option value="TM">TM</option>
                <option value="IM">IM</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <select className="intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20" value={intakeStatusFilter} onChange={(e) => setIntakeStatusFilter(e.target.value as 'all' | 'submitted' | 'accepted' | 'rejected')}>
                <option value="all">All</option>
                <option value="submitted">Submitted</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Employee</span>
              <select className="intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
                <option value="all">All</option>
                {employeeOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button className="btn w-full xl:w-auto shrink-0" type="button" onClick={() => setShowAdvancedFilters((current) => !current)}>
                More Filters{activeAdvancedFilterCount > 0 ? ` (${activeAdvancedFilterCount})` : ''}
              </button>
            </div>
          </div>

          {showAdvancedFilters ? (
            <div className="rounded-xl border border-border/60 bg-card/90 p-3 dark:bg-card/70">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DateFilterInput label="Date From" committedValue={dateFrom} onCommit={setDateFrom} />
                <DateFilterInput label="Date To" committedValue={dateTo} onCommit={setDateTo} />
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Invoice Status</span>
                  <select className="intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20" value={invoiceStatusFilter} onChange={(e) => setInvoiceStatusFilter(e.target.value)}>
                    <option value="all">All</option>
                    {invoiceStatusOptions.map((status) => (
                      <option key={status} value={status}>{formatInvoiceStatus(status)}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Creator Invoice Received</span>
                  <select className="intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20" value={creatorInvoiceReceivedFilter} onChange={(e) => setCreatorInvoiceReceivedFilter(e.target.value as 'all' | 'received' | 'pending')}>
                    <option value="all">All</option>
                    {CREATOR_INVOICE_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Payment Received</span>
                  <select className="intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20" value={paymentReceivedFilter} onChange={(e) => setPaymentReceivedFilter(e.target.value)}>
                    <option value="all">All</option>
                    {PAYMENT_RECEIVED_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Payment Made</span>
                  <select className="intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20" value={paymentMadeFilter} onChange={(e) => setPaymentMadeFilter(e.target.value)}>
                    <option value="all">All</option>
                    {PAYMENT_MADE_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Closed Status</span>
                  <select className="intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20" value={closedStatusFilter} onChange={(e) => setClosedStatusFilter(e.target.value)}>
                    <option value="all">All</option>
                    {CLOSURE_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Version Status</span>
                  <select className="intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20" value={versionStatusFilter} onChange={(e) => setVersionStatusFilter(e.target.value as 'all' | 'original' | 'resubmitted' | 'superseded')}>
                    <option value="all">All</option>
                    <option value="original">Original</option>
                    <option value="resubmitted">Resubmitted</option>
                    <option value="superseded">Superseded</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <button className="btn" type="button" onClick={resetAdvancedFilters}>Reset Advanced</button>
              </div>
            </div>
          ) : null}
        </div>
      </SectionCard>

      {rowsLoading ? <StatePanel>Loading finance submissions...</StatePanel> : null}
      {rowsError ? <StatePanel tone="danger">{rowsError}</StatePanel> : null}

      {!rowsLoading && !rowsError ? (
        <SubmissionTable
          rows={filteredRows}
          onOpen={setOpenId}
          columns={['pi', 'owner_name', 'entity', 'amount', 'intake_status', 'invoice_status', 'submitted_at', 'actions']}
          emptyLabel="No finance submissions found for the current filters."
          viewer={user.role === 'admin' ? 'admin' : 'finance'}
          getActionLabel={() => 'View / Edit'}
          onFinanceUpdate={updateFinanceCell}
        />
      ) : null}

      <SubmissionDrawer
        open={Boolean(row)}
        onClose={() => setOpenId(null)}
        row={row}
        viewer={getDrawerViewerRole(user.role)}
        financePanel={financePanel}
      />
    </div>
  );
}
