import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '../../../../lib/server/supabase';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';
import { deriveInvoiceStatusDbValue, normalizeInvoiceStatusMachine } from '../../../../lib/shared/invoice-status';
import { sortFinanceQueueRows, type FinanceQueueLineItem } from '../../../../lib/client/finance-queue-sort';
import { createPerfTimer } from '../../../../lib/server/perf-timing';

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

type FinanceAggregateCounts = {
  pending_review: number;
  accepted: number;
  resubmission_requested: number;
};

type EmployeeDirectoryEntry = {
  email: string;
  full_name: string | null;
};

type SubmissionChainRow = {
  id: string | null;
  previous_submission_id: string | null;
  proforma_invoice?: string | null;
  is_latest_version?: boolean | null;
};

type BulkSubmissionChainRow = SubmissionChainRow & {
  input_submission_id: string | null;
};

type SubmissionLineItemRow = {
  submission_id: string | null;
  creator_name?: string | null;
  brand_name?: string | null;
  deliverable_name?: string | null;
  amount?: number | null;
  line_order?: number | null;
};

type SubmissionAttachmentRow = {
  submission_id: string | null;
  id: string | null;
  document_type: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  uploaded_at?: string | null;
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

function applyFinanceFilters(
  query: FilterQuery,
  params: URLSearchParams,
  employeeIds: string[] | null,
  searchSubmittedByIds: string[] | null
) {
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
    const filters = [
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
    ];
    if (searchSubmittedByIds && searchSubmittedByIds.length > 0) {
      filters.push('submitted_by.in.(' + searchSubmittedByIds.join(',') + ')');
    }
    query = query.or(filters.join(','));
  }

  return query;
}

