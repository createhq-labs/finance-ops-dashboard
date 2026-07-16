"use client";

import { useRouter } from 'next/navigation';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, CheckCircle2, ChevronLeft, ChevronRight, CircleX, Clock3, Download, FileText, Pencil, X } from 'lucide-react';
import { getPiDisplayMeta } from '../../lib/client/pi-display';
import { formatSubmissionAmount, getCurrencyTitle } from '../../lib/shared/currency';
import { formatAttachmentSize, type SubmissionAttachmentSummary } from '../../lib/shared/submission-attachments';
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
import { normalizeInvoiceStatusMachine } from '../../lib/shared/invoice-status';

export type SubmissionRow = {
  id: string;
  pi: string;
  entity: string;
  amount: number;
  currency?: string | null;
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
  finance_notes?: string | null;
  finance_external_notes?: string | null;
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
  product_reimbursement_attachment?: SubmissionAttachmentSummary | null;
  reference_po_attachment?: SubmissionAttachmentSummary | null;
  additional_information?: string | null;
  previous_submission_id?: string | null;
  previous_submission_pi?: string | null;
  previous_submission_snapshot?: Partial<Omit<SubmissionRow, 'previous_submission_snapshot'>> | null;
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
  invoice_status_started?: boolean;
  creator_invoice_received_started?: boolean;
  payment_received_started?: boolean;
  payment_made_started?: boolean;
  intake_line_items?: Array<{
    creator_name?: string | null;
    brand_name?: string | null;
    deliverable_name?: string | null;
    amount?: number | null;
    line_order?: number | null;
  }>;
};

export type MasterDataCellKey =
  | 'agency_name'
  | 'agency_trade_name'
  | 'brand_name'
  | 'brand_trade_name'
  | 'creator_name'
  | 'gst_number';

export type MasterDataReviewSummary = {
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
  | 'rejection_note'
  | 'finance_notes'
  | 'finance_external_notes'
  | 'finance_comment'
  | 'invoice_number'
  | 'debit_note_number';

type StatusEditableField = Exclude<FinanceEditableField, 'rejection_note' | 'finance_notes' | 'finance_comment' | 'invoice_number' | 'debit_note_number'>;

type FinanceUpdateResult = {
  success: boolean;
  message?: string;
  nextValue?: string;
  nextRowPatch?: Partial<SubmissionRow>;
};

type MasterDataActionResult = {
  success: boolean;
  message?: string;
  review?: MasterDataReviewSummary;
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
  | 'owner_name'
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
  | 'campaign_name'
  | 'campaign_brand'
  | 'campaign_code'
  | 'commercials'
  | 'product_reimbursement_upload'
  | 'additional_agency_commission'
  | 'gross_amount'
  | 'additional_information'
  | 'product_reimbursement_file'
  | 'reference_po_file'
  | 'invoice_number'
  | 'debit_note_number'
  | 'creator_invoice_received'
  | 'rejection_note'
  | 'finance_notes'
  | 'finance_external_notes'
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
  owner_name: 'Employee Name / Email',
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
  campaign_name: 'Campaign Name',
  campaign_brand: 'Campaign Brand',
  campaign_code: 'Campaign Code',
  commercials: 'Deal Amount',
  product_reimbursement_upload: 'Product Reimbursement',
  additional_agency_commission: 'Additional Agency Commission',
  gross_amount: 'Total/Gross Amount',
  additional_information: 'Additional Information',
  product_reimbursement_file: 'Product Reimbursement File',
  reference_po_file: 'Reference PO File',
  invoice_number: 'Invoice Number',
  debit_note_number: 'Debit Note Number',
  creator_invoice_received: 'Creator Invoice',
  rejection_note: 'Resubmission Note',
  finance_notes: 'Finance Internal Notes',
  finance_external_notes: 'Finance Notes',
  actions: 'View',
};

const COLUMN_WIDTHS: Record<SheetColumnId, number> = {
  pi: 164,
  submitted_at: 124,
  intake_status: 176,
  invoice_status: 136,
  payment_received: 140,
  payment_made: 136,
  closed_status: 130,
  email_address: 166,
  owner_name: 184,
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
  creator_brand: 150,
  deliverables: 152,
  line_amounts: 168,
  campaign_name: 126,
  campaign_brand: 126,
  campaign_code: 108,
  commercials: 170,
  product_reimbursement_upload: 132,
  additional_agency_commission: 156,
  gross_amount: 182,
  additional_information: 144,
  product_reimbursement_file: 156,
  reference_po_file: 156,
  invoice_number: 104,
  debit_note_number: 104,
  creator_invoice_received: 146,
  rejection_note: 160,
  finance_notes: 156,
  finance_external_notes: 156,
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

const RESUBMISSION_CHANGE_FIELDS: Array<{ label: string; getValue: (row: Partial<SubmissionRow>) => unknown }> = [
  { label: 'Entity Name', getValue: (row) => row.entity },
  { label: 'Legal Name', getValue: (row) => row.trade_name },
  { label: 'GST Number', getValue: (row) => row.gst_number },
  { label: 'Address', getValue: (row) => row.address },
  { label: 'Payment Terms', getValue: (row) => row.bill_due },
  { label: 'Invoice Type', getValue: (row) => row.invoice_type },
  { label: 'Creator / Creators', getValue: (row) => row.creator_creators_name },
  { label: 'Brand Name', getValue: (row) => row.brand_name },
  { label: 'Campaign Code', getValue: (row) => row.campaign_code },
  { label: 'Campaign Name', getValue: (row) => row.campaign_name },
  { label: 'Campaign Brand', getValue: (row) => row.campaign_brand },
  { label: 'Deliverables', getValue: (row) => row.deliverables },
  { label: 'Deal Amount', getValue: (row) => row.amount },
  { label: 'Product Reimbursement', getValue: (row) => row.reimbursement_amount },
  { label: 'Product Reimbursement File', getValue: (row) => row.reimbursement_receipts },
  { label: 'Additional Agency Commission', getValue: (row) => row.additional_agency_commission },
  { label: 'Additional Information', getValue: (row) => row.additional_information },
  { label: 'Business Line', getValue: (row) => row.business_line },
  { label: 'Entry Type', getValue: (row) => row.entry_type },
  { label: 'Entity Type', getValue: (row) => row.entity_type },
  { label: 'Client Type', getValue: (row) => row.client_type },
  { label: 'Agency Name', getValue: (row) => row.agency_name },
  { label: 'Agency Trade Name', getValue: (row) => row.agency_trade_name },
  { label: 'Brand Trade Name', getValue: (row) => row.brand_trade_name },
  { label: 'Currency', getValue: (row) => row.currency },
  { label: 'Line Items', getValue: (row) => row.intake_line_items ?? [] },
];

const COLLAPSED_COLUMN_WIDTHS: Record<'invoice_number' | 'debit_note_number' | 'campaign_code' | 'campaign_name' | 'city' | 'state' | 'country' | 'pincode', number> = {
  invoice_number: 72,
  debit_note_number: 72,
  campaign_code: 88,
  campaign_name: 88,
  city: 88,
  state: 88,
  country: 88,
  pincode: 80,
};

const STATUS_PILL_BASE =
  'inline-flex h-6 max-w-full items-center gap-1 rounded-md border px-2 text-[11px] font-medium leading-none';

function money(n: number, currency?: string | null) {
  return formatSubmissionAmount(n, currency);
}

function copyMoney(value: string | number | null | undefined) {
  return String(value ?? '')
    .split(String.fromCharCode(10))
    .map((part) => part.replace(/[^0-9.-]/g, '').trim())
    .filter((part) => /[0-9]/.test(part))
    .join(String.fromCharCode(10));
}

function normalizeComparableDate(value: string) {
  const isoLike = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[tT ].*)?$/);
  if (isoLike) return isoLike[1] + '-' + isoLike[2] + '-' + isoLike[3];
  const dayFirst = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dayFirst) return dayFirst[3] + '-' + dayFirst[2] + '-' + dayFirst[1];
  return null;
}

function normalizeComparableValue(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return JSON.stringify(
      value.map((entry) => {
        if (!entry || typeof entry !== 'object') return normalizeComparableValue(entry);
        const item = entry as Record<string, unknown>;
        return {
          creator_name: normalizeComparableValue(item.creator_name),
          brand_name: normalizeComparableValue(item.brand_name),
          deliverable_name: normalizeComparableValue(item.deliverable_name),
          amount: normalizeComparableValue(item.amount),
          line_order: normalizeComparableValue(item.line_order),
        };
      })
    );
  }
  if (typeof value === 'number') return 'number:' + value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const text = String(value).trim();
  if (!text) return '';
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return 'number:' + Number(text);
  const normalizedDate = normalizeComparableDate(text);
  if (normalizedDate) return 'date:' + normalizedDate;
  return text;
}

