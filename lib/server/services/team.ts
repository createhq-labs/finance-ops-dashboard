import type { SupabaseClient } from '@supabase/supabase-js';
import type { BusinessLine } from '../types/submissions';

type TeamLeadMemberRow = {
  id: string;
  team_lead_id: string;
  employee_id: string;
  created_by: string;
  created_at: string;
};

type TeamEmployeeRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  business_line: BusinessLine | null;
};

export type TeamMemberRecord = {
  employee_id: string;
  full_name: string;
  email: string;
  status: string;
  business_line: BusinessLine | null;
  created_at: string;
  created_by: string;
};

export type TeamCandidateRecord = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  business_line: BusinessLine | null;
  team_lead_names: string[];
  is_current_team_member: boolean;
  disabled_reason: string | null;
};

export type TeamLeadSubmissionListResult = {
  submissions: Array<Record<string, unknown>>;
  has_more: boolean;
  next_offset: number | null;
  offset: number;
  limit: number;
};

type FilterQuery = {
  eq: (column: string, value: unknown) => FilterQuery;
  or: (filters: string) => FilterQuery;
  in: (column: string, values: string[]) => FilterQuery;
  range: (from: number, to: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
  order: (column: string, options: { ascending: boolean }) => FilterQuery;
};

function normalizeBusinessLine(value: string | null | undefined) {
  const next = String(value ?? '').trim().toUpperCase();
  if (next === 'IM' || next === 'TM') return next as BusinessLine;
  return null;
}

function mapVersionStatus(previousSubmissionId: string | null, isLatestVersion: boolean | null | undefined) {
  if (previousSubmissionId) return 'resubmitted';
  if (isLatestVersion === false) return 'superseded';
  return 'original';
}

export async function listTeamLeadMembers(client: SupabaseClient, teamLeadId: string) {
  const { data, error } = await client
    .from('team_lead_members')
    .select('id, team_lead_id, employee_id, created_by, created_at')
    .eq('team_lead_id', teamLeadId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const mappings = (data ?? []) as TeamLeadMemberRow[];
  const employeeIds = mappings.map((item) => item.employee_id);

  if (employeeIds.length === 0) {
    return [] as TeamMemberRecord[];
  }

  const { data: employees, error: employeesError } = await client
    .from('users')
    .select('id, full_name, email, role, status, business_line')
    .in('id', employeeIds);

  if (employeesError) throw new Error(employeesError.message);

  const employeeById = new Map(
    ((employees ?? []) as TeamEmployeeRow[]).map((employee) => [employee.id, employee])
  );

  return mappings
    .map((mapping) => {
      const employee = employeeById.get(mapping.employee_id);
      if (!employee) return null;
      return {
        employee_id: mapping.employee_id,
        full_name: employee.full_name,
        email: employee.email,
        status: employee.status,
        business_line: employee.business_line ?? null,
        created_at: mapping.created_at,
        created_by: mapping.created_by,
      } satisfies TeamMemberRecord;
    })
    .filter(Boolean) as TeamMemberRecord[];
}

export async function searchTeamLeadCandidates(
  client: SupabaseClient,
  teamLeadId: string,
  search: string,
  teamLeadBusinessLine: string | null
) {
  const normalizedSearch = search.trim().toLowerCase();

  const { data: existingMappings, error: existingMappingsError } = await client
    .from('team_lead_members')
    .select('employee_id')
    .eq('team_lead_id', teamLeadId);

  if (existingMappingsError) throw new Error(existingMappingsError.message);

  const currentTeamIds = new Set((existingMappings ?? []).map((item) => String(item.employee_id)));

  const { data, error } = await client
    .from('users')
    .select('id, full_name, email, role, status, business_line')
    .eq('role', 'employee');

  if (error) throw new Error(error.message);

  const employees = ((data ?? []) as TeamEmployeeRow[])
    .filter((employee) => employee.status === 'active')
    .filter((employee) => {
      if (!normalizedSearch) return true;
      const haystack = (employee.full_name + ' ' + employee.email).toLowerCase();
      return haystack.includes(normalizedSearch);
    })
    .sort((left, right) => left.full_name.localeCompare(right.full_name));

  if (employees.length === 0) return [] as TeamCandidateRecord[];

  const employeeIds = employees.map((employee) => employee.id);

  const { data: mappings, error: mappingsError } = await client
    .from('team_lead_members')
    .select('employee_id, team_lead_id')
    .in('employee_id', employeeIds);

  if (mappingsError) throw new Error(mappingsError.message);

  const leadIds = Array.from(new Set(((mappings ?? []) as Array<{ employee_id: string; team_lead_id: string }>).map((item) => item.team_lead_id).filter(Boolean)));

  let leadNameMap = new Map<string, string>();
  if (leadIds.length > 0) {
    const { data: leads, error: leadsError } = await client
      .from('users')
      .select('id, full_name')
      .in('id', leadIds);
    if (leadsError) throw new Error(leadsError.message);
    leadNameMap = new Map(
      ((leads ?? []) as Array<{ id: string; full_name: string }>).map((lead) => [lead.id, lead.full_name])
    );
  }

  const leadNamesByEmployee = new Map<string, string[]>();
  for (const mapping of (mappings ?? []) as Array<{ employee_id: string; team_lead_id: string }>) {
    if (mapping.team_lead_id === teamLeadId) continue;
    const current = leadNamesByEmployee.get(mapping.employee_id) || [];
    const name = leadNameMap.get(mapping.team_lead_id);
    if (name && !current.includes(name)) current.push(name);
    leadNamesByEmployee.set(mapping.employee_id, current);
  }

  return employees
    .map((employee) => ({
      id: employee.id,
      full_name: employee.full_name,
      email: employee.email,
      status: employee.status,
      business_line: employee.business_line ?? null,
      team_lead_names: leadNamesByEmployee.get(employee.id) || [],
      is_current_team_member: currentTeamIds.has(employee.id),
      disabled_reason:
        !normalizeBusinessLine(teamLeadBusinessLine)
          ? 'Assign business line first.'
          : employee.business_line !== normalizeBusinessLine(teamLeadBusinessLine)
            ? 'Different business line'
            : null,
    }));
}

export async function addTeamLeadMember(
  client: SupabaseClient,
  teamLeadId: string,
  employeeId: string,
  createdBy: string,
  teamLeadBusinessLine: string | null
) {
  if (teamLeadId === employeeId) {
    throw new Error('You cannot add yourself as a team member.');
  }

  const { data: employee, error: employeeError } = await client
    .from('users')
    .select('id, role, status, full_name, email, business_line')
    .eq('id', employeeId)
    .maybeSingle();

  if (employeeError) throw new Error(employeeError.message);
  if (!employee) throw new Error('Employee not found.');
  if (employee.role !== 'employee') throw new Error('Only employee users can be added to a team.');
  if (employee.status !== 'active') throw new Error('Only active employees can be added to a team.');
  const leadLine = normalizeBusinessLine(teamLeadBusinessLine);
  if (!leadLine) {
    throw new Error('Assign business line first.');
  }
  if (employee.business_line !== leadLine) {
    throw new Error('Different business line.');
  }

  const { data: existing, error: existingError } = await client
    .from('team_lead_members')
    .select('id')
    .eq('team_lead_id', teamLeadId)
    .eq('employee_id', employeeId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) {
    throw new Error('This employee is already in your team.');
  }

  const { data, error } = await client
    .from('team_lead_members')
    .insert({
      team_lead_id: teamLeadId,
      employee_id: employeeId,
      created_by: createdBy,
    })
    .select('id, team_lead_id, employee_id, created_by, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('This employee is already in your team.');
    }
    throw new Error(error.message);
  }

  return {
    mapping: data as TeamLeadMemberRow,
    employee: employee as TeamEmployeeRow,
  };
}

export async function removeTeamLeadMember(
  client: SupabaseClient,
  teamLeadId: string,
  employeeId: string
) {
  const { data, error } = await client
    .from('team_lead_members')
    .delete()
    .eq('team_lead_id', teamLeadId)
    .eq('employee_id', employeeId)
    .select('id');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('Team member mapping not found.');
  }

  return { removed: true as const };
}

