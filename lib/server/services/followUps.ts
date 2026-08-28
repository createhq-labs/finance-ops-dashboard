import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubmissionAttachmentSummary } from '../../shared/submission-attachments';
import { GST_SCREENSHOT_DOCUMENT_TYPE } from '../../shared/submission-attachments';
import { normalizeInvoiceStatusMachine } from '../../shared/invoice-status';
import type { AppUser } from '../types/submissions';
import { getAttachmentAccessSummaryMap, type AttachmentAccessActor, type AttachmentAccessSummary } from './submissionAttachments';

export type FollowUpType = 'payment_received_pending' | 'gst_pending';
export type FollowUpStatus = 'pending' | 'completed';

type GstScreenshotAttachmentRow = SubmissionAttachmentSummary & {
  submission_id: string;
  uploaded_by: string;
};

export type FollowUpListItem = {
  id: string;
  submission_id: string;
  follow_up_type: FollowUpType;
  due_date: string;
  status: FollowUpStatus;
  completion_reason: string | null;
  completed_at: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  last_notified_at: string | null;
  next_notification_at: string | null;
  created_at: string;
  updated_at: string;
  assigned_employee_id: string;
  assigned_employee_name: string | null;
  assigned_employee_email: string | null;
  assigned_team_lead_id: string | null;
  assigned_team_lead_name: string | null;
  proforma_invoice: string | null;
  agency_brand_name: string | null;
  bill_due: string | null;
  intake_status: string | null;
  invoice_status: string | null;
  payment_received_status: string | null;
  creator_invoice_status: string | null;
  payment_made_status: string | null;
  closure_status: string | null;
  submitted_at: string | null;
  gst_screenshot_attachment: SubmissionAttachmentSummary | null;
  gst_screenshot_uploaded_by_name: string | null;
  gst_screenshot_uploaded_at: string | null;
  gst_screenshot_access_summary: { employee: AttachmentAccessSummary | null; team_lead: AttachmentAccessSummary | null } | null;
};

type SubmissionCandidate = {
  id: string;
  submitted_by: string | null;
  assigned_to_user_id?: string | null;
  proforma_invoice: string | null;
  agency_brand_name: string | null;
  bill_due: string | null;
  intake_status: string | null;
  invoice_status: string | null;
  payment_received_status: string | null;
  creator_invoice_status: string | null;
  payment_made_status: string | null;
  closed: string | null;
  closure_status: string | null;
  submitted_at: string | null;
  is_latest_version: boolean | null;
};

type FollowUpRow = {
  id: string;
  submission_id: string;
  follow_up_type: FollowUpType;
  assigned_employee_id: string;
  assigned_team_lead_id: string | null;
  due_date: string;
  status: FollowUpStatus;
  completion_reason: string | null;
  completed_at: string | null;
  completed_by: string | null;
  last_notified_at: string | null;
  next_notification_at: string | null;
  created_at: string;
  updated_at: string;
};

const PAYMENT_PENDING_STATUSES = new Set(['pending', 'past_due', 'advance_past_due', 'partial_left', 'credit_note_issued']);
const GST_PENDING_STATUS = 'gst_left';
export const FOLLOW_UP_REMINDER_INTERVAL_DAYS = 7;

