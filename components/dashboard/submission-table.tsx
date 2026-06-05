"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
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
  pi: 128,
  submitted_at: 124,
  intake_status: 132,
  invoice_status: 136,
  payment_received: 140,
  payment_made: 136,
  closed_status: 130,
  email_address: 166,
  business_line: 68,
  entry_type: 108,
  entity_type: 96,
  client_type: 96,
  agency_name: 132,
  agency_trade_name: 128,
  brand_name: 138,
  brand_trade_name: 128,
  gst_number: 132,
  address: 156,
  city: 102,
  state: 102,
  country: 102,
  pincode: 88,
  invoice_type: 94,
  bill_due: 90,
  creator_name: 144,
  creator_brand: 136,
  deliverables: 142,
  line_amounts: 110,
  campaign_code: 108,
  campaign_name: 126,
  campaign_brand: 126,
  campaign_notes: 144,
  product_reimbursement_upload: 150,
  commercials: 126,
  additional_agency_commission: 132,
  additional_information: 144,
  invoice_number: 126,
  debit_note_number: 126,
  creator_invoice_received: 146,
  finance_comment: 156,
  actions: 92,
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
  'inline-flex h-6 max-w-full items-center gap-1 rounded-md border px-2 text-[11px] font-medium leading-none';

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
  if (normalized === 'tm' || normalized === 'talent management') return 'TM';
  if (normalized === 'im' || normalized === 'influencer marketing') return 'IM';
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
  const rawBusinessLine = row.business_line || row.integration_metadata?.businessLine || '';
  const normalizedBusinessLine = normalizeText(rawBusinessLine);
  const isTM = normalizedBusinessLine == 'tm' || normalizedBusinessLine == 'talent management';
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
  const textRef = useRef<HTMLDivElement | null>(null);
  const [needsClamp, setNeedsClamp] = useState(value.length > 36 || value.includes('\n'));

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

  useEffect(() => {
    const element = textRef.current;
    if (!element) return undefined;

    const checkOverflow = () => {
      setNeedsClamp(element.scrollHeight > element.clientHeight + 1 || value.length > 36 || value.includes('\n'));
    };

    checkOverflow();

    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, value]);

  return (
    <div ref={ref} className="relative max-w-full" onDoubleClick={onCopy} title={value}>
      <CopyNotice active={copied} />
      <div
        ref={textRef}
        className={[
          expanded
            ? 'whitespace-pre-line break-words pr-7 text-[13px] leading-4 text-foreground'
            : 'line-clamp-2 break-words pr-7 text-[13px] leading-4 text-foreground',
        ].join(' ')}
      >
        {value}
      </div>
      {needsClamp ? (
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => setExpanded((current) => !current)}
          className="absolute bottom-0 right-0 inline-flex h-6 w-6 items-center justify-center rounded-md text-[0.68rem] font-semibold text-muted-foreground transition-none hover:bg-muted/40 hover:text-foreground"
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
        rows={expanded ? 4 : 1}
        className={[
          'w-full resize-none rounded-md border border-border/70 bg-popover px-2 py-1.5 pr-8 text-xs leading-5 text-popover-foreground outline-none transition-[border-color,box-shadow] duration-75 placeholder:text-muted-foreground focus:border-primary/40 focus:ring-1 focus:ring-primary/30 disabled:cursor-wait disabled:opacity-70',
          expanded ? '' : 'h-[26px] overflow-hidden whitespace-nowrap',
        ].join(' ')}
        title={draft}
      />
      <button
        type="button"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => setExpanded((current) => !current)}
        className="absolute bottom-0 right-0 inline-flex h-6 w-6 items-center justify-center rounded-md text-[0.68rem] font-semibold text-muted-foreground transition-none hover:bg-muted/40 hover:text-foreground"
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
  active,
  onCopy,
  onChange,
  onActivate,
  onClose,
  onOpenAudit,
}: {
  row: SubmissionRow;
  field: Exclude<FinanceEditableField, 'finance_comment'>;
  editable: boolean;
  label: string;
  value: string;
  saving: boolean;
  copied: boolean;
  active: boolean;
  onCopy: () => void;
  onChange: (value: string) => Promise<void>;
  onActivate: () => void;
  onClose: () => void;
  onOpenAudit?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const tone = getStatusTone(field, value);
  const currentValue = getEditableValue(row, field);
  const options = getEditableOptions(field);

  useEffect(() => {
    if (!active) return undefined;
    function handleOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (rootRef.current?.contains(target as Node)) return;
      if (target?.closest?.('[data-status-menu="true"]')) return;
      onClose();
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [active, onClose]);

  useEffect(() => {
    if (!active) {
      setMenuRect(null);
      return;
    }
    const updateRect = () => {
      const rect = rootRef.current?.getBoundingClientRect() || null;
      setMenuRect(rect);
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [active]);

  return (
    <div ref={rootRef} className="relative inline-flex max-w-full items-center gap-1.5" onDoubleClick={onCopy}>
      <CopyNotice active={copied} />
      <div className="relative max-w-full">
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={editable ? (active ? onClose : onActivate) : undefined}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
          className={[
            STATUS_PILL_BASE,
            'max-w-[124px] transition-none',
            tone,
            saving ? 'ring-1 ring-primary/40 bg-primary/5' : '',
            active ? 'ring-1 ring-primary/40' : '',
          ].join(' ')}
          title={saving ? 'Saving...' : label}
        >
          <span className="truncate">{saving ? 'Saving...' : truncateStatusLabel(label)}</span>
          {editable ? <span className="text-[10px] font-semibold opacity-70">v</span> : null}
        </button>
        {editable && active && menuRect && typeof document !== 'undefined'
          ? createPortal(
          <div
            data-status-menu="true"
            className="fixed z-[9999] min-w-[152px] rounded-md border border-border/70 bg-popover p-1 text-popover-foreground shadow-sm"
            style={{ top: menuRect.bottom + 4, left: menuRect.left }}
          >
            {options.map((option) => {
              const selected = option.value === currentValue;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={saving}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    void onChange(option.value).finally(onClose);
                  }}
                  className={[
                    'flex w-full items-center justify-between rounded-sm px-2 py-1 text-left text-[11px] transition-none hover:bg-muted/40',
                    selected ? 'bg-primary/5 text-foreground' : 'text-popover-foreground',
                  ].join(' ')}
                >
                  <span className="truncate">{option.label}</span>
                  {selected ? <span className="ml-2 text-[10px] text-primary">•</span> : null}
                </button>
              );
            })}
          </div>,
          document.body
        ) : null}
      </div>
      {onOpenAudit ? (
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={onOpenAudit}
          className="inline-flex h-5 w-5 items-center justify-center rounded-md text-foreground transition-none hover:bg-muted/40"
          aria-label="Open audit details"
          title="Status audit"
        >
          <span className="inline-flex h-3 w-3 items-center justify-center rounded-full border border-current text-[0.5rem] font-medium leading-none opacity-85">
            i
          </span>
        </button>
      ) : null}
    </div>
  );
}

