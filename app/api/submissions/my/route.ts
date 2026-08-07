import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { assertSupabaseEnv, createUserScopedClient } from '../../../../lib/server/supabase';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';
import { deriveInvoiceStatusDbValue } from '../../../../lib/shared/invoice-status';

type FilterQuery = {
  eq: (column: string, value: unknown) => FilterQuery;
  is: (column: string, value: unknown) => FilterQuery;
  not: (column: string, operator: string, value: unknown) => FilterQuery;
  or: (filters: string) => FilterQuery;
  range: (from: number, to: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
  order: (column: string, options: { ascending: boolean }) => FilterQuery;
};

function clampLimit(value: string | null, fallback = 50) {
  const parsed = Number.parseInt(value || '', 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 100);
}

function parseOffset(value: string | null) {
  const parsed = Number.parseInt(value || '', 10);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
}

function mapVersionStatus(previousSubmissionId: string | null, isLatestVersion: boolean | null | undefined) {
  if (previousSubmissionId) return 'resubmitted';
  if (isLatestVersion === false) return 'superseded';
  return 'original';
}

function applyMyFilters(query: FilterQuery, params: URLSearchParams) {
  const submissionId = params.get('submission_id')?.trim();
  const intakeStatus = params.get('intake_status');
  const versionStatus = params.get('version_status');
  const paymentStatus = params.get('payment_status');
  const search = params.get('query')?.trim();

  if (submissionId) query = query.eq('id', submissionId);
  if (intakeStatus && intakeStatus !== 'all') query = query.eq('intake_status', intakeStatus);
  if (paymentStatus && paymentStatus !== 'all') query = query.eq('payment_received_status', paymentStatus);

  if (versionStatus === 'original') {
    query = query.is('previous_submission_id', null).eq('is_latest_version', true);
  } else if (versionStatus === 'resubmitted') {
    query = query.not('previous_submission_id', 'is', null);
  } else if (versionStatus === 'superseded') {
    query = query.is('previous_submission_id', null).eq('is_latest_version', false);
  }

  if (search) {
    const escaped = search.replace(/,/g, ' ');
    query = query.or(
      [
        'proforma_invoice.ilike.%' + escaped + '%',
        'agency_brand_name.ilike.%' + escaped + '%',
        'brand_name.ilike.%' + escaped + '%',
        'creator_creators_name.ilike.%' + escaped + '%',
        'campaign_brand.ilike.%' + escaped + '%',
        'campaign_code.ilike.%' + escaped + '%',
        'campaign_name.ilike.%' + escaped + '%',
      ].join(',')
    );
  }

  return query;
}

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
    const params = req.nextUrl.searchParams;
    const limit = clampLimit(params.get('limit'), 50);
    const offset = parseOffset(params.get('offset'));

    const baseSelect =
      'id, proforma_invoice, currency, agency_brand_name, agency_brand_trade_name, email_address, gst_number, address, bill_due, invoice_type, deliverables, creator_creators_name, brand_name, campaign_code, campaign_name, campaign_brand, campaign_notes, commercials, additional_agency_commission, reimbursement_amount, reimbursement_receipts, additional_information, intake_status, invoice_status, submitted_at, rejection_note, previous_submission_id, business_line, entry_type, entity_type, client_type, agency_name, agency_trade_name, brand_trade_name, finance_notes, finance_external_notes, finance_comment, creator_invoice_status, payment_received_status, payment_made_status, closure_status, reviewed_by, reviewed_at, is_latest_version, submission_attachments(id,document_type,file_name,file_size_bytes,mime_type,uploaded_at), intake_line_items(creator_name,brand_name,deliverable_name,amount,line_order)';
    const legacySelect =
      'id, proforma_invoice, currency, agency_brand_name, agency_brand_trade_name, email_address, gst_number, address, bill_due, invoice_type, deliverables, creator_creators_name, brand_name, commercials, additional_agency_commission, reimbursement_amount, reimbursement_receipts, additional_information, intake_status, invoice_status, submitted_at, rejection_note, previous_submission_id, intake_line_items(creator_name,brand_name,deliverable_name,amount,line_order)';

    const runBaseQuery = async (selectClause: string) => {
      let query = userClient
        .from('intake_submissions')
        .select(selectClause)
        .eq('submitted_by', appUser.id)
        .order('submitted_at', { ascending: false }) as unknown as FilterQuery;
      query = applyMyFilters(query, params);
      return query.range(offset, offset + limit);
    };

    let { data, error } = await runBaseQuery(baseSelect);

    if (error) {
      const fallback = await runBaseQuery(legacySelect);
      data = (fallback.data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        business_line: null,
        entry_type: null,
        entity_type: null,
        client_type: null,
        agency_name: null,
        agency_trade_name: null,
        brand_trade_name: null,
        finance_notes: null,
        finance_external_notes: null,
        finance_comment: null,
        currency: 'INR',
        creator_invoice_status: null,
        campaign_code: null,
        campaign_name: null,
        campaign_brand: null,
        campaign_notes: null,
        payment_received_status: null,
        payment_made_status: null,
        closure_status: null,
        is_latest_version: true,
        submission_attachments: [],
      }));
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    const pageRows = (data ?? []).slice(0, limit) as Array<Record<string, unknown>>;
    const hasMore = (data ?? []).length > limit;
    const previousSubmissionIds = Array.from(new Set(pageRows.map((row) => String(row.previous_submission_id ?? '')).filter(Boolean)));
    const reviewedByIds = Array.from(new Set(pageRows.map((row) => String(row.reviewed_by ?? '')).filter(Boolean)));

    // Neither lookup depends on the other's result, so run them concurrently
    // instead of two sequential round trips.
    const [previousPiMap, reviewerNameMap] = await Promise.all([
      (async () => {
        if (previousSubmissionIds.length === 0) return new Map<string, string | null>();
        const { data: previousRows, error: previousRowsError } = await userClient
          .from('intake_submissions')
          .select('id, proforma_invoice')
          .in('id', previousSubmissionIds);
        if (previousRowsError) throw new Error(previousRowsError.message);
        return new Map((previousRows ?? []).map((row) => [String(row.id), row.proforma_invoice ? String(row.proforma_invoice) : null]));
      })(),
      (async () => {
        if (reviewedByIds.length === 0) return new Map<string, string>();
        const { data: reviewers, error: reviewersError } = await userClient
          .from('users')
          .select('id, full_name')
          .in('id', reviewedByIds);
        if (reviewersError) throw new Error(reviewersError.message);
        return new Map((reviewers ?? []).map((reviewer) => [String(reviewer.id), String(reviewer.full_name ?? '').trim()]));
      })(),
    ]);

    const submissions = pageRows.map((row) => ({
      ...row,
      invoice_status: deriveInvoiceStatusDbValue(row),
      reviewed_by_name: row.reviewed_by ? reviewerNameMap.get(String(row.reviewed_by)) ?? null : null,
      previous_submission_pi: row.previous_submission_id ? previousPiMap.get(String(row.previous_submission_id)) ?? null : null,
      version_status: mapVersionStatus(row.previous_submission_id ? String(row.previous_submission_id) : null, row.is_latest_version as boolean | null | undefined),
    }));

    return NextResponse.json(
      {
        success: true,
        submissions,
        has_more: hasMore,
        next_offset: hasMore ? offset + limit : null,
        offset,
        limit,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
