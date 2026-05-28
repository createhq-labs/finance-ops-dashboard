import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { assertSupabaseEnv, createUserScopedClient } from '../../../../lib/server/supabase';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';

export async function GET(req: NextRequest) {
  try {
    assertSupabaseEnv();

    let token = '';
    try {
      token = getBearerToken(req);
    } catch {
      token = getAccessTokenFromCookieHeader(req.cookies) ?? '';
    }
    if (!token) throw new Error('Missing auth token');

    const userClient = createUserScopedClient(token);
    const appUser = await getCurrentAppUser(userClient, token);
    if (!(appUser.role === 'finance' || appUser.role === 'admin')) {
      throw new Error('Unauthorized');
    }

    const baseSelect =
      'id, submitted_by, reviewed_by, reviewed_at, proforma_invoice, agency_brand_name, agency_brand_trade_name, email_address, gst_number, address, bill_due, invoice_type, deliverables, creator_creators_name, brand_name, campaign_code, campaign_name, campaign_brand, campaign_notes, commercials, additional_agency_commission, reimbursement_amount, reimbursement_receipts, additional_information, intake_status, invoice_status, submitted_at, rejection_note, previous_submission_id, business_line, entity_type, client_type, agency_name, agency_trade_name, brand_trade_name, payment_received, payment_received_status, invoice_via_creators_received, payment_made, payment_made_status, closed, closure_status, invoice_number, debit_note_number, sync_status, intake_line_items(creator_name,brand_name,deliverable_name,amount,line_order)';
    const legacySelect =
      'id, submitted_by, reviewed_by, reviewed_at, proforma_invoice, agency_brand_name, agency_brand_trade_name, email_address, gst_number, address, bill_due, invoice_type, deliverables, creator_creators_name, brand_name, commercials, additional_agency_commission, reimbursement_amount, reimbursement_receipts, additional_information, intake_status, invoice_status, submitted_at, rejection_note, previous_submission_id, payment_received, payment_made, closed, invoice_number, debit_note_number, sync_status, intake_line_items(creator_name,brand_name,deliverable_name,amount,line_order)';

    let { data, error } = await userClient
      .from('intake_submissions')
      .select(`${baseSelect}, integration_metadata`)
      .order('submitted_at', { ascending: false });

    if (error) {
      const normalizedFallback = await userClient
        .from('intake_submissions')
        .select(baseSelect)
        .order('submitted_at', { ascending: false });

      data = (normalizedFallback.data ?? []).map((row) => ({
        ...row,
        integration_metadata: null,
      }));
      error = normalizedFallback.error;
    }

    if (error) {
      const fallback = await userClient
        .from('intake_submissions')
        .select(legacySelect)
        .order('submitted_at', { ascending: false });

      data = (fallback.data ?? []).map((row) => ({
        ...row,
        integration_metadata: null,
        business_line: null,
        entity_type: null,
        client_type: null,
        agency_name: null,
        agency_trade_name: null,
        brand_trade_name: null,
        campaign_code: null,
        campaign_name: null,
        campaign_brand: null,
        campaign_notes: null,
        invoice_via_creators_received: null,
        payment_received_status: null,
        payment_made_status: null,
        closure_status: null,
      }));
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    const submittedByIds = Array.from(new Set((data ?? []).map((row) => String(row.submitted_by ?? '')).filter(Boolean)));
    let userMap = new Map<string, { full_name: string; email: string }>();

    if (submittedByIds.length > 0) {
      const { data: users, error: usersError } = await userClient.from('users').select('id, full_name, email').in('id', submittedByIds);
      if (usersError) {
        return NextResponse.json({ success: false, error: usersError.message }, { status: 400 });
      }
      userMap = new Map((users ?? []).map((user) => [String(user.id), { full_name: String(user.full_name ?? ''), email: String(user.email ?? '') }]));
    }

    const submissions = (data ?? []).map((row) => {
      const owner = userMap.get(String(row.submitted_by ?? ''));
      return {
        ...row,
        submitted_by_name: owner?.full_name ?? null,
        submitted_by_email: owner?.email ?? null,
      };
    });

    return NextResponse.json({ success: true, submissions }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
