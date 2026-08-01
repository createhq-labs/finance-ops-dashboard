import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { assertSupabaseEnv, createUserScopedClient } from '../../../../lib/server/supabase';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';
import { deriveInvoiceStatusDbValue, normalizeInvoiceStatusMachine } from '../../../../lib/shared/invoice-status';
import { sortFinanceQueueRows, type FinanceQueueLineItem } from '../../../../lib/client/finance-queue-sort';

const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';
// Safety bound so the full filtered queue can be fetched and sorted before
// limit/offset pagination is applied, instead of paginating pre-sort.
const MAX_QUEUE_ROWS = 5000;

type FilterQuery = {
  eq: (column: string, value: unknown) => FilterQuery;
  is: (column: string, value: unknown) => FilterQuery;
  not: (column: string, operator: string, value: unknown) => FilterQuery;
  or: (filters: string) => FilterQuery;
  gte: (column: string, value: string) => FilterQuery;
  lte: (column: string, value: string) => FilterQuery;
  in: (column: string, values: string[]) => FilterQuery;
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

function applyFinanceFilters(query: FilterQuery, params: URLSearchParams, employeeIds: string[] | null) {
  const submissionId = params.get('submission_id')?.trim();
  const businessLine = params.get('business_line');
  const intakeStatus = params.get('intake_status');
  const invoiceStatus = params.get('invoice_status');
  const creatorInvoice = params.get('creator_invoice_received');
  const paymentReceived = params.get('payment_received');
  const paymentMade = params.get('payment_made');
  const closedStatus = params.get('closed_status');
  const versionStatus = params.get('version_status');
  const dateFrom = params.get('date_from');
  const dateTo = params.get('date_to');
  const search = params.get('query')?.trim();

  if (submissionId) query = query.eq('id', submissionId);
  if (businessLine && businessLine !== 'all') query = query.eq('business_line', businessLine);
  if (intakeStatus && intakeStatus !== 'all') query = query.eq('intake_status', intakeStatus);
  if (invoiceStatus && invoiceStatus !== 'all') {
    const normalizedInvoiceStatus = normalizeInvoiceStatusMachine(invoiceStatus);
    if (normalizedInvoiceStatus === 'invoice_cancelled') {
      query = query.eq('intake_status', 'rejected');
    } else if (normalizedInvoiceStatus === 'invoice_plus_debit_note') {
      query = query.not('intake_status', 'eq', 'rejected').not('invoice_number', 'is', null).not('debit_note_number', 'is', null);
    } else if (normalizedInvoiceStatus === 'debit_note') {
      query = query.not('intake_status', 'eq', 'rejected').not('debit_note_number', 'is', null).is('invoice_number', null);
    } else if (normalizedInvoiceStatus === 'invoice_created') {
      query = query.not('intake_status', 'eq', 'rejected').not('invoice_number', 'is', null).is('debit_note_number', null);
    } else if (normalizedInvoiceStatus === 'po_created_estimate' || normalizedInvoiceStatus === 'invoice_pending') {
      query = query.eq('intake_status', 'accepted').is('invoice_number', null).is('debit_note_number', null);
    }
  }
  if (creatorInvoice && creatorInvoice !== 'all') query = query.eq('creator_invoice_status', creatorInvoice);
  if (paymentReceived && paymentReceived !== 'all') query = query.eq('payment_received_status', paymentReceived);
  if (paymentMade && paymentMade !== 'all') query = query.eq('payment_made_status', paymentMade);
  if (closedStatus && closedStatus !== 'all') query = query.eq('closure_status', closedStatus);
  if (dateFrom) query = query.gte('submitted_at', dateFrom + 'T00:00:00.000Z');
  if (dateTo) query = query.lte('submitted_at', dateTo + 'T23:59:59.999Z');

  if (versionStatus === 'original') {
    query = query.is('previous_submission_id', null).eq('is_latest_version', true);
  } else if (versionStatus === 'resubmitted') {
    query = query.not('previous_submission_id', 'is', null);
  } else if (versionStatus === 'superseded') {
    query = query.is('previous_submission_id', null).eq('is_latest_version', false);
  }

  if (employeeIds) {
    query = query.in('submitted_by', employeeIds.length > 0 ? employeeIds : [EMPTY_UUID]);
  }

  if (search) {
    const escaped = search.replace(/,/g, ' ');
    query = query.or(
      [
        'proforma_invoice.ilike.%' + escaped + '%',
        'agency_brand_name.ilike.%' + escaped + '%',
        'agency_brand_trade_name.ilike.%' + escaped + '%',
        'email_address.ilike.%' + escaped + '%',
        'creator_creators_name.ilike.%' + escaped + '%',
        'brand_name.ilike.%' + escaped + '%',
        'agency_name.ilike.%' + escaped + '%',
        'agency_trade_name.ilike.%' + escaped + '%',
        'brand_trade_name.ilike.%' + escaped + '%',
        'campaign_code.ilike.%' + escaped + '%',
        'campaign_name.ilike.%' + escaped + '%',
        'campaign_brand.ilike.%' + escaped + '%',
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
    if (!(appUser.role === 'finance' || appUser.role === 'admin')) {
      throw new Error('Unauthorized');
    }

    const params = req.nextUrl.searchParams;
    const limit = clampLimit(params.get('limit'), 50);
    const offset = parseOffset(params.get('offset'));
    const employeeFilter = params.get('employee');

    let employeeIds: string[] | null = null;
    if (employeeFilter && employeeFilter !== 'all') {
      const { data: users, error: usersError } = await userClient
        .from('users')
        .select('id')
        .or('full_name.ilike.%' + employeeFilter + '%,email.ilike.%' + employeeFilter + '%');

      if (usersError) throw new Error(usersError.message);
      employeeIds = (users ?? []).map((user) => String(user.id ?? '')).filter(Boolean);
      if (employeeIds.length === 0) {
        return NextResponse.json(
          { success: true, submissions: [], has_more: false, next_offset: null, offset, limit },
          { status: 200 }
        );
      }
    }

    const baseSelect =
      'id, submitted_by, reviewed_by, reviewed_at, proforma_invoice, currency, agency_brand_name, agency_brand_trade_name, email_address, gst_number, address, bill_due, invoice_type, deliverables, creator_creators_name, brand_name, campaign_code, campaign_name, campaign_brand, campaign_notes, commercials, additional_agency_commission, reimbursement_amount, reimbursement_receipts, additional_information, intake_status, invoice_status, submitted_at, rejection_note, previous_submission_id, business_line, entry_type, entity_type, client_type, agency_name, agency_trade_name, brand_trade_name, finance_notes, finance_external_notes, finance_comment, payment_received, payment_received_status, creator_invoice_status, invoice_via_creators_received, payment_made, payment_made_status, closed, closure_status, invoice_number, debit_note_number, sync_status, is_latest_version, submission_attachments(id,document_type,file_name,file_size_bytes,mime_type,uploaded_at), intake_line_items(creator_name,brand_name,deliverable_name,amount,line_order)';
    const legacySelect =
      'id, submitted_by, reviewed_by, reviewed_at, proforma_invoice, currency, agency_brand_name, agency_brand_trade_name, email_address, gst_number, address, bill_due, invoice_type, deliverables, creator_creators_name, brand_name, commercials, additional_agency_commission, reimbursement_amount, reimbursement_receipts, additional_information, intake_status, invoice_status, submitted_at, rejection_note, previous_submission_id, finance_notes, payment_received, payment_made, closed, invoice_number, debit_note_number, sync_status, intake_line_items(creator_name,brand_name,deliverable_name,amount,line_order)';

    const runBaseQuery = async (selectClause: string) => {
      let query = userClient.from('intake_submissions').select(selectClause).order('submitted_at', { ascending: false }) as unknown as FilterQuery;
      query = applyFinanceFilters(query, params, employeeIds);
      return query.range(0, MAX_QUEUE_ROWS - 1);
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
        campaign_code: null,
        campaign_name: null,
        campaign_brand: null,
        campaign_notes: null,
        currency: 'INR',
        creator_invoice_status: null,
        invoice_via_creators_received: null,
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

    const allRows = (data ?? []) as Array<Record<string, unknown>>;

    const acceptedIds = Array.from(new Set(allRows.filter((row) => row.intake_status === 'accepted').map((row) => String(row.id))));

    const acceptedAtMap = new Map<string, string>();
    if (acceptedIds.length > 0) {
      const { data: approvalRows, error: approvalError } = await userClient
        .from('activity_log')
        .select('submission_id, created_at')
        .in('submission_id', acceptedIds)
        .eq('action_type', 'submission_approved')
        .order('created_at', { ascending: true });
      if (approvalError) {
        return NextResponse.json({ success: false, error: approvalError.message }, { status: 400 });
      }
      for (const logRow of approvalRows ?? []) {
        const submissionId = String(logRow.submission_id ?? '');
        if (!submissionId || acceptedAtMap.has(submissionId)) continue;
        acceptedAtMap.set(submissionId, String(logRow.created_at));
      }
    }

    const sortableRows = allRows.map((row) => ({
      id: String(row.id),
      intake_status: String(row.intake_status ?? ''),
      pi: (row.proforma_invoice as string | null) ?? null,
      submitted_at: (row.submitted_at as string | null) ?? null,
      accepted_at: acceptedAtMap.get(String(row.id)) ?? null,
      invoice_type: (row.invoice_type as string | null) ?? null,
      intake_line_items: (row.intake_line_items as FinanceQueueLineItem[] | null) ?? null,
    }));
    const rowsById = new Map(allRows.map((row) => [String(row.id), row]));
    const sortedRows = sortFinanceQueueRows(sortableRows).map((sortableRow) => rowsById.get(sortableRow.id)!);

    const pageRows = sortedRows.slice(offset, offset + limit) as Array<Record<string, unknown>>;
    const hasMore = sortedRows.length > offset + limit;

    const submittedByIds = Array.from(new Set(pageRows.map((row) => String(row.submitted_by ?? '')).filter(Boolean)));
    const previousSubmissionIds = Array.from(new Set(pageRows.map((row) => String(row.previous_submission_id ?? '')).filter(Boolean)));

    let userMap = new Map<string, { full_name: string; email: string }>();
    if (submittedByIds.length > 0) {
      const { data: users, error: usersError } = await userClient.from('users').select('id, full_name, email').in('id', submittedByIds);
      if (usersError) {
        return NextResponse.json({ success: false, error: usersError.message }, { status: 400 });
      }
      userMap = new Map((users ?? []).map((user) => [String(user.id), { full_name: String(user.full_name ?? ''), email: String(user.email ?? '') }]));
    }

    let previousPiMap = new Map<string, string | null>();
    if (previousSubmissionIds.length > 0) {
      const { data: previousRows, error: previousRowsError } = await userClient
        .from('intake_submissions')
        .select('id, proforma_invoice')
        .in('id', previousSubmissionIds);
      if (previousRowsError) {
        return NextResponse.json({ success: false, error: previousRowsError.message }, { status: 400 });
      }
      previousPiMap = new Map((previousRows ?? []).map((row) => [String(row.id), row.proforma_invoice ? String(row.proforma_invoice) : null]));
    }

    let previousSubmissionMap = new Map<string, Record<string, unknown>>();
    if (previousSubmissionIds.length > 0) {
      const { data: previousSubmissionRows, error: previousSubmissionError } = await userClient
        .from('intake_submissions')
        .select('id, proforma_invoice, currency, agency_brand_name, agency_brand_trade_name, gst_number, address, bill_due, invoice_type, deliverables, creator_creators_name, brand_name, campaign_code, campaign_name, campaign_brand, commercials, additional_agency_commission, reimbursement_amount, reimbursement_receipts, additional_information, business_line, entry_type, entity_type, client_type, agency_name, agency_trade_name, brand_trade_name, intake_line_items(creator_name,brand_name,deliverable_name,amount,line_order)')
        .in('id', previousSubmissionIds);
      if (previousSubmissionError) {
        return NextResponse.json({ success: false, error: previousSubmissionError.message }, { status: 400 });
      }
      previousSubmissionMap = new Map((previousSubmissionRows ?? []).map((row) => [String(row.id), row as Record<string, unknown>]));
    }

    const submissions = pageRows.map((row) => {
      const owner = userMap.get(String(row.submitted_by ?? ''));
      return {
        ...row,
        invoice_status: deriveInvoiceStatusDbValue(row),
        submitted_by_name: owner?.full_name ?? null,
        submitted_by_email: owner?.email ?? null,
        previous_submission_pi: row.previous_submission_id ? previousPiMap.get(String(row.previous_submission_id)) ?? null : null,
        previous_submission_snapshot: row.previous_submission_id ? previousSubmissionMap.get(String(row.previous_submission_id)) ?? null : null,
        version_status: mapVersionStatus(row.previous_submission_id ? String(row.previous_submission_id) : null, row.is_latest_version as boolean | null | undefined),
        accepted_at: acceptedAtMap.get(String(row.id)) ?? null,
      };
    });

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