function normalizeStatus(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function normalizeBillDue(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

function startOfNextDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + 1);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function parseDueDate(submittedAt: string | null | undefined, billDue: string | null | undefined) {
  const base = submittedAt ? new Date(submittedAt) : new Date();
  const date = Number.isNaN(base.getTime()) ? new Date() : base;
  const due = normalizeBillDue(billDue);

  if (due.includes('net 5')) return addDays(date, 6);
  if (due.includes('net 10')) return addDays(date, 11);
  if (due.includes('net 15')) return addDays(date, 16);
  if (due.includes('net 20')) return addDays(date, 21);
  if (due.includes('net 25')) return addDays(date, 26);
  if (due.includes('net 30')) return addDays(date, 31);
  if (due.includes('net 45')) return addDays(date, 46);
  if (due.includes('net 60')) return addDays(date, 61);
  if (due.includes('net 90')) return addDays(date, 91);
  if (due.includes('due end of next month')) return endOfMonth(new Date(date.getFullYear(), date.getMonth() + 1, 1));
  if (due.includes('due end of month')) return endOfMonth(date);
  return startOfNextDay(date);
}

function isSubmissionClosedOrCancelled(submission: Pick<SubmissionCandidate, 'closed' | 'closure_status'>) {
  const closure = normalizeStatus(submission.closure_status ?? submission.closed);
  return closure === 'closed' || closure === 'cancelled' || closure === 'canceled';
}

function isPaymentOutstandingForBillDue(value: string | null | undefined) {
  if (!value) return true;
  return PAYMENT_PENDING_STATUSES.has(normalizeStatus(value));
}

// Additional business guard: invoice-cancelled submissions should not carry
// Bill Due follow-ups. Keep isolated so the guard is easy to remove later.
function isInvoiceCancelledForBillDue(submission: Pick<SubmissionCandidate, 'invoice_status'>) {
  return normalizeInvoiceStatusMachine(submission.invoice_status) === 'invoice_cancelled';
}

function needsPaymentReceivedFollowUp(submission: SubmissionCandidate) {
  if (normalizeStatus(submission.intake_status) !== 'accepted') return false;
  if (isSubmissionClosedOrCancelled(submission)) return false;
  if (isInvoiceCancelledForBillDue(submission)) return false;
  if (!isPaymentOutstandingForBillDue(submission.payment_received_status)) return false;
  return parseDueDate(submission.submitted_at, submission.bill_due).getTime() <= Date.now();
}

function needsGstFollowUp(submission: SubmissionCandidate) {
  if (isSubmissionClosedOrCancelled(submission)) return false;
  return normalizeStatus(submission.payment_received_status) === GST_PENDING_STATUS;
}

async function getPrimaryTeamLeadMap(adminClient: SupabaseClient, employeeIds: string[]) {
  if (employeeIds.length === 0) return new Map<string, string | null>();

  const { data, error } = await adminClient
    .from('team_lead_members')
    .select('employee_id, team_lead_id, created_at')
    .in('employee_id', employeeIds)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  const map = new Map<string, string | null>();
  for (const row of data ?? []) {
    const employeeId = String(row.employee_id ?? '');
    const teamLeadId = String(row.team_lead_id ?? '');
    if (!employeeId || !teamLeadId || map.has(employeeId)) continue;
    map.set(employeeId, teamLeadId);
  }

  return map;
}

async function getActiveUserMap(adminClient: SupabaseClient, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, { full_name?: string | null; email?: string | null; role?: string | null; business_line?: string | null }>();

  const { data, error } = await adminClient
    .from('users')
    .select('id, full_name, email, role, business_line')
    .in('id', userIds);

  if (error) throw new Error(error.message);

  return new Map((data ?? []).map((row) => [String(row.id), row]));
}

async function getLatestGstScreenshotMap(adminClient: SupabaseClient, submissionIds: string[]) {
  if (submissionIds.length === 0) return new Map<string, GstScreenshotAttachmentRow>();

  const { data, error } = await adminClient
    .from('submission_attachments')
    .select('id, submission_id, document_type, file_name, file_size_bytes, mime_type, uploaded_at, uploaded_by')
    .in('submission_id', submissionIds)
    .eq('document_type', GST_SCREENSHOT_DOCUMENT_TYPE)
    .order('uploaded_at', { ascending: false });

  if (error) throw new Error(error.message);

  const map = new Map<string, GstScreenshotAttachmentRow>();
  for (const row of (data ?? []) as GstScreenshotAttachmentRow[]) {
    const submissionId = String(row.submission_id ?? '');
    if (!submissionId || map.has(submissionId)) continue;
    map.set(submissionId, row);
  }
  return map;
}

async function sendDueFollowUpReminderNotifications(adminClient: SupabaseClient) {
  const { error } = await adminClient.rpc('send_due_follow_up_reminders', {
    p_interval_days: FOLLOW_UP_REMINDER_INTERVAL_DAYS,
  });

  if (error) throw new Error(error.message);
}

// Global backfill only. Re-reads and re-diffs every latest submission and
// every pending follow-up across several separate, non-transactional
// statements, so concurrent calls can interleave against stale snapshots
// (see reconcile_follow_ups_for_submission for the runtime-safe path). Do
// not call this from request-handling code (routes, polling, notifications,
// sidebar counts) - it must only run as a deliberate, manual/admin backfill.
export async function syncFollowUps(adminClient: SupabaseClient, completionActorUserId: string | null = null) {
  const { data: submissions, error: submissionsError } = await adminClient
    .from('intake_submissions')
    .select('id, submitted_by, assigned_to_user_id, proforma_invoice, agency_brand_name, bill_due, intake_status, invoice_status, payment_received_status, creator_invoice_status, payment_made_status, closed, closure_status, submitted_at, is_latest_version')
    .eq('is_latest_version', true);

  if (submissionsError) throw new Error(submissionsError.message);

  const candidates = (submissions ?? []) as SubmissionCandidate[];
  const employeeIds = Array.from(
    new Set(
      candidates
        .map((row) => String(row.assigned_to_user_id ?? row.submitted_by ?? ''))
        .filter(Boolean)
    )
  );
  const teamLeadMap = await getPrimaryTeamLeadMap(adminClient, employeeIds);

  const { data: existingRows, error: existingError } = await adminClient
    .from('follow_ups')
    .select('id, submission_id, follow_up_type, assigned_employee_id, assigned_team_lead_id, due_date, status, completion_reason, completed_at, completed_by, last_notified_at, next_notification_at, created_at, updated_at')
    .eq('status', 'pending');

  if (existingError) throw new Error(existingError.message);

  const existingByKey = new Map<string, FollowUpRow>();
  for (const row of (existingRows ?? []) as FollowUpRow[]) {
    const key = `${row.submission_id}:${row.follow_up_type}:${row.assigned_employee_id}:${row.assigned_team_lead_id ?? ''}`;
    existingByKey.set(key, row);
  }

  const desiredKeys = new Set<string>();
  const inserts: Array<Record<string, unknown>> = [];
  const nowIso = new Date().toISOString();

  for (const submission of candidates) {
    const assignedEmployeeId = String(submission.assigned_to_user_id ?? submission.submitted_by ?? '');
    if (!assignedEmployeeId) continue;

    const assignedTeamLeadId = teamLeadMap.get(assignedEmployeeId) ?? null;

    const desired: Array<{ type: FollowUpType; dueDate: Date }> = [];
    if (needsPaymentReceivedFollowUp(submission)) {
      desired.push({ type: 'payment_received_pending', dueDate: parseDueDate(submission.submitted_at, submission.bill_due) });
    }
    if (needsGstFollowUp(submission)) {
      desired.push({ type: 'gst_pending', dueDate: new Date() });
    }

    for (const item of desired) {
      const key = `${submission.id}:${item.type}:${assignedEmployeeId}:${assignedTeamLeadId ?? ''}`;
      desiredKeys.add(key);
      if (!existingByKey.has(key)) {
        inserts.push({
          submission_id: submission.id,
          follow_up_type: item.type,
          assigned_employee_id: assignedEmployeeId,
          assigned_team_lead_id: assignedTeamLeadId,
          due_date: item.dueDate.toISOString(),
          status: 'pending',
          last_notified_at: null,
          next_notification_at: nowIso,
          updated_at: nowIso,
        });
      }
    }
  }

  const toComplete = Array.from(existingByKey.entries()).filter(([key]) => !desiredKeys.has(key)).map(([, row]) => row.id);

  if (inserts.length > 0) {
    for (const insert of inserts) {
      const { error } = await adminClient.from('follow_ups').insert(insert);
      if (error && error.code !== '23505') throw new Error(error.message);
    }
  }

  if (toComplete.length > 0) {
    const { error } = await adminClient
      .from('follow_ups')
      .update({
        status: 'completed',
        completed_at: nowIso,
        completed_by: completionActorUserId,
        completion_reason: 'Current status no longer requires follow-up.',
        updated_at: nowIso,
      })
      .in('id', toComplete);

    if (error) throw new Error(error.message);
  }

  await sendDueFollowUpReminderNotifications(adminClient);
}

// Runtime-safe path: reconciles follow-ups for exactly one submission,
// atomically. Business-rule evaluation (needsPaymentReceivedFollowUp /
// needsGstFollowUp / parseDueDate / team lead lookup) is the same code
// syncFollowUps() uses - only the read-decide-write is delegated to
// reconcile_follow_ups_for_submission(), which runs as a single Postgres
// transaction and serializes concurrent calls for the same submission_id.
// This is what request-handling code (finance actions, etc.) must call
// instead of syncFollowUps().
export async function reconcileFollowUpsForSubmission(params: {
  adminClient: SupabaseClient;
  submissionId: string;
  completionActorUserId?: string | null;
}) {
  const { adminClient, submissionId, completionActorUserId = null } = params;

  const { data: submission, error: submissionError } = await adminClient
    .from('intake_submissions')
    .select('id, submitted_by, assigned_to_user_id, proforma_invoice, agency_brand_name, bill_due, intake_status, invoice_status, payment_received_status, creator_invoice_status, payment_made_status, closed, closure_status, submitted_at, is_latest_version')
    .eq('id', submissionId)
    .maybeSingle();

  if (submissionError) throw new Error(submissionError.message);
  if (!submission) return { created: 0, updated: 0, completed: 0 };

  const candidate = submission as SubmissionCandidate;
  const assignedEmployeeId = String(candidate.assigned_to_user_id ?? candidate.submitted_by ?? '');
  if (!assignedEmployeeId) return { created: 0, updated: 0, completed: 0 };

  const teamLeadMap = await getPrimaryTeamLeadMap(adminClient, [assignedEmployeeId]);
  const assignedTeamLeadId = teamLeadMap.get(assignedEmployeeId) ?? null;

  const desired: Array<{
    follow_up_type: FollowUpType;
    due_date: string;
    assigned_employee_id: string;
    assigned_team_lead_id: string | null;
  }> = [];

  if (needsPaymentReceivedFollowUp(candidate)) {
    desired.push({
      follow_up_type: 'payment_received_pending',
      due_date: parseDueDate(candidate.submitted_at, candidate.bill_due).toISOString(),
      assigned_employee_id: assignedEmployeeId,
      assigned_team_lead_id: assignedTeamLeadId,
    });
  }
  if (needsGstFollowUp(candidate)) {
    desired.push({
      follow_up_type: 'gst_pending',
      due_date: new Date().toISOString(),
      assigned_employee_id: assignedEmployeeId,
      assigned_team_lead_id: assignedTeamLeadId,
    });
  }

  const { data, error } = await adminClient.rpc('reconcile_follow_ups_for_submission', {
    p_submission_id: submissionId,
    p_desired: desired,
    p_completed_by: completionActorUserId,
  });

  if (error) throw new Error(error.message);

  const result = (Array.isArray(data) ? data[0] : data) as
    | { created_count: number; updated_count: number; completed_count: number }
    | undefined;

  return {
    created: result?.created_count ?? 0,
    updated: result?.updated_count ?? 0,
    completed: result?.completed_count ?? 0,
  };
}

export async function listFollowUpsForUser(params: {
  adminClient: SupabaseClient;
  appUser: AppUser;
  query?: string;
  status?: FollowUpStatus | 'all';
  type?: FollowUpType | 'all';
  screenshot?: 'all' | 'missing' | 'uploaded';
}) {
  const { adminClient, appUser, query = '', status = 'all', type = 'all', screenshot = 'all' } = params;

  

  let followUpsQuery = adminClient
    .from('follow_ups')
    .select('id, submission_id, follow_up_type, assigned_employee_id, assigned_team_lead_id, due_date, status, completion_reason, completed_at, completed_by, last_notified_at, next_notification_at, created_at, updated_at')
    .order('due_date', { ascending: false });

  if (status !== 'all') followUpsQuery = followUpsQuery.eq('status', status);
  if (type !== 'all') followUpsQuery = followUpsQuery.eq('follow_up_type', type);
  if (appUser.role === 'employee') {
    followUpsQuery = followUpsQuery.eq('assigned_employee_id', appUser.id);
  } else if (appUser.role === 'team_lead') {
    followUpsQuery = followUpsQuery.or(`assigned_team_lead_id.eq.${appUser.id},assigned_employee_id.eq.${appUser.id}`);
  }

  const { data, error } = await followUpsQuery;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as FollowUpRow[];
  if (rows.length === 0) return [] as FollowUpListItem[];

  const submissionIds = Array.from(new Set(rows.map((row) => row.submission_id)));

  // gstScreenshotMap and submissionsRes both depend only on submissionIds
  // (not on each other), so run them concurrently. userMap still has to wait
  // for gstScreenshotMap because its uploader ids feed into the requested
  // user id set below.
  const [gstScreenshotMap, submissionsRes] = await Promise.all([
    getLatestGstScreenshotMap(adminClient, submissionIds),
    adminClient
      .from('intake_submissions')
      .select('id, proforma_invoice, agency_brand_name, bill_due, intake_status, invoice_status, payment_received_status, creator_invoice_status, payment_made_status, closure_status, submitted_at')
      .in('id', submissionIds),
  ]);

  if (submissionsRes.error) throw new Error(submissionsRes.error.message);

  const userIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.assigned_employee_id, row.assigned_team_lead_id, row.completed_by, gstScreenshotMap.get(row.submission_id)?.uploaded_by])
        .filter(Boolean)
    )
  ) as string[];

  const userMap = await getActiveUserMap(adminClient, userIds);

  const submissionMap = new Map((submissionsRes.data ?? []).map((row) => [String(row.id), row]));
  const normalizedQuery = query.trim().toLowerCase();

  // One batched query for every GST attachment's access history, instead of a
  // query per row. Visibility of the result (below) still follows the same
  // finance/admin/developer-or-assigned-team-lead rule the dedicated audit
  // endpoint previously enforced.
  const isPrivilegedViewer = ['finance', 'admin', 'developer'].includes(appUser.role);
  const accessAuditActors: AttachmentAccessActor[] = [];
  for (const row of rows) {
    if (row.follow_up_type !== 'gst_pending') continue;
    const gstAttachment = gstScreenshotMap.get(row.submission_id);
    if (!gstAttachment) continue;
    const employee = userMap.get(row.assigned_employee_id);
    accessAuditActors.push({
      attachmentId: gstAttachment.id,
      role: 'employee',
      userId: row.assigned_employee_id,
      name: employee?.full_name ?? null,
      businessLine: employee?.business_line ?? null,
    });
    if (row.assigned_team_lead_id) {
      const teamLead = userMap.get(row.assigned_team_lead_id);
      accessAuditActors.push({
        attachmentId: gstAttachment.id,
        role: 'team_lead',
        userId: row.assigned_team_lead_id,
        name: teamLead?.full_name ?? null,
        businessLine: teamLead?.business_line ?? null,
      });
    }
  }
  const accessSummaryMap = await getAttachmentAccessSummaryMap({ adminClient, actors: accessAuditActors });

  return rows
    .map((row) => {
      const submission = submissionMap.get(row.submission_id);
      const employee = userMap.get(row.assigned_employee_id);
      const teamLead = row.assigned_team_lead_id ? userMap.get(row.assigned_team_lead_id) : null;
      const completedBy = row.completed_by ? userMap.get(row.completed_by) : null;
      const gstAttachment = gstScreenshotMap.get(row.submission_id) ?? null;
      const gstUploader = gstAttachment?.uploaded_by ? userMap.get(gstAttachment.uploaded_by) : null;
      const canViewAccessSummary = isPrivilegedViewer || (appUser.role === 'team_lead' && row.assigned_team_lead_id === appUser.id);
      const gstAccessSummary = canViewAccessSummary && gstAttachment
        ? {
            employee: accessSummaryMap.get(`${gstAttachment.id}:employee`) ?? null,
            team_lead: row.assigned_team_lead_id ? accessSummaryMap.get(`${gstAttachment.id}:team_lead`) ?? null : null,
          }
        : null;
      return {
        ...row,
        assigned_employee_name: employee?.full_name ?? null,
        assigned_employee_email: employee?.email ?? null,
        assigned_team_lead_name: teamLead?.full_name ?? null,
        completed_by_name: completedBy?.full_name ?? null,
        proforma_invoice: submission?.proforma_invoice ? String(submission.proforma_invoice) : null,
        agency_brand_name: submission?.agency_brand_name ?? null,
        bill_due: submission?.bill_due ?? null,
        intake_status: submission?.intake_status ?? null,
        invoice_status: submission?.invoice_status ?? null,
        payment_received_status: submission?.payment_received_status ?? null,
        creator_invoice_status: submission?.creator_invoice_status ?? null,
        payment_made_status: submission?.payment_made_status ?? null,
        closure_status: submission?.closure_status ?? null,
        submitted_at: submission?.submitted_at ?? null,
        gst_screenshot_attachment: gstAttachment
          ? {
              id: gstAttachment.id,
              document_type: gstAttachment.document_type,
              file_name: gstAttachment.file_name,
              file_size_bytes: gstAttachment.file_size_bytes,
              mime_type: gstAttachment.mime_type,
              uploaded_at: gstAttachment.uploaded_at ?? null,
            }
          : null,
        gst_screenshot_uploaded_by_name: gstUploader?.full_name ?? null,
        gst_screenshot_uploaded_at: gstAttachment?.uploaded_at ?? null,
        gst_screenshot_access_summary: gstAccessSummary,
      } satisfies FollowUpListItem;
    })
    .filter((item) => {
      if (!normalizedQuery) return true;
      const haystack = [
        item.proforma_invoice,
        item.agency_brand_name,
        item.assigned_employee_name,
        item.assigned_employee_email,
        item.assigned_team_lead_name,
        item.follow_up_type,
        item.gst_screenshot_attachment?.file_name,
      ].map((value) => String(value || '').toLowerCase()).join(' ');
      return haystack.includes(normalizedQuery);
    })
    .filter((item) => {
      if (screenshot === 'all') return true;
      if (item.follow_up_type !== 'gst_pending') return false;
      return screenshot === 'missing' ? !item.gst_screenshot_attachment : Boolean(item.gst_screenshot_attachment);
    });
}

