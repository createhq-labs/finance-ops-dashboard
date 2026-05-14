export type AppRole = 'employee' | 'team_lead' | 'finance' | 'admin' | 'developer';

export type CreateLineItemInput = {
  creator_id?: string | null;
  brand_id?: string | null;
  deliverable_id?: string | null;
  creator_name?: string | null;
  brand_name?: string | null;
  deliverable_name?: string | null;
  amount?: number | string | null;
  line_order?: number | null;
};

export type CreateSubmissionInput = {
  previous_submission_id?: string | null;
  submitted_at?: string | null;
  agency_brand_name?: string;
  agency_brand_trade_name?: string | null;
  email_address?: string;
  gst_number?: string | null;
  address?: string | null;
  bill_due?: string;
  invoice_type?: string;
  deliverables?: string | null;
  creator_creators_name?: string | null;
  brand_name?: string | null;
  commercials?: number | string | null;
  additional_information?: string | null;
  additional_agency_commission?: number | string | null;
  reimbursement_amount?: number | string | null;
  reimbursement_receipts?: string | null;
  line_items?: CreateLineItemInput[];
};

export type AppUser = {
  id: string;
  supabase_auth_id: string;
  email: string;
  role: AppRole;
  status: 'active' | 'inactive';
};

export type SanitizedSubmissionPayload = {
  previous_submission_id: string | null;
  submitted_at: string;
  agency_brand_name: string;
  agency_brand_trade_name: string | null;
  email_address: string;
  gst_number: string | null;
  address: string | null;
  bill_due: string;
  invoice_type: string;
  deliverables: string | null;
  creator_creators_name: string | null;
  brand_name: string | null;
  commercials: number;
  additional_information: string | null;
  additional_agency_commission: number;
  reimbursement_amount: number;
  reimbursement_receipts: string | null;
  intake_status: 'submitted';
  sync_status: 'pending_sheet_sync';
  invoice_status: 'Invoice Pending' | 'Invoice created' | 'Po Created/Estimate' | 'Invoice Cancelled' | 'Debit Note' | 'Invoice + Debit Note';
  invoice_number: null;
  debit_note_number: null;
  payment_received: null;
  invoice_via_creators_received: null;
  payment_made: null;
  closed: null;
  reviewed_by: null;
  reviewed_at: null;
  rejection_note: null;
};

export type SanitizedLineItemPayload = {
  creator_id: string | null;
  brand_id: string | null;
  deliverable_id: string | null;
  creator_name: string | null;
  brand_name: string | null;
  deliverable_name: string | null;
  amount: number;
  line_order: number;
};