function getResubmissionChangedFields(row: SubmissionRow): string[] {
  if (!row.previous_submission_snapshot) return [];
  const previous = row.previous_submission_snapshot;
  const changed: string[] = [];
  for (const field of RESUBMISSION_CHANGE_FIELDS) {
    const currentValue = normalizeComparableValue(field.getValue(row));
    const previousValue = normalizeComparableValue(field.getValue(previous));
    if (currentValue !== previousValue) changed.push(field.label);
  }
  return changed;
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

function truncateAttachmentLabel(value: string) {
  const trimmed = String(value || '').trim();
  if (trimmed.length <= 10) return trimmed;
  return `${trimmed.slice(0, 6)}....`;
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
    ? joinLines(nonReimbursementLineItems.map((item) => (item.amount ? money(item.amount, row.currency) : null)))
    : money(row.amount, row.currency);

  if (!isTM) {
    return {
      creatorNames: '-',
      creatorBrands: '-',
      deliverables: fieldValue(row.deliverables),
      amounts: money(row.amount, row.currency),
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
      .map((item) => (typeof item.amount === 'number' ? money(item.amount, row.currency) : null))
      .filter(Boolean);

    if (values.length) return values.join('\n');
  }

  if (row.reimbursement_amount === null || row.reimbursement_amount === undefined) return '-';
  return money(row.reimbursement_amount, row.currency);
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
  return normalizeInvoiceStatusMachine(value) || 'po_created_estimate';
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
  if (field === 'invoice_status') return hasStatusStarted(row, field) ? normalizeInvoiceStatusValue(row.invoice_status) : '';
  if (field === 'creator_invoice_received') return hasStatusStarted(row, field) ? row.creator_invoice_received || '' : '';
  if (field === 'payment_received') return hasStatusStarted(row, field) ? row.payment_received || '' : '';
  if (field === 'payment_made') return hasStatusStarted(row, field) ? row.payment_made || '' : '';
  if (field === 'closed_status') return row.closed_status || 'open';
  return row.intake_status;
}

function renderStatusLabel(field: StatusEditableField, value: string | null | undefined) {
  if (
    (field === 'invoice_status' ||
      field === 'creator_invoice_received' ||
      field === 'payment_received' ||
      field === 'payment_made' ||
      field === 'closed_status') &&
    !value
  ) {
    return '';
  }
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
  if (viewer === 'employee' || viewer === 'team_lead') {
    if (field === 'intake_status' && normalized === 'submitted') {
      return 'text-[#A68835] dark:text-[#FCCD49]';
    }
    if (
      (field === 'invoice_status' || field === 'creator_invoice_received' || field === 'payment_received' || field === 'payment_made') &&
      normalized === 'pending'
    ) {
      return 'text-[#A68835] dark:text-[#FCCD49]';
    }
    if (field === 'closed_status' && normalized === 'open') {
      return 'text-rose-600 dark:text-rose-400';
    }
  }
  const tone = getStatusTone(field, value);
  if (tone.includes('cyan')) return 'text-cyan-700 dark:text-cyan-300';
  if (tone.includes('emerald')) return 'text-emerald-700 dark:text-emerald-400';
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
  if ((field === 'invoice_status' || field === 'creator_invoice_received' || field === 'payment_received' || field === 'payment_made') && !normalized) {
    return 'border-slate-300/80 bg-slate-100/80 text-slate-500 dark:border-slate-500/85 dark:bg-slate-300/10 dark:text-slate-300';
  }
  if (field === 'intake_status' && normalized === 'submitted') {
    return 'border-amber-300/90 bg-amber-500/12 text-amber-900 dark:border-amber-500/75 dark:bg-amber-400/26 dark:text-white';
  }
  if (normalized === 'invoice_created') {
    return 'border-cyan-300/90 bg-cyan-500/16 text-cyan-900 dark:border-cyan-300/75 dark:bg-cyan-400/27 dark:text-white';
  }
  if (
    normalized === 'accepted' ||
    normalized === 'full' ||
    normalized === 'paid' ||
    normalized === 'closed' ||
    normalized === 'received'
  ) {
    return 'border-emerald-300/90 bg-emerald-500/16 text-emerald-900 dark:border-emerald-500/75 dark:bg-emerald-300/1 dark:text-emerald-50';
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
      return 'border-rose-400/90 bg-rose-500/18 text-rose-900 dark:border-rose-500/75 dark:bg-rose-500/20 dark:text-white';
    }
    return 'border-orange-300/90 bg-orange-500/16 text-orange-900 dark:border-orange-300/85 dark:bg-orange-500/20 dark:text-white';
  }
  if (
    normalized === 'not_paid' ||
    normalized === 'not_received' ||
    normalized === 'issues' ||
    normalized === 'past_due'
  ) {
    return 'border-rose-300/90 bg-rose-500/16 text-rose-900 dark:border-rose-400/75 dark:bg-rose-500/36 dark:text-white';
  }
  if (normalized === 'invoice_cancelled' || normalized === 'cancelled') {
    return 'border-slate-300/90 bg-slate-500/14 text-slate-800 dark:border-slate-300/80 dark:bg-slate-400/20 dark:text-white';
  }
  return 'border-amber-300/90 bg-amber-500/16 text-amber-900 dark:border-amber-500/65 dark:bg-amber-400/26 dark:text-white';
}

function isClosedRow(row: SubmissionRow) {
  return normalizeText(row.closed_status) === 'closed';
}



function getMasterDataStatusClasses(status: MasterDataReviewSummary['status']) {
  if (status === 'approved') return 'border-emerald-300/70 bg-emerald-500/10 text-emerald-700 dark:border-emerald-300/55 dark:bg-emerald-500/20 dark:text-white';
  if (status === 'rejected') return 'border-rose-300/70 bg-rose-500/10 text-rose-700 dark:border-rose-300/75 dark:bg-rose-500/20 dark:text-white';
  return 'border-amber-300/70 bg-amber-500/10 text-amber-700 dark:border-amber-300/75 dark:bg-amber-500/20 dark:text-white';
}

function getEmployeeFeedback(row: SubmissionRow) {
  return row.finance_comment || row.rejection_note || '';
}

function getFinanceNotes(row: SubmissionRow) {
  return row.finance_notes || '';
}

function getFinanceExternalNotes(row: SubmissionRow) {
  return row.finance_external_notes || '';
}

function truncateNotePreview(value: string) {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (!compact) return '—';
  if (compact.length <= 10) return compact;
  return `${compact.slice(0, 5)}.....`;
}

function hasStatusStarted(row: SubmissionRow, field: StatusEditableField) {
  if (field === 'invoice_status') return Boolean(row.invoice_status_started);
  if (field === 'creator_invoice_received') return Boolean(row.creator_invoice_received_started);
  if (field === 'payment_received') return Boolean(row.payment_received_started);
  if (field === 'payment_made') return Boolean(row.payment_made_started);
  return true;
}

function getColumns(
  viewer: ViewerRole,
  viewerBusinessLine?: 'TM' | 'IM' | null,
  showImCampaignColumns = false,
  showInvoiceColumns = false,
  showAddressColumns = false
) {
  const invoiceFields: SheetColumnId[] = showInvoiceColumns ? ['invoice_number', 'debit_note_number'] : [];
  const addressFields: SheetColumnId[] = showAddressColumns ? ['city', 'state', 'country', 'pincode'] : [];
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
    ...addressFields,
    'invoice_type',
    'bill_due',
    'creator_name',
    'creator_brand',
    'campaign_name',
    'campaign_brand',
    'campaign_code',
    'commercials',
    'product_reimbursement_upload',
    'additional_agency_commission',
    'gross_amount',
    'additional_information',
    'product_reimbursement_file',
    'reference_po_file',
    'deliverables',
  ];
  const financeSharedFields: SheetColumnId[] = [
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
    ...addressFields,
    'bill_due',
    'invoice_type',
    'deliverables',
    'creator_name',
    'creator_brand',
    'campaign_name',
    'campaign_brand',
    'campaign_code',
    'commercials',
    'product_reimbursement_upload',
    'additional_agency_commission',
    'gross_amount',
    'additional_information',
    'product_reimbursement_file',
    'reference_po_file',
  ];

  if (viewer === 'employee' || viewer === 'team_lead') {
    const baseColumns: SheetColumnId[] = ['pi'];
    const teamLeadColumns: SheetColumnId[] = viewer === 'team_lead' ? ['owner_name'] : [];
    if (viewer === 'employee' && viewerBusinessLine === 'TM') {
      return [
        ...baseColumns,
        ...teamLeadColumns,
        'intake_status',
        ...invoiceFields,
        'submitted_at',
        'rejection_note',
        'finance_external_notes',
        'invoice_status',
        'payment_received',
        'creator_invoice_received',
        'payment_made',
        'closed_status',
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
        ...addressFields,
        'invoice_type',
        'bill_due',
        'creator_name',
        'creator_brand',
        'campaign_name',
        'campaign_brand',
        'campaign_code',
        'commercials',
        'product_reimbursement_upload',
        'additional_agency_commission',
        'gross_amount',
        'additional_information',
        'product_reimbursement_file',
        'reference_po_file',
        'deliverables',
        'actions',
      ] satisfies SheetColumnId[];
    }

    if (viewer === 'employee' && viewerBusinessLine === 'IM') {
      return [
        ...baseColumns,
        ...invoiceFields,
        'intake_status',
        ...(showImCampaignColumns ? (['campaign_code', 'campaign_name'] as SheetColumnId[]) : []),
        'submitted_at',
        'rejection_note',
        'finance_external_notes',
        'invoice_status',
        'payment_received',
        'creator_invoice_received',
        'payment_made',
        'closed_status',
        'email_address',
        'business_line',
        'entity_type',
        'client_type',
        'agency_name',
        'agency_trade_name',
        'brand_name',
        'brand_trade_name',
        'gst_number',
        'address',
        ...addressFields,
        'invoice_type',
        'bill_due',
        'creator_brand',
        'campaign_brand',
        'deliverables',
        'commercials',
        'product_reimbursement_upload',
        'additional_agency_commission',
        'gross_amount',
        'additional_information',
        'product_reimbursement_file',
        'reference_po_file',
        'actions',
      ] satisfies SheetColumnId[];
    }

    if (viewer === 'team_lead' && viewerBusinessLine === 'IM') {
      return [
        ...baseColumns,
        ...invoiceFields,
        'intake_status',
        ...teamLeadColumns,
        'submitted_at',
        'rejection_note',
        'finance_external_notes',
        'invoice_status',
        'payment_received',
        'creator_invoice_received',
        'payment_made',
        'closed_status',
        'email_address',
        'business_line',
        'entity_type',
        'client_type',
        'agency_name',
        'agency_trade_name',
        'brand_name',
        'brand_trade_name',
        'gst_number',
        'address',
        ...addressFields,
        'invoice_type',
        'bill_due',
        'creator_brand',
        ...(showImCampaignColumns ? (['campaign_name'] as SheetColumnId[]) : []),
        'campaign_brand',
        ...(showImCampaignColumns ? (['campaign_code'] as SheetColumnId[]) : []),
        'commercials',
        'product_reimbursement_upload',
        'additional_agency_commission',
        'gross_amount',
        'additional_information',
        'product_reimbursement_file',
        'reference_po_file',
        'deliverables',
        'actions',
      ] satisfies SheetColumnId[];
    }

    return [
      ...baseColumns,
      ...teamLeadColumns,
      'intake_status',
      ...invoiceFields,
      'submitted_at',
      'rejection_note',
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
      ...invoiceFields,
      'intake_status',
      'submitted_at',
      ...financeSharedFields,
      'invoice_status',
      'payment_received',
      'creator_invoice_received',
      'payment_made',
      'closed_status',
      'rejection_note',
      'finance_external_notes',
      'finance_notes',
      'actions',
    ] satisfies SheetColumnId[];
  }

  return ['pi', ...invoiceFields, 'intake_status', 'submitted_at', ...sharedEmployeeFields, 'actions'] satisfies SheetColumnId[];
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
  collapsedColumns: Record<'invoice_number' | 'debit_note_number' | 'campaign_code' | 'campaign_name' | 'city' | 'state' | 'country' | 'pincode', boolean>
) {
  if ((column === 'invoice_number' || column === 'debit_note_number') && collapsedColumns[column]) {
    return COLLAPSED_COLUMN_WIDTHS[column];
  }
  if ((column === 'campaign_code' || column === 'campaign_name') && collapsedColumns[column]) {
    return COLLAPSED_COLUMN_WIDTHS[column];
  }
  if ((column === 'city' || column === 'state' || column === 'country' || column === 'pincode') && collapsedColumns[column]) {
    return COLLAPSED_COLUMN_WIDTHS[column];
  }

  return COLUMN_WIDTHS[column];
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
  title,
  className,
  collapseSignal,
}: {
  value: string;
  copied: boolean;
  onCopy: () => void;
  title?: string;
  className?: string;
  collapseSignal?: string;
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
    setExpanded(false);
  }, [collapseSignal]);

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
      data-expandable-root="true"
      className="relative h-full max-w-full"
      onClick={(event) => {
        if (!needsClamp || event.detail !== 1) return;
        setExpanded((current) => !current);
      }}
      onDoubleClick={onCopy}
      title={title || value}
      onKeyDown={(event) => {
        if (!needsClamp) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setExpanded((current) => !current);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setExpanded(false);
        }
      }}
    >
      <CopyNotice active={copied} />
      <div
        ref={textRef}
        className={[
          expanded
            ? `whitespace-pre-line break-words pr-7 text-[13px] leading-4 text-foreground ${className || ''}`
            : `line-clamp-2 break-words pr-7 text-[13px] leading-4 text-foreground ${className || ''}`,
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
          data-expandable-toggle="true"
          aria-label={expanded ? 'Collapse cell' : 'Expand cell'}
        >
          {expanded ? '▴' : '▾'}
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
    Boolean(getFinanceNotes(row).trim());
  const statusStarted =
    field === 'invoice_status' ||
    field === 'creator_invoice_received' ||
    field === 'payment_received' ||
    field === 'payment_made'
      ? hasStatusStarted(row, field)
      : true;

    const top = rect.bottom + 10;
    const left = Math.max(12, rect.left - 70);
    const clampedTop = typeof window === 'undefined' ? top : Math.min(Math.max(12, top), Math.max(12, window.innerHeight - 292));
    const clampedLeft = typeof window === 'undefined' ? left : Math.min(Math.max(12, left), Math.max(12, window.innerWidth - 256 - 12));

  return createPortal(
    <div
      data-audit-popover="true"
      className={[
          'fixed z-[9999] max-h-[calc(100vh-24px)] w-64 overflow-auto rounded-2xl border p-4 text-left shadow-[0_28px_80px_-38px_rgba(15,74,145,0.45)]',
        isReopenAudit
          ? 'border-rose-300/50 bg-white dark:border-rose-400/65 dark:bg-[#07111d]'
          : 'border-cyan-300/35 bg-white/98 dark:border-cyan-400/68 dark:bg-[#07111d]',
      ].join(' ')}
        style={{ top: clampedTop, left: clampedLeft }}
    >
      <div
        className={[
          'text-[0.68rem] font-semibold uppercase tracking-[0.18em]',
          isReopenAudit ? 'text-rose-700 dark:text-rose-200' : 'text-cyan-700 dark:text-cyan-200',
        ].join(' ')}
      >
        {isReopenAudit ? 'Reopen Audit' : statusStarted ? 'Status Audit' : 'Status not started'}
      </div>
      <div className="mt-3 grid gap-3">
        {!statusStarted ? (
          <>
            <div className="text-sm leading-5 text-slate-700 dark:text-slate-200">
              Finance has not started operations on this submission yet.
            </div>
            <div>
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Updated By</div>
              <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-50">—</div>
            </div>
            <div>
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Updated At</div>
              <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-50">—</div>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">Updated By</div>
              <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-50">{row.reviewed_by_name || 'Finance Team'}</div>
            </div>
            <div>
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">Updated At</div>
              <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-50">{formatAuditDate(row.reviewed_at)}</div>
            </div>
          </>
        )}
        {isReopenAudit ? (
          <div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-rose-600 dark:text-rose-300">Reason</div>
            <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-50">{getFinanceNotes(row)}</div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

function MasterDataReviewPopover({
  rect,
  review,
  saving,
  onClose,
  onApprove,
  onReject,
}: {
  rect: DOMRect;
  review: MasterDataReviewSummary;
  saving: boolean;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  useEffect(() => {
    function handleClose(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('[data-master-data-popover="true"]')) return;
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
    const left = Math.max(12, rect.left - 40);
    const clampedTop = typeof window === 'undefined' ? top : Math.min(Math.max(12, top), Math.max(12, window.innerHeight - 320));
    const clampedLeft = typeof window === 'undefined' ? left : Math.min(Math.max(12, left), Math.max(12, window.innerWidth - 288 - 12));
  const statusLabel = review.status === 'approved' ? 'Approved' : review.status === 'rejected' ? 'Ignored' : 'Pending Review';
  const gstNumber = String(review.payload?.gst_number ?? '').trim();
  const address = String(review.payload?.address ?? '').trim();

  return createPortal(
    <div
      data-master-data-popover="true"
        className="fixed z-[9999] max-h-[calc(100vh-24px)] w-72 overflow-auto rounded-2xl border border-cyan-300/75 bg-white/98 p-4 text-left shadow-[0_28px_80px_-38px_rgba(15,74,145,0.45)] dark:border-cyan-400/78 dark:bg-[#07111d]"
        style={{ top: clampedTop, left: clampedLeft }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200">
          Master Data Review
        </div>
        <span className={[
          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
          getMasterDataStatusClasses(review.status),
        ].join(' ')}>
          {statusLabel}
        </span>
      </div>
      <div className="mt-3 grid gap-3">
        <div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-300">Submitted Value</div>
          <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-50">{review.submitted_value}</div>
        </div>
        {review.submitted_trade_name ? (
          <div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-300">Trade Name</div>
            <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-50">{review.submitted_trade_name}</div>
          </div>
        ) : null}
        {gstNumber ? (
          <div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-300">GST Number</div>
            <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-50">{gstNumber}</div>
          </div>
        ) : null}
        {address ? (
          <div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-300">Address</div>
            <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-50">{address}</div>
          </div>
        ) : null}
        {review.status !== 'pending' ? (
          <>
            <div>
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-300">Reviewed By</div>
              <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-50">{review.reviewed_by_name || 'Finance Team'}</div>
            </div>
            <div>
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-300">Reviewed At</div>
              <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-50">{formatAuditDate(review.reviewed_at)}</div>
            </div>
          </>
        ) : null}
        {review.status === 'rejected' && review.rejection_reason ? (
          <div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-rose-600 dark:text-rose-300">Reason</div>
            <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-50">{review.rejection_reason}</div>
          </div>
        ) : null}
      </div>
      {review.status === 'pending' ? (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onReject}
            disabled={saving}
            className="inline-flex h-8 items-center rounded-lg bg-rose-600/10 border border-rose-500/70 px-3 text-sm font-medium text-rose-800 transition-none hover:bg-rose-500/50 disabled:opacity-60 dark:bg-rose-600/20 dark:border-rose-300/80 dark:text-white"
          >
            {saving ? 'Working...' : 'Ignore'}
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={saving}
            className="inline-flex h-8 items-center rounded-lg bg-[linear-gradient(135deg,var(--primary-strong),var(--accent))] px-3 text-sm text-white font-semibold text-primary-foreground transition-none hover:brightness-105 disabled:opacity-60"
          >
            {saving ? 'Working...' : 'Approve'}
          </button>
        </div>
      ) : null}
    </div>,
    document.body
  );
}

function EditableNoteCell({
  row,
  field,
  label,
  value,
  onSave,
  saving,
  copied,
  onCopy,
  editable,
  active,
  onActivate,
  onClose,
}: {
  row: SubmissionRow;
  field: FinanceEditableField;
  label: string;
  value: string;
  onSave?: (row: SubmissionRow, field: FinanceEditableField, value: string) => Promise<FinanceUpdateResult>;
  saving: boolean;
  copied: boolean;
  onCopy: () => void;
  editable: boolean;
  active: boolean;
  onActivate: () => void;
  onClose: () => void;
}) {
  const displayValue = value === '-' ? '' : value;
  const [draft, setDraft] = useState(displayValue);
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft(displayValue);
  }, [displayValue, row.id]);

  useEffect(() => {
    if (!active) return undefined;
    function handleOutside(event: MouseEvent) {
      if (editorRef.current?.contains(event.target as Node)) return;
      setDraft(displayValue);
      onClose();
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [active, displayValue, onClose]);

  async function commit() {
    const next = draft.trim();
    if (!onSave || next === displayValue.trim()) return;
    await onSave(row, field, next);
  }

  if (active && editable) {
    return (
      <div
        ref={editorRef}
        className="flex w-full min-w-0 items-center gap-1 overflow-hidden"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') {
              event.preventDefault();
              void commit().finally(onClose);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setDraft(displayValue);
              onClose();
            }
          }}
          disabled={saving}
          placeholder={label}
          className="h-7 min-w-0 flex-1 basis-0 rounded-md border border-border/70 bg-card px-2 text-[11px] text-foreground outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/25"
        />
        {saving ? <span className="text-[10px] font-medium text-amber-600 dark:text-amber-300">Saving...</span> : null}
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => void commit().finally(onClose)}
          disabled={saving}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-emerald-700 transition-none hover:bg-emerald-500/10 disabled:opacity-60 dark:text-emerald-300"
          aria-label={`Save ${label.toLowerCase()}`}
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => {
            setDraft(displayValue);
            onClose();
          }}
          disabled={saving}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-rose-700 transition-none hover:bg-rose-500/10 disabled:opacity-60 dark:text-rose-300"
          aria-label={`Cancel ${label.toLowerCase()} edit`}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5" title={value || label}>
      <div className="min-w-0 flex-1">
        <ExpandableText value={value || '—'} copied={copied} onCopy={onCopy} />
      </div>
      {editable ? (
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onActivate();
          }}
          className="inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-none hover:bg-muted/40 hover:text-foreground"
          aria-label={`Edit ${label.toLowerCase()}`}
        >
          <Pencil size={12} />
        </button>
      ) : null}
    </div>
  );
}

function InlineValueCell({
  value,
  copied,
  saving,
  active,
  collapsed,
  multiline = false,
  displayValue,
  onCopy,
  onActivate,
  onCancel,
  onSave,
  className,
}: {
  value: string;
  copied: boolean;
  saving: boolean;
  active: boolean;
  collapsed: boolean;
  multiline?: boolean;
  displayValue?: string;
  onCopy: () => void;
  onActivate: () => void;
  onCancel: () => void;
  onSave: (value: string) => Promise<void>;
  className?: string;
}) {
  const rawValue = value === '-' ? '' : value;
  const shownValue = (displayValue ?? value) === '-' ? '—' : (displayValue ?? value);
  const [draft, setDraft] = useState(rawValue);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [portalRect, setPortalRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    setDraft(rawValue);
  }, [rawValue]);

  useEffect(() => {
    if (!active) return undefined;
    function handleOutside(event: MouseEvent) {
      if (editorRef.current?.contains(event.target as Node)) return;
      if (portalRef.current?.contains(event.target as Node)) return;
      setDraft(rawValue);
      onCancel();
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [active, onCancel, rawValue]);

  useLayoutEffect(() => {
    if (!multiline || !active) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(180, Math.max(88, textarea.scrollHeight))}px`;
  }, [active, draft, multiline]);

  useLayoutEffect(() => {
    if (!multiline || !active) return undefined;
    const anchor = editorRef.current;
    if (!anchor) return undefined;

    const updateRect = () => {
      const rect = anchor.getBoundingClientRect();
      const viewport = anchor.closest('[data-submission-table-viewport="true"]') as HTMLElement | null;
      const viewportRect = viewport?.getBoundingClientRect();
      const maxWidth = viewportRect ? Math.max(320, viewportRect.width - 24) : 520;
      const width = Math.min(maxWidth, Math.max(340, rect.width + 56));
      const minLeft = viewportRect ? viewportRect.left + 12 : 16;
      const maxLeft = viewportRect ? Math.max(minLeft, viewportRect.right - width - 12) : Math.max(16, rect.left);
      setPortalRect({
        top: viewportRect ? viewportRect.top + 12 : Math.max(16, rect.top),
        left: Math.min(Math.max(rect.left, minLeft), maxLeft),
        width,
      });
    };

    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [active, multiline]);

  async function commit() {
    await onSave(draft.trim());
  }

  if (active) {
    return (
      <div
        ref={editorRef}
        className={multiline ? 'relative z-20 w-full min-w-0 overflow-visible' : 'relative w-full min-w-0 overflow-hidden'}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        {multiline && portalRect && typeof document !== 'undefined'
          ? createPortal(
              <div
                ref={portalRef}
                className="fixed z-[10020] rounded-xl border border-border/80 bg-card p-2 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.55)] dark:shadow-[0_20px_48px_-28px_rgba(2,132,199,0.45)]"
                style={{ top: portalRect.top, left: portalRect.left, width: portalRect.width }}
              >
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void commit();
                    } else if (event.key === 'Escape') {
                      event.preventDefault();
                      setDraft(rawValue);
                      onCancel();
                    }
                  }}
                  disabled={saving}
                  placeholder="Write note"
                  className="min-h-[88px] w-full resize-none overflow-y-auto rounded-lg border border-border/70 bg-background px-2.5 py-2 pr-14 text-[11px] leading-5 text-foreground outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/25"
                />
                <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-0.5">
                  {saving ? (
                    <span className="pointer-events-none text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-600 dark:text-amber-300">
                      ...
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={() => void commit()}
                    disabled={saving}
                    className="pointer-events-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-emerald-700 transition-none hover:bg-emerald-500/10 disabled:opacity-60 dark:text-emerald-300"
                    aria-label="Save value"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={() => {
                      setDraft(rawValue);
                      onCancel();
                    }}
                    disabled={saving}
                    className="pointer-events-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-rose-700 transition-none hover:bg-rose-500/10 disabled:opacity-60 dark:text-rose-300"
                    aria-label="Cancel edit"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>,
              document.body
            )
          : null}
        {!multiline ? (
          <>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void commit();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  setDraft(rawValue);
                  onCancel();
                }
              }}
              disabled={saving}
              placeholder="Enter value"
              className="h-7 w-full min-w-0 rounded-md border border-border/70 bg-card px-2 pr-14 text-[11px] text-foreground outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/25"
            />
            <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center gap-0.5">
              {saving ? (
                <span className="pointer-events-none text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-600 dark:text-amber-300">
                  ...
                </span>
              ) : null}
              <button
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={() => void commit()}
                disabled={saving}
                className="pointer-events-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-emerald-700 transition-none hover:bg-emerald-500/10 disabled:opacity-60 dark:text-emerald-300"
                aria-label="Save value"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={() => {
                  setDraft(rawValue);
                  onCancel();
                }}
                disabled={saving}
                className="pointer-events-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-rose-700 transition-none hover:bg-rose-500/10 disabled:opacity-60 dark:text-rose-300"
                aria-label="Cancel edit"
              >
                <X size={14} />
              </button>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  const shownText = shownValue;

  return (
    <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap" onDoubleClick={onCopy} title={rawValue || shownText}>
      <CopyNotice active={copied} />
      <span className={['min-w-0 truncate whitespace-nowrap text-[12px]', rawValue === '' ? 'text-muted-foreground' : 'text-foreground', className || ''].join(' ')}>
        {collapsed ? (rawValue === '' ? '—' : shownText.slice(0, 4)) : shownText}
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const tone = getStatusTone(field, value);
  const currentValue = getEditableValue(row, field);
  const options = getEditableOptions(field);
  const displayLabel = label || '—';

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
    const currentIndex = Math.max(0, options.findIndex((option) => option.value === currentValue));
    setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    if (active) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, [active, currentValue, options]);

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

  const statusMenuStyle = useMemo(() => {
    if (!menuRect || typeof window === 'undefined') return null;
    const menuWidth = 176;
    const menuHeight = Math.min(220, options.length * 34 + 8);
    const fitsBelow = menuRect.bottom + 4 + menuHeight <= window.innerHeight - 12;
    const top = fitsBelow
      ? menuRect.bottom + 4
      : Math.max(12, menuRect.top - menuHeight - 4);
    const left = Math.min(
      Math.max(12, menuRect.left),
      Math.max(12, window.innerWidth - menuWidth - 12)
    );
    return { top, left, width: menuWidth };
  }, [menuRect, options.length]);

  return (
    <div ref={rootRef} className="relative inline-flex max-w-full items-center gap-1.5" onDoubleClick={onCopy}>
      <CopyNotice active={copied} />
      <div className="relative max-w-full">
        <button
          ref={triggerRef}
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={editable ? (active ? onClose : onActivate) : undefined}
          onKeyDown={(event) => {
            if (!editable) return;
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              onClose();
              return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              if (!active) {
                onActivate();
              } else {
                void onChange(options[highlightedIndex]?.value || currentValue).finally(onClose);
              }
              return;
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              event.stopPropagation();
              if (!active) {
                onActivate();
                return;
              }
              setHighlightedIndex((current) => {
                const delta = event.key === 'ArrowDown' ? 1 : -1;
                const next = (current + delta + options.length) % options.length;
                requestAnimationFrame(() => optionRefs.current[next]?.focus());
                return next;
              });
            }
          }}
          className={[
            STATUS_PILL_BASE,
            'max-w-[124px] transition-none',
            tone,
            saving ? 'ring-1 ring-primary/40 bg-primary/5' : '',
            active ? 'ring-1 ring-primary/40' : '',
          ].join(' ')}
          title={saving ? 'Saving...' : displayLabel}
        >
          <span className="truncate">{saving ? 'Saving...' : truncateStatusLabel(displayLabel)}</span>
          {editable ? <span className="inline-flex h-4 w-4 items-center justify-center text-current opacity-70">{active ? '▴' : '▾'}</span> : null}
        </button>
        {editable && active && statusMenuStyle && typeof document !== 'undefined'
          ? createPortal(
          <div
            data-status-menu="true"
            className="fixed z-[9999] min-w-[152px] rounded-md border border-border/70 bg-popover p-1 text-popover-foreground shadow-sm"
            style={statusMenuStyle}
          >
            {options.map((option, index) => {
              const selected = option.value === currentValue;
              return (
                <button
                  key={option.value}
                  ref={(node) => { optionRefs.current[index] = node; }}
                  type="button"
                  disabled={saving}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      event.preventDefault();
                      event.stopPropagation();
                      const delta = event.key === 'ArrowDown' ? 1 : -1;
                      const next = (index + delta + options.length) % options.length;
                      setHighlightedIndex(next);
                      optionRefs.current[next]?.focus();
                    } else if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      void onChange(option.value).finally(onClose);
                    } else if (event.key === 'Escape') {
                      event.preventDefault();
                      event.stopPropagation();
                      onClose();
                      requestAnimationFrame(() => triggerRef.current?.focus());
                    }
                  }}
                  onClick={() => {
                    void onChange(option.value).finally(onClose);
                  }}
                  className={[
                    'flex w-full items-center justify-between rounded-sm px-2 py-1 text-left text-[11px] transition-none hover:bg-sky-50 hover:text-sky-900 dark:hover:bg-sky-500/12 dark:hover:text-sky-100',
                    selected || highlightedIndex === index ? 'bg-primary/5 text-foreground' : 'text-popover-foreground',
                  ].join(' ')}
                >
                  <span className="truncate">{option.label}</span>
                  {selected ? <Check size={10} className="ml-2 text-primary" /> : null}
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
            field === 'closed_status' && normalizeText(row.closed_status) === 'open' && getFinanceNotes(row).trim()
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
  rowHighlighted,
}: {
  rowRef: SubmissionRow;
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
  onFocusCell: (rowId: string, columnIndex: number) => void;
  onClickCell: (rowId: string, columnIndex: number) => void;
  onKeyDownCell: (event: ReactKeyboardEvent<HTMLTableCellElement>, rowId: string, columnIndex: number) => void;
  renderContent: () => ReactNode;
  rowHighlighted?: boolean;
}) {
  return (
    <td
      ref={(node) => registerCellRef(`${rowRef.id}:${columnIndex}`, node)}
      data-sheet-cell={`${rowRef.id}:${columnIndex}`}
      data-row-id={rowRef.id}
      data-active-editor={isActiveEditor ? 'true' : undefined}
      data-copied={isCopied ? 'true' : undefined}
      tabIndex={0}
      onFocus={() => onFocusCell(rowRef.id, columnIndex)}
      onClick={() => onClickCell(rowRef.id, columnIndex)}
      onKeyDown={(event) => onKeyDownCell(event, rowRef.id, columnIndex)}
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
  !rowClosed ? 'transition-colors duration-100 group-hover:bg-sky-50/90 hover:bg-sky-50/90 dark:group-hover:bg-slate-800/80 dark:hover:bg-slate-800/80' : 'transition-colors duration-100',
  isFocused ? 'bg-primary/5 ring-1 ring-primary/40 ring-inset' : '',
  rowHighlighted ? '!bg-red-300/30 dark:!bg-red-900/70 animate-[pulse_0.85s_ease-in-out_5]' : '',
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
  prev.columnIndex === next.columnIndex &&
  prev.sticky === next.sticky &&
  prev.rowClosed === next.rowClosed &&
  prev.isFocused === next.isFocused &&
  prev.isActiveEditor === next.isActiveEditor &&
  prev.isCopied === next.isCopied &&
  prev.isSaving === next.isSaving &&
  prev.rowHighlighted === next.rowHighlighted &&
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
  viewerBusinessLine,
  onFinanceUpdate,
  masterDataReviewsBySubmission,
  onMasterDataReviewAction,
  highlightedRowId,
  paginationFooter,
}: {
  rows: SubmissionRow[];
  onOpen?: (id: string, row: SubmissionRow) => void;
  columns?: SubmissionTableColumn[];
  emptyLabel?: string;
  getActionLabel?: (row: SubmissionRow) => string;
  viewer?: ViewerRole;
  viewerBusinessLine?: 'TM' | 'IM' | null;
  onFinanceUpdate?: (row: SubmissionRow, field: FinanceEditableField, value: string) => Promise<FinanceUpdateResult>;
  masterDataReviewsBySubmission?: Record<string, Partial<Record<MasterDataCellKey, MasterDataReviewSummary>>>;
  onMasterDataReviewAction?: (review: MasterDataReviewSummary, action: 'approve' | 'reject') => Promise<MasterDataActionResult>;
  highlightedRowId?: string | null;
  paginationFooter?: ReactNode;
}) {
  void columns;
  const router = useRouter();
  const [showImCampaignColumns, setShowImCampaignColumns] = useState(false);
  const [showInvoiceColumns, setShowInvoiceColumns] = useState(false);
  const [showAddressColumns, setShowAddressColumns] = useState(false);
  const [hiddenOptionalColumns, setHiddenOptionalColumns] = useState<Record<'invoice_number' | 'debit_note_number' | 'campaign_code' | 'campaign_name' | 'city' | 'state' | 'country' | 'pincode', boolean>>({
    invoice_number: false,
    debit_note_number: false,
    campaign_code: false,
    campaign_name: false,
    city: false,
    state: false,
    country: false,
    pincode: false,
  });
  const baseColumns = useMemo(() => getColumns(viewer, viewerBusinessLine, showImCampaignColumns, showInvoiceColumns, showAddressColumns), [viewer, viewerBusinessLine, showImCampaignColumns, showInvoiceColumns, showAddressColumns]);
  const canToggleCampaignColumns = (viewer === 'employee' || viewer === 'team_lead') && viewerBusinessLine === 'IM';
  const activeColumns = useMemo(() => baseColumns.filter((column) => {
    if ((column === 'invoice_number' || column === 'debit_note_number' || column === 'city' || column === 'state' || column === 'country' || column === 'pincode') && hiddenOptionalColumns[column]) {
      return false;
    }
    if (canToggleCampaignColumns && (column === 'campaign_code' || column === 'campaign_name') && hiddenOptionalColumns[column]) {
      return false;
    }
    return true;
  }), [baseColumns, canToggleCampaignColumns, hiddenOptionalColumns]);
  const isFinanceViewer = viewer === 'finance' || viewer === 'admin';
  const [collapsedColumns, setCollapsedColumns] = useState<Record<'invoice_number' | 'debit_note_number' | 'campaign_code' | 'campaign_name' | 'city' | 'state' | 'country' | 'pincode', boolean>>({
    invoice_number: false,
    debit_note_number: false,
    campaign_code: false,
    campaign_name: false,
    city: false,
    state: false,
    country: false,
    pincode: false,
  });
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [attachmentActionKey, setAttachmentActionKey] = useState<string | null>(null);
  const [auditPopover, setAuditPopover] = useState<{ key: string; rect: DOMRect; row: SubmissionRow; field: FinanceEditableField } | null>(null);
  const [masterDataPopover, setMasterDataPopover] = useState<{ rect: DOMRect; review: MasterDataReviewSummary } | null>(null);
  const [masterDataSavingId, setMasterDataSavingId] = useState<string | null>(null);
  const [expandedPiGroups, setExpandedPiGroups] = useState<string[]>([]);
  const [focusedCell, setFocusedCell] = useState<{ rowId: string; columnIndex: number } | null>(null);
  const [activeEditor, setActiveEditor] = useState<{ rowId: string; columnIndex: number } | null>(null);
  const [reopenDialog, setReopenDialog] = useState<{ row: SubmissionRow; rowIndex: number; columnIndex: number } | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenError, setReopenError] = useState('');
  const [reopenSubmitting, setReopenSubmitting] = useState(false);
  const [changeSummaryDialog, setChangeSummaryDialog] = useState<{ pi: string; fields: string[] } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef(new Map<string, HTMLTableCellElement>());
  const lastHighlightedRowIdRef = useRef<string | null>(null);
  const stickyLefts = useMemo(() => {
    const piWidth = getColumnWidth('pi', collapsedColumns);
    const invoiceVisible = activeColumns.includes('invoice_number');
    const invoiceWidth = invoiceVisible ? getColumnWidth('invoice_number', collapsedColumns) : 0;
    const debitVisible = activeColumns.includes('debit_note_number');
    const debitWidth = debitVisible ? getColumnWidth('debit_note_number', collapsedColumns) : 0;
    return {
      pi: 0,
      invoice_number: piWidth,
      debit_note_number: piWidth + invoiceWidth,
      intake_status: piWidth + invoiceWidth + debitWidth,
    };
  }, [activeColumns, collapsedColumns]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('submission-table-collapsed-columns');
      if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<Record<'invoice_number' | 'debit_note_number' | 'campaign_code' | 'campaign_name' | 'city' | 'state' | 'country' | 'pincode', boolean>>;
        setCollapsedColumns({
          invoice_number: Boolean(parsed.invoice_number),
          debit_note_number: Boolean(parsed.debit_note_number),
          campaign_code: false,
          campaign_name: false,
          city: Boolean(parsed.city),
          state: Boolean(parsed.state),
          country: Boolean(parsed.country),
          pincode: Boolean(parsed.pincode),
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
    const cell = cellRefs.current.get(`${activeEditor.rowId}:${activeEditor.columnIndex}`);
    const target = cell?.querySelector<HTMLElement>('input, button, textarea, select');
    target?.focus();
    return undefined;
  }, [activeEditor]);

  useEffect(() => {
    if (!showImCampaignColumns && !showInvoiceColumns && !showAddressColumns) return undefined;
    function handleOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (viewportRef.current?.contains(target as Node)) return;
      setShowImCampaignColumns(false);
      setShowInvoiceColumns(false);
      setShowAddressColumns(false);
      setHiddenOptionalColumns({
        invoice_number: false,
        debit_note_number: false,
        campaign_code: false,
        campaign_name: false,
        city: false,
        state: false,
        country: false,
        pincode: false,
      });
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showAddressColumns, showImCampaignColumns, showInvoiceColumns]);

  useEffect(() => {
    if (expandedPiGroups.length === 0) return undefined;
    function handleOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('[data-pi-group-toggle="true"]')) return;
      if (target?.closest?.('[data-pi-group-panel="true"]')) return;
      setExpandedPiGroups([]);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [expandedPiGroups]);

  const groupedPiData = useMemo(() => {
    const rowMap = new Map(rows.map((entry) => [entry.id, entry]));
    const rootCache = new Map<string, string>();

    const getRootId = (row: SubmissionRow) => {
      const cached = rootCache.get(row.id);
      if (cached) return cached;
      let current = row;
      const seen = new Set<string>([row.id]);
      while (current.previous_submission_id && rowMap.has(current.previous_submission_id) && !seen.has(current.previous_submission_id)) {
        const next = rowMap.get(current.previous_submission_id);
        if (!next) break;
        current = next;
        seen.add(current.id);
      }
      rootCache.set(row.id, current.id);
      return current.id;
    };

    const groups = new Map<string, Array<{ index: number; row: SubmissionRow }>>();
    rows.forEach((row, index) => {
      const rootId = getRootId(row);
      const nextEntries = groups.get(rootId) ?? [];
      nextEntries.push({ index, row });
      groups.set(rootId, nextEntries);
    });

    const groupIdByRowId: Record<string, string> = {};
    const expandableGroupIds = new Set<string>();
    const sortedGroups = Array.from(groups.entries()).sort(
      (a, b) => Math.min(...a[1].map((entry) => entry.index)) - Math.min(...b[1].map((entry) => entry.index))
    );

    const groupedRows = sortedGroups.map(([groupId, entries]) => {
      const members = entries.map((entry) => entry.row);
      const memberIds = new Set(members.map((entry) => entry.id));
      const newerRefIds = new Set(
        members
          .map((entry) => entry.previous_submission_id)
          .filter((entry): entry is string => Boolean(entry && memberIds.has(entry)))
      );
      const latest =
        members.find((entry) => !newerRefIds.has(entry.id)) ??
        [...members].sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime())[0];
      const history = [...members]
        .filter((entry) => entry.id != latest.id)
        .sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime());
      if (history.length > 0) {
        expandableGroupIds.add(groupId);
      }
      groupIdByRowId[latest.id] = groupId;
      for (const historyRow of history) {
        groupIdByRowId[historyRow.id] = groupId;
      }
      return { groupId, latest, history };
    });

    return { groupedRows, groupIdByRowId, expandableGroupIds };
  }, [rows]);

  const expandedPiGroupSet = useMemo(() => new Set(expandedPiGroups), [expandedPiGroups]);
  const resubmissionChangeMap = useMemo(() => {
    const next = new Map<string, string[]>();
    for (const row of rows) {
      if (!row.previous_submission_id || !row.previous_submission_snapshot) continue;
      next.set(row.id, getResubmissionChangedFields(row));
    }
    return next;
  }, [rows]);

  useEffect(() => {
    if (!highlightedRowId) {
      lastHighlightedRowIdRef.current = null;
      return;
    }
    if (lastHighlightedRowIdRef.current === highlightedRowId) return;
    const viewport = viewportRef.current;
    const rowNode = viewport?.querySelector<HTMLTableRowElement>(`tr[data-submission-row="${highlightedRowId}"]`);
    if (!rowNode) {
      const groupId = groupedPiData.groupIdByRowId[highlightedRowId];
      const targetGroup = groupedPiData.groupedRows.find((group) => group.groupId === groupId);
      if (targetGroup && targetGroup.history.some((entry) => entry.id === highlightedRowId) && !expandedPiGroupSet.has(groupId)) {
        setExpandedPiGroups((current) => (current.includes(groupId) ? current : [...current, groupId]));
      }
      return;
    }
    lastHighlightedRowIdRef.current = highlightedRowId;
    rowNode.scrollIntoView({ block: 'center' });
    const timer = window.setTimeout(() => {
      if (lastHighlightedRowIdRef.current === highlightedRowId) {
        lastHighlightedRowIdRef.current = null;
      }
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [expandedPiGroupSet, groupedPiData.groupIdByRowId, groupedPiData.groupedRows, highlightedRowId, rows]);

  const { renderItems, visibleDataRows } = useMemo(() => {
    const renderItems: Array<{ kind: 'data'; row: SubmissionRow; groupId: string; isHistory: boolean; rowIndex: number }> = [];
    const visibleDataRows: SubmissionRow[] = [];
    let rowIndex = 0;

    for (const group of groupedPiData.groupedRows) {
      visibleDataRows.push(group.latest);
      renderItems.push({
        kind: 'data',
        row: group.latest,
        groupId: group.groupId,
        isHistory: false,
        rowIndex,
      });
      rowIndex += 1;

      if (expandedPiGroupSet.has(group.groupId)) {
        for (const historyRow of group.history) {
          visibleDataRows.push(historyRow);
          renderItems.push({
            kind: 'data',
            row: historyRow,
            groupId: group.groupId,
            isHistory: true,
            rowIndex,
          });
          rowIndex += 1;
        }
      }
    }

    return { renderItems, visibleDataRows };
  }, [expandedPiGroupSet, groupedPiData]);

  const visibleRowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    visibleDataRows.forEach((row, index) => {
      map.set(row.id, index);
    });
    return map;
  }, [visibleDataRows]);

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

  const openAttachment = useCallback(async (attachment: SubmissionAttachmentSummary | null | undefined, row: SubmissionRow, mode: 'view' | 'download') => {
    if (!attachment) return;
    const key = `${row.id}:${attachment.id}:${mode}`;
    setAttachmentActionKey(key);
    try {
      const res = await fetch(`/api/submissions/attachments/${attachment.id}/signed-url${mode === 'download' ? '?download=1' : ''}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success || !body?.url) {
        throw new Error(body?.error || 'Unable to open attachment.');
      }
      window.open(String(body.url), '_blank', 'noopener,noreferrer');
      setFlash({ key, message: mode === 'download' ? 'Download ready' : 'Opening file', tone: 'success' });
    } catch (error) {
      setFlash({ key, message: error instanceof Error ? error.message : 'Unable to open attachment.', tone: 'error' });
    } finally {
      setAttachmentActionKey(null);
    }
  }, []);

  const getCellCopyText = useCallback((column: SheetColumnId, row: SubmissionRow) => {
    const creatorData = getCreatorData(row);

    switch (column) {
      case 'pi':
        return formatPiNumber(row);
      case 'submitted_at':
        return formatSubmittedAt(row.submitted_at);
      case 'owner_name':
        return fieldValue(row.owner_name);
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
        return copyMoney(creatorData.amounts);
      case 'campaign_name':
        return fieldValue(row.campaign_name);
      case 'campaign_brand':
        return fieldValue(row.campaign_brand);
      case 'campaign_code':
        return fieldValue(row.campaign_code);
      case 'commercials':
        return copyMoney(money(row.amount, row.currency));
      case 'product_reimbursement_upload':
        return copyMoney(getProductReimbursementValue(row));
      case 'additional_agency_commission':
        return row.additional_agency_commission ? copyMoney(money(row.additional_agency_commission, row.currency)) : '';
      case 'gross_amount':
        return copyMoney(money(row.amount + (row.additional_agency_commission || 0), row.currency));
      case 'additional_information':
        return fieldValue(row.additional_information);
      case 'product_reimbursement_file':
        return fieldValue(row.product_reimbursement_attachment?.file_name);
      case 'reference_po_file':
        return fieldValue(row.reference_po_attachment?.file_name);
      case 'rejection_note':
        return fieldValue(getEmployeeFeedback(row));
      case 'invoice_number':
        return fieldValue(row.invoice_number);
      case 'debit_note_number':
        return fieldValue(row.debit_note_number);
      case 'finance_notes':
        return fieldValue(getFinanceNotes(row));
      case 'finance_external_notes':
        return fieldValue(getFinanceExternalNotes(row));
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


  function openMasterDataPopover(review: MasterDataReviewSummary, event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMasterDataPopover({ rect, review });
  }

  function navigateToMasterDataEdit(review: MasterDataReviewSummary, event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    router.push('/dashboard/master-data?review_id=' + review.id + '&mode=edit');
  }

  function renderMasterDataReviewActions(review: MasterDataReviewSummary) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => openMasterDataPopover(review, event)}
          className={['inline-flex h-5 w-5 items-center justify-center rounded-md border transition-none hover:bg-muted/40', getMasterDataStatusClasses(review.status)].join(' ')}
          aria-label="Open master data review"
          title={review.status === 'pending' ? 'Pending master data review' : review.status === 'approved' ? 'Approved master data value' : 'Ignored master data value'}
        >
          {review.status === 'approved' ? <CheckCircle2 size={12} /> : review.status === 'rejected' ? <CircleX size={12} /> : <Clock3 size={12} />}
        </button>
        {isFinanceViewer && review.status === 'approved' ? (
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => navigateToMasterDataEdit(review, event)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-none hover:bg-muted/40 hover:text-foreground"
            aria-label="Edit approved master data"
            title="Edit approved master data"
          >
            <Pencil size={12} />
          </button>
        ) : null}
      </div>
    );
  }

  async function handleMasterDataPopoverAction(action: 'approve' | 'reject') {
    if (!masterDataPopover || !onMasterDataReviewAction) return;
    setMasterDataSavingId(masterDataPopover.review.id);
    const result = await onMasterDataReviewAction(masterDataPopover.review, action);
    setMasterDataSavingId(null);
    if (result.success && result.review) {
      setMasterDataPopover((current) => (current ? { ...current, review: result.review! } : current));
    }
  }

  function togglePiGroup(groupId: string) {
    if (!groupedPiData.expandableGroupIds.has(groupId)) return;
    setExpandedPiGroups((current) =>
      current.includes(groupId) ? current.filter((entry) => entry !== groupId) : [...current, groupId]
    );
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

    const noteResult = await onFinanceUpdate(reopenDialog.row, 'finance_notes', note);
    if (!noteResult.success) {
      setReopenSubmitting(false);
      setReopenError(noteResult.message || 'Failed to save reopen reason.');
      return;
    }

    const rowForReopen = {
      ...reopenDialog.row,
      finance_notes: note,
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
      column !== 'invoice_number' &&
      column !== 'debit_note_number' &&
      column !== 'intake_status'
    ) return undefined;
    return {
      position: 'sticky',
      left: stickyLefts[column],
      zIndex: column === 'intake_status' ? 40 : column === 'debit_note_number' ? 39 : column === 'invoice_number' ? 38 : 37,
    };
  }

  function stickyHeaderStyle(column: SheetColumnId): CSSProperties | undefined {
    if (
      column !== 'pi' &&
      column !== 'invoice_number' &&
      column !== 'debit_note_number' &&
      column !== 'intake_status'
    ) return undefined;
    return {
      position: 'sticky',
      left: stickyLefts[column],
      zIndex: column === 'intake_status' ? 66 : column === 'debit_note_number' ? 65 : column === 'invoice_number' ? 64 : 63,
    };
  }

  const focusCell = useCallback((rowIndex: number, columnIndex: number) => {
    const nextRow = Math.max(0, Math.min(visibleDataRows.length - 1, rowIndex));
    const nextColumn = Math.max(0, Math.min(activeColumns.length - 1, columnIndex));
    const targetRow = visibleDataRows[nextRow];
    if (!targetRow) return;
    setFocusedCell({ rowId: targetRow.id, columnIndex: nextColumn });
    const cell = cellRefs.current.get(`${targetRow.id}:${nextColumn}`);
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
  }, [activeColumns.length, collapsedColumns, visibleDataRows]);

  const registerCellRef = useCallback((key: string, node: HTMLTableCellElement | null) => {
    if (node) cellRefs.current.set(key, node);
    else cellRefs.current.delete(key);
  }, []);

  const handleCellFocus = useCallback((rowId: string, columnIndex: number) => {
    setFocusedCell({ rowId, columnIndex });
  }, []);

  const handleCellClick = useCallback((rowId: string, columnIndex: number) => {
    setFocusedCell({ rowId, columnIndex });
    const rowIndex = visibleRowIndexById.get(rowId);
    if (rowIndex == null) {
      setActiveEditor((current) =>
        current && (current.rowId !== rowId || current.columnIndex !== columnIndex) ? null : current
      );
      return;
    }
    const column = activeColumns[columnIndex];
    const row = visibleDataRows[rowIndex];
    const isSingleClickEditable =
      isFinanceViewer &&
      Boolean(onFinanceUpdate) &&
      !isClosedRow(row) &&
      (
        column === 'invoice_number' ||
        column === 'debit_note_number' ||
        column === 'rejection_note' ||
        column === 'finance_external_notes' ||
        column === 'finance_notes'
      );

    if (isSingleClickEditable) {
      setActiveEditor({ rowId, columnIndex });
      return;
    }

    setActiveEditor((current) =>
      current && (current.rowId !== rowId || current.columnIndex !== columnIndex) ? null : current
    );
  }, [activeColumns, isFinanceViewer, onFinanceUpdate, visibleDataRows, visibleRowIndexById]);

  const requestEditorOpen = useCallback((row: SubmissionRow, columnIndex: number) => {
    if (isClosedRow(row)) return;
    setActiveEditor({ rowId: row.id, columnIndex });
  }, []);

  const handleCellKeyDown = useCallback((event: ReactKeyboardEvent<HTMLTableCellElement>, rowId: string, columnIndex: number) => {
    const rowIndex = visibleRowIndexById.get(rowId);
    if (rowIndex == null) return;
    const column = activeColumns[columnIndex];
    const row = visibleDataRows[rowIndex];
    const isEditableStatusCell =
      isFinanceViewer &&
      (
        column === 'intake_status' ||
        column === 'invoice_status' ||
        column === 'creator_invoice_received' ||
        column === 'payment_received' ||
        column === 'payment_made' ||
        column === 'closed_status' ||
        column === 'rejection_note' ||
        column === 'finance_external_notes' ||
        column === 'finance_notes' ||
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
        setActiveEditor({ rowId: row.id, columnIndex });
      }
    } else if (event.key === 'Enter') {
      const cell = cellRefs.current.get(`${row.id}:${columnIndex}`);
      const toggle = cell?.querySelector('[data-expandable-toggle="true"]');
      if (toggle instanceof HTMLElement) {
        event.preventDefault();
        toggle.click();
        return;
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setActiveEditor(null);
      focusCell(rowIndex, columnIndex);
    }
  }, [activeColumns, focusCell, isFinanceViewer, visibleDataRows, visibleRowIndexById]);

  const toggleColumnCollapse = useCallback((column: 'invoice_number' | 'debit_note_number' | 'campaign_code' | 'campaign_name' | 'city' | 'state' | 'country' | 'pincode') => {
    if ((column === 'campaign_code' || column === 'campaign_name') && !canToggleCampaignColumns) {
      return;
    }
    if (column === 'invoice_number' || column === 'debit_note_number' || column === 'campaign_code' || column === 'campaign_name' || column === 'city' || column === 'state' || column === 'country' || column === 'pincode') {
      setHiddenOptionalColumns((current) => ({
        ...current,
        [column]: !current[column],
      }));
      return;
    }
    setCollapsedColumns((current) => ({
      ...current,
      [column]: !current[column],
    }));
  }, [canToggleCampaignColumns]);

  const toggleCampaignColumns = useCallback(() => {
    setShowImCampaignColumns((current) => {
      const next = !current;
      if (next) {
        setHiddenOptionalColumns((hidden) => ({ ...hidden, campaign_code: false, campaign_name: false }));
      }
      return next;
    });
  }, []);

  const toggleInvoiceColumns = useCallback(() => {
    setShowInvoiceColumns((current) => {
      const next = !current;
      if (next) {
        setHiddenOptionalColumns((hidden) => ({ ...hidden, invoice_number: false, debit_note_number: false }));
      }
      return next;
    });
  }, []);

  const toggleAddressColumns = useCallback(() => {
    setShowAddressColumns((current) => {
      const next = !current;
      if (next) {
        setHiddenOptionalColumns((hidden) => ({ ...hidden, city: false, state: false, country: false, pincode: false }));
      }
      return next;
    });
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

    const rowIndex = visibleRowIndexById.get(focusedCell.rowId);
    if (rowIndex == null) return;
    const row = visibleDataRows[rowIndex];
    const column = activeColumns[focusedCell.columnIndex];
    if (!row || !column) return;

    event.preventDefault();
    void copyCell(`${row.id}:${column}`, getCellCopyText(column, row));
  }, [activeColumns, copyCell, focusedCell, getCellCopyText, visibleDataRows, visibleRowIndexById]);

  function renderCell(column: SheetColumnId, row: SubmissionRow, rowIndex: number, columnIndex: number, isHistoryRow = false) {
    const cellKey = `${row.id}:${column}`;
    const creatorData = getCreatorData(row);
    const isCopied = copiedKey === cellKey;
    const isSaving = savingKey === `${row.id}:${column}`;
    const commonText = (value: string, title?: string, copyValue = value, className?: string) => (
      <ExpandableText
        value={value}
        copied={isCopied}
        onCopy={() => void copyCell(cellKey, copyValue)}
        title={title}
        className={className}
        collapseSignal={focusedCell ? `${focusedCell.rowId}:${focusedCell.columnIndex}` : ''}
      />
    );
    const renderAttachmentCell = (attachment: SubmissionAttachmentSummary | null | undefined, row: SubmissionRow) => {
      if (!attachment) return commonText('-');
      const actionKeyBase = `${row.id}:${attachment.id}`;
      const isViewing = attachmentActionKey === `${actionKeyBase}:view`;
      const isDownloading = attachmentActionKey === `${actionKeyBase}:download`;
      const title = `${attachment.file_name} • ${formatAttachmentSize(attachment.file_size_bytes)}`;

      const isBusy = isViewing || isDownloading;

      return (
        <div className="flex min-w-0 items-center gap-1.5" title={title}>
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200">
            <FileText size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-foreground">{truncateAttachmentLabel(attachment.file_name)}</p>
            <p className="text-[10px] text-muted-foreground">{formatAttachmentSize(attachment.file_size_bytes)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void openAttachment(attachment, row, 'view')}
              className="inline-flex h-6 items-center rounded-md border border-border/70 bg-card px-2 text-[11px] font-medium text-foreground transition-none hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isViewing ? 'Opening...' : isDownloading ? 'Preparing...' : 'View'}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void openAttachment(attachment, row, 'download')}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground transition-none hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Download attachment"
            >
              {isDownloading ? <Clock3 size={12} className="animate-spin" /> : <Download size={12} />}
            </button>
          </div>
        </div>
      );
    };

    switch (column) {
      case 'pi':
        {
          const displayPi = formatPiNumber(row);
          const piVersionState = row.version_status ?? (isHistoryRow ? 'superseded' : row.previous_submission_id ? 'resubmitted' : 'original');
          const piClasses =
            piVersionState === 'superseded'
              ? 'border-amber-500/79 bg-amber-300/20 text-amber-800 dark:border-amber-500/80 dark:bg-amber-500/40 dark:text-white'
              : piVersionState === 'resubmitted'
                ? 'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/80 dark:bg-blue-800/52 dark:text-white'
                : displayPi === 'PI Not Required'
                  ? 'border-cyan-300/80 bg-cyan-50 text-cyan-800 dark:border-cyan-500/80 dark:bg-cyan-500/40 dark:text-white'
                  : 'border-slate-300/80 bg-slate-100 text-slate-700 dark:border-slate-500/62 dark:bg-slate-200/20 dark:text-white';
          const groupId = groupedPiData.groupIdByRowId[row.id] || row.id;
          const isExpanded = expandedPiGroupSet.has(groupId);
          const canExpand = groupedPiData.expandableGroupIds.has(groupId);
          return (
              <div className="relative flex items-center gap-1.5" title={getPiTitle(row)}>
                <CopyNotice active={isCopied} />
                <button
                  type="button"
                  data-pi-group-toggle="true"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!canExpand) return;
                    togglePiGroup(groupId);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    void copyCell(cellKey, displayPi);
                  }}
                  className={[
                    'inline-flex h-6 max-w-full items-center gap-1 rounded-md border px-2 text-xs font-medium transition-none',
                    piClasses,
                    canExpand ? 'cursor-pointer hover:ring-1 hover:ring-primary/35' : 'cursor-default',
                  ].join(' ')}
                >
                  <span className="truncate whitespace-nowrap">{displayPi}</span>
                  {canExpand ? (
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-current">
                      {isExpanded ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}
                    </span>
                  ) : null}
                </button>
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
      case 'owner_name':
        return commonText(fieldValue(row.owner_name));
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
        if (viewer === 'employee' || viewer === 'team_lead') {
          const shouldShowAuditIcon =
            field === 'invoice_status' ||
            field === 'creator_invoice_received' ||
            field === 'payment_received' ||
            field === 'payment_made';
          return (
            <div className="flex max-w-full items-center gap-1.5" onDoubleClick={() => void copyCell(cellKey, label || '-') } title={label || 'Status not started'}>
              <CopyNotice active={isCopied} />
              <span className={['block truncate text-sm font-medium', getStatusTextTone(field, rawValue, viewer)].join(' ')}>
                {label || '—'}
              </span>
              {shouldShowAuditIcon ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => openAudit(row, field, event)}
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

        const changeFields = field === 'intake_status' && !isHistoryRow ? (resubmissionChangeMap.get(row.id) ?? null) : null;
        const statusCell = (
          <BadgeSelectCell
            row={row}
            field={field}
            editable={editable}
            label={label}
            value={rawValue}
            saving={isSaving}
            copied={isCopied}
            active={activeEditor?.rowId === row.id && activeEditor?.columnIndex === columnIndex}
            onCopy={() => void copyCell(cellKey, label)}
            onChange={(value) => updateFinanceValue(row, field, value)}
            onActivate={() => requestEditorOpen(row, columnIndex)}
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

        if (!changeFields || !row.previous_submission_id) {
          return statusCell;
        }

        return (
          <div className="flex max-w-full items-center gap-1.5">
            {statusCell}
            <button
              type="button"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                setChangeSummaryDialog({ pi: formatPiNumber(row), fields: changeFields });
              }}
              className="inline-flex h-5 min-w-[24px] items-center justify-center rounded-full border border-rose-300 bg-rose-50 px-1.5 text-[10px] font-semibold leading-none text-rose-700 transition-none hover:bg-rose-100 dark:border-rose-400/35 dark:bg-rose-500/12 dark:text-rose-200 dark:hover:bg-rose-500/20"
              title="View changes in latest resubmission"
              aria-label={'View ' + changeFields.length + ' changed fields in latest resubmission'}
            >
              {changeFields.length}
            </button>
          </div>
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
      case 'agency_name': {
        const value = fieldValue(row.agency_name);
        const review = masterDataReviewsBySubmission?.[row.id]?.['agency_name'];
        return (
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">{commonText(value)}</div>
            {review ? renderMasterDataReviewActions(review) : null}
          </div>
        );
      }
      case 'agency_trade_name': {
        const value = fieldValue(row.agency_trade_name);
        const review = masterDataReviewsBySubmission?.[row.id]?.['agency_trade_name'];
        return (
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">{commonText(value)}</div>
            {review ? renderMasterDataReviewActions(review) : null}
          </div>
        );
      }
      case 'brand_name': {
        const value = fieldValue(row.brand_name);
        const review = masterDataReviewsBySubmission?.[row.id]?.['brand_name'];
        return (
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">{commonText(value)}</div>
            {review ? renderMasterDataReviewActions(review) : null}
          </div>
        );
      }
      case 'brand_trade_name': {
        const value = fieldValue(row.brand_trade_name);
        const review = masterDataReviewsBySubmission?.[row.id]?.['brand_trade_name'];
        return (
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">{commonText(value)}</div>
            {review ? renderMasterDataReviewActions(review) : null}
          </div>
        );
      }
      case 'gst_number': {
        const value = fieldValue(row.gst_number);
        const review = masterDataReviewsBySubmission?.[row.id]?.gst_number;
        return (
          <div className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1">{commonText(value)}</div>
            {review ? renderMasterDataReviewActions(review) : null}
          </div>
        );
      }
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
      case 'creator_name': {
        const value = creatorData.creatorNames;
        const review = masterDataReviewsBySubmission?.[row.id]?.creator_name;
        return (
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">{commonText(value)}</div>
            {review ? renderMasterDataReviewActions(review) : null}
          </div>
        );
      }
      case 'creator_brand':
        return commonText(creatorData.creatorBrands);
      case 'deliverables':
        return commonText(creatorData.deliverables);
      case 'line_amounts':
        return commonText(creatorData.amounts, getCurrencyTitle(row.currency), copyMoney(creatorData.amounts));
      case 'campaign_name':
        return commonText(fieldValue(row.campaign_name));
      case 'campaign_brand':
        return commonText(fieldValue(row.campaign_brand));
      case 'campaign_code':
        return commonText(fieldValue(row.campaign_code));
      case 'commercials':
        return commonText(money(row.amount, row.currency), getCurrencyTitle(row.currency, row.amount), copyMoney(money(row.amount, row.currency)));
      case 'product_reimbursement_upload':
        return commonText(getProductReimbursementValue(row), getCurrencyTitle(row.currency), copyMoney(getProductReimbursementValue(row)));
      case 'additional_agency_commission':
        return commonText(
          row.additional_agency_commission ? money(row.additional_agency_commission, row.currency) : '-',
          row.additional_agency_commission ? getCurrencyTitle(row.currency, row.additional_agency_commission) : undefined,
          row.additional_agency_commission ? copyMoney(money(row.additional_agency_commission, row.currency)) : '-'
        );
      case 'gross_amount':
        return commonText(
          money(row.amount + (row.additional_agency_commission || 0), row.currency),
          getCurrencyTitle(row.currency, row.amount + (row.additional_agency_commission || 0)),
          copyMoney(money(row.amount + (row.additional_agency_commission || 0), row.currency))
        );
      case 'additional_information':
        return commonText(fieldValue(row.additional_information));
      case 'product_reimbursement_file':
        return renderAttachmentCell(row.product_reimbursement_attachment, row);
      case 'reference_po_file':
        return renderAttachmentCell(row.reference_po_attachment, row);
      case 'rejection_note': {
        const feedbackRaw = row.rejection_note || row.finance_comment || '';
        const feedback = fieldValue(feedbackRaw);
        const employeeNotesClass = !isFinanceViewer ? 'rounded-md bg-rose-50/75 px-2 py-1 dark:bg-rose-500/10' : undefined;
        return isFinanceViewer && onFinanceUpdate ? (
          <InlineValueCell
            value={feedbackRaw}
            displayValue={truncateNotePreview(feedbackRaw)}
            copied={isCopied}
            saving={isSaving}
            active={!isClosedRow(row) && activeEditor?.rowId === row.id && activeEditor?.columnIndex === columnIndex}
            collapsed={false}
            multiline
            onCopy={() => void copyCell(cellKey, feedbackRaw)}
            onActivate={() => requestEditorOpen(row, columnIndex)}
            onCancel={() => setActiveEditor(null)}
            onSave={async (value) => {
              await updateFinanceValue(row, 'rejection_note', value);
              setActiveEditor(null);
            }}
            className="text-rose-700 dark:text-rose-300"
          />
        ) : commonText(feedback, undefined, feedbackRaw, employeeNotesClass);
      }
      case 'invoice_number':
      case 'debit_note_number': {
        const field = column as 'invoice_number' | 'debit_note_number';
        const colorClass =
          field === 'invoice_number'
            ? 'text-purple-700 dark:text-purple-300'
            : 'text-blue-900 dark:text-blue-200';
        if (!isFinanceViewer || !onFinanceUpdate) {
          return (
            <ExpandableText
              value={fieldValue(row[field])}
              copied={isCopied}
              onCopy={() => void copyCell(cellKey, fieldValue(row[field]))}
              className={colorClass}
              collapseSignal={focusedCell ? `${focusedCell.rowId}:${focusedCell.columnIndex}` : ''}
            />
          );
        }
        return (
          <InlineValueCell
            value={fieldValue(row[field])}
            copied={isCopied}
            saving={isSaving}
            active={!isClosedRow(row) && activeEditor?.rowId === row.id && activeEditor?.columnIndex === columnIndex}
            collapsed={collapsedColumns[field]}
            onCopy={() => void copyCell(cellKey, fieldValue(row[field]))}
            onActivate={() => requestEditorOpen(row, columnIndex)}
            onCancel={() => setActiveEditor(null)}
            onSave={async (value) => {
              await updateFinanceValue(row, field, value);
              setActiveEditor(null);
            }}
            className={colorClass}
          />
        );
      }
      case 'finance_external_notes': {
        const externalNotesRaw = getFinanceExternalNotes(row);
        const externalNotesValue = fieldValue(externalNotesRaw);
        const employeeFinanceNotesClass = !isFinanceViewer ? 'rounded-md bg-rose-50/75 px-2 py-1 dark:bg-rose-500/10' : undefined;
        return isFinanceViewer && onFinanceUpdate && !isClosedRow(row) ? (
          <InlineValueCell
            value={externalNotesRaw}
            displayValue={truncateNotePreview(externalNotesRaw)}
            copied={isCopied}
            saving={isSaving}
            active={activeEditor?.rowId === row.id && activeEditor?.columnIndex === columnIndex}
            collapsed={false}
            multiline
            onCopy={() => void copyCell(cellKey, externalNotesRaw)}
            onActivate={() => requestEditorOpen(row, columnIndex)}
            onCancel={() => setActiveEditor(null)}
            onSave={async (value) => {
              await updateFinanceValue(row, 'finance_external_notes', value);
              setActiveEditor(null);
            }}
            className="text-sky-700 dark:text-sky-300"
          />
        ) : commonText(externalNotesValue, undefined, externalNotesRaw, employeeFinanceNotesClass);
      }
      case 'finance_notes': {
        const internalNotesRaw = getFinanceNotes(row);
        return isFinanceViewer && onFinanceUpdate && !isClosedRow(row) ? (
          <InlineValueCell
            value={internalNotesRaw}
            displayValue={truncateNotePreview(internalNotesRaw)}
            copied={isCopied}
            saving={isSaving}
            active={activeEditor?.rowId === row.id && activeEditor?.columnIndex === columnIndex}
            collapsed={false}
            multiline
            onCopy={() => void copyCell(cellKey, internalNotesRaw)}
            onActivate={() => requestEditorOpen(row, columnIndex)}
            onCancel={() => setActiveEditor(null)}
            onSave={async (value) => {
              await updateFinanceValue(row, 'finance_notes', value);
              setActiveEditor(null);
            }}
            className="text-slate-700 dark:text-slate-200"
          />
        ) : commonText(fieldValue(internalNotesRaw));
      }
      case 'actions':
        return (
          <button
              type="button"
            onClick={() => onOpen?.(row.id, row)}
            className={[
              'inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-medium',
              (viewer === 'employee' || viewer === 'team_lead') && row.intake_status === 'rejected'
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
        data-submission-table-viewport="true"
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
                    const isCollapsed =
                      (column === 'invoice_number' || column === 'debit_note_number' || column === 'city' || column === 'state' || column === 'country' || column === 'pincode') &&
                      collapsedColumns[column];
                    const isCampaignCollapsed =
                      canToggleCampaignColumns &&
                      (column === 'campaign_code' || column === 'campaign_name') &&
                      collapsedColumns[column];
                    const canCollapse =
                      column === 'invoice_number' ||
                      column === 'debit_note_number' ||
                      column === 'city' ||
                      column === 'state' ||
                      column === 'country' ||
                      column === 'pincode';
                    const canCollapseCampaignColumn =
                      canToggleCampaignColumns &&
                      (column === 'campaign_code' || column === 'campaign_name');

                  return (
                <th
                  key={column}
                  onClick={
                    column === 'pi'
                      ? toggleInvoiceColumns
                      : column === 'address'
                        ? toggleAddressColumns
                        : column === 'intake_status' && canToggleCampaignColumns
                          ? toggleCampaignColumns
                          : undefined
                  }
                  className={[
                    'h-8 overflow-hidden align-middle border-b border-r border-border/60 bg-card px-2.5 py-1 text-left text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground',
                    (column === 'pi' || column === 'address' || (column === 'intake_status' && canToggleCampaignColumns)) ? 'cursor-pointer' : '',
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
                    <span className="truncate whitespace-nowrap leading-[1.05]">
                        {((isCollapsed && canCollapse) || (isCampaignCollapsed && canCollapseCampaignColumn)) ? (
                          column === 'invoice_number'
                            ? 'Inv'
                            : column === 'debit_note_number'
                              ? 'Debit'
                              : column === 'campaign_code'
                                ? 'Code'
                                : column === 'campaign_name'
                                  ? 'Name'
                                  : column === 'city'
                                    ? 'City'
                                    : column === 'state'
                                      ? 'State'
                                      : column === 'country'
                                        ? 'Country'
                                        : 'Pin'
                        ) : column === 'invoice_number' ? (
                          <>Invoice<br />No.</>
                        ) : column === 'debit_note_number' ? (
                          <>Debit<br />No.</>
                        ) : column === 'campaign_code' ? (
                          'Campaign Code'
                        ) : column === 'campaign_name' ? (
                          'Campaign Name'
                        ) : column === 'product_reimbursement_upload' ? (
                          <>Product<br />Reimbursement</>
                        ) : column === 'product_reimbursement_file' ? (
                          'Product Reim. File'
                        ) : column === 'reference_po_file' ? (
                          'Reference PO File'
                        ) : column === 'creator_invoice_received' ? (
                          <>Creator<br />Invoice</>
                      ) : column === 'payment_received' ? (
                        <>Payment<br />Received</>
                      ) : column === 'payment_made' ? (
                        <>Payment<br />Made</>
                      ) : column === 'rejection_note' ? (
                        <>Resubmission<br />Note</>
                      ) : column === 'finance_external_notes' ? (
                        isFinanceViewer ? <>Finance External<br />Notes</> : <>Finance<br />Notes</>
                      ) : column === 'finance_notes' ? (
                        <>Finance Internal<br />Notes</>
                      ) : (
                        COLUMN_TITLES[column]
                      )}
                    </span>
                      {canCollapse || canCollapseCampaignColumn ? (
                        <button
                          type="button"
                          onClick={() => toggleColumnCollapse(column)}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground transition-none hover:bg-muted/40 hover:text-foreground"
                          aria-label={isCollapsed || isCampaignCollapsed ? 'Expand column' : 'Collapse column'}
                        >
                          {isCollapsed || isCampaignCollapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
                        </button>
                      ) : null}
                      {column === 'pi' ? (
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); toggleInvoiceColumns(); }}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground transition-none hover:bg-muted/40 hover:text-foreground"
                          aria-label={showInvoiceColumns ? 'Collapse invoice columns' : 'Expand invoice columns'}
                          title={showInvoiceColumns ? 'Collapse invoice columns' : 'Expand invoice columns'}
                        >
                          {showInvoiceColumns ? '<' : '>'}
                        </button>
                      ) : null}
                      {column === 'address' ? (
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); toggleAddressColumns(); }}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground transition-none hover:bg-muted/40 hover:text-foreground"
                          aria-label={showAddressColumns ? 'Collapse address columns' : 'Expand address columns'}
                          title={showAddressColumns ? 'Collapse address columns' : 'Expand address columns'}
                        >
                          {showAddressColumns ? '<' : '>'}
                        </button>
                      ) : null}
                      {column === 'intake_status' && canToggleCampaignColumns ? (
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); toggleCampaignColumns(); }}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground transition-none hover:bg-muted/40 hover:text-foreground"
                          aria-label={showImCampaignColumns ? 'Collapse campaign columns' : 'Expand campaign columns'}
                          title={showImCampaignColumns ? 'Collapse campaign columns' : 'Expand campaign columns'}
                        >
                          {showImCampaignColumns ? <ChevronLeft size={11} /> : <ChevronRight size={11} />}
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
            {renderItems.map((item) => {
              const row = item.row;
              const rowIndex = item.rowIndex;
              const rowClosed = isClosedRow(row);
              return (
                <tr key={item.kind + ':' + row.id + ':' + (item.isHistory ? 'history' : 'main')} className={[ 'group', item.isHistory ? 'bg-muted/10' : '', 'transition-colors duration-100 hover:bg-sky-50/60 dark:hover:bg-slate-800/60' ].join(' ')} data-pi-group-panel={item.isHistory ? 'true' : undefined} data-submission-row={row.id}>
                  {activeColumns.map((column, columnIndex) => {
                    const sticky =
                      column === 'pi' ||
                      column === 'invoice_number' ||
                      column === 'debit_note_number' ||
                      column === 'intake_status';
                    const columnWidth = getColumnWidth(column, collapsedColumns);
                    const isFocused = focusedCell?.rowId === row.id && focusedCell.columnIndex === columnIndex;
                    const flashForCell = flash?.key === `${row.id}:${column}` ? flash : null;

                    return (
                      <MemoDataCell
                        key={`${row.id}:${column}:${item.isHistory ? 'history' : 'main'}`}
                        rowRef={row}
                        columnIndex={columnIndex}
                        sticky={sticky}
                        cellStyle={{
                          width: columnWidth,
                          minWidth: columnWidth,
                          ...stickyStyle(column),
                        }}
                        isFocused={isFocused}
                        isActiveEditor={activeEditor?.rowId === row.id && activeEditor?.columnIndex === columnIndex}
                        isCopied={copiedKey === `${row.id}:${column}`}
                        flash={flashForCell}
                        isSaving={savingKey === `${row.id}:${column}`}
                        registerCellRef={registerCellRef}
                        onFocusCell={handleCellFocus}
                        onClickCell={handleCellClick}
                        onKeyDownCell={handleCellKeyDown}
                        renderContent={() => renderCell(column, row, rowIndex, columnIndex, item.isHistory)}
                        rowClosed={rowClosed}
                        rowHighlighted={highlightedRowId === row.id}
                      />
                    );
                  })}
                </tr>
              );
            })}
            {visibleDataRows.length === 0 ? (
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
      {paginationFooter ? (
        <div className="border-t border-border/50 bg-card">
          {paginationFooter}
        </div>
      ) : null}
      {auditPopover ? (
        <AuditPopover
          rect={auditPopover.rect}
          row={auditPopover.row}
          field={auditPopover.field}
          onClose={() => setAuditPopover(null)}
        />
      ) : null}
      {masterDataPopover ? (
        <MasterDataReviewPopover
          rect={masterDataPopover.rect}
          review={masterDataPopover.review}
          saving={masterDataSavingId === masterDataPopover.review.id}
          onClose={() => setMasterDataPopover(null)}
          onApprove={masterDataPopover.review.status === 'pending' ? () => void handleMasterDataPopoverAction('approve') : undefined}
          onReject={masterDataPopover.review.status === 'pending' ? () => void handleMasterDataPopoverAction('reject') : undefined}
        />
      ) : null}
      {changeSummaryDialog && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/35 px-4">
              <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-foreground">Changes in Latest Resubmission</div>
                    <div className="mt-1 text-sm text-muted-foreground">{changeSummaryDialog.pi}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChangeSummaryDialog(null)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                    aria-label="Close changes summary"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="mt-4">
                  <div className="text-sm font-medium text-foreground">Changed Fields:</div>
                  {changeSummaryDialog.fields.length > 0 ? (
                    <ul className="mt-2 grid gap-2 text-sm text-foreground">
                      {changeSummaryDialog.fields.map((field) => (
                        <li key={field} className="flex items-start gap-2">
                          <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-rose-500" />
                          <span>{field}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No comparable business fields changed.</p>
                  )}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">Detailed history is available by expanding the PI entry.</p>
              </div>
            </div>,
            document.body
          )
        : null}
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









