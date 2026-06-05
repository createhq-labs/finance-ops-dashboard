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

    const baseSelect =
      'id, proforma_invoice, agency_brand_name, agency_brand_trade_name, email_address, gst_number, address, bill_due, invoice_type, deliverables, creator_creators_name, brand_name, campaign_code, campaign_name, campaign_brand, campaign_notes, commercials, additional_agency_commission, reimbursement_amount, reimbursement_receipts, additional_information, intake_status, invoice_status, submitted_at, rejection_note, previous_submission_id, business_line, entity_type, client_type, agency_name, agency_trade_name, brand_trade_name, finance_comment, creator_invoice_status, payment_received_status, payment_made_status, closure_status, intake_line_items(creator_name,brand_name,deliverable_name,amount,line_order)';
    const legacySelect =
      'id, proforma_invoice, agency_brand_name, agency_brand_trade_name, email_address, gst_number, address, bill_due, invoice_type, deliverables, creator_creators_name, brand_name, commercials, additional_agency_commission, reimbursement_amount, reimbursement_receipts, additional_information, intake_status, invoice_status, submitted_at, rejection_note, previous_submission_id, intake_line_items(creator_name,brand_name,deliverable_name,amount,line_order)';

    let { data, error } = await userClient
      .from('intake_submissions')
      .select(`${baseSelect}, integration_metadata`)
      .eq('submitted_by', appUser.id)
      .order('submitted_at', { ascending: false });

    if (error) {
      const normalizedFallback = await userClient
        .from('intake_submissions')
        .select(baseSelect)
        .eq('submitted_by', appUser.id)
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
        .eq('submitted_by', appUser.id)
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
        finance_comment: null,
        creator_invoice_status: null,
        campaign_code: null,
        campaign_name: null,
        campaign_brand: null,
        campaign_notes: null,
        payment_received_status: null,
        payment_made_status: null,
        closure_status: null,
      }));
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, submissions: data ?? [] }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
