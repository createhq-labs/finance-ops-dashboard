import type { SupabaseClient } from '@supabase/supabase-js';
import { logSubmissionAction } from './activityLog';
import type { AppRole } from '../types/submissions';

export type TransferEligibilitySummary = {
  open_submission_count: number;
  mapped_team_lead_id: string | null;
  mapped_team_lead_name: string | null;
  can_transfer: boolean;
  blocked_reason: string | null;
};

type OwnershipTransferResult = {
  transferred_count: number;
  mapped_team_lead_id: string;
  mapped_team_lead_name: string;
  employee_name: string;
};

type TransferredSubmissionListResult = {
  submissions: Array<Record<string, unknown>>;
  has_more: boolean;
  next_offset: number | null;
  offset: number;
  limit: number;
};

type FilterQuery = {
  eq: (column: string, value: unknown) => FilterQuery;
  in: (column: string, values: string[]) => FilterQuery;
  gte: (column: string, value: string) => FilterQuery;
  lte: (column: string, value: string) => FilterQuery;
  or: (filters: string) => FilterQuery;
  order: (column: string, options: { ascending: boolean }) => FilterQuery;
  range: (from: number, to: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
};

function normalizeClosureStatus(value: string | null | undefined) {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (!normalized || normalized === 'open' || normalized === 'no') return 'open';
  if (normalized === 'closed' || normalized === 'yes') return 'closed';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'cancelled';
  if (normalized === 'issues') return 'issues';
  if (normalized === 'gst_left') return 'gst_left';
  return normalized;
}

function isTransferableSubmission(row: Record<string, unknown>, employeeId: string) {
  const currentOwner = String(row.assigned_to_user_id ?? row.submitted_by ?? '');
  const latestVersion = row.is_latest_version as boolean | null | undefined;
  const closureStatus = normalizeClosureStatus((row.closure_status ?? row.closed) as string | null | undefined);
  return currentOwner === employeeId && latestVersion !== false && closureStatus !== 'closed' && closureStatus !== 'cancelled';
}

async function getActiveMappedTeamLeads(adminClient: SupabaseClient, employeeId: string) {
  const { data: mappings, error: mappingsError } = await adminClient
    .from('team_lead_members')
    .select('team_lead_id')
    .eq('employee_id', employeeId);

  if (mappingsError) throw new Error(mappingsError.message);

  const leadIds = Array.from(new Set((mappings ?? []).map((item) => String(item.team_lead_id ?? '')).filter(Boolean)));
  if (leadIds.length === 0) return [] as Array<{ id: string; full_name: string | null }>;

  const { data: leads, error: leadsError } = await adminClient
    .from('users')
    .select('id, full_name, role, status')
    .in('id', leadIds)
    .eq('role', 'team_lead')
    .eq('status', 'active');

  if (leadsError) throw new Error(leadsError.message);

  return ((leads ?? []) as Array<{ id: string; full_name: string | null }>);
}

export async function getTransferEligibilityForEmployees(adminClient: SupabaseClient, employeeIds: string[]) {
  const uniqueEmployeeIds = Array.from(new Set(employeeIds.filter(Boolean)));
  const result = new Map<string, TransferEligibilitySummary>();
  if (uniqueEmployeeIds.length === 0) return result;

  const { data: mappings, error: mappingsError } = await adminClient
    .from('team_lead_members')
    .select('employee_id, team_lead_id')
    .in('employee_id', uniqueEmployeeIds);

  if (mappingsError) throw new Error(mappingsError.message);

  const leadIds = Array.from(new Set((mappings ?? []).map((item) => String(item.team_lead_id ?? '')).filter(Boolean)));
  const leadMap = new Map<string, { id: string; full_name: string | null }>();
  if (leadIds.length > 0) {
    const { data: leads, error: leadsError } = await adminClient
      .from('users')
      .select('id, full_name, role, status')
      .in('id', leadIds)
      .eq('role', 'team_lead')
      .eq('status', 'active');
    if (leadsError) throw new Error(leadsError.message);
    for (const lead of (leads ?? []) as Array<{ id: string; full_name: string | null }>) {
      leadMap.set(String(lead.id), lead);
    }
  }

  const leadIdsByEmployee = new Map<string, string[]>();
  for (const mapping of (mappings ?? []) as Array<{ employee_id: string; team_lead_id: string }>) {
    const employeeId = String(mapping.employee_id ?? '');
    const leadId = String(mapping.team_lead_id ?? '');
    if (!employeeId || !leadMap.has(leadId)) continue;
    const current = leadIdsByEmployee.get(employeeId) ?? [];
    if (!current.includes(leadId)) current.push(leadId);
    leadIdsByEmployee.set(employeeId, current);
  }

  const { data: rows, error: rowsError } = await adminClient
    .from('intake_submissions')
    .select('id, submitted_by, assigned_to_user_id, closure_status, closed, is_latest_version')
    .in('submitted_by', uniqueEmployeeIds);

  if (rowsError) throw new Error(rowsError.message);

  const openCounts = new Map<string, number>();
  for (const row of (rows ?? []) as Array<Record<string, unknown>>) {
    const employeeId = String(row.submitted_by ?? '');
    if (!employeeId) continue;
    if (!isTransferableSubmission(row, employeeId)) continue;
    openCounts.set(employeeId, (openCounts.get(employeeId) ?? 0) + 1);
  }

  for (const employeeId of uniqueEmployeeIds) {
    const matchedLeads = (leadIdsByEmployee.get(employeeId) ?? []).map((leadId) => leadMap.get(leadId)).filter(Boolean) as Array<{ id: string; full_name: string | null }>;
    const openSubmissionCount = openCounts.get(employeeId) ?? 0;

    if (matchedLeads.length !== 1) {
      result.set(employeeId, {
        open_submission_count: openSubmissionCount,
        mapped_team_lead_id: matchedLeads[0]?.id ?? null,
        mapped_team_lead_name: matchedLeads[0]?.full_name ?? null,
        can_transfer: false,
        blocked_reason: matchedLeads.length === 0 ? 'No active mapped team lead.' : 'Multiple active team leads are mapped.',
      });
      continue;
    }

    result.set(employeeId, {
      open_submission_count: openSubmissionCount,
      mapped_team_lead_id: matchedLeads[0].id,
      mapped_team_lead_name: matchedLeads[0].full_name ?? 'Team Lead',
      can_transfer: openSubmissionCount > 0,
      blocked_reason: openSubmissionCount > 0 ? null : 'No open submissions to transfer.',
    });
  }

  return result;
}

export async function transferOpenSubmissionsToMappedTeamLead(params: {
  adminClient: SupabaseClient;
  actorUserId: string;
  actorRole: AppRole;
  employeeId: string;
}) {
  const { adminClient, actorUserId, actorRole, employeeId } = params;
  if (!(actorRole === 'finance' || actorRole === 'admin' || actorRole === 'developer')) {
    throw new Error('Forbidden');
  }

  const { data: employee, error: employeeError } = await adminClient
    .from('users')
    .select('id, full_name, role, status, business_line')
    .eq('id', employeeId)
    .single();

  if (employeeError || !employee) throw new Error('Employee not found.');
  if (employee.role !== 'employee') throw new Error('Only employee ownership can be transferred.');
  if (employee.status !== 'inactive') throw new Error('Transfer is available only for inactive employees.');

  const matchedLeads = await getActiveMappedTeamLeads(adminClient, employeeId);
  if (matchedLeads.length === 0) throw new Error('No active mapped team lead found.');
  if (matchedLeads.length > 1) throw new Error('Multiple active team leads are mapped to this employee.');

  const targetLead = matchedLeads[0];

  const { data: submissions, error: submissionsError } = await adminClient
    .from('intake_submissions')
    .select('id, submitted_by, assigned_to_user_id, original_submitted_by, proforma_invoice, business_line, financial_year, closure_status, closed, is_latest_version')
    .eq('submitted_by', employeeId);

  if (submissionsError) throw new Error(submissionsError.message);

  const transferable = ((submissions ?? []) as Array<Record<string, unknown>>).filter((row) => isTransferableSubmission(row, employeeId));
  if (transferable.length === 0) {
    throw new Error('No open submissions are eligible for transfer.');
  }

  const submissionIds = transferable.map((row) => String(row.id));
  const timestamp = new Date().toISOString();
  const reason = 'Employee exit ownership transfer';

  const { error: updateError } = await adminClient
    .from('intake_submissions')
    .update({
      assigned_to_user_id: targetLead.id,
      original_submitted_by: employeeId,
      ownership_transferred_at: timestamp,
      ownership_transferred_by: actorUserId,
      ownership_transfer_reason: reason,
    })
    .in('id', submissionIds);

  if (updateError) throw new Error(updateError.message);

  for (const row of transferable) {
    const submissionId = String(row.id);
    const piNumber = String(row.proforma_invoice ?? '').trim() || 'No PI Required';
    const details = {
      message: `Transferred ${piNumber} from ${employee.full_name} to ${targetLead.full_name ?? 'Team Lead'}.`,
      pi_number: piNumber,
      business_line: row.business_line ?? employee.business_line ?? null,
      financial_year: row.financial_year ?? null,
      original_submitted_by: employeeId,
      assigned_to_user_id: targetLead.id,
      ownership_transfer_reason: reason,
      module: 'users',
    } as Record<string, unknown>;

    await logSubmissionAction(adminClient, actorUserId, submissionId, 'submission_ownership_transferred', details, {
      action_type: 'submission_ownership_transferred',
      from_status: employeeId,
      to_status: targetLead.id,
      entity_type: 'submission',
      entity_id: submissionId,
      metadata: details,
    });
  }

  return {
    transferred_count: transferable.length,
    mapped_team_lead_id: targetLead.id,
    mapped_team_lead_name: targetLead.full_name ?? 'Team Lead',
    employee_name: String(employee.full_name ?? 'Employee'),
  } satisfies OwnershipTransferResult;
}

function mapVersionStatus(previousSubmissionId: string | null, isLatestVersion: boolean | null | undefined) {
  if (previousSubmissionId) return 'resubmitted';
  if (isLatestVersion === false) return 'superseded';
  return 'original';
}

export async function listTransferredSubmissions(
  client: SupabaseClient,
  params: {
    teamLeadId: string;
    limit: number;
    offset: number;
    query?: string | null;
    status?: string | null;
    originalEmployeeQuery?: string | null;
    submissionId?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }
): Promise<TransferredSubmissionListResult> {
  const { teamLeadId, limit, offset, query, status, originalEmployeeQuery, submissionId, dateFrom, dateTo } = params;

  let submissionsQuery = client
    .from('intake_submissions')
    .select(
      'id, submitted_by, assigned_to_user_id, original_submitted_by, ownership_transferred_at, ownership_transfer_reason, proforma_invoice, currency, agency_brand_name, agency_brand_trade_name, email_address, gst_number, address, bill_due, invoice_type, deliverables, creator_creators_name, brand_name, campaign_code, campaign_name, campaign_brand, campaign_notes, commercials, additional_agency_commission, reimbursement_amount, reimbursement_receipts, additional_information, intake_status, invoice_status, submitted_at, rejection_note, previous_submission_id, business_line, entry_type, entity_type, client_type, agency_name, agency_trade_name, brand_trade_name, invoice_number, debit_note_number, finance_notes, finance_external_notes, finance_comment, creator_invoice_status, payment_received_status, payment_made_status, closure_status, is_latest_version, submission_attachments(id,document_type,file_name,file_size_bytes,mime_type,uploaded_at), intake_line_items(creator_name,brand_name,deliverable_name,amount,line_order)'
    )
    .eq('assigned_to_user_id', teamLeadId)
    .not('ownership_transferred_at', 'is', null)
    .order('ownership_transferred_at', { ascending: false }) as unknown as FilterQuery;

  if (submissionId) submissionsQuery = submissionsQuery.eq('id', submissionId.trim());
  if (status && status !== 'all') submissionsQuery = submissionsQuery.eq('intake_status', status);
  if (dateFrom) submissionsQuery = submissionsQuery.gte('ownership_transferred_at', `${dateFrom}T00:00:00.000Z`);
  if (dateTo) submissionsQuery = submissionsQuery.lte('ownership_transferred_at', `${dateTo}T23:59:59.999Z`);

  const normalizedQuery = String(query || '').trim().replace(/,/g, ' ');
  if (normalizedQuery) {
    submissionsQuery = submissionsQuery.or([
      'proforma_invoice.ilike.%' + normalizedQuery + '%',
      'agency_brand_name.ilike.%' + normalizedQuery + '%',
      'agency_brand_trade_name.ilike.%' + normalizedQuery + '%',
      'creator_creators_name.ilike.%' + normalizedQuery + '%',
      'brand_name.ilike.%' + normalizedQuery + '%',
      'campaign_code.ilike.%' + normalizedQuery + '%',
      'campaign_name.ilike.%' + normalizedQuery + '%',
      'campaign_brand.ilike.%' + normalizedQuery + '%',
    ].join(','));
  }

  const { data, error } = await submissionsQuery.range(offset, offset + limit);
  if (error) throw new Error(error.message);

  let pageRows = ((data ?? []) as Array<Record<string, unknown>>).slice(0, limit);
  const hasMore = ((data ?? []) as Array<Record<string, unknown>>).length > limit;

  const userIds = Array.from(
    new Set(
      pageRows
        .flatMap((row) => [
          String(row.submitted_by ?? ''),
          String(row.assigned_to_user_id ?? ''),
          String(row.original_submitted_by ?? ''),
        ])
        .filter(Boolean)
    )
  );
  const previousSubmissionIds = Array.from(
    new Set(pageRows.map((row) => String(row.previous_submission_id ?? '')).filter(Boolean))
  );

  let userMap = new Map<string, { full_name: string; email: string }>();
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await client
      .from('users')
      .select('id, full_name, email')
      .in('id', userIds);
    if (usersError) throw new Error(usersError.message);
    userMap = new Map(((users ?? []) as Array<{ id: string; full_name: string; email: string }>).map((entry) => [String(entry.id), { full_name: String(entry.full_name ?? ''), email: String(entry.email ?? '') }]));
  }

  if (String(originalEmployeeQuery || '').trim()) {
    const employeeSearch = String(originalEmployeeQuery).trim().toLowerCase();
    pageRows = pageRows.filter((row) => {
      const originalOwner = userMap.get(String(row.original_submitted_by ?? row.submitted_by ?? ''));
      const haystack = `${originalOwner?.full_name ?? ''} ${originalOwner?.email ?? ''}`.toLowerCase();
      return haystack.includes(employeeSearch);
    });
  }

  let previousPiMap = new Map<string, string | null>();
  if (previousSubmissionIds.length > 0) {
    const { data: previousRows, error: previousRowsError } = await client
      .from('intake_submissions')
      .select('id, proforma_invoice')
      .in('id', previousSubmissionIds);
    if (previousRowsError) throw new Error(previousRowsError.message);
    previousPiMap = new Map(((previousRows ?? []) as Array<{ id: string; proforma_invoice: string | null }>).map((row) => [String(row.id), row.proforma_invoice ? String(row.proforma_invoice) : null]));
  }

  const submissions = pageRows.map((row) => {
    const submittedById = String(row.submitted_by ?? '');
    const originalOwnerId = String(row.original_submitted_by ?? submittedById);
    const assignedOwnerId = String(row.assigned_to_user_id ?? '');
    const previousSubmissionId = row.previous_submission_id ? String(row.previous_submission_id) : null;
    return {
      ...row,
      submitted_by_name: userMap.get(submittedById)?.full_name ?? null,
      submitted_by_email: userMap.get(submittedById)?.email ?? null,
      original_owner_name: userMap.get(originalOwnerId)?.full_name ?? null,
      original_owner_email: userMap.get(originalOwnerId)?.email ?? null,
      assigned_to_name: userMap.get(assignedOwnerId)?.full_name ?? null,
      assigned_to_email: userMap.get(assignedOwnerId)?.email ?? null,
      previous_submission_pi: previousSubmissionId ? previousPiMap.get(previousSubmissionId) ?? null : null,
      version_status: mapVersionStatus(previousSubmissionId, row.is_latest_version as boolean | null | undefined),
    };
  });

  return {
    submissions,
    has_more: hasMore,
    next_offset: hasMore ? offset + limit : null,
    offset,
    limit,
  };
}
