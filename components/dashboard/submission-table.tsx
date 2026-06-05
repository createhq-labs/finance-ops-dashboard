"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
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
} from '../../lib/client/finance-status';

export type SubmissionRow = {
  id: string;
  pi: string;
  entity: string;
  amount: number;
  owner_name?: string;
  submitter_email?: string;
  intake_status: 'submitted' | 'rejected' | 'accepted';
  invoice_status: string;
  sync_status: 'pending_sheet_sync' | 'synced' | 'failed';
  submitted_at: string;
  rejection_note?: string | null;
  creator_invoice_received?: 'received' | 'pending' | string;
  payment_received?: 'received' | 'pending' | 'partial' | 'full' | 'not_received' | string;
  payment_made?: 'paid' | 'pending' | 'partial' | 'full' | 'not_paid' | string;
  closed_status?: 'open' | 'closed' | 'cancelled' | string;
  finance_comment?: string | null;
  invoice_number?: string | null;
  debit_note_number?: string | null;
  comments?: string;
  trade_name?: string | null;
  gst_number?: string | null;
  address?: string | null;
  bill_due?: string | null;
  invoice_type?: string | null;
  creator_creators_name?: string | null;
  brand_name?: string | null;
  campaign_code?: string | null;
  campaign_name?: string | null;
  campaign_brand?: string | null;
  campaign_notes?: string | null;
  deliverables?: string | null;
  additional_agency_commission?: number | null;
  reimbursement_amount?: number | null;
  reimbursement_receipts?: string | null;
  additional_information?: string | null;
  previous_submission_id?: string | null;
  previous_submission_pi?: string | null;
  version_status?: 'original' | 'resubmitted' | 'superseded';
  business_line?: 'TM' | 'IM' | string | null;
  entity_type?: 'Agency' | 'Brand' | string | null;
  client_type?: 'Indian' | 'Foreign' | string | null;
  agency_name?: string | null;
  agency_trade_name?: string | null;
  brand_trade_name?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
  integration_metadata?: {
    submitterName?: string;
    businessLine?: 'TM' | 'IM' | string;
    entryType?: 'SC' | 'MC' | null;
    entityType?: 'Agency' | 'Brand' | string;
    clientType?: 'Indian' | 'Foreign' | string;
    billingBrandName?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
    campaignCode?: string;
    campaignName?: string;
    campaignBrand?: string;
    campaignDeliverable?: string;
    campaignNotes?: string;
    brandNamesText?: string;
  } | null;
  intake_line_items?: Array<{
    creator_name?: string | null;
    brand_name?: string | null;
    deliverable_name?: string | null;
    amount?: number | null;
    line_order?: number | null;
  }>;
};

export type SubmissionTableColumn =
  | 'pi'
  | 'entity'
  | 'owner_name'
  | 'amount'
  | 'intake_status'
  | 'invoice_status'
  | 'sync_status'
  | 'submitted_at'
  | 'rejection_note'
  | 'actions';

type ViewerRole = 'employee' | 'team_lead' | 'finance' | 'admin' | 'developer';
type FinanceEditableField =
  | 'intake_status'
  | 'invoice_status'
  | 'creator_invoice_received'
  | 'payment_received'
  | 'payment_made'
  | 'closed_status'
  | 'finance_comment';

type FinanceUpdateResult = {
  success: boolean;
  message?: string;
  nextValue?: string;
  nextRowPatch?: Partial<SubmissionRow>;
};

type SheetColumnId =
  | 'pi'
  | 'submitted_at'
  | 'intake_status'
  | 'invoice_status'
  | 'payment_received'
  | 'payment_made'
  | 'closed_status'
  | 'email_address'
  | 'business_line'
  | 'entry_type'
  | 'entity_type'
  | 'client_type'
  | 'agency_name'
  | 'agency_trade_name'
  | 'brand_name'
  | 'brand_trade_name'
  | 'gst_number'
  | 'address'
  | 'city'
  | 'state'
  | 'country'
  | 'pincode'
  | 'invoice_type'
  | 'bill_due'
  | 'creator_name'
  | 'creator_brand'
  | 'deliverables'
  | 'line_amounts'
  | 'campaign_code'
  | 'campaign_name'
  | 'campaign_brand'
  | 'campaign_notes'
  | 'product_reimbursement_upload'
  | 'commercials'
  | 'additional_agency_commission'
  | 'additional_information'
  | 'invoice_number'
  | 'debit_note_number'
  | 'creator_invoice_received'
  | 'finance_comment'
  | 'actions';

type FlashState = {
  key: string;
  message: string;
  tone: 'success' | 'error' | 'warning';
};

