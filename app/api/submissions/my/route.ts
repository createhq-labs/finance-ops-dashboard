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
      'id, proforma_invoice, agency_brand_name, agency_brand_trade_name, email_address, gst_number, address, bill_due, invoice_type, deliverables, creator_creators_name, brand_name, commercials, additional_agency_commission, reimbursement_amount, reimbursement_receipts, additional_information, intake_status, invoice_status, submitted_at, rejection_note, previous_submission_id, intake_line_items(creator_name,brand_name,deliverable_name,amount,line_order)';

    let { data, error } = await userClient
      .from('intake_submissions')
      .select(`${baseSelect}, integration_metadata`)
      .eq('submitted_by', appUser.id)
      .order('submitted_at', { ascending: false });

    if (error && /integration_metadata/i.test(error.message)) {
      const fallback = await userClient
        .from('intake_submissions')
        .select(baseSelect)
        .eq('submitted_by', appUser.id)
        .order('submitted_at', { ascending: false });

      data = (fallback.data ?? []).map((row) => ({
        ...row,
        integration_metadata: null,
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
