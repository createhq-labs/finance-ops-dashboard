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
import { Check, ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react';
import { getPiDisplayMeta } from '../../lib/client/pi-display';
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
  entry_type?: 'SC' | 'MC' | string | null;
  entity_type?: 'Agency' | 'Brand' | string | null;
  client_type?: 'Indian' | 'Foreign' | string | null;
  agency_name?: string | null;
  agency_trade_name?: string | null;
  brand_trade_name?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
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
  | 'finance_comment'
  | 'invoice_number'
  | 'debit_note_number';

type StatusEditableField = Exclude<FinanceEditableField, 'finance_comment' | 'invoice_number' | 'debit_note_number'>;

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
  product_reimbursement_upload: 'Product Reimbursement',
  commercials: 'Amount',
  additional_agency_commission: 'Additional Agency Commission',
  additional_information: 'Additional Information',
  invoice_number: 'Invoice Number',
  debit_note_number: 'Debit Note Number',
  creator_invoice_received: 'Creator Invoice',
  finance_comment: 'Finance Comment',
  actions: 'View',
};

const COLUMN_WIDTHS: Record<SheetColumnId, number> = {
  pi: 164,
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
  product_reimbursement_upload: 124,
  commercials: 126,
  additional_agency_commission: 132,
  additional_information: 144,
  invoice_number: 104,
  debit_note_number: 104,
  creator_invoice_received: 146,
  finance_comment: 156,
  actions: 92,
};

const STATUS_AUDIT_FIELDS = new Set<StatusEditableField>([
  'intake_status',
  'invoice_status',
  'creator_invoice_received',
  'payment_received',
  'payment_made',
  'closed_status',
]);

const COLLAPSED_COLUMN_WIDTHS: Record<'invoice_number' | 'debit_note_number', number> = {
  invoice_number: 72,
  debit_note_number: 72,
};

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

