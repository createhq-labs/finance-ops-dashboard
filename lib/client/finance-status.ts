import { normalizeInvoiceStatusMachine } from '../shared/invoice-status';

export const INVOICE_STATUS_LABELS = {
  invoice_pending: 'PI Created / Estimate',
  invoice_created: 'Invoice Created',
  po_created_estimate: 'PI Created / Estimate',
  invoice_cancelled: 'Cancelled',
  debit_note: 'Debit Note',
  invoice_plus_debit_note: 'Invoice + Debit Note',
} as const;

export const PAYMENT_RECEIVED_STATUS_LABELS = {
  pending: 'Pending',
  full: 'Yes - Full',
  advance_received: 'Yes - Advance',
  gst_left: 'Yes - GST Left',
  past_due: 'No - Past Due Date',
  advance_past_due: 'Advance but Past Due Date',
  not_received: 'No',
  partial_left: 'Some Amount Left',
  credit_note_issued: 'Pending (Credit Note Issued Along)',
} as const;

export const CREATOR_INVOICE_STATUS_LABELS = {
  pending: 'Pending',
  received: 'Yes',
  part_payment_against_advance: 'Part Payment Against Advance',
  not_received: 'No',
  multiple_creators: 'Multiple Creators',
  gst_left: 'GST Left',
} as const;

export const PAYMENT_MADE_STATUS_LABELS = {
  pending: 'Pending',
  full: 'Yes',
  paid: 'Yes',
  part_payment_against_advance: 'Part Payment Against Advance',
  not_paid: 'No',
  multiple_creators: 'Multiple Creators',
  gst_left: 'GST Left',
} as const;

export const CLOSURE_STATUS_LABELS = {
  open: 'No',
  closed: 'Yes',
  issues: 'Issues',
  cancelled: 'Cancelled',
  gst_left: 'GST Left',
} as const;

export const INVOICE_STATUS_OPTIONS = Object.entries(INVOICE_STATUS_LABELS)
  .filter(([value]) => value !== 'invoice_pending')
  .map(([value, label]) => ({ value, label }));
export const PAYMENT_RECEIVED_STATUS_OPTIONS = Object.entries(PAYMENT_RECEIVED_STATUS_LABELS).map(([value, label]) => ({ value, label }));
export const CREATOR_INVOICE_STATUS_OPTIONS = [
  { value: 'received', label: 'Yes' },
  { value: 'not_received', label: 'No' },
  { value: 'multiple_creators', label: 'Multiple Creators' },
];
export const PAYMENT_MADE_STATUS_OPTIONS = Object.entries(PAYMENT_MADE_STATUS_LABELS)
  .filter(([value]) => value !== 'full')
  .map(([value, label]) => ({ value, label }));
export const CLOSURE_STATUS_OPTIONS = Object.entries(CLOSURE_STATUS_LABELS).map(([value, label]) => ({ value, label }));

function fallbackLabel(value: string | null | undefined) {
  if (!value) return '-';
  return value.replace(/_/g, ' ');
}

export function formatInvoiceStatus(value: string | null | undefined) {
  const machineValue = normalizeInvoiceStatusMachine(value) || value;
  return INVOICE_STATUS_LABELS[machineValue as keyof typeof INVOICE_STATUS_LABELS] || fallbackLabel(value);
}

export function formatPaymentReceivedStatus(value: string | null | undefined) {
  return PAYMENT_RECEIVED_STATUS_LABELS[value as keyof typeof PAYMENT_RECEIVED_STATUS_LABELS] || fallbackLabel(value);
}

export function formatCreatorInvoiceStatus(value: string | null | undefined) {
  return CREATOR_INVOICE_STATUS_LABELS[value as keyof typeof CREATOR_INVOICE_STATUS_LABELS] || fallbackLabel(value);
}

export function formatPaymentMadeStatus(value: string | null | undefined) {
  return PAYMENT_MADE_STATUS_LABELS[value as keyof typeof PAYMENT_MADE_STATUS_LABELS] || fallbackLabel(value);
}

export function formatClosureStatus(value: string | null | undefined) {
  return CLOSURE_STATUS_LABELS[value as keyof typeof CLOSURE_STATUS_LABELS] || fallbackLabel(value);
}