const COLUMN_TITLES: Record<SheetColumnId, string> = {
  pi: 'PI Number',
  submitted_at: 'Submitted At',
  intake_status: 'Intake Status',
  invoice_status: 'Invoice Status',
  payment_received: 'Payment Received',
  payment_made: 'Payment Made',
  closed_status: 'Closure Status',
  email_address: 'Email Address',
  business_line: 'Business Line',
  entry_type: 'Entry Type',
  entity_type: 'Entity Type',
  client_type: 'Client Type',
  agency_name: 'Agency Name',
  agency_trade_name: 'Agency Trade Name',
  brand_name: 'Brand Name',
  brand_trade_name: 'Brand Trade Name',
  gst_number: 'GST Number',
  address: 'Address',
  city: 'City',
  state: 'State',
  country: 'Country',
  pincode: 'Pincode',
  invoice_type: 'Invoice Type',
  bill_due: 'Bill Due',
  creator_name: 'Creator / Creators',
  creator_brand: 'Creator Brand / Brand(s)',
  deliverables: 'Deliverable(s)',
  line_amounts: 'Amount(s)',
  campaign_code: 'Campaign Code',
  campaign_name: 'Campaign Name',
  campaign_brand: 'Campaign Brand',
  campaign_notes: 'Campaign Notes',
  product_reimbursement_upload: 'Product Reimbursement Upload',
  commercials: 'Commercials / Total Amount',
  additional_agency_commission: 'Additional Agency Commission',
  additional_information: 'Additional Information',
  invoice_number: 'Invoice Number',
  debit_note_number: 'Debit Note Number',
  creator_invoice_received: 'Creator Invoice',
  finance_comment: 'Finance Comment',
  actions: 'View',
};

const COLUMN_WIDTHS: Record<SheetColumnId, number> = {
  pi: 144,
  submitted_at: 148,
  intake_status: 144,
  invoice_status: 150,
  payment_received: 160,
  payment_made: 152,
  closed_status: 144,
  email_address: 182,
  business_line: 102,
  entry_type: 126,
  entity_type: 110,
  client_type: 110,
  agency_name: 166,
  agency_trade_name: 166,
  brand_name: 166,
  brand_trade_name: 166,
  gst_number: 144,
  address: 220,
  city: 122,
  state: 122,
  country: 122,
  pincode: 102,
  invoice_type: 110,
  bill_due: 110,
  creator_name: 172,
  creator_brand: 172,
  deliverables: 192,
  line_amounts: 124,
  campaign_code: 128,
  campaign_name: 168,
  campaign_brand: 158,
  campaign_notes: 182,
  product_reimbursement_upload: 168,
  commercials: 146,
  additional_agency_commission: 146,
  additional_information: 182,
  invoice_number: 146,
  debit_note_number: 146,
  creator_invoice_received: 162,
  finance_comment: 188,
  actions: 108,
};

const STICKY_LEFTS: Record<'pi' | 'intake_status', number> = {
  pi: 0,
  intake_status: COLUMN_WIDTHS.pi,
};

const STATUS_AUDIT_FIELDS = new Set<FinanceEditableField>([
  'intake_status',
  'invoice_status',
  'creator_invoice_received',
  'payment_received',
  'payment_made',
  'closed_status',
]);

const STATUS_PILL_BASE =
  'inline-flex min-h-8 items-center gap-2 rounded-full border px-3 py-1.5 text-[0.8rem] font-semibold tracking-[-0.01em] shadow-sm transition duration-100';

function money(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function fieldValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function normalizeText(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

function sortLineItems(row: SubmissionRow) {
  return [...(row.intake_line_items || [])].sort((a, b) => (a.line_order ?? 0) - (b.line_order ?? 0));
}

function uniqueList(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => (item || '').trim()).filter(Boolean)));
}

function joinLines(values: Array<string | null | undefined>) {
  const items = uniqueList(values);
  return items.length ? items.join('\n') : '-';
}

function businessLineLabel(row: SubmissionRow) {
  const raw = row.business_line || row.integration_metadata?.businessLine || '';
  const normalized = normalizeText(raw);
  if (normalized === 'tm' || normalized === 'talent management') return 'Talent Management';
  if (normalized === 'im' || normalized === 'influencer marketing') return 'Influencer Marketing';
  return fieldValue(raw || '-');
}

function entryTypeLabel(row: SubmissionRow) {
  const raw = row.integration_metadata?.entryType || '';
  if (raw === 'SC') return 'Single Creator';
  if (raw === 'MC') return 'Multiple Creators';
  return '-';
}