export async function countPendingFollowUpsForUser(params: {
  adminClient: SupabaseClient;
  appUser: AppUser;
}) {
  const { adminClient, appUser } = params;

  let query = adminClient
    .from('follow_ups')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lte('due_date', new Date().toISOString());

  if (appUser.role === 'employee') {
    query = query.eq('assigned_employee_id', appUser.id);
  } else if (appUser.role === 'team_lead') {
    query = query.eq('assigned_team_lead_id', appUser.id);
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// Read-only count for the Finance/Admin monthly GST banner. Does not sync or
// mutate follow_ups, and does not run the full listFollowUpsForUser row
// pipeline (access-audit joins, submission joins) - it only needs a number.
export async function countPendingGstScreenshotMissingFollowUps(params: {
  adminClient: SupabaseClient;
}) {
  const { adminClient } = params;

  const { data: rows, error } = await adminClient
    .from('follow_ups')
    .select('id, submission_id')
    .eq('status', 'pending')
    .eq('follow_up_type', 'gst_pending');

  if (error) throw new Error(error.message);

  const followUpRows = (rows ?? []) as Array<{ id: string; submission_id: string }>;
  if (followUpRows.length === 0) return 0;

  const submissionIds = Array.from(new Set(followUpRows.map((row) => String(row.submission_id))));

  const { data: attachmentRows, error: attachmentError } = await adminClient
    .from('submission_attachments')
    .select('submission_id')
    .eq('document_type', GST_SCREENSHOT_DOCUMENT_TYPE)
    .in('submission_id', submissionIds);

  if (attachmentError) throw new Error(attachmentError.message);

  const uploadedSubmissionIds = new Set((attachmentRows ?? []).map((row) => String(row.submission_id)));
  return followUpRows.filter((row) => !uploadedSubmissionIds.has(String(row.submission_id))).length;
}
