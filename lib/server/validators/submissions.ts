import type {
  CreateLineItemInput,
  CreateSubmissionInput,
  SanitizedLineItemPayload,
  SanitizedSubmissionPayload,
} from '../types/submissions';
import { normalizeCurrency } from '../../shared/currency';

function toNullableText(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toMoney(v: unknown, defaultValue = 0): number {
  if (v === undefined || v === null || v === '') return defaultValue;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error('Invalid numeric value');
  return n;
}

function mustText(v: unknown, field: string): string {
  const s = toNullableText(v);
  if (!s) throw new Error(`${field} is required`);
  return s;
}

export function sanitizeSubmissionInput(input: CreateSubmissionInput): SanitizedSubmissionPayload {
  const submittedAt = input.submitted_at ? new Date(input.submitted_at) : new Date();
  if (Number.isNaN(submittedAt.getTime())) throw new Error('Invalid submitted_at');
  const businessLine = toNullableText(input.business_line);
  const entryType = toNullableText(input.entry_type);
  const entityType = toNullableText(input.entity_type);
  const clientType = toNullableText(input.client_type);
  const campaignCode = toNullableText(input.campaign_code);
  const campaignName = toNullableText(input.campaign_name);
  const campaignBrand = toNullableText(input.campaign_brand);
  const campaignNotes = toNullableText(input.campaign_notes);
  const agencyBrandName = mustText(input.agency_brand_name, 'agency_brand_name');
  const agencyBrandTradeName = toNullableText(input.agency_brand_trade_name);

  return {
    previous_submission_id: toNullableText(input.previous_submission_id),
    submitted_at: submittedAt.toISOString(),
    agency_brand_name: agencyBrandName,
    agency_brand_trade_name: agencyBrandTradeName,
    email_address: mustText(input.email_address, 'email_address').toLowerCase(),
    gst_number: toNullableText(input.gst_number),
    address: toNullableText(input.address),
    bill_due: mustText(input.bill_due, 'bill_due'),
    invoice_type: mustText(input.invoice_type, 'invoice_type'),
    deliverables: toNullableText(input.deliverables),
    creator_creators_name: toNullableText(input.creator_creators_name),
    campaign_code: businessLine === 'IM' ? campaignCode : null,
    campaign_name: businessLine === 'IM' ? campaignName : null,
    campaign_brand: businessLine === 'IM' ? campaignBrand : null,
    campaign_notes: businessLine === 'IM' ? campaignNotes : null,
    currency: normalizeCurrency((input as { currency?: string | null }).currency),
    commercials: toMoney(input.commercials, 0),
    additional_information: toNullableText(input.additional_information),
    additional_agency_commission: toMoney(input.additional_agency_commission, 0),
    reimbursement_amount: toMoney(input.reimbursement_amount, 0),
    reimbursement_receipts: toNullableText(input.reimbursement_receipts),
    business_line: businessLine,
    entry_type: businessLine === 'TM' && (entryType === 'SC' || entryType === 'MC') ? entryType : null,
    entity_type: entityType,
    client_type: clientType,
    agency_name: entityType === 'Agency' ? agencyBrandName : null,
    agency_trade_name: entityType === 'Agency' ? agencyBrandTradeName : null,
    brand_trade_name: entityType === 'Brand' ? agencyBrandTradeName : null,
    brand_name:
      entityType === 'Brand'
        ? agencyBrandName
        : toNullableText(input.brand_name),
    intake_status: 'submitted',
    sync_status: 'pending_sheet_sync',
    invoice_status: null,
    invoice_number: null,
    debit_note_number: null,
    payment_received: null,
    payment_received_status: null,
    invoice_via_creators_received: null,
    payment_made: null,
    payment_made_status: null,
    closed: null,
    closure_status: 'open',
    reviewed_by: null,
    reviewed_at: null,
    rejection_note: null,
  };
}

export function sanitizeLineItems(items: CreateLineItemInput[] | undefined): SanitizedLineItemPayload[] {
  if (!items || !Array.isArray(items)) return [];

  return items.map((item, idx) => ({
    creator_id: toNullableText(item.creator_id),
    brand_id: toNullableText(item.brand_id),
    deliverable_id: toNullableText(item.deliverable_id),
    creator_name: toNullableText(item.creator_name),
    brand_name: toNullableText(item.brand_name),
    deliverable_name: toNullableText(item.deliverable_name),
    amount: toMoney(item.amount, 0),
    line_order: Number.isInteger(item.line_order) ? Number(item.line_order) : idx,
  }));
}