function getCreatorData(row: SubmissionRow) {
  const lineItems = sortLineItems(row);
  const isTM = businessLineLabel(row) === 'Talent Management';
  const creatorNames = joinLines(
    lineItems.map((item) => item.creator_name).length ? lineItems.map((item) => item.creator_name) : [row.creator_creators_name]
  );
  const creatorBrands = joinLines(
    lineItems.map((item) => item.brand_name).length ? lineItems.map((item) => item.brand_name) : [row.brand_name]
  );
  const deliverables = joinLines(
    lineItems.map((item) => item.deliverable_name).length
      ? lineItems.map((item) => item.deliverable_name)
      : [row.deliverables || row.integration_metadata?.campaignDeliverable]
  );
  const amounts = lineItems.some((item) => item.amount)
    ? joinLines(lineItems.map((item) => (item.amount ? money(item.amount) : null)))
    : money(row.amount);

  if (!isTM) {
    return {
      creatorNames: '-',
      creatorBrands: '-',
      deliverables: fieldValue(row.deliverables || row.integration_metadata?.campaignDeliverable),
      amounts: money(row.amount),
    };
  }

  return { creatorNames, creatorBrands, deliverables, amounts };
}

function hasProductReimbursement(row: SubmissionRow) {
  const deliverableText = [row.deliverables, ...(row.intake_line_items || []).map((item) => item.deliverable_name)]
    .join(' ')
    .toLowerCase();
  return deliverableText.includes('product reimbursement');
}

