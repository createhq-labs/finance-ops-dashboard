export const DB_INVOICE_STATUS_BY_MACHINE = {
  invoice_pending: 'Invoice Pending',
  invoice_created: 'Invoice created',
  po_created_estimate: 'Po Created/Estimate',
  invoice_cancelled: 'Invoice Cancelled',
  debit_note: 'Debit Note',
  invoice_plus_debit_note: 'Invoice + Debit Note',
} as const;

export const LEGACY_INVOICE_STATUS_TO_MACHINE = {
  'Invoice Pending': 'invoice_pending',
  'Invoice created': 'invoice_created',
  'Po Created/Estimate': 'po_created_estimate',
  'Invoice Cancelled': 'invoice_cancelled',
  'Debit Note': 'debit_note',
  'Invoice + Debit Note': 'invoice_plus_debit_note',
} as const;

export type InvoiceStatusMachine = keyof typeof DB_INVOICE_STATUS_BY_MACHINE;

type InvoiceStatusSource = {
  intake_status?: string | null | undefined;
  invoice_number?: string | null | undefined;
  debit_note_number?: string | null | undefined;
  invoice_status?: string | null | undefined;
};

function normalizeToken(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function hasValue(value: string | null | undefined) {
  return Boolean(String(value || '').trim());
}

export function normalizeInvoiceStatusMachine(value: string | null | undefined): InvoiceStatusMachine | null {
  if (!value) return null;
  const machineValue =
    LEGACY_INVOICE_STATUS_TO_MACHINE[value as keyof typeof LEGACY_INVOICE_STATUS_TO_MACHINE] || value;
  const normalized = normalizeToken(machineValue).replace(/\//g, '_').replace(/\+/g, 'plus');

  if (normalized === 'invoice_pending') return 'invoice_pending';
  if (normalized === 'invoice_created') return 'invoice_created';
  if (normalized === 'po_created_estimate' || normalized === 'po_createdestimate') return 'po_created_estimate';
  if (normalized === 'invoice_cancelled') return 'invoice_cancelled';
  if (normalized === 'debit_note') return 'debit_note';
  if (normalized === 'invoice_plus_debit_note' || normalized === 'invoice_plus__debit_note') {
    return 'invoice_plus_debit_note';
  }

  return null;
}

export function toDbInvoiceStatus(status: InvoiceStatusMachine | string | null | undefined) {
  if (!status) return null;
  const machineValue = normalizeInvoiceStatusMachine(status) || status;
  return DB_INVOICE_STATUS_BY_MACHINE[machineValue as InvoiceStatusMachine] || machineValue;
}

export function deriveInvoiceStatusMachine(source: InvoiceStatusSource): InvoiceStatusMachine | null {
  const intakeStatus = normalizeToken(source.intake_status);
  const hasInvoiceNumber = hasValue(source.invoice_number);
  const hasDebitNoteNumber = hasValue(source.debit_note_number);

  if (intakeStatus === 'rejected') return 'invoice_cancelled';
  if (hasInvoiceNumber && hasDebitNoteNumber) return 'invoice_plus_debit_note';
  if (hasDebitNoteNumber) return 'debit_note';
  if (hasInvoiceNumber) return 'invoice_created';
  if (intakeStatus === 'accepted') return 'po_created_estimate';

  return normalizeInvoiceStatusMachine(source.invoice_status);
}

export function deriveInvoiceStatusDbValue(source: InvoiceStatusSource) {
  const machineValue = deriveInvoiceStatusMachine(source);
  return machineValue ? toDbInvoiceStatus(machineValue) : null;
}