export async function GET(req: NextRequest) {
  const perf = createPerfTimer('submissions-finance');
  perf.mark('START');
  let chainRpcCalls = 0;
  try {
    assertSupabaseEnv();

    let token = '';
    try {
      token = getBearerToken(req);
    } catch {
      token = getAccessTokenFromCookieHeader(req.cookies) ?? '';
    }
    if (!token) throw new Error('Missing auth token');
    perf.log('request_parse_and_token');

    const userClient = createUserScopedClient(token);
    const appUser = await getCurrentAppUser(userClient, token);
    if (!(appUser.role === 'finance' || appUser.role === 'admin')) {
      throw new Error('Unauthorized');
    }
    perf.log('auth_app_user_resolve');

    const params = req.nextUrl.searchParams;
    const limit = clampLimit(params.get('limit'), 50);
    const offset = parseOffset(params.get('offset'));
    const employeeFilter = params.get('employee');
    const search = params.get('query')?.trim() || '';
    // Opt-in lightweight mode for callers (currently only the Finance/Admin
    // Overview page) that render summary/list data derived from the exact
    // same rows, ordering, pagination, chain resolution and aggregates as
    // the default response, but never read attachment metadata or
    // previous-submission snapshots. Absent -> byte-for-byte the existing
    // behavior below; every row-selection/sort/chain code path is shared
    // and unconditional, only the SELECT projection and one enrichment step
    // change when this is set.
    const isOverviewMode = params.get('view') === 'overview';
    perf.mark(isOverviewMode ? 'mode=overview' : 'mode=full');

    // Neither lookup depends on the other's result (different search terms
    // against the same users table), so run them concurrently.
    const [employeeFilterResult, searchUsersResult] = await Promise.all([
      employeeFilter && employeeFilter !== 'all'
        ? userClient.from('users').select('id').or('full_name.ilike.%' + employeeFilter + '%,email.ilike.%' + employeeFilter + '%')
        : Promise.resolve(null),
      search
        ? userClient.from('users').select('id').or('full_name.ilike.%' + search + '%,email.ilike.%' + search + '%')
        : Promise.resolve(null),
    ]);

    let employeeIds: string[] | null = null;
    if (employeeFilterResult) {
      if (employeeFilterResult.error) throw new Error(employeeFilterResult.error.message);
      employeeIds = (employeeFilterResult.data ?? []).map((user) => String(user.id ?? '')).filter(Boolean);
      if (employeeIds.length === 0) {
        return NextResponse.json(
          { success: true, submissions: [], has_more: false, next_offset: null, offset, limit },
          { status: 200 }
        );
      }
    }

    let searchSubmittedByIds: string[] | null = null;
    if (searchUsersResult) {
      if (searchUsersResult.error) throw new Error(searchUsersResult.error.message);
      searchSubmittedByIds = (searchUsersResult.data ?? []).map((user) => String(user.id ?? '')).filter(Boolean);
    }
    perf.log('employee_filter_search_user_lookup');

    const baseSelect =
      'id, submitted_by, reviewed_by, reviewed_at, proforma_invoice, currency, agency_brand_name, agency_brand_trade_name, email_address, gst_number, address, bill_due, invoice_type, deliverables, creator_creators_name, brand_name, campaign_code, campaign_name, campaign_brand, campaign_notes, commercials, additional_agency_commission, reimbursement_amount, reimbursement_receipts, additional_information, intake_status, invoice_status, submitted_at, rejection_note, previous_submission_id, business_line, entry_type, entity_type, client_type, agency_name, agency_trade_name, brand_trade_name, finance_notes, finance_external_notes, finance_comment, payment_received, payment_received_status, creator_invoice_status, invoice_via_creators_received, payment_made, payment_made_status, closed, closure_status, invoice_number, debit_note_number, sync_status, is_latest_version';
    const legacySelect =
      'id, submitted_by, reviewed_by, reviewed_at, proforma_invoice, currency, agency_brand_name, agency_brand_trade_name, email_address, gst_number, address, bill_due, invoice_type, deliverables, creator_creators_name, brand_name, commercials, additional_agency_commission, reimbursement_amount, reimbursement_receipts, additional_information, intake_status, invoice_status, submitted_at, rejection_note, previous_submission_id, finance_notes, payment_received, payment_made, closed, invoice_number, debit_note_number, sync_status';

    const normalizeLegacyRows = (rows: Record<string, unknown>[] | null | undefined) =>
      (rows ?? []).map((row: Record<string, unknown>) => ({
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
        intake_line_items: [],
        submission_attachments: [],
      }));

    const runBaseQuery = async (selectClause: string) => {
      let query = userClient.from('intake_submissions').select(selectClause).order('submitted_at', { ascending: false }) as unknown as FilterQuery;
      query = applyFinanceFilters(query, params, employeeIds, searchSubmittedByIds);
      return query.range(0, MAX_QUEUE_ROWS - 1);
    };

    const runLatestTopLevelQuery = async (selectClause: string) => {
      let query = userClient.from('intake_submissions').select(selectClause).order('submitted_at', { ascending: false }) as unknown as FilterQuery;
      query = applyFinanceFilters(query, params, employeeIds, searchSubmittedByIds);
      query = query.eq('is_latest_version', true);
      return query.range(0, MAX_QUEUE_ROWS - 1);
    };

    const fetchRowsByIds = async (ids: string[]) => {
      if (ids.length === 0) return [] as Array<Record<string, unknown>>;

      let selectedRows: Record<string, unknown>[] | null = null;
      let selectedError: { message: string } | null = null;

      {
        const result = await serviceClient
          .from('intake_submissions')
          .select(baseSelect)
          .in('id', ids)
          .order('submitted_at', { ascending: false });
        selectedRows = (result.data ?? null) as Record<string, unknown>[] | null;
        selectedError = result.error;
      }

      if (selectedError) {
        const fallback = await serviceClient
          .from('intake_submissions')
          .select(legacySelect)
          .in('id', ids)
          .order('submitted_at', { ascending: false });

        selectedRows = normalizeLegacyRows(fallback.data as Record<string, unknown>[] | null | undefined);
        selectedError = fallback.error;
      }

      if (selectedError) {
        throw new Error(selectedError.message);
      }

      return (selectedRows ?? []) as Array<Record<string, unknown>>;
    };

    const fetchLineItemsBySubmissionIds = async (submissionIds: string[]) => {
      const uniqueSubmissionIds = Array.from(new Set(submissionIds.filter(Boolean)));
      if (uniqueSubmissionIds.length === 0) return new Map<string, SubmissionLineItemRow[]>();

      const { data: lineItemRows, error: lineItemError } = await userClient
        .from('intake_line_items')
        .select('submission_id, creator_name, brand_name, deliverable_name, amount, line_order')
        .in('submission_id', uniqueSubmissionIds);

      if (lineItemError) {
        throw new Error(lineItemError.message);
      }

      const lineItemsBySubmissionId = new Map<string, SubmissionLineItemRow[]>();
      for (const row of (lineItemRows ?? []) as SubmissionLineItemRow[]) {
        const submissionId = String(row.submission_id ?? '').trim();
        if (!submissionId) continue;
        const entries = lineItemsBySubmissionId.get(submissionId) ?? [];
        entries.push(row);
        lineItemsBySubmissionId.set(submissionId, entries);
      }

      for (const [submissionId, entries] of lineItemsBySubmissionId.entries()) {
        entries.sort((left, right) => (left.line_order ?? 0) - (right.line_order ?? 0));
        lineItemsBySubmissionId.set(submissionId, entries);
      }

      return lineItemsBySubmissionId;
    };

    const fetchAttachmentsBySubmissionIds = async (submissionIds: string[]) => {
      const uniqueSubmissionIds = Array.from(new Set(submissionIds.filter(Boolean)));
      if (uniqueSubmissionIds.length === 0) return new Map<string, SubmissionAttachmentRow[]>();

      const { data: attachmentRows, error: attachmentError } = await userClient
        .from('submission_attachments')
        .select('submission_id, id, document_type, file_name, file_size_bytes, mime_type, uploaded_at')
        .in('submission_id', uniqueSubmissionIds);

      if (attachmentError) {
        throw new Error(attachmentError.message);
      }

      const attachmentsBySubmissionId = new Map<string, SubmissionAttachmentRow[]>();
      for (const row of (attachmentRows ?? []) as SubmissionAttachmentRow[]) {
        const submissionId = String(row.submission_id ?? '').trim();
        if (!submissionId) continue;
        const entries = attachmentsBySubmissionId.get(submissionId) ?? [];
        entries.push(row);
        attachmentsBySubmissionId.set(submissionId, entries);
      }

      return attachmentsBySubmissionId;
    };

    const attachLineItemsToRows = (
      rows: Array<Record<string, unknown>>,
      lineItemsBySubmissionId: Map<string, SubmissionLineItemRow[]>
    ) =>
      rows.map((row) => ({
        ...row,
        intake_line_items: lineItemsBySubmissionId.get(String(row.id ?? '').trim()) ?? [],
      }));

    const attachAttachmentsToRows = (
      rows: Array<Record<string, unknown>>,
      attachmentsBySubmissionId: Map<string, SubmissionAttachmentRow[]>
    ) =>
      rows.map((row) => ({
        ...row,
        submission_attachments: attachmentsBySubmissionId.get(String(row.id ?? '').trim()) ?? [],
      }));

    const serviceClient = createServiceClient();
    const chainCache = new Map<string, { latestId: string; ids: string[] }>();

    const resolveChainBucket = async (submissionId: string) => {
      const cached = chainCache.get(submissionId);
      if (cached) return cached;

      chainRpcCalls += 1;
      const { data: chainRows, error: chainError } = await serviceClient.rpc('resolve_submission_chain', {
        p_submission_id: submissionId,
      });

      if (chainError) {
        throw new Error(chainError.message);
      }

      const ids = Array.from(
        new Set(
          ((chainRows ?? []) as Array<{ id: string | null; is_latest_version?: boolean | null }>)
            .map((entry) => String(entry.id ?? '').trim())
            .filter(Boolean)
        )
      );
      const latestId =
        ((chainRows ?? []) as Array<{ id: string | null; is_latest_version?: boolean | null }>)
          .find((entry) => entry.is_latest_version === true)?.id
          ?.toString() ??
        submissionId;

      const bucket = { latestId, ids };
      ids.forEach((id) => chainCache.set(id, bucket));
      return bucket;
    };

    const resolveChainBucketsBulk = async (submissionIds: string[]) => {
      const uniqueSubmissionIds = Array.from(new Set(submissionIds.filter(Boolean)));
      const missingSubmissionIds = uniqueSubmissionIds.filter((submissionId) => !chainCache.has(submissionId));

      if (missingSubmissionIds.length > 0) {
        chainRpcCalls += 1;
        const { data: bulkChainRows, error: bulkChainError } = await serviceClient.rpc('resolve_submission_chains_bulk', {
          p_submission_ids: missingSubmissionIds,
        });

        if (bulkChainError) {
          throw new Error(bulkChainError.message);
        }

        const rowsByInputId = new Map<string, BulkSubmissionChainRow[]>();
        for (const row of (bulkChainRows ?? []) as BulkSubmissionChainRow[]) {
          const inputSubmissionId = String(row.input_submission_id ?? '').trim();
          if (!inputSubmissionId) continue;
          const entries = rowsByInputId.get(inputSubmissionId) ?? [];
          entries.push(row);
          rowsByInputId.set(inputSubmissionId, entries);
        }

        for (const inputSubmissionId of missingSubmissionIds) {
          const chainRows = rowsByInputId.get(inputSubmissionId) ?? [];
          const ids = Array.from(
            new Set(
              chainRows
                .map((entry) => String(entry.id ?? '').trim())
                .filter(Boolean)
            )
          );
          const latestId =
            chainRows.find((entry) => entry.is_latest_version === true)?.id?.toString() ??
            inputSubmissionId;

          const bucket = { latestId, ids };
          ids.forEach((id) => chainCache.set(id, bucket));
          chainCache.set(inputSubmissionId, bucket);
        }
      }

      return uniqueSubmissionIds.map((submissionId) => {
        const bucket = chainCache.get(submissionId);
        if (!bucket) {
          throw new Error('Submission not found for bulk chain resolution.');
        }
        return bucket;
      });
    };

    let { data, error } = await runBaseQuery(baseSelect);

    if (error) {
      const fallback = await runBaseQuery(legacySelect);
      data = normalizeLegacyRows(fallback.data as Record<string, unknown>[] | null | undefined);
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    perf.log('main_intake_submissions_query');

    const allRows = (data ?? []) as Array<Record<string, unknown>>;
    const aggregates: FinanceAggregateCounts = {
      pending_review: allRows.filter((row) => row.intake_status === 'submitted').length,
      accepted: allRows.filter((row) => row.intake_status === 'accepted').length,
      resubmission_requested: allRows.filter((row) => row.intake_status === 'rejected').length,
    };
    perf.log('aggregate_counts_compute');

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
    perf.log('accepted_at_activity_log_query');

    let latestRows: Array<Record<string, unknown>> = [];
    if (search) {
      const matchedLatestIds: string[] = [];
      const seenLatestIds = new Set<string>();
      const coveredChainMemberIds = new Set<string>();

      for (const row of allRows) {
        const rowId = String(row.id ?? '').trim();
        if (!rowId || coveredChainMemberIds.has(rowId)) continue;

        const bucket = await resolveChainBucket(rowId);
        bucket.ids.forEach((id) => coveredChainMemberIds.add(id));

        if (!seenLatestIds.has(bucket.latestId)) {
          seenLatestIds.add(bucket.latestId);
          matchedLatestIds.push(bucket.latestId);
        }
      }

      latestRows = await fetchRowsByIds(matchedLatestIds);
    } else if (allRows.length < MAX_QUEUE_ROWS) {
      // allRows already ran through applyFinanceFilters with the exact same
      // params/employeeIds/searchSubmittedByIds as runLatestTopLevelQuery
      // would use, and is ordered/bounded identically - the only extra
      // predicate runLatestTopLevelQuery adds is is_latest_version = true.
      // As long as allRows was not truncated by the MAX_QUEUE_ROWS safety
      // cap, filtering it in memory is exactly equivalent to re-running the
      // same filtered query against Postgres a second time, so the second
      // round trip can be skipped. If the cap was hit, fall through to the
      // original dedicated query so truncation can't silently drop rows
      // that a direct is_latest_version-filtered query would still reach.
      latestRows = allRows.filter((row) => row.is_latest_version === true);
    } else {
      let { data: latestData, error: latestError } = await runLatestTopLevelQuery(baseSelect);

      if (latestError) {
        const fallback = await runLatestTopLevelQuery(legacySelect);
        latestData = normalizeLegacyRows(fallback.data as Record<string, unknown>[] | null | undefined);
        latestError = fallback.error;
      }

      if (latestError) {
        return NextResponse.json({ success: false, error: latestError.message }, { status: 400 });
      }

      latestRows = (latestData ?? []) as Array<Record<string, unknown>>;
    }
    const latestLineItemsBySubmissionId = await fetchLineItemsBySubmissionIds(
      latestRows.map((row) => String(row.id ?? '').trim())
    );
    latestRows = attachLineItemsToRows(latestRows, latestLineItemsBySubmissionId);
    perf.log('latest_line_items_fetch');
    perf.log('latest_version_rows_resolve');
    perf.mark(`chain_rpc_calls_so_far=${chainRpcCalls}`);

    const sortableRows = latestRows.map((row) => ({
      id: String(row.id),
      intake_status: String(row.intake_status ?? ''),
      pi: (row.proforma_invoice as string | null) ?? null,
      submitted_at: (row.submitted_at as string | null) ?? null,
      accepted_at: acceptedAtMap.get(String(row.id)) ?? null,
      invoice_type: (row.invoice_type as string | null) ?? null,
      intake_line_items: (row.intake_line_items as FinanceQueueLineItem[] | null) ?? null,
    }));
    const latestRowsById = new Map(latestRows.map((row) => [String(row.id), row]));
    const sortedLatestRows = sortFinanceQueueRows(sortableRows).map((sortableRow) => latestRowsById.get(sortableRow.id)!);
    const pageLatestRows = sortedLatestRows.slice(offset, offset + limit) as Array<Record<string, unknown>>;
    const hasMore = sortedLatestRows.length > offset + limit;
    perf.log('sort_and_paginate');

    const chainIdBuckets = await resolveChainBucketsBulk(
      pageLatestRows.map((row) => String(row.id))
    );
    perf.log('page_chain_resolve');
    perf.mark(`chain_rpc_calls_total=${chainRpcCalls}`);

    const historyIds = Array.from(
      new Set(
        chainIdBuckets.flatMap((bucket) => bucket.ids.filter((id) => id !== bucket.latestId))
      )
    );
    const historyRows = await fetchRowsByIds(historyIds);
    const historyRowsById = new Map(historyRows.map((row) => [String(row.id), row]));
    perf.log('history_rows_fetch');
    let pageRows = pageLatestRows.flatMap((row) => {
      const latestId = String(row.id);
      const chain = chainIdBuckets.find((bucket) => bucket.latestId === latestId);
      const history = (chain?.ids ?? [])
        .filter((id) => id !== latestId)
        .map((id) => historyRowsById.get(id))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry))
        .sort(
          (left, right) =>
            new Date(String(right.submitted_at ?? 0)).getTime() - new Date(String(left.submitted_at ?? 0)).getTime()
        );

      return [row, ...history];
    });
    const pageSubmissionIds = pageRows.map((row) => String(row.id ?? '').trim());
    const pageLineItemsBySubmissionId = await fetchLineItemsBySubmissionIds(pageSubmissionIds);
    pageRows = attachLineItemsToRows(pageRows, pageLineItemsBySubmissionId);
    perf.log('page_line_items_fetch');
    if (!isOverviewMode) {
      const pageAttachmentsBySubmissionId = await fetchAttachmentsBySubmissionIds(pageSubmissionIds);
      pageRows = attachAttachmentsToRows(pageRows, pageAttachmentsBySubmissionId);
    }
    perf.log('page_attachments_fetch');

    const pageAcceptedIds = Array.from(
      new Set(
        pageRows
          .filter((row) => row.intake_status === 'accepted' && !acceptedAtMap.has(String(row.id)))
          .map((row) => String(row.id))
      )
    );
    if (pageAcceptedIds.length > 0) {
      const { data: pageApprovalRows, error: pageApprovalError } = await userClient
        .from('activity_log')
        .select('submission_id, created_at')
        .in('submission_id', pageAcceptedIds)
        .eq('action_type', 'submission_approved')
        .order('created_at', { ascending: true });
      if (pageApprovalError) {
        return NextResponse.json({ success: false, error: pageApprovalError.message }, { status: 400 });
      }
      for (const logRow of pageApprovalRows ?? []) {
        const submissionId = String(logRow.submission_id ?? '');
        if (!submissionId || acceptedAtMap.has(submissionId)) continue;
        acceptedAtMap.set(submissionId, String(logRow.created_at));
      }
    }
    perf.log('page_accepted_at_activity_log_query');

    const allSubmittedByIds = Array.from(new Set(allRows.map((row) => String(row.submitted_by ?? '')).filter(Boolean)));
    const pageSubmittedByIds = Array.from(new Set(pageRows.map((row) => String(row.submitted_by ?? '')).filter(Boolean)));
    const reviewedByIds = Array.from(new Set(pageRows.map((row) => String(row.reviewed_by ?? '')).filter(Boolean)));
    const previousSubmissionIds = Array.from(new Set(pageRows.map((row) => String(row.previous_submission_id ?? '')).filter(Boolean)));

    let userMap = new Map<string, { full_name: string; email: string }>();
    if (allSubmittedByIds.length > 0 || pageSubmittedByIds.length > 0 || reviewedByIds.length > 0) {
      const requestedUserIds = Array.from(new Set([...allSubmittedByIds, ...pageSubmittedByIds, ...reviewedByIds]));
      const { data: users, error: usersError } = await userClient.from('users').select('id, full_name, email').in('id', requestedUserIds);
      if (usersError) {
        return NextResponse.json({ success: false, error: usersError.message }, { status: 400 });
      }
      userMap = new Map((users ?? []).map((user) => [String(user.id), { full_name: String(user.full_name ?? ''), email: String(user.email ?? '') }]));
    }
    perf.log('user_enrichment_lookup');

    // Only used by Finance Review's employee-filter dropdown; the Overview
    // fetch never reads `employee_directory`, so skip building it in
    // overview mode.
    const employeeDirectory = isOverviewMode
      ? []
      : Array.from(
          new Map(
            allRows
              .map((row) => {
                const owner = userMap.get(String(row.submitted_by ?? ''));
                const email = String(owner?.email ?? row.email_address ?? '').trim();
                if (!email) return null;
                return [
                  email,
                  {
                    email,
                    full_name: owner?.full_name?.trim() || null,
                  } satisfies EmployeeDirectoryEntry,
                ] as const;
              })
              .filter((entry): entry is readonly [string, EmployeeDirectoryEntry] => Boolean(entry))
          ).values()
        );
    perf.log('employee_directory_build');

    let previousPiMap = new Map<string, string | null>();
    let previousSubmissionMap = new Map<string, Record<string, unknown>>();
    // Neither previous_submission_pi nor previous_submission_snapshot is
    // read by Overview (see app/(dashboard)/dashboard/page.tsx) - skip the
    // extra query (and its own nested intake_line_items join) entirely.
    if (!isOverviewMode && previousSubmissionIds.length > 0) {
      // previousPiMap only needs `proforma_invoice`, which this select
      // already includes - deriving it from the same rows avoids running an
      // identical `.in(id)` lookup against intake_submissions twice.
      const { data: previousSubmissionRows, error: previousSubmissionError } = await userClient
        .from('intake_submissions')
        .select('id, proforma_invoice, currency, agency_brand_name, agency_brand_trade_name, gst_number, address, bill_due, invoice_type, deliverables, creator_creators_name, brand_name, campaign_code, campaign_name, campaign_brand, commercials, additional_agency_commission, reimbursement_amount, reimbursement_receipts, additional_information, business_line, entry_type, entity_type, client_type, agency_name, agency_trade_name, brand_trade_name, intake_line_items(creator_name,brand_name,deliverable_name,amount,line_order)')
        .in('id', previousSubmissionIds);
      if (previousSubmissionError) {
        return NextResponse.json({ success: false, error: previousSubmissionError.message }, { status: 400 });
      }
      previousSubmissionMap = new Map((previousSubmissionRows ?? []).map((row) => [String(row.id), row as Record<string, unknown>]));
      previousPiMap = new Map(
        (previousSubmissionRows ?? []).map((row) => [String(row.id), row.proforma_invoice ? String(row.proforma_invoice) : null])
      );
    }
    perf.log('previous_submission_enrichment');

    // previous_submission_pi/previous_submission_snapshot are only ever
    // computed when !isOverviewMode (see previousPiMap/previousSubmissionMap
    // above) - omit the keys entirely in overview mode rather than
    // serializing a fabricated `null` in place of data that was
    // intentionally not fetched.
    const submissions = pageRows.map((row) => {
      const owner = userMap.get(String(row.submitted_by ?? ''));
      return {
        ...row,
        invoice_status: deriveInvoiceStatusDbValue(row),
        submitted_by_name: owner?.full_name ?? null,
        submitted_by_email: owner?.email ?? null,
        reviewed_by_name: row.reviewed_by ? userMap.get(String(row.reviewed_by ?? ''))?.full_name ?? null : null,
        ...(isOverviewMode
          ? {}
          : {
              previous_submission_pi: row.previous_submission_id ? previousPiMap.get(String(row.previous_submission_id)) ?? null : null,
              previous_submission_snapshot: row.previous_submission_id ? previousSubmissionMap.get(String(row.previous_submission_id)) ?? null : null,
            }),
        version_status: mapVersionStatus(row.previous_submission_id ? String(row.previous_submission_id) : null, row.is_latest_version as boolean | null | undefined),
        accepted_at: acceptedAtMap.get(String(row.id)) ?? null,
      };
    });
    perf.log('response_row_mapping');

    const response = NextResponse.json(
      {
        success: true,
        submissions,
        aggregates,
        // employee_directory is only ever built when !isOverviewMode (see
        // employeeDirectory above) - omit the key entirely in overview mode
        // rather than serializing a fabricated `[]` in place of data that
        // was intentionally not fetched.
        ...(isOverviewMode ? {} : { employee_directory: employeeDirectory }),
        has_more: hasMore,
        next_offset: hasMore ? offset + limit : null,
        offset,
        limit,
      },
      { status: 200 }
    );
    perf.log('json_response_prepare');
    perf.total();
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