export async function listTeamLeadSubmissions(
  client: SupabaseClient,
  params: {
    teamLeadId: string;
    limit: number;
    offset: number;
    query?: string | null;
    status?: string | null;
    memberQuery?: string | null;
    submissionId?: string | null;
  }
): Promise<TeamLeadSubmissionListResult> {
  const { teamLeadId, limit, offset, query, status, memberQuery, submissionId } = params;

  const { data: mappings, error: mappingsError } = await client
    .from('team_lead_members')
    .select('employee_id')
    .eq('team_lead_id', teamLeadId);

  if (mappingsError) throw new Error(mappingsError.message);

  let employeeIds = Array.from(new Set((mappings ?? []).map((item) => String(item.employee_id)).filter(Boolean)));
  if (employeeIds.length === 0) {
    return { submissions: [], has_more: false, next_offset: null, offset, limit };
  }

  const normalizedMemberQuery = String(memberQuery || '').trim();
  if (normalizedMemberQuery) {
    const { data: matchedUsers, error: matchedUsersError } = await client
      .from('users')
      .select('id')
      .in('id', employeeIds)
      .or('full_name.ilike.%' + normalizedMemberQuery + '%,email.ilike.%' + normalizedMemberQuery + '%');

    if (matchedUsersError) throw new Error(matchedUsersError.message);

    employeeIds = (matchedUsers ?? []).map((user) => String(user.id ?? '')).filter(Boolean);
    if (employeeIds.length === 0) {
      return { submissions: [], has_more: false, next_offset: null, offset, limit };
    }
  }

  let submissionsQuery = client
    .from('intake_submissions')
    .select(
      'id, submitted_by, proforma_invoice, currency, agency_brand_name, agency_brand_trade_name, email_address, gst_number, address, bill_due, invoice_type, deliverables, creator_creators_name, brand_name, campaign_code, campaign_name, campaign_brand, campaign_notes, commercials, additional_agency_commission, reimbursement_amount, reimbursement_receipts, additional_information, intake_status, invoice_status, submitted_at, rejection_note, previous_submission_id, business_line, entry_type, entity_type, client_type, agency_name, agency_trade_name, brand_trade_name, invoice_number, debit_note_number, finance_notes, finance_external_notes, finance_comment, creator_invoice_status, payment_received_status, payment_made_status, closure_status, is_latest_version, submission_attachments(id,document_type,file_name,file_size_bytes,mime_type,uploaded_at), intake_line_items(creator_name,brand_name,deliverable_name,amount,line_order)'
    )
    .in('submitted_by', employeeIds)
    .order('submitted_at', { ascending: false }) as unknown as FilterQuery;

  if (submissionId) {
    submissionsQuery = submissionsQuery.eq('id', submissionId.trim());
  }

  if (status && status !== 'all') {
    submissionsQuery = submissionsQuery.eq('intake_status', status);
  }

  const normalizedQuery = String(query || '').trim().replace(/,/g, ' ');
  if (normalizedQuery) {
    submissionsQuery = submissionsQuery.or(
      [
        'proforma_invoice.ilike.%' + normalizedQuery + '%',
        'agency_brand_name.ilike.%' + normalizedQuery + '%',
        'agency_brand_trade_name.ilike.%' + normalizedQuery + '%',
        'creator_creators_name.ilike.%' + normalizedQuery + '%',
        'brand_name.ilike.%' + normalizedQuery + '%',
        'campaign_code.ilike.%' + normalizedQuery + '%',
        'campaign_name.ilike.%' + normalizedQuery + '%',
        'campaign_brand.ilike.%' + normalizedQuery + '%',
      ].join(',')
    );
  }

  const { data, error } = await submissionsQuery.range(offset, offset + limit);

  if (error) throw new Error(error.message);

  const pageRows = ((data ?? []) as Array<Record<string, unknown>>).slice(0, limit);
  const hasMore = ((data ?? []) as Array<Record<string, unknown>>).length > limit;

  const submittedByIds = Array.from(
    new Set(pageRows.map((row) => String(row.submitted_by ?? '')).filter(Boolean))
  );
  const previousSubmissionIds = Array.from(
    new Set(pageRows.map((row) => String(row.previous_submission_id ?? '')).filter(Boolean))
  );

  let userMap = new Map<string, { full_name: string; email: string }>();
  if (submittedByIds.length > 0) {
    const { data: users, error: usersError } = await client
      .from('users')
      .select('id, full_name, email')
      .in('id', submittedByIds);
    if (usersError) throw new Error(usersError.message);
    userMap = new Map(
      ((users ?? []) as Array<{ id: string; full_name: string; email: string }>).map((user) => [
        user.id,
        { full_name: String(user.full_name ?? ''), email: String(user.email ?? '') },
      ])
    );
  }

  let previousPiMap = new Map<string, string | null>();
  if (previousSubmissionIds.length > 0) {
    const { data: previousRows, error: previousRowsError } = await client
      .from('intake_submissions')
      .select('id, proforma_invoice')
      .in('id', previousSubmissionIds);
    if (previousRowsError) throw new Error(previousRowsError.message);
    previousPiMap = new Map(
      ((previousRows ?? []) as Array<{ id: string; proforma_invoice: string | null }>).map((row) => [
        String(row.id),
        row.proforma_invoice ? String(row.proforma_invoice) : null,
      ])
    );
  }

  const submissions = pageRows.map((row) => {
    const owner = userMap.get(String(row.submitted_by ?? ''));
    const previousSubmissionId = row.previous_submission_id ? String(row.previous_submission_id) : null;
    return {
      ...row,
      submitted_by_name: owner?.full_name ?? null,
      submitted_by_email: owner?.email ?? null,
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
