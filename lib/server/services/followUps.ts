import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubmissionAttachmentSummary } from '../../shared/submission-attachments';
import { GST_SCREENSHOT_DOCUMENT_TYPE } from '../../shared/submission-attachments';
import type { AppUser } from '../types/submissions';
import { createNotifications } from './notifications';
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
  payment_received_status: string | null;
  creator_invoice_status: string | null;
  payment_made_status: string | null;
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

const PAYMENT_PENDING_STATUSES = new Set(['pending', 'not_received', 'past_due', 'advance_past_due', 'partial_left']);
const GST_PENDING_STATUS = 'gst_left';
const FOLLOW_UP_NOTIFICATION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const GST_FINANCE_REMINDER_DAYS = new Set([13, 14, 15]);

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

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
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

function needsPaymentReceivedFollowUp(submission: SubmissionCandidate) {
  const normalized = normalizeStatus(submission.payment_received_status);
  if (!PAYMENT_PENDING_STATUSES.has(normalized)) return false;
  return parseDueDate(submission.submitted_at, submission.bill_due).getTime() <= Date.now();
}

function needsGstFollowUp(submission: SubmissionCandidate) {
  return normalizeStatus(submission.payment_received_status) === GST_PENDING_STATUS;
}

function getEmployeeFollowUpLabel(type: FollowUpType) {
  return type === 'payment_received_pending' ? 'Bill Due follow-up pending' : 'GST follow-up pending';
}

function getEmployeeFollowUpMessage(type: FollowUpType, piLabel: string, entityLabel: string) {
  return type === 'payment_received_pending'
    ? `${piLabel} for ${entityLabel} is overdue for bill due follow-up.`
    : `${piLabel} for ${entityLabel} still needs GST follow-up.`;
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

async function getActiveFinanceAndAdminUsers(adminClient: SupabaseClient) {
  const { data, error } = await adminClient
    .from('users')
    .select('id, role')
    .in('role', ['finance', 'admin'])
    .eq('status', 'active');

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: String(row.id), role: String(row.role) as AppUser['role'] }));
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

async function sendFinanceGstScreenshotReminders(params: {
  adminClient: SupabaseClient;
  followUps: FollowUpRow[];
  submissionMetaById: Map<string, { proforma_invoice?: string | null; agency_brand_name?: string | null }>;
  gstScreenshotMap: Map<string, GstScreenshotAttachmentRow>;
}) {
  const { adminClient, followUps, submissionMetaById, gstScreenshotMap } = params;
  const today = new Date();
  if (!GST_FINANCE_REMINDER_DAYS.has(today.getDate())) return;

  const gstRows = followUps.filter((row) => row.follow_up_type === 'gst_pending' && !gstScreenshotMap.has(row.submission_id));
  if (gstRows.length === 0) return;

  const recipients = await getActiveFinanceAndAdminUsers(adminClient);
  if (recipients.length === 0) return;

  const startTodayIso = startOfDay(today).toISOString();
  const submissionIds = Array.from(new Set(gstRows.map((row) => row.submission_id)));
  const userIds = recipients.map((recipient) => recipient.id);

  const { data: existingRows, error: existingError } = await adminClient
    .from('notifications')
    .select('user_id, related_submission_id, target_path, title, created_at')
    .eq('type', 'follow_up_pending')
    .in('user_id', userIds)
    .in('related_submission_id', submissionIds)
    .gte('created_at', startTodayIso)
    .eq('title', 'GST screenshot upload pending');

  if (existingError) throw new Error(existingError.message);

  const existingKeys = new Set(
    ((existingRows ?? []) as Array<{ user_id: string | null; related_submission_id: string | null; target_path: string | null }>).map(
      (row) => `${String(row.user_id ?? '')}:${String(row.related_submission_id ?? '')}:${String(row.target_path ?? '')}`
    )
  );

  const inserts: Array<{
    user_id: string;
    role_target: AppUser['role'];
    type: 'follow_up_pending';
    title: string;
    message: string;
    related_submission_id: string;
    related_review_id: null;
    target_path: string;
  }> = [];

  for (const row of gstRows) {
    const submission = submissionMetaById.get(row.submission_id);
    const piLabel = String(submission?.proforma_invoice || 'No PI Required');
    const entityLabel = String(submission?.agency_brand_name || 'submission');
    const targetPath = `/dashboard/follow-ups?submission_id=${row.submission_id}&context=gst-screenshot`;

    for (const recipient of recipients) {
      const key = `${recipient.id}:${row.submission_id}:${targetPath}`;
      if (existingKeys.has(key)) continue;
      inserts.push({
        user_id: recipient.id,
        role_target: recipient.role,
        type: 'follow_up_pending',
        title: 'GST screenshot upload pending',
        message: `${piLabel} for ${entityLabel} still needs a GST screenshot upload.`,
        related_submission_id: row.submission_id,
        related_review_id: null,
        target_path: targetPath,
      });
    }
  }

  if (inserts.length > 0) {
    await createNotifications(adminClient, inserts);
  }
}