function formatSubmittedAt(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fieldValue(value);
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function normalizeInvoiceStatusValue(value: string | null | undefined) {
  const normalized = normalizeText(value).replace(/\s+/g, '_');
  if (normalized === 'invoice_created') return 'invoice_created';
  if (normalized === 'po_created/estimate' || normalized === 'po_created_estimate' || normalized === 'po_createdestimate') {
    return 'po_created_estimate';
  }
  if (normalized === 'invoice_cancelled') return 'invoice_cancelled';
  if (normalized === 'debit_note') return 'debit_note';
  if (normalized === 'invoice_+_debit_note' || normalized === 'invoice_plus_debit_note') return 'invoice_plus_debit_note';
  return 'invoice_pending';
}

function getEditableOptions(field: Exclude<FinanceEditableField, 'finance_comment'>) {
  if (field === 'invoice_status') return INVOICE_STATUS_OPTIONS;
  if (field === 'creator_invoice_received') return CREATOR_INVOICE_STATUS_OPTIONS;
  if (field === 'payment_received') return PAYMENT_RECEIVED_STATUS_OPTIONS;
  if (field === 'payment_made') return PAYMENT_MADE_STATUS_OPTIONS;
  if (field === 'closed_status') return CLOSURE_STATUS_OPTIONS;
  return [
    { value: 'submitted', label: 'Submitted' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'rejected', label: 'Resubmission Requested' },
  ];
}

function getEditableValue(row: SubmissionRow, field: Exclude<FinanceEditableField, 'finance_comment'>) {
  if (field === 'invoice_status') return normalizeInvoiceStatusValue(row.invoice_status);
  if (field === 'creator_invoice_received') return row.creator_invoice_received || 'pending';
  if (field === 'payment_received') return row.payment_received || 'pending';
  if (field === 'payment_made') return row.payment_made || 'pending';
  if (field === 'closed_status') return row.closed_status || 'open';
  return row.intake_status;
}

function renderStatusLabel(field: Exclude<FinanceEditableField, 'finance_comment'>, value: string | null | undefined) {
  if (field === 'invoice_status') return formatInvoiceStatus(value);
  if (field === 'creator_invoice_received') return formatCreatorInvoiceStatus(value);
  if (field === 'payment_received') return formatPaymentReceivedStatus(value);
  if (field === 'payment_made') return formatPaymentMadeStatus(value);
  if (field === 'closed_status') return formatClosureStatus(value);
  if (!value) return 'Pending';
  if (value === 'accepted') return 'Accepted';
  if (value === 'rejected') return 'Resubmission';
  return 'Submitted';
}

function truncateStatusLabel(label: string) {
  if (label.length <= 12) return label;
  const firstWord = label.split(/\s+/)[0] || label;
  if (firstWord.length >= 7) return `${firstWord.slice(0, 10)}...`;
  return `${label.slice(0, 9).trim()}...`;
}

function getStatusTone(field: Exclude<FinanceEditableField, 'finance_comment'>, value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (normalized === 'invoice_created') {
    return 'border-cyan-300/90 bg-cyan-500/16 text-cyan-900 dark:border-cyan-300/35 dark:bg-cyan-300/16 dark:text-cyan-50';
  }
  if (
    normalized === 'accepted' ||
    normalized === 'full' ||
    normalized === 'paid' ||
    normalized === 'closed' ||
    normalized === 'received'
  ) {
    return 'border-emerald-300/90 bg-emerald-500/16 text-emerald-900 dark:border-emerald-300/35 dark:bg-emerald-300/16 dark:text-emerald-50';
  }
  if (
    (field === 'intake_status' && normalized === 'rejected') ||
    normalized === 'partial' ||
    normalized === 'partial_left' ||
    normalized === 'advance_received' ||
    normalized === 'advance_past_due' ||
    normalized === 'gst_left' ||
    normalized === 'part_payment_against_advance' ||
    normalized === 'multiple_creators'
  ) {
    return 'border-orange-300/90 bg-orange-500/16 text-orange-900 dark:border-orange-300/35 dark:bg-orange-300/16 dark:text-orange-50';
  }
  if (
    normalized === 'not_paid' ||
    normalized === 'not_received' ||
    normalized === 'issues' ||
    normalized === 'past_due'
  ) {
    return 'border-rose-300/90 bg-rose-500/16 text-rose-900 dark:border-rose-300/35 dark:bg-rose-300/16 dark:text-rose-50';
  }
  if (normalized === 'invoice_cancelled' || normalized === 'cancelled') {
    return 'border-slate-300/90 bg-slate-500/14 text-slate-800 dark:border-slate-300/30 dark:bg-slate-300/14 dark:text-slate-100';
  }
  return 'border-amber-300/90 bg-amber-500/16 text-amber-900 dark:border-amber-300/35 dark:bg-amber-300/16 dark:text-amber-50';
}

function getColumns(viewer: ViewerRole) {
  const sharedEmployeeFields: SheetColumnId[] = [
    'email_address',
    'business_line',
    'entry_type',
    'entity_type',
    'client_type',
    'agency_name',
    'agency_trade_name',
    'brand_name',
    'brand_trade_name',
    'gst_number',
    'address',
    'city',
    'state',
    'country',
    'pincode',
    'invoice_type',
    'bill_due',
    'creator_name',
    'creator_brand',
    'deliverables',
    'line_amounts',
    'campaign_code',
    'campaign_name',
    'campaign_brand',
    'campaign_notes',
    'product_reimbursement_upload',
    'commercials',
    'additional_agency_commission',
    'additional_information',
  ];

  if (viewer === 'employee') {
    return [
      'pi',
      'intake_status',
      'submitted_at',
      'invoice_status',
      'payment_received',
      'payment_made',
      'closed_status',
      ...sharedEmployeeFields,
      'actions',
    ] satisfies SheetColumnId[];
  }

  if (viewer === 'finance' || viewer === 'admin') {
    return [
      'pi',
      'intake_status',
      'submitted_at',
      ...sharedEmployeeFields,
      'invoice_status',
      'invoice_number',
      'debit_note_number',
      'creator_invoice_received',
      'payment_received',
      'payment_made',
      'closed_status',
      'finance_comment',
      'actions',
    ] satisfies SheetColumnId[];
  }

  return ['pi', 'intake_status', 'submitted_at', ...sharedEmployeeFields, 'actions'] satisfies SheetColumnId[];
}

function formatAuditDate(value: string | null | undefined) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fieldValue(value);
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function flashToneClasses(tone: FlashState['tone']) {
  if (tone === 'success') return 'bg-emerald-500 text-white dark:bg-emerald-300 dark:text-slate-950';
  if (tone === 'error') return 'bg-rose-500 text-white dark:bg-rose-300 dark:text-slate-950';
  return 'bg-amber-500 text-white dark:bg-amber-300 dark:text-slate-950';
}

function CopyNotice({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg dark:bg-cyan-100 dark:text-slate-950">
      Copied
    </span>
  );
}

function ExpandableText({
  value,
  copied,
  onCopy,
}: {
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const needsClamp = value.length > 42 || value.includes('\n');

  useEffect(() => {
    if (!expanded) return undefined;
    function handleOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [expanded]);

  return (
    <div ref={ref} className="relative max-w-full" onDoubleClick={onCopy} title={value}>
      <CopyNotice active={copied} />
      <div
        className={[
          'whitespace-pre-line break-words pr-8 text-[0.82rem] leading-5 text-slate-700 dark:text-slate-100',
          expanded ? '' : 'line-clamp-2',
        ].join(' ')}
      >
        {value}
      </div>
      {needsClamp ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="absolute bottom-0 right-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-[0.72rem] font-bold text-cyan-700 transition hover:bg-cyan-500/12 hover:text-cyan-900 dark:text-cyan-200 dark:hover:bg-cyan-300/12"
          aria-label={expanded ? 'Collapse cell' : 'Expand cell'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      ) : null}
    </div>
  );
}

function AuditPopover({
  rect,
  row,
  onClose,
}: {
  rect: DOMRect;
  row: SubmissionRow;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleClose(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('[data-audit-popover="true"]')) return;
      onClose();
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClose);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClose);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const top = rect.bottom + 10;
  const left = Math.max(12, rect.left - 70);

  return createPortal(
    <div
      data-audit-popover="true"
      className="fixed z-[9999] w-64 rounded-2xl border border-cyan-300/35 bg-white/98 p-4 text-left shadow-[0_28px_80px_-38px_rgba(15,74,145,0.45)] dark:border-cyan-400/28 dark:bg-[#07111d]"
      style={{ top, left }}
    >
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200">Status Audit</div>
      <div className="mt-3 grid gap-3">
        <div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Updated By</div>
          <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-50">{row.reviewed_by_name || 'Finance Team'}</div>
        </div>
        <div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Updated At</div>
          <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-50">{formatAuditDate(row.reviewed_at)}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function FinanceCommentCell({
  row,
  onSave,
  saving,
  copied,
  onCopy,
}: {
  row: SubmissionRow;
  onSave?: (row: SubmissionRow, field: FinanceEditableField, value: string) => Promise<FinanceUpdateResult>;
  saving: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  const [draft, setDraft] = useState(row.finance_comment || '');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setDraft(row.finance_comment || '');
  }, [row.finance_comment, row.id]);

  async function commit() {
    const next = draft.trim();
    if (!onSave || next === (row.finance_comment || '').trim()) return;
    await onSave(row, 'finance_comment', next);
  }

  return (
    <div className="relative" onDoubleClick={onCopy}>
      <CopyNotice active={copied} />
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        disabled={saving}
        placeholder="Add comment"
        rows={expanded ? 5 : 2}
        className={[
          'w-full resize-none rounded-2xl border border-slate-200/80 bg-white px-3 py-2 pr-9 text-[0.82rem] leading-5 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/25 disabled:cursor-wait disabled:opacity-70 dark:border-cyan-400/18 dark:bg-slate-950/85 dark:text-slate-100 dark:placeholder:text-slate-500',
          expanded ? '' : 'line-clamp-2',
        ].join(' ')}
      />
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="absolute bottom-1 right-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-[0.72rem] font-bold text-cyan-700 transition hover:bg-cyan-500/12 dark:text-cyan-200"
        aria-label={expanded ? 'Collapse finance comment' : 'Expand finance comment'}
      >
        {expanded ? '^' : 'v'}
      </button>
    </div>
  );
}

function BadgeSelectCell({
  row,
  field,
  editable,
  label,
  value,
  saving,
  copied,
  onCopy,
  onChange,
  onOpenAudit,
}: {
  row: SubmissionRow;
  field: Exclude<FinanceEditableField, 'finance_comment'>;
  editable: boolean;
  label: string;
  value: string;
  saving: boolean;
  copied: boolean;
  onCopy: () => void;
  onChange: (value: string) => Promise<void>;
  onOpenAudit?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const tone = getStatusTone(field, value);
  const currentValue = getEditableValue(row, field);

  return (
    <div className="relative inline-flex max-w-full items-center gap-2" onDoubleClick={onCopy}>
      <CopyNotice active={copied} />
      <div className="group/status relative inline-flex max-w-full items-center">
        <span
          className={[STATUS_PILL_BASE, 'max-w-[132px]', tone, saving ? 'ring-2 ring-cyan-300/60 shadow-cyan-300/40' : ''].join(' ')}
          title={saving ? 'Saving...' : label}
        >
          <span className="truncate">{saving ? 'Saving...' : truncateStatusLabel(label)}</span>
          {editable ? <span className="text-[0.68rem] font-bold opacity-80">v</span> : null}
        </span>
        <span className="pointer-events-none absolute bottom-full left-1/2 z-[70] mb-2 min-w-36 max-w-64 -translate-x-1/2 rounded-2xl border border-cyan-200/80 bg-white/95 px-3 py-2 text-center text-xs font-semibold text-slate-900 opacity-0 shadow-[0_18px_48px_-28px_rgba(15,104,168,0.52)] transition duration-100 group-hover/status:-translate-y-0.5 group-hover/status:opacity-100 dark:border-cyan-400/24 dark:bg-[#07111d]/95 dark:text-slate-50">
          {saving ? 'Saving...' : label}
        </span>
        {editable ? (
          <select
            value={currentValue}
            disabled={saving}
            onChange={(event) => void onChange(event.target.value)}
            onDoubleClick={onCopy}
            className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
            aria-label={COLUMN_TITLES[field as SheetColumnId]}
          >
            {getEditableOptions(field).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {onOpenAudit ? (
        <button
          type="button"
          onClick={onOpenAudit}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-950 transition duration-100 hover:bg-slate-900/6 dark:text-slate-100 dark:hover:bg-white/8"
          aria-label="Open audit details"
          title="Status audit"
        >
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[0.62rem] font-semibold leading-none opacity-80">
            i
          </span>
        </button>
      ) : null}
    </div>
  );
}

export function SubmissionTable({
  rows,
  onOpen,
  columns,
  emptyLabel,
  getActionLabel,
  viewer = 'employee',
  onFinanceUpdate,
}: {
  rows: SubmissionRow[];
  onOpen?: (id: string) => void;
  columns?: SubmissionTableColumn[];
  emptyLabel?: string;
  getActionLabel?: (row: SubmissionRow) => string;
  viewer?: ViewerRole;
  onFinanceUpdate?: (row: SubmissionRow, field: FinanceEditableField, value: string) => Promise<FinanceUpdateResult>;
}) {
  void columns;
  const activeColumns = useMemo(() => getColumns(viewer), [viewer]);
  const isFinanceViewer = viewer === 'finance' || viewer === 'admin';
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [auditPopover, setAuditPopover] = useState<{ key: string; rect: DOMRect; row: SubmissionRow } | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; columnIndex: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => setFlash(null), 1400);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    if (!copiedKey) return undefined;
    const timer = window.setTimeout(() => setCopiedKey(null), 1200);
    return () => window.clearTimeout(timer);
  }, [copiedKey]);

  const copyCell = useCallback(async (key: string, text: string) => {
    const value = text.trim();
    if (!value || value === '-') return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
    } catch {
      setFlash({ key, message: 'Copy failed', tone: 'error' });
    }
  }, []);

  const updateFinanceValue = useCallback(
    async (row: SubmissionRow, field: FinanceEditableField, value: string) => {
      if (!onFinanceUpdate) return;
      if (field === 'invoice_status') {
        const confirmed = window.confirm('Update invoice status for this submission?');
        if (!confirmed) return;
      }
      if (field === 'intake_status' && value === 'submitted') return;

      const key = `${row.id}:${field}`;
      setSavingKey(key);
      setFlash({ key, message: 'Saving...', tone: 'warning' });
      const result = await onFinanceUpdate(row, field, value);
      setSavingKey(null);
      if (result.success) {
        setFlash({
          key,
          message: result.message === 'No changes were needed.' ? 'No change' : 'Updated',
          tone: result.message === 'No changes were needed.' ? 'warning' : 'success',
        });
      } else {
        setFlash({ key, message: result.message || 'Update failed', tone: 'error' });
      }
    },
    [onFinanceUpdate]
  );

  function openAudit(row: SubmissionRow, field: FinanceEditableField, event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setAuditPopover({ key: `${row.id}:${field}`, rect, row });
  }

  function stickyStyle(column: SheetColumnId, hovered: boolean): CSSProperties | undefined {
    if (column !== 'pi' && column !== 'intake_status') return undefined;
    return {
      position: 'sticky',
      left: STICKY_LEFTS[column],
      zIndex: column === 'intake_status' ? 24 : 23,
      background: hovered ? 'rgb(232, 245, 255)' : 'rgb(255,255,255)',
      boxShadow: '10px 0 28px -24px rgba(14, 67, 120, 0.42)',
    };
  }

  function stickyHeaderStyle(column: SheetColumnId): CSSProperties | undefined {
    if (column !== 'pi' && column !== 'intake_status') return undefined;
    return {
      position: 'sticky',
      left: STICKY_LEFTS[column],
      zIndex: column === 'intake_status' ? 48 : 47,
      background: 'linear-gradient(135deg, #16a6e0 0%, #1db7ea 48%, #47caef 100%)',
      boxShadow: '10px 0 28px -24px rgba(17, 138, 193, 0.52)',
    };
  }

  function focusCell(rowIndex: number, columnIndex: number) {
    const nextRow = Math.max(0, Math.min(rows.length - 1, rowIndex));
    const nextColumn = Math.max(0, Math.min(activeColumns.length - 1, columnIndex));
    setFocusedCell({ rowIndex: nextRow, columnIndex: nextColumn });
    window.requestAnimationFrame(() => {
      const cell = viewportRef.current?.querySelector<HTMLElement>(
        `[data-sheet-cell="${nextRow}:${nextColumn}"]`
      );
      cell?.focus({ preventScroll: true });
      cell?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
  }

  function handleCellKeyDown(event: ReactKeyboardEvent<HTMLTableCellElement>, rowIndex: number, columnIndex: number) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusCell(rowIndex, columnIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusCell(rowIndex, columnIndex - 1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusCell(rowIndex + 1, columnIndex);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusCell(rowIndex - 1, columnIndex);
    }
  }

  function renderCell(column: SheetColumnId, row: SubmissionRow) {
    const cellKey = `${row.id}:${column}`;
    const creatorData = getCreatorData(row);
    const isCopied = copiedKey === cellKey;
    const isSaving = savingKey === `${row.id}:${column}`;
    const commonText = (value: string) => (
      <ExpandableText value={value} copied={isCopied} onCopy={() => void copyCell(cellKey, value)} />
    );

    switch (column) {
      case 'pi':
        {
          const piClasses =
            row.version_status === 'superseded'
              ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100'
              : row.version_status === 'resubmitted'
                ? 'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/12 dark:text-blue-100'
                : 'border-slate-300/80 bg-slate-100 text-slate-700 dark:border-slate-300/12 dark:bg-slate-200/10 dark:text-slate-100';
        return (
          <div className="relative" onDoubleClick={() => void copyCell(cellKey, row.pi)}>
            <CopyNotice active={isCopied} />
            <span className={['inline-flex rounded-full border px-3.5 py-1.5 text-[0.9rem] font-semibold tracking-[-0.01em]', piClasses].join(' ')}>
              {row.pi}
            </span>
          </div>
        );
        }
      case 'submitted_at':
        return commonText(formatSubmittedAt(row.submitted_at));
      case 'intake_status':
      case 'invoice_status':
      case 'creator_invoice_received':
      case 'payment_received':
      case 'payment_made':
      case 'closed_status': {
        const field = column as Exclude<FinanceEditableField, 'finance_comment'>;
        const rawValue = String(getEditableValue(row, field) || '');
        const label = renderStatusLabel(field, rawValue);
        const editable = isFinanceViewer && Boolean(onFinanceUpdate);
        return (
          <BadgeSelectCell
            row={row}
            field={field}
            editable={editable}
            label={label}
            value={rawValue}
            saving={isSaving}
            copied={isCopied}
            onCopy={() => void copyCell(cellKey, label)}
            onChange={(value) => updateFinanceValue(row, field, value)}
            onOpenAudit={editable && STATUS_AUDIT_FIELDS.has(field) ? (event) => openAudit(row, field, event) : undefined}
          />
        );
      }
      case 'email_address':
        return commonText(fieldValue(row.submitter_email));
      case 'business_line':
        return commonText(businessLineLabel(row));
      case 'entry_type':
        return commonText(entryTypeLabel(row));
      case 'entity_type':
        return commonText(fieldValue(row.entity_type || row.integration_metadata?.entityType));
      case 'client_type':
        return commonText(fieldValue(row.client_type || row.integration_metadata?.clientType));
      case 'agency_name':
        return commonText(fieldValue(row.agency_name));
      case 'agency_trade_name':
        return commonText(fieldValue(row.agency_trade_name));
      case 'brand_name':
        return commonText(fieldValue(row.brand_name || row.integration_metadata?.billingBrandName));
      case 'brand_trade_name':
        return commonText(fieldValue(row.brand_trade_name));
      case 'gst_number':
        return commonText(fieldValue(row.gst_number));
      case 'address':
        return commonText(fieldValue(row.address));
      case 'city':
        return commonText(fieldValue(row.integration_metadata?.city));
      case 'state':
        return commonText(fieldValue(row.integration_metadata?.state));
      case 'country':
        return commonText(fieldValue(row.integration_metadata?.country));
      case 'pincode':
        return commonText(fieldValue(row.integration_metadata?.pincode));
      case 'invoice_type':
        return commonText(fieldValue(row.invoice_type));
      case 'bill_due':
        return commonText(fieldValue(row.bill_due));
      case 'creator_name':
        return commonText(creatorData.creatorNames);
      case 'creator_brand':
        return commonText(creatorData.creatorBrands);
      case 'deliverables':
        return commonText(creatorData.deliverables);
      case 'line_amounts':
        return commonText(creatorData.amounts);
      case 'campaign_code':
        return commonText(fieldValue(row.campaign_code || row.integration_metadata?.campaignCode));
      case 'campaign_name':
        return commonText(fieldValue(row.campaign_name || row.integration_metadata?.campaignName));
      case 'campaign_brand':
        return commonText(fieldValue(row.campaign_brand || row.integration_metadata?.campaignBrand));
      case 'campaign_notes':
        return commonText(fieldValue(row.campaign_notes || row.integration_metadata?.campaignNotes));
      case 'product_reimbursement_upload':
        return commonText(hasProductReimbursement(row) ? fieldValue(row.reimbursement_receipts) : '-');
      case 'commercials':
        return commonText(money(row.amount));
      case 'additional_agency_commission':
        return commonText(row.additional_agency_commission ? money(row.additional_agency_commission) : '-');
      case 'additional_information':
        return commonText(fieldValue(row.additional_information));
      case 'invoice_number':
        return commonText(fieldValue(row.invoice_number));
      case 'debit_note_number':
        return commonText(fieldValue(row.debit_note_number));
      case 'finance_comment':
        return isFinanceViewer ? (
          <FinanceCommentCell
            row={row}
            onSave={onFinanceUpdate}
            saving={isSaving}
            copied={isCopied}
            onCopy={() => void copyCell(cellKey, row.finance_comment || '')}
          />
        ) : commonText(fieldValue(row.finance_comment));
      case 'actions':
        return (
          <button
            type="button"
            onClick={() => onOpen?.(row.id)}
            className="inline-flex items-center rounded-full border border-cyan-300/60 bg-white px-3.5 py-1.5 text-[0.8rem] font-semibold text-slate-800 shadow-sm transition duration-100 hover:border-cyan-400 hover:bg-cyan-500/8 hover:text-cyan-900 dark:border-cyan-400/18 dark:bg-slate-950/70 dark:text-slate-100 dark:hover:bg-cyan-400/12 dark:hover:text-cyan-100"
          >
            {getActionLabel ? getActionLabel(row) : 'View'}
          </button>
        );
      default:
        return commonText('-');
    }
  }

  return (
    <div className="max-w-full overflow-hidden rounded-[22px] border border-slate-200/85 bg-white/95 shadow-[0_18px_50px_-38px_rgba(22,82,142,0.28)] dark:border-cyan-400/14 dark:bg-[#07111d]">
      <div
        ref={viewportRef}
        className="max-w-full overflow-auto"
        style={{
          maxHeight: '610px',
          scrollSnapType: 'x proximity',
          overscrollBehaviorX: 'contain',
          overscrollBehaviorY: 'contain',
          position: 'relative',
          isolation: 'isolate',
          touchAction: 'pan-x pan-y',
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          scrollbarGutter: 'stable both-edges',
          willChange: 'scroll-position',
          contain: 'paint layout',
        }}
      >
        <table className="min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {activeColumns.map((column) => (
                <th
                  key={column}
                  className="snap-start border-b border-r border-cyan-100/70 bg-[linear-gradient(135deg,#16a6e0_0%,#1db7ea_48%,#47caef_100%)] px-2.5 py-2 text-left text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.14)]"
                  style={{
                    width: COLUMN_WIDTHS[column],
                    minWidth: COLUMN_WIDTHS[column],
                    top: 0,
                    zIndex: 42,
                    position: 'sticky',
                    ...stickyHeaderStyle(column),
                  }}
                >
                  {COLUMN_TITLES[column]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const hovered = hoveredRow === row.id;
              return (
                <tr
                  key={row.id}
                  onMouseEnter={() => setHoveredRow(row.id)}
                  onMouseLeave={() => setHoveredRow((current) => (current === row.id ? null : current))}
                >
                  {activeColumns.map((column, columnIndex) => {
                    const sticky = column === 'pi' || column === 'intake_status';
                    const isFocused = focusedCell?.rowIndex === rowIndex && focusedCell.columnIndex === columnIndex;
                    const financeTint =
                      isFinanceViewer &&
                      (column === 'intake_status' ||
                        column === 'invoice_status' ||
                        column === 'invoice_number' ||
                        column === 'debit_note_number' ||
                        column === 'creator_invoice_received' ||
                        column === 'payment_received' ||
                        column === 'payment_made' ||
                        column === 'closed_status' ||
                        column === 'finance_comment');

                    return (
                      <td
                        key={`${row.id}:${column}`}
                        data-sheet-cell={`${rowIndex}:${columnIndex}`}
                        tabIndex={0}
                        onFocus={() => setFocusedCell({ rowIndex, columnIndex })}
                        onClick={() => setFocusedCell({ rowIndex, columnIndex })}
                        onKeyDown={(event) => handleCellKeyDown(event, rowIndex, columnIndex)}
                        className={[
                          'relative snap-start border-b border-r border-cyan-100/75 px-2.5 py-2 align-top text-[0.8rem] text-slate-700 outline-none transition-colors duration-100 dark:border-cyan-400/10 dark:text-slate-100',
                          hovered
                            ? 'bg-sky-50/90 shadow-[inset_0_0_0_1px_rgba(52,193,255,0.12)] dark:bg-cyan-950/30'
                            : 'bg-white dark:bg-[#07111d]',
                          financeTint && !sticky ? 'bg-cyan-50/24 dark:bg-[#081523]' : '',
                          isFocused ? 'shadow-[inset_0_0_0_2px_rgba(14,165,233,0.42)]' : '',
                        ].join(' ')}
                        style={{
                          width: COLUMN_WIDTHS[column],
                          minWidth: COLUMN_WIDTHS[column],
                          ...stickyStyle(column, hovered),
                        }}
                      >
                        {renderCell(column, row)}
                        {savingKey === `${row.id}:${column}` ? (
                          <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg dark:bg-cyan-300 dark:text-slate-950">
                            Saving...
                          </span>
                        ) : null}
                        {flash?.key === `${row.id}:${column}` ? (
                          <span
                            className={[
                              'pointer-events-none absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-lg',
                              flashToneClasses(flash.tone),
                            ].join(' ')}
                          >
                            {flash.message}
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={activeColumns.length}
                  className="border-b border-cyan-100/75 px-6 py-16 text-center text-sm text-slate-500 dark:border-cyan-400/10 dark:text-slate-400"
                >
                  {emptyLabel || 'No submissions yet.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {auditPopover ? <AuditPopover rect={auditPopover.rect} row={auditPopover.row} onClose={() => setAuditPopover(null)} /> : null}
    </div>
  );
}