const MemoDataCell = memo(function MemoDataCell({
  rowRef,
  rowIndex,
  columnIndex,
  sticky,
  cellStyle,
  isFocused,
  isActiveEditor,
  isCopied,
  flash,
  isSaving,
  registerCellRef,
  onFocusCell,
  onClickCell,
  onKeyDownCell,
  renderContent,
}: {
  rowRef: SubmissionRow;
  rowIndex: number;
  columnIndex: number;
  sticky: boolean;
  cellStyle: CSSProperties;
  isFocused: boolean;
  isActiveEditor: boolean;
  isCopied: boolean;
  flash: FlashState | null;
  isSaving: boolean;
  registerCellRef: (key: string, node: HTMLTableCellElement | null) => void;
  onFocusCell: (rowIndex: number, columnIndex: number) => void;
  onClickCell: (rowIndex: number, columnIndex: number) => void;
  onKeyDownCell: (event: ReactKeyboardEvent<HTMLTableCellElement>, rowIndex: number, columnIndex: number) => void;
  renderContent: () => ReactNode;
}) {
  return (
    <td
      ref={(node) => registerCellRef(`${rowIndex}:${columnIndex}`, node)}
      data-sheet-cell={`${rowIndex}:${columnIndex}`}
      data-row-id={rowRef.id}
      data-active-editor={isActiveEditor ? 'true' : undefined}
      data-copied={isCopied ? 'true' : undefined}
      tabIndex={0}
      onFocus={() => onFocusCell(rowIndex, columnIndex)}
      onClick={() => onClickCell(rowIndex, columnIndex)}
      onKeyDown={(event) => onKeyDownCell(event, rowIndex, columnIndex)}
      className={[
        'relative h-9 max-h-10 border-b border-r border-border/50 px-2.5 py-1 align-middle text-[12px] leading-4 text-foreground outline-none transition-none group-hover:bg-muted/30',
        isActiveEditor ? 'z-50 overflow-visible' : 'overflow-hidden',
        sticky ? 'bg-card border-r border-border/60 group-hover:bg-muted/30' : 'bg-card',
        isFocused ? 'bg-primary/5 ring-1 ring-primary/40 ring-inset' : '',
      ].join(' ')}
      style={cellStyle}
    >
      {renderContent()}
      {isSaving ? (
        <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-cyan-500 px-1.5 py-0.5 text-[9px] font-semibold text-white dark:bg-cyan-300 dark:text-slate-950">
          Saving...
        </span>
      ) : null}
      {flash ? (
        <span
          className={[
            'pointer-events-none absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
            flashToneClasses(flash.tone),
          ].join(' ')}
        >
          {flash.message}
        </span>
      ) : null}
    </td>
  );
}, (prev, next) =>
  prev.rowRef === next.rowRef &&
  prev.rowIndex === next.rowIndex &&
  prev.columnIndex === next.columnIndex &&
  prev.sticky === next.sticky &&
  prev.isFocused === next.isFocused &&
  prev.isActiveEditor === next.isActiveEditor &&
  prev.isCopied === next.isCopied &&
  prev.isSaving === next.isSaving &&
  prev.flash?.message === next.flash?.message &&
  prev.flash?.tone === next.flash?.tone
);

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
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [auditPopover, setAuditPopover] = useState<{ key: string; rect: DOMRect; row: SubmissionRow } | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; columnIndex: number } | null>(null);
  const [activeEditor, setActiveEditor] = useState<{ rowIndex: number; columnIndex: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef(new Map<string, HTMLTableCellElement>());

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

  useEffect(() => {
    if (!activeEditor) return undefined;
    const cell = cellRefs.current.get(`${activeEditor.rowIndex}:${activeEditor.columnIndex}`);
    const target = cell?.querySelector<HTMLElement>('button, textarea');
    target?.focus();
    return undefined;
  }, [activeEditor]);

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

  function stickyStyle(column: SheetColumnId): CSSProperties | undefined {
    if (column !== 'pi' && column !== 'intake_status') return undefined;
    return {
      position: 'sticky',
      left: STICKY_LEFTS[column],
      zIndex: column === 'intake_status' ? 36 : 35,
    };
  }

  function stickyHeaderStyle(column: SheetColumnId): CSSProperties | undefined {
    if (column !== 'pi' && column !== 'intake_status') return undefined;
    return {
      position: 'sticky',
      left: STICKY_LEFTS[column],
      zIndex: column === 'intake_status' ? 62 : 61,
    };
  }

  const focusCell = useCallback((rowIndex: number, columnIndex: number) => {
    const nextRow = Math.max(0, Math.min(rows.length - 1, rowIndex));
    const nextColumn = Math.max(0, Math.min(activeColumns.length - 1, columnIndex));
    setFocusedCell({ rowIndex: nextRow, columnIndex: nextColumn });
    const cell = cellRefs.current.get(`${nextRow}:${nextColumn}`);
    const viewport = viewportRef.current;
    cell?.focus({ preventScroll: true });
    if (!cell || !viewport) return;

    const cellRect = cell.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const stickyWidth = COLUMN_WIDTHS.pi + COLUMN_WIDTHS.intake_status + 8;

    if (cellRect.left < viewportRect.left + stickyWidth) {
      viewport.scrollLeft -= viewportRect.left + stickyWidth - cellRect.left;
    } else if (cellRect.right > viewportRect.right - 8) {
      viewport.scrollLeft += cellRect.right - (viewportRect.right - 8);
    }

    if (cellRect.top < viewportRect.top + 4) {
      viewport.scrollTop -= viewportRect.top + 4 - cellRect.top;
    } else if (cellRect.bottom > viewportRect.bottom - 4) {
      viewport.scrollTop += cellRect.bottom - (viewportRect.bottom - 4);
    }
  }, [activeColumns.length, rows.length]);

  const registerCellRef = useCallback((key: string, node: HTMLTableCellElement | null) => {
    if (node) cellRefs.current.set(key, node);
    else cellRefs.current.delete(key);
  }, []);

  const handleCellFocus = useCallback((rowIndex: number, columnIndex: number) => {
    setFocusedCell({ rowIndex, columnIndex });
  }, []);

  const handleCellClick = useCallback((rowIndex: number, columnIndex: number) => {
    setFocusedCell({ rowIndex, columnIndex });
    setActiveEditor((current) =>
      current && (current.rowIndex !== rowIndex || current.columnIndex !== columnIndex) ? null : current
    );
  }, []);

  const handleCellKeyDown = useCallback((event: ReactKeyboardEvent<HTMLTableCellElement>, rowIndex: number, columnIndex: number) => {
    const column = activeColumns[columnIndex];
    const isEditableStatusCell =
      isFinanceViewer &&
      (
        column === 'intake_status' ||
        column === 'invoice_status' ||
        column === 'creator_invoice_received' ||
        column === 'payment_received' ||
        column === 'payment_made' ||
        column === 'closed_status'
      );

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setActiveEditor(null);
      focusCell(rowIndex, columnIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setActiveEditor(null);
      focusCell(rowIndex, columnIndex - 1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveEditor(null);
      focusCell(rowIndex + 1, columnIndex);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveEditor(null);
      focusCell(rowIndex - 1, columnIndex);
    } else if (event.key === 'Enter' && isEditableStatusCell) {
      event.preventDefault();
      setActiveEditor({ rowIndex, columnIndex });
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setActiveEditor(null);
      focusCell(rowIndex, columnIndex);
    }
  }, [activeColumns, focusCell, isFinanceViewer]);

  function renderCell(column: SheetColumnId, row: SubmissionRow, rowIndex: number, columnIndex: number) {
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
          <div className="relative" onDoubleClick={() => void copyCell(cellKey, row.pi)} title={row.pi}>
            <CopyNotice active={isCopied} />
            <span className={['inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium', piClasses].join(' ')}>
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
            active={activeEditor?.rowIndex === rowIndex && activeEditor?.columnIndex === columnIndex}
            onCopy={() => void copyCell(cellKey, label)}
            onChange={(value) => updateFinanceValue(row, field, value)}
            onActivate={() => setActiveEditor({ rowIndex, columnIndex })}
            onClose={() => setActiveEditor(null)}
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
            className="inline-flex h-6 items-center rounded-md border border-border/70 bg-card px-2 text-[11px] font-medium text-foreground hover:bg-muted/30"
          >
            {getActionLabel ? getActionLabel(row) : 'View'}
          </button>
        );
      default:
        return commonText('-');
    }
  }

  return (
    <div className="max-w-full overflow-hidden rounded-xl border border-border/70 bg-card">
      <div
        ref={viewportRef}
        className="max-w-full overflow-auto [scrollbar-width:thin]"
        style={{
          maxHeight: '610px',
          overscrollBehaviorX: 'contain',
          overscrollBehaviorY: 'contain',
          position: 'relative',
          isolation: 'isolate',
          touchAction: 'pan-x pan-y',
          WebkitOverflowScrolling: 'touch',
          scrollbarGutter: 'stable both-edges',
        }}
      >
        <table className="min-w-max border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              {activeColumns.map((column) => (
                <th
                  key={column}
                  className={[
                    'h-8 overflow-hidden border-b border-r border-border/60 bg-card px-2.5 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground',
                    column === 'pi' || column === 'intake_status' ? 'bg-card border-r border-border/60' : '',
                  ].join(' ')}
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
              return (
                <tr key={row.id} className="group">
                  {activeColumns.map((column, columnIndex) => {
                    const sticky = column === 'pi' || column === 'intake_status';
                    const isFocused = focusedCell?.rowIndex === rowIndex && focusedCell.columnIndex === columnIndex;
                    const flashForCell = flash?.key === `${row.id}:${column}` ? flash : null;

                    return (
                      <MemoDataCell
                        key={`${row.id}:${column}`}
                        rowRef={row}
                        rowIndex={rowIndex}
                        columnIndex={columnIndex}
                        sticky={sticky}
                        cellStyle={{
                          width: COLUMN_WIDTHS[column],
                          minWidth: COLUMN_WIDTHS[column],
                          ...stickyStyle(column),
                        }}
                        isFocused={isFocused}
                        isActiveEditor={activeEditor?.rowIndex === rowIndex && activeEditor?.columnIndex === columnIndex}
                        isCopied={copiedKey === `${row.id}:${column}`}
                        flash={flashForCell}
                        isSaving={savingKey === `${row.id}:${column}`}
                        registerCellRef={registerCellRef}
                        onFocusCell={handleCellFocus}
                        onClickCell={handleCellClick}
                        onKeyDownCell={handleCellKeyDown}
                        renderContent={() => renderCell(column, row, rowIndex, columnIndex)}
                      />
                    );
                  })}
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={activeColumns.length}
                  className="border-b border-border/50 px-6 py-12 text-center text-sm text-muted-foreground"
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