export async function syncFollowUps(adminClient: SupabaseClient, completionActorUserId: string | null = null) {
  const { data: submissions, error: submissionsError } = await adminClient
    .from('intake_submissions')
    .select('id, submitted_by, assigned_to_user_id, proforma_invoice, agency_brand_name, bill_due, payment_received_status, creator_invoice_status, payment_made_status, closure_status, submitted_at, is_latest_version')
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
    const { error } = await adminClient.from('follow_ups').insert(inserts);
    if (error && error.code != '23505') throw new Error(error.message);
  }

  if (toComplete.length > 0) {
    const { error } = await adminClient
      .from('follow_ups')
      .update({
        status: 'completed',
        completed_at: nowIso,
        completed_by: completionActorUserId,
        completion_reason: 'Required action completed automatically from current workflow status.',
        updated_at: nowIso,
      })
      .in('id', toComplete);

    if (error) throw new Error(error.message);
  }

  const { data: notifyRows, error: notifyError } = await adminClient
    .from('follow_ups')
    .select('id, submission_id, follow_up_type, assigned_employee_id, assigned_team_lead_id, due_date, status, completion_reason, completed_at, completed_by, last_notified_at, next_notification_at, created_at, updated_at, intake_submissions!inner(proforma_invoice, agency_brand_name)')
    .eq('status', 'pending')
    .or(`next_notification_at.is.null,next_notification_at.lte.${new Date().toISOString()}`);

  if (notifyError) throw new Error(notifyError.message);

  const pendingRows = (notifyRows ?? []) as Array<FollowUpRow & { intake_submissions?: { proforma_invoice?: string | null; agency_brand_name?: string | null } | null }>;
  const notifications: Array<{
    user_id: string;
    role_target: AppUser['role'];
    type: 'follow_up_pending';
    title: string;
    message: string;
    related_submission_id: string;
    related_review_id: null;
    target_path: string;
  }> = [];
  const notifiedIds: string[] = [];

  for (const row of pendingRows) {
    const piLabel = String(row.intake_submissions?.proforma_invoice || 'No PI Required');
    const entityLabel = String(row.intake_submissions?.agency_brand_name || 'submission');
    const title = getEmployeeFollowUpLabel(row.follow_up_type);
    const message = getEmployeeFollowUpMessage(row.follow_up_type, piLabel, entityLabel);

    notifications.push({
      user_id: row.assigned_employee_id,
      role_target: 'employee',
      type: 'follow_up_pending',
      title,
      message,
      related_submission_id: row.submission_id,
      related_review_id: null,
      target_path: `/dashboard/follow-ups?submission_id=${row.submission_id}`,
    });
    if (row.assigned_team_lead_id) {
      notifications.push({
        user_id: row.assigned_team_lead_id,
        role_target: 'team_lead',
        type: 'follow_up_pending',
        title,
        message,
        related_submission_id: row.submission_id,
        related_review_id: null,
        target_path: `/dashboard/follow-ups?submission_id=${row.submission_id}`,
      });
    }
    notifiedIds.push(row.id);
  }

  if (notifications.length > 0) {
    await createNotifications(adminClient, notifications);
    const nextAt = new Date(Date.now() + FOLLOW_UP_NOTIFICATION_INTERVAL_MS).toISOString();
    const { error } = await adminClient
      .from('follow_ups')
      .update({
        last_notified_at: nowIso,
        next_notification_at: nextAt,
        updated_at: nowIso,
      })
      .in('id', notifiedIds);
    if (error) throw new Error(error.message);
  }

  const { data: financeReminderRows, error: financeReminderError } = await adminClient
    .from('follow_ups')
    .select('id, submission_id, follow_up_type, assigned_employee_id, assigned_team_lead_id, due_date, status, completion_reason, completed_at, completed_by, last_notified_at, next_notification_at, created_at, updated_at, intake_submissions!inner(proforma_invoice, agency_brand_name)')
    .eq('status', 'pending')
    .eq('follow_up_type', 'gst_pending');

  if (financeReminderError) throw new Error(financeReminderError.message);

  const activeGstRows = (financeReminderRows ?? []) as Array<FollowUpRow & { intake_submissions?: { proforma_invoice?: string | null; agency_brand_name?: string | null } | null }>;
  const pendingSubmissionIds = Array.from(new Set(activeGstRows.map((row) => row.submission_id)));
  const gstScreenshotMap = await getLatestGstScreenshotMap(adminClient, pendingSubmissionIds);
  const submissionMetaById = new Map<string, { proforma_invoice?: string | null; agency_brand_name?: string | null }>();
  for (const row of activeGstRows) {
    submissionMetaById.set(row.submission_id, {
      proforma_invoice: row.intake_submissions?.proforma_invoice ?? null,
      agency_brand_name: row.intake_submissions?.agency_brand_name ?? null,
    });
  }
  await sendFinanceGstScreenshotReminders({
    adminClient,
    followUps: activeGstRows,
    submissionMetaById,
    gstScreenshotMap,
  });
}

export async function listFollowUpsForUser(params: {
  adminClient: SupabaseClient;
  appUser: AppUser;
  query?: string;
  status?: FollowUpStatus | 'all';
  type?: FollowUpType | 'all';
}) {
  const { adminClient, appUser, query = '', status = 'all', type = 'all' } = params;

  await syncFollowUps(adminClient);

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
  const gstScreenshotMap = await getLatestGstScreenshotMap(adminClient, submissionIds);
  const userIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.assigned_employee_id, row.assigned_team_lead_id, row.completed_by, gstScreenshotMap.get(row.submission_id)?.uploaded_by])
        .filter(Boolean)
    )
  ) as string[];

  const [submissionsRes, userMap] = await Promise.all([
    adminClient
      .from('intake_submissions')
      .select('id, proforma_invoice, agency_brand_name, bill_due, payment_received_status, creator_invoice_status, payment_made_status, closure_status, submitted_at')
      .in('id', submissionIds),
    getActiveUserMap(adminClient, userIds),
  ]);

  if (submissionsRes.error) throw new Error(submissionsRes.error.message);

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
    });
}