function toTitleCase(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatCreatorDisplay(value: string | null | undefined) {
  return String(value || '')
    .split('\n')
    .map((part) => toTitleCase(part))
    .filter(Boolean)
    .join('\n');
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
  const raw = row.business_line || '';
  const normalized = normalizeText(raw);
  if (normalized === 'tm' || normalized === 'talent management') return 'TM';
  if (normalized === 'im' || normalized === 'influencer marketing') return 'IM';
  return fieldValue(raw || '-');
}

function formatPiNumber(row: SubmissionRow) {
  return getPiDisplayMeta({
    pi: row.pi,
    submittedAt: row.submitted_at,
    invoiceType: row.invoice_type,
    lineItems: sortLineItems(row),
  }).label;
}

function getPiTitle(row: SubmissionRow) {
  return getPiDisplayMeta({
    pi: row.pi,
    submittedAt: row.submitted_at,
    invoiceType: row.invoice_type,
    lineItems: sortLineItems(row),
  }).title;
}

function entryTypeLabel(row: SubmissionRow) {
  const raw = row.entry_type || '';
  if (raw === 'SC') return 'SC';
  if (raw === 'MC') return 'MC';
  return '-';
}

function getCreatorData(row: SubmissionRow) {
  const lineItems = sortLineItems(row);
  const nonReimbursementLineItems = lineItems.filter(
    (item) => !normalizeText(item.deliverable_name).includes('product reimbursement')
  );
  const rawBusinessLine = row.business_line || '';
  const normalizedBusinessLine = normalizeText(rawBusinessLine);
  const isTM = normalizedBusinessLine == 'tm' || normalizedBusinessLine == 'talent management';
  const creatorNames = joinLines(
    lineItems.map((item) => item.creator_name).length
      ? lineItems.map((item) => formatCreatorDisplay(item.creator_name))
      : [formatCreatorDisplay(row.creator_creators_name)]
  );
  const creatorBrands = joinLines(
    lineItems.map((item) => item.brand_name).length ? lineItems.map((item) => item.brand_name) : [row.brand_name]
  );
  const deliverables = joinLines(
    lineItems.map((item) => item.deliverable_name).length
      ? lineItems.map((item) => item.deliverable_name)
      : [row.deliverables]
  );
  const amounts = nonReimbursementLineItems.some((item) => item.amount)
    ? joinLines(nonReimbursementLineItems.map((item) => (item.amount ? money(item.amount) : null)))
    : money(row.amount);

  if (!isTM) {
    return {
      creatorNames: '-',
      creatorBrands: '-',
      deliverables: fieldValue(row.deliverables),
      amounts: money(row.amount),
    };
  }

  return { creatorNames, creatorBrands, deliverables, amounts };
}

function getAddressSegments(row: SubmissionRow) {
  return (row.address || '')
    .split(/[\n,]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getAddressPart(row: SubmissionRow, part: 'city' | 'state' | 'country' | 'pincode') {
  const segments = getAddressSegments(row);
  if (!segments.length) return '-';

  const pincodeMatch = (row.address || '').match(/\b\d{4,8}\b/);
  const pincode = pincodeMatch?.[0] || '-';
  const withoutPincode = segments
    .map((segment) => segment.replace(/\b\d{4,8}\b/g, '').trim())
    .filter(Boolean);

  if (part === 'pincode') return pincode;
  if (part === 'country') return withoutPincode[withoutPincode.length - 1] ? toTitleCase(withoutPincode[withoutPincode.length - 1]) : '-';
  if (part === 'state') return withoutPincode[withoutPincode.length - 2] ? toTitleCase(withoutPincode[withoutPincode.length - 2]) : '-';
  if (part === 'city') return withoutPincode[withoutPincode.length - 3] ? toTitleCase(withoutPincode[withoutPincode.length - 3]) : '-';
  return '-';
}

function getProductReimbursementValue(row: SubmissionRow) {
  const reimbursementLineItems = sortLineItems(row).filter((item) =>
    normalizeText(item.deliverable_name).includes('product reimbursement')
  );

  if (reimbursementLineItems.length > 0) {
    const values = reimbursementLineItems
      .map((item) => (typeof item.amount === 'number' ? money(item.amount) : null))
      .filter(Boolean);

    if (values.length) return values.join('\n');
  }

  if (row.reimbursement_amount === null || row.reimbursement_amount === undefined) return '-';
  return money(row.reimbursement_amount);
}

function formatSubmittedAt(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fieldValue(value);
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function normalizeInvoiceStatusValue(value: string | null | undefined) {
  const normalized = normalizeText(value).replace(/\s+/g, '_');
  if (normalized === 'invoice_created') return 'invoice_created';
  if (normalized === 'invoice_pending') return 'po_created_estimate';
  if (normalized === 'po_created/estimate' || normalized === 'po_created_estimate' || normalized === 'po_createdestimate') {
    return 'po_created_estimate';
  }
  if (normalized === 'invoice_cancelled') return 'invoice_cancelled';
  if (normalized === 'debit_note') return 'debit_note';
  if (normalized === 'invoice_+_debit_note' || normalized === 'invoice_plus_debit_note') return 'invoice_plus_debit_note';
  return 'invoice_pending';
}

function getEditableOptions(field: StatusEditableField) {
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

function getEditableValue(row: SubmissionRow, field: StatusEditableField) {
  if (field === 'invoice_status') return normalizeInvoiceStatusValue(row.invoice_status);
  if (field === 'creator_invoice_received') return row.creator_invoice_received || 'pending';
  if (field === 'payment_received') return row.payment_received || 'pending';
  if (field === 'payment_made') return row.payment_made || 'pending';
  if (field === 'closed_status') return row.closed_status || 'open';
  return row.intake_status;
}

function renderStatusLabel(field: StatusEditableField, value: string | null | undefined) {
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

function getStatusTextTone(field: StatusEditableField, value: string | null | undefined, viewer?: ViewerRole) {
  const normalized = normalizeText(value);
  if (viewer === 'employee') {
    if (field === 'intake_status' && normalized === 'submitted') {
      return 'text-[#A68835] dark:text-[#A68835]';
    }
    if (
      (field === 'invoice_status' || field === 'creator_invoice_received' || field === 'payment_received' || field === 'payment_made') &&
      normalized === 'pending'
    ) {
      return 'text-[#A68835] dark:text-[#A68835]';
    }
    if (field === 'closed_status' && normalized === 'open') {
      return 'text-rose-600 dark:text-rose-400';
    }
  }
  const tone = getStatusTone(field, value);
  if (tone.includes('cyan')) return 'text-cyan-700 dark:text-cyan-300';
  if (tone.includes('emerald')) return 'text-emerald-700 dark:text-emerald-300';
  if (tone.includes('orange')) return 'text-orange-700 dark:text-orange-300';
  if (tone.includes('rose')) return 'text-rose-700 dark:text-rose-300';
  if (tone.includes('slate')) return 'text-slate-600 dark:text-slate-300';
  return 'text-amber-700 dark:text-amber-300';
}

function truncateStatusLabel(label: string) {
  if (label.length <= 12) return label;
  const firstWord = label.split(/\s+/)[0] || label;
  if (firstWord.length >= 7) return `${firstWord.slice(0, 10)}...`;
  return `${label.slice(0, 9).trim()}...`;
}

function getStatusTone(field: StatusEditableField, value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (field === 'intake_status' && normalized === 'submitted') {
    return 'border-amber-300/90 bg-amber-500/12 text-amber-900 dark:border-amber-300/35 dark:bg-amber-300/14 dark:text-amber-50';
  }
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
    if (field === 'intake_status' && normalized === 'rejected') {
      return 'border-rose-400/90 bg-rose-500/18 text-rose-900 dark:border-rose-300/45 dark:bg-rose-300/18 dark:text-rose-50';
    }
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

function isClosedRow(row: SubmissionRow) {
  return normalizeText(row.closed_status) === 'closed';
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
    'product_reimbursement_upload',
    'campaign_code',
    'campaign_name',
    'campaign_brand',
    'campaign_notes',
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
      'creator_invoice_received',
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
      'payment_received',
      'creator_invoice_received',
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

function getColumnWidth(
  column: SheetColumnId,
  collapsedColumns: Record<'invoice_number' | 'debit_note_number', boolean>
) {
  if ((column === 'invoice_number' || column === 'debit_note_number') && collapsedColumns[column]) {
    return COLLAPSED_COLUMN_WIDTHS[column];
  }

  return COLUMN_WIDTHS[column];
}

function getStickyLefts(
  collapsedColumns: Record<'invoice_number' | 'debit_note_number', boolean>
) {
  return {
    pi: 0,
    invoice_number: 0,
    debit_note_number: 0,
    intake_status: getColumnWidth('pi', collapsedColumns),
  };
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
    <div
      ref={ref}
      className="relative h-full max-w-full"
      onClick={(event) => {
        if (!needsClamp || event.detail !== 1) return;
        setExpanded((current) => !current);
      }}
      onDoubleClick={onCopy}
      title={value}
    >
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
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((current) => !current);
          }}
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
  field,
  onClose,
}: {
  rect: DOMRect;
  row: SubmissionRow;
  field: FinanceEditableField;
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

  const isReopenAudit =
    field === 'closed_status' &&
    normalizeText(row.closed_status) === 'open' &&
    Boolean((row.finance_comment || '').trim());

  const top = rect.bottom + 10;
  const left = Math.max(12, rect.left - 70);

  return createPortal(
    <div
      data-audit-popover="true"
      className={[
        'fixed z-[9999] w-64 rounded-2xl border p-4 text-left shadow-[0_28px_80px_-38px_rgba(15,74,145,0.45)]',
        isReopenAudit
          ? 'border-rose-300/50 bg-white dark:border-rose-400/35 dark:bg-[#07111d]'
          : 'border-cyan-300/35 bg-white/98 dark:border-cyan-400/28 dark:bg-[#07111d]',
      ].join(' ')}
      style={{ top, left }}
    >
      <div
        className={[
          'text-[0.68rem] font-semibold uppercase tracking-[0.18em]',
          isReopenAudit ? 'text-rose-700 dark:text-rose-200' : 'text-cyan-700 dark:text-cyan-200',
        ].join(' ')}
      >
        {isReopenAudit ? 'Reopen Audit' : 'Status Audit'}
      </div>
      <div className="mt-3 grid gap-3">
        <div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Updated By</div>
          <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-50">{row.reviewed_by_name || 'Finance Team'}</div>
        </div>
        <div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Updated At</div>
          <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-50">{formatAuditDate(row.reviewed_at)}</div>
        </div>
        {isReopenAudit ? (
          <div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-rose-600 dark:text-rose-300">Reason</div>
            <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-50">{row.finance_comment}</div>
          </div>
        ) : null}
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
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft(row.finance_comment || '');
  }, [row.finance_comment, row.id]);

  useEffect(() => {
    if (!expanded) return undefined;
    function handleOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [expanded]);

  async function commit() {
    const next = draft.trim();
    if (!onSave || next === (row.finance_comment || '').trim()) return;
    await onSave(row, 'finance_comment', next);
  }

  return (
    <div ref={rootRef} className="relative" onDoubleClick={onCopy}>
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

function InlineValueCell({
  value,
  copied,
  saving,
  active,
  collapsed,
  onCopy,
  onActivate,
  onCancel,
  onSave,
}: {
  value: string;
  copied: boolean;
  saving: boolean;
  active: boolean;
  collapsed: boolean;
  onCopy: () => void;
  onActivate: () => void;
  onCancel: () => void;
  onSave: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value === '-' ? '' : value);

  useEffect(() => {
    setDraft(value === '-' ? '' : value);
  }, [value]);

  async function commit() {
    await onSave(draft.trim());
  }

  if (active) {
    return (
      <div
        className="flex items-center gap-1"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void commit();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setDraft(value === '-' ? '' : value);
              onCancel();
            }
          }}
          disabled={saving}
          placeholder="Enter value"
          className="h-7 min-w-0 flex-1 rounded-md border border-border/70 bg-card px-2 text-[11px] text-foreground outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/25"
        />
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => void commit()}
          disabled={saving}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-emerald-700 transition-none hover:bg-emerald-500/10 disabled:opacity-60 dark:text-emerald-300"
          aria-label="Save value"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => {
            setDraft(value === '-' ? '' : value);
            onCancel();
          }}
          disabled={saving}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-rose-700 transition-none hover:bg-rose-500/10 disabled:opacity-60 dark:text-rose-300"
          aria-label="Cancel edit"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  const displayValue = value === '-' ? '—' : value;

  return (
    <div className="flex items-center gap-1.5" onDoubleClick={onCopy} title={displayValue}>
      <CopyNotice active={copied} />
      <span className={['truncate text-[12px]', value === '-' ? 'text-muted-foreground' : 'text-foreground'].join(' ')}>
        {collapsed ? (value === '-' ? '—' : displayValue.slice(0, 4)) : displayValue}
      </span>
      {!collapsed ? (
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onActivate();
          }}
          className="inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-none hover:bg-muted/40 hover:text-foreground"
          aria-label="Edit value"
        >
          <Pencil size={12} />
        </button>
      ) : null}
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
  locked,
  onUnlock,
  onOpenAudit,
}: {
  row: SubmissionRow;
  field: StatusEditableField;
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
  locked?: boolean;
  onUnlock?: () => void;
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
      {locked && onUnlock ? (
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onUnlock();
          }}
          className="inline-flex h-5 w-5 items-center justify-center rounded-md text-rose-600 transition-none hover:bg-rose-500/10 dark:text-rose-300"
          aria-label="Unlock closed submission"
          title="Unlock closed submission"
        >
          <span className="text-[11px] leading-none">🔒</span>
        </button>
      ) : null}
      {onOpenAudit ? (
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={onOpenAudit}
          className={[
            'inline-flex h-5 w-5 items-center justify-center rounded-md transition-none hover:bg-muted/40',
            field === 'closed_status' && normalizeText(row.closed_status) === 'open' && (row.finance_comment || '').trim()
              ? 'text-rose-600 dark:text-rose-300'
              : 'text-foreground',
          ].join(' ')}
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
  rowClosed,
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
  rowClosed: boolean;
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
        'relative h-9 max-h-10 border-b border-r border-border/50 px-2.5 py-1 align-middle text-[12px] leading-4 text-foreground outline-none',
        isActiveEditor ? 'z-50 overflow-visible' : 'overflow-hidden',
        rowClosed
          ? sticky
            ? 'border-r border-border/60 bg-emerald-50 dark:bg-emerald-950'
            : 'bg-emerald-50 dark:bg-emerald-950'
          : sticky
            ? 'bg-card border-r border-border/60'
            : 'bg-card',
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
  prev.rowClosed === next.rowClosed &&
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
  onOpen?: (id: string, row: SubmissionRow) => void;
  columns?: SubmissionTableColumn[];
  emptyLabel?: string;
  getActionLabel?: (row: SubmissionRow) => string;
  viewer?: ViewerRole;
  onFinanceUpdate?: (row: SubmissionRow, field: FinanceEditableField, value: string) => Promise<FinanceUpdateResult>;
}) {
  void columns;
  const activeColumns = useMemo(() => getColumns(viewer), [viewer]);
  const isFinanceViewer = viewer === 'finance' || viewer === 'admin';
  const [collapsedColumns, setCollapsedColumns] = useState<Record<'invoice_number' | 'debit_note_number', boolean>>({
    invoice_number: false,
    debit_note_number: false,
  });
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [auditPopover, setAuditPopover] = useState<{ key: string; rect: DOMRect; row: SubmissionRow; field: FinanceEditableField } | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; columnIndex: number } | null>(null);
  const [activeEditor, setActiveEditor] = useState<{ rowIndex: number; columnIndex: number } | null>(null);
  const [reopenDialog, setReopenDialog] = useState<{ row: SubmissionRow; rowIndex: number; columnIndex: number } | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenError, setReopenError] = useState('');
  const [reopenSubmitting, setReopenSubmitting] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef(new Map<string, HTMLTableCellElement>());
  const stickyLefts = useMemo(() => getStickyLefts(collapsedColumns), [collapsedColumns]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('submission-table-collapsed-columns');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<'invoice_number' | 'debit_note_number', boolean>>;
      setCollapsedColumns({
        invoice_number: Boolean(parsed.invoice_number),
        debit_note_number: Boolean(parsed.debit_note_number),
      });
    } catch {
      // ignore invalid local preference state
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('submission-table-collapsed-columns', JSON.stringify(collapsedColumns));
  }, [collapsedColumns]);

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
    const target = cell?.querySelector<HTMLElement>('input, button, textarea, select');
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

  const getCellCopyText = useCallback((column: SheetColumnId, row: SubmissionRow) => {
    const creatorData = getCreatorData(row);

    switch (column) {
      case 'pi':
        return formatPiNumber(row);
      case 'submitted_at':
        return formatSubmittedAt(row.submitted_at);
      case 'intake_status':
      case 'invoice_status':
      case 'creator_invoice_received':
      case 'payment_received':
      case 'payment_made':
      case 'closed_status':
        return renderStatusLabel(column as StatusEditableField, String(getEditableValue(row, column as StatusEditableField) || ''));
      case 'email_address':
        return fieldValue(row.submitter_email);
      case 'business_line':
        return businessLineLabel(row);
      case 'entry_type':
        return entryTypeLabel(row);
      case 'entity_type':
        return fieldValue(row.entity_type);
      case 'client_type':
        return fieldValue(row.client_type);
      case 'agency_name':
        return fieldValue(row.agency_name);
      case 'agency_trade_name':
        return fieldValue(row.agency_trade_name);
      case 'brand_name':
        return fieldValue(row.brand_name);
      case 'brand_trade_name':
        return fieldValue(row.brand_trade_name);
      case 'gst_number':
        return fieldValue(row.gst_number);
      case 'address':
        return fieldValue(row.address);
      case 'city':
        return getAddressPart(row, 'city');
      case 'state':
        return getAddressPart(row, 'state');
      case 'country':
        return getAddressPart(row, 'country');
      case 'pincode':
        return getAddressPart(row, 'pincode');
      case 'invoice_type':
        return fieldValue(row.invoice_type);
      case 'bill_due':
        return fieldValue(row.bill_due);
      case 'creator_name':
        return creatorData.creatorNames;
      case 'creator_brand':
        return creatorData.creatorBrands;
      case 'deliverables':
        return creatorData.deliverables;
      case 'line_amounts':
        return creatorData.amounts;
      case 'campaign_code':
        return fieldValue(row.campaign_code);
      case 'campaign_name':
        return fieldValue(row.campaign_name);
      case 'campaign_brand':
        return fieldValue(row.campaign_brand);
      case 'campaign_notes':
        return fieldValue(row.campaign_notes);
      case 'product_reimbursement_upload':
        return getProductReimbursementValue(row);
      case 'commercials':
        return money(row.amount);
      case 'additional_agency_commission':
        return row.additional_agency_commission ? money(row.additional_agency_commission) : '-';
      case 'additional_information':
        return fieldValue(row.additional_information);
      case 'invoice_number':
        return fieldValue(row.invoice_number);
      case 'debit_note_number':
        return fieldValue(row.debit_note_number);
      case 'finance_comment':
        return fieldValue(row.finance_comment);
      case 'actions':
        return getActionLabel ? getActionLabel(row) : 'View';
      default:
        return '-';
    }
  }, [getActionLabel]);

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
    setAuditPopover({ key: `${row.id}:${field}`, rect, row, field });
  }

  async function handleReopenClosedRow() {
    if (!reopenDialog || !onFinanceUpdate) return;
    const note = reopenReason.trim();
    if (!note) {
      setReopenError('Reason is required.');
      return;
    }

    setReopenSubmitting(true);
    setReopenError('');

    const noteResult = await onFinanceUpdate(reopenDialog.row, 'finance_comment', note);
    if (!noteResult.success) {
      setReopenSubmitting(false);
      setReopenError(noteResult.message || 'Failed to save reopen reason.');
      return;
    }

    const rowForReopen = {
      ...reopenDialog.row,
      finance_comment: note,
    };
    const reopenResult = await onFinanceUpdate(rowForReopen, 'closed_status', 'open');
    if (!reopenResult.success) {
      setReopenSubmitting(false);
      setReopenError(reopenResult.message || 'Failed to reopen closed submission.');
      return;
    }

    setReopenSubmitting(false);
    setReopenDialog(null);
    setReopenReason('');
    setReopenError('');
  }

  function stickyStyle(column: SheetColumnId): CSSProperties | undefined {
    if (
      column !== 'pi' &&
      column !== 'intake_status'
    ) return undefined;
    return {
      position: 'sticky',
      left: stickyLefts[column],
      zIndex: column === 'intake_status' ? 38 : 37,
    };
  }

  function stickyHeaderStyle(column: SheetColumnId): CSSProperties | undefined {
    if (
      column !== 'pi' &&
      column !== 'intake_status'
    ) return undefined;
    return {
      position: 'sticky',
      left: stickyLefts[column],
      zIndex: column === 'intake_status' ? 64 : 63,
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
    const stickyWidth =
      getColumnWidth('pi', collapsedColumns) +
      getColumnWidth('intake_status', collapsedColumns) +
      8;

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
  }, [activeColumns.length, collapsedColumns, rows.length]);

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

  const requestEditorOpen = useCallback((row: SubmissionRow, rowIndex: number, columnIndex: number) => {
    if (isClosedRow(row)) return;
    setActiveEditor({ rowIndex, columnIndex });
  }, []);

  const handleCellKeyDown = useCallback((event: ReactKeyboardEvent<HTMLTableCellElement>, rowIndex: number, columnIndex: number) => {
    const column = activeColumns[columnIndex];
    const row = rows[rowIndex];
    const isEditableStatusCell =
      isFinanceViewer &&
      (
        column === 'intake_status' ||
        column === 'invoice_status' ||
        column === 'creator_invoice_received' ||
        column === 'payment_received' ||
        column === 'payment_made' ||
        column === 'closed_status' ||
        column === 'invoice_number' ||
        column === 'debit_note_number'
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
      if (row && !isClosedRow(row)) {
        setActiveEditor({ rowIndex, columnIndex });
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setActiveEditor(null);
      focusCell(rowIndex, columnIndex);
    }
  }, [activeColumns, focusCell, isFinanceViewer, rows]);

  const toggleColumnCollapse = useCallback((column: 'invoice_number' | 'debit_note_number') => {
    setCollapsedColumns((current) => ({
      ...current,
      [column]: !current[column],
    }));
  }, []);

  const handleViewportKeyDownCapture = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const isCopy = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c';
    if (!isCopy || !focusedCell) return;

    const target = event.target as HTMLElement | null;
    if (
      target?.tagName === 'INPUT' ||
      target?.tagName === 'TEXTAREA' ||
      target?.tagName === 'SELECT' ||
      target?.isContentEditable ||
      target?.closest('[data-active-editor="true"]') ||
      target?.closest('[data-status-menu="true"]')
    ) {
      return;
    }

    const row = rows[focusedCell.rowIndex];
    const column = activeColumns[focusedCell.columnIndex];
    if (!row || !column) return;

    event.preventDefault();
    void copyCell(`${row.id}:${column}`, getCellCopyText(column, row));
  }, [activeColumns, copyCell, focusedCell, getCellCopyText, rows]);

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
          const displayPi = formatPiNumber(row);
          const piClasses =
            row.version_status === 'superseded'
              ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100'
              : row.version_status === 'resubmitted'
                ? 'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/12 dark:text-blue-100'
                : displayPi === 'PI Not Required'
                ? 'border-cyan-300/80 bg-cyan-50 text-cyan-800 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100'
                : 'border-slate-300/80 bg-slate-100 text-slate-700 dark:border-slate-300/12 dark:bg-slate-200/10 dark:text-slate-100';
        return (
          <div className="relative" onDoubleClick={() => void copyCell(cellKey, displayPi)} title={getPiTitle(row)}>
            <CopyNotice active={isCopied} />
            <span className={['inline-flex h-6 max-w-full items-center rounded-md border px-2 text-xs font-medium', piClasses].join(' ')}>
              {displayPi}
            </span>
          </div>
        );
        }
      case 'submitted_at':
        return (
          <div
            className="truncate text-[11px] leading-4 text-foreground"
            onDoubleClick={() => void copyCell(cellKey, formatSubmittedAt(row.submitted_at))}
            title={formatSubmittedAt(row.submitted_at)}
          >
            <CopyNotice active={isCopied} />
            {formatSubmittedAt(row.submitted_at)}
          </div>
        );
      case 'intake_status':
      case 'invoice_status':
      case 'creator_invoice_received':
      case 'payment_received':
      case 'payment_made':
      case 'closed_status': {
        const field = column as StatusEditableField;
        const rawValue = String(getEditableValue(row, field) || '');
        const label = renderStatusLabel(field, rawValue);
        const editable = isFinanceViewer && Boolean(onFinanceUpdate) && !isClosedRow(row);
        if (viewer === 'employee') {
          return (
            <div className="max-w-full" onDoubleClick={() => void copyCell(cellKey, label)} title={label}>
              <CopyNotice active={isCopied} />
              <span className={['block truncate text-sm font-medium', getStatusTextTone(field, rawValue, viewer)].join(' ')}>
                {label}
              </span>
            </div>
          );
        }

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
            onActivate={() => requestEditorOpen(row, rowIndex, columnIndex)}
            onClose={() => setActiveEditor(null)}
            locked={field === 'closed_status' && isFinanceViewer && isClosedRow(row)}
            onUnlock={
              field === 'closed_status' && isFinanceViewer && isClosedRow(row)
                ? () => {
                    setReopenDialog({ row, rowIndex, columnIndex });
                    setReopenReason('');
                    setReopenError('');
                  }
                : undefined
            }
            onOpenAudit={STATUS_AUDIT_FIELDS.has(field) ? (event) => openAudit(row, field, event) : undefined}
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
        return commonText(fieldValue(row.entity_type));
      case 'client_type':
        return commonText(fieldValue(row.client_type));
      case 'agency_name':
        return commonText(fieldValue(row.agency_name));
      case 'agency_trade_name':
        return commonText(fieldValue(row.agency_trade_name));
      case 'brand_name':
        return commonText(fieldValue(row.brand_name));
      case 'brand_trade_name':
        return commonText(fieldValue(row.brand_trade_name));
      case 'gst_number':
        return commonText(fieldValue(row.gst_number));
      case 'address':
        return commonText(fieldValue(row.address));
      case 'city':
        return commonText(getAddressPart(row, 'city'));
      case 'state':
        return commonText(getAddressPart(row, 'state'));
      case 'country':
        return commonText(getAddressPart(row, 'country'));
      case 'pincode':
        return commonText(getAddressPart(row, 'pincode'));
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
        return commonText(fieldValue(row.campaign_code));
      case 'campaign_name':
        return commonText(fieldValue(row.campaign_name));
      case 'campaign_brand':
        return commonText(fieldValue(row.campaign_brand));
      case 'campaign_notes':
        return commonText(fieldValue(row.campaign_notes));
      case 'product_reimbursement_upload':
        return commonText(getProductReimbursementValue(row));
      case 'commercials':
        return commonText(money(row.amount));
      case 'additional_agency_commission':
        return commonText(row.additional_agency_commission ? money(row.additional_agency_commission) : '-');
      case 'additional_information':
        return commonText(fieldValue(row.additional_information));
      case 'invoice_number':
      case 'debit_note_number': {
        const field = column as 'invoice_number' | 'debit_note_number';
        if (!isFinanceViewer || !onFinanceUpdate) {
          return commonText(fieldValue(row[field]));
        }
        return (
          <InlineValueCell
            value={fieldValue(row[field])}
            copied={isCopied}
            saving={isSaving}
            active={!isClosedRow(row) && activeEditor?.rowIndex === rowIndex && activeEditor?.columnIndex === columnIndex}
            collapsed={collapsedColumns[field]}
            onCopy={() => void copyCell(cellKey, fieldValue(row[field]))}
            onActivate={() => requestEditorOpen(row, rowIndex, columnIndex)}
            onCancel={() => setActiveEditor(null)}
            onSave={async (value) => {
              await updateFinanceValue(row, field, value);
              setActiveEditor(null);
            }}
          />
        );
      }
      case 'finance_comment':
        return isFinanceViewer && !isClosedRow(row) ? (
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
            onClick={() => onOpen?.(row.id, row)}
            className={[
              'inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-medium',
              viewer === 'employee' && row.intake_status === 'rejected'
                ? 'border-rose-300/80 bg-rose-500/5 text-rose-700 hover:bg-rose-500/10 dark:border-rose-300/35 dark:text-rose-300'
                : 'border-border/70 bg-card text-foreground hover:bg-muted/30',
            ].join(' ')}
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
        onKeyDownCapture={handleViewportKeyDownCapture}
        className="max-w-full overflow-auto [scrollbar-width:thin]"
        style={{
          maxHeight: '610px',
          overscrollBehaviorX: 'auto',
          overscrollBehaviorY: 'auto',
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
                (() => {
                  const columnWidth = getColumnWidth(column, collapsedColumns);
                  const isCollapsed = (column === 'invoice_number' || column === 'debit_note_number') && collapsedColumns[column];
                  const canCollapse = column === 'invoice_number' || column === 'debit_note_number';

                  return (
                <th
                  key={column}
                  className={[
                    'h-8 overflow-hidden border-b border-r border-border/60 bg-card px-2.5 py-1 text-left text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground',
                    column === 'pi' || column === 'intake_status' ? 'bg-card border-r border-border/60' : '',
                  ].join(' ')}
                  style={{
                    width: columnWidth,
                    minWidth: columnWidth,
                    top: 0,
                    zIndex: 42,
                    position: 'sticky',
                    ...stickyHeaderStyle(column),
                  }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate leading-[1.05]">
                      {isCollapsed && canCollapse ? (
                        column === 'invoice_number' ? 'Inv' : 'Debit'
                      ) : column === 'invoice_number' ? (
                        <>Invoice<br />No.</>
                      ) : column === 'debit_note_number' ? (
                        <>Debit<br />No.</>
                      ) : column === 'product_reimbursement_upload' ? (
                        <>Product<br />Reimbursement</>
                      ) : column === 'creator_invoice_received' ? (
                        <>Creator<br />Invoice</>
                      ) : column === 'payment_received' ? (
                        <>Payment<br />Received</>
                      ) : column === 'payment_made' ? (
                        <>Payment<br />Made</>
                      ) : (
                        COLUMN_TITLES[column]
                      )}
                    </span>
                    {canCollapse ? (
                      <button
                        type="button"
                        onClick={() => toggleColumnCollapse(column)}
                        className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground transition-none hover:bg-muted/40 hover:text-foreground"
                        aria-label={isCollapsed ? 'Expand column' : 'Collapse column'}
                      >
                        {isCollapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
                      </button>
                    ) : null}
                  </div>
                </th>
                  );
                })()
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const rowClosed = isClosedRow(row);
              return (
                <tr key={row.id} className="group">
                  {activeColumns.map((column, columnIndex) => {
                    const sticky =
                      column === 'pi' ||
                      column === 'intake_status';
                    const columnWidth = getColumnWidth(column, collapsedColumns);
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
                          width: columnWidth,
                          minWidth: columnWidth,
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
                        rowClosed={rowClosed}
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
      {auditPopover ? (
        <AuditPopover
          rect={auditPopover.rect}
          row={auditPopover.row}
          field={auditPopover.field}
          onClose={() => setAuditPopover(null)}
        />
      ) : null}
      {reopenDialog && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/35 px-4">
              <div className="w-full max-w-sm rounded-2xl border border-rose-200 bg-card p-4 shadow-2xl dark:border-rose-400/25">
                <div className="text-sm font-semibold text-rose-600 dark:text-rose-300">Unlock Closed Submission</div>
                <p className="mt-2 text-sm leading-5 text-rose-600 dark:text-rose-300">
                  Reopening a closed submission will unlock the full finance row for editing.
                </p>
                <label className="mt-3 grid gap-1.5">
                  <span className="text-xs font-medium text-foreground">Reason</span>
                  <textarea
                    value={reopenReason}
                    onChange={(event) => {
                      setReopenReason(event.target.value);
                      if (reopenError) setReopenError('');
                    }}
                    rows={3}
                    placeholder="Why do you need to reopen this closed submission?"
                    className="w-full resize-none rounded-lg border border-border/70 bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-rose-300 focus:ring-1 focus:ring-rose-200 dark:focus:border-rose-300 dark:focus:ring-rose-400/20"
                  />
                </label>
                {reopenError ? <div className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-300">{reopenError}</div> : null}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (reopenSubmitting) return;
                      setReopenDialog(null);
                      setReopenReason('');
                      setReopenError('');
                    }}
                    className="inline-flex h-8 items-center rounded-lg border border-border/70 px-3 text-sm font-medium text-foreground hover:bg-muted/30"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={reopenSubmitting}
                    onClick={() => void handleReopenClosedRow()}
                    className="inline-flex h-8 items-center rounded-lg bg-rose-600 px-3 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-70 dark:bg-rose-500 dark:hover:bg-rose-400"
                  >
                    {reopenSubmitting ? 'Opening...' : 'Open Locked Row'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
