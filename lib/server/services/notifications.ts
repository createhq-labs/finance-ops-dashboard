import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole, AppUser } from '../types/submissions';

type NotificationType =
  | 'new_submission'
  | 'pending_master_data_review'
  | 'resubmitted_form'
  | 'finance_action_pending'
  | 'submission_rejected'
  | 'resubmission_requested'
  | 'submission_reopened'
  | 'invoice_updated'
  | 'follow_up_pending';

type NotificationInsert = {
  user_id: string;
  role_target: AppRole | null;
  type: NotificationType;
  title: string;
  message: string;
  related_submission_id: string | null;
  related_review_id: string | null;
  audit_log_id?: string | null;
  target_path: string;
  is_read?: boolean;
};

type MasterReviewSummary = {
  id: string;
  type: 'agency' | 'brand' | 'creator' | 'agency_gst_address' | 'brand_gst_address';
  submitted_value: string;
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}

async function getActiveUsersByRoles(adminClient: SupabaseClient, roles: AppRole[], excludeUserIds: string[] = []) {
  const { data, error } = await adminClient
    .from('users')
    .select('id, role, status')
    .in('role', roles)
    .eq('status', 'active');

  if (error) throw new Error(error.message);

  return (data ?? []).filter((row) => !excludeUserIds.includes(String(row.id)));
}

async function getActiveMappedTeamLeadIdsForEmployee(adminClient: SupabaseClient, employeeId: string) {
  if (!employeeId) return [] as string[];

  const { data: mappings, error: mappingsError } = await adminClient
    .from('team_lead_members')
    .select('team_lead_id')
    .eq('employee_id', employeeId);

  if (mappingsError) throw new Error(mappingsError.message);

  const leadIds = uniqueStrings((mappings ?? []).map((mapping) => String(mapping.team_lead_id ?? '')));
  if (leadIds.length === 0) return [] as string[];

  const { data: leads, error: leadsError } = await adminClient
    .from('users')
    .select('id')
    .in('id', leadIds)
    .eq('role', 'team_lead')
    .eq('status', 'active');

  if (leadsError) throw new Error(leadsError.message);

  return uniqueStrings((leads ?? []).map((lead) => String(lead.id ?? '')));
}

export async function createNotifications(adminClient: SupabaseClient, inserts: NotificationInsert[]) {
  if (inserts.length === 0) return { success: true as const, created: 0 };

  const deduped = inserts.filter((insert, index, all) => {
    const key = [insert.user_id, insert.type, insert.related_submission_id ?? '', insert.related_review_id ?? '', insert.target_path].join('::');
    return all.findIndex((candidate) => [candidate.user_id, candidate.type, candidate.related_submission_id ?? '', candidate.related_review_id ?? '', candidate.target_path].join('::') === key) === index;
  });

  const { error } = await adminClient.from('notifications').insert(deduped);
  if (error) {
    return { success: false as const, created: 0, error: error.message };
  }

  return { success: true as const, created: deduped.length };
}

export async function createFinanceAndAdminSubmissionNotifications(params: {
  adminClient: SupabaseClient;
  appUser: AppUser;
  submissionId: string;
  piNumber: string;
  entityName: string;
  isResubmission: boolean;
}) {
  const { adminClient, appUser, submissionId, piNumber, entityName, isResubmission } = params;
  const recipients = await getActiveUsersByRoles(adminClient, ['finance', 'admin'], [appUser.id]);
  const targetPath = '/dashboard/finance?submission_id=' + submissionId + (isResubmission ? '&context=resubmission' : '&context=new_submission');
  const primaryType: NotificationType = isResubmission ? 'resubmitted_form' : 'new_submission';
  const primaryTitle = isResubmission ? 'Resubmitted submission received' : 'New submission received';
  const primaryMessage = piNumber + ' for ' + entityName + ' was submitted by ' + appUser.email + '.';

  const inserts: NotificationInsert[] = [];
  for (const recipient of recipients) {
    const roleTarget = recipient.role as AppRole;
    inserts.push({
      user_id: String(recipient.id),
      role_target: roleTarget,
      type: primaryType,
      title: primaryTitle,
      message: primaryMessage,
      related_submission_id: submissionId,
      related_review_id: null,
      target_path: targetPath,
    });
    inserts.push({
      user_id: String(recipient.id),
      role_target: roleTarget,
      type: 'finance_action_pending',
      title: 'Finance action pending',
      message: 'Review is pending for ' + piNumber + '.',
      related_submission_id: submissionId,
      related_review_id: null,
      target_path: targetPath,
    });
  }

  const teamLeadIds = await getActiveMappedTeamLeadIdsForEmployee(adminClient, appUser.id);
  for (const teamLeadId of teamLeadIds) {
    inserts.push({
      user_id: teamLeadId,
      role_target: 'team_lead',
      type: primaryType,
      title: primaryTitle,
      message: primaryMessage,
      related_submission_id: submissionId,
      related_review_id: null,
      target_path: '/dashboard/team-submissions?submission_id=' + submissionId,
    });
  }

  return createNotifications(adminClient, inserts);
}

function getMasterReviewTitle(type: MasterReviewSummary['type']) {
  if (type === 'agency_gst_address') return 'Agency GST review pending';
  if (type === 'brand_gst_address') return 'Brand GST review pending';
  if (type === 'agency') return 'Agency master review pending';
  if (type === 'brand') return 'Brand master review pending';
  return 'Creator master review pending';
}

function getMasterReviewMessage(review: MasterReviewSummary) {
  if (review.type === 'agency_gst_address' || review.type === 'brand_gst_address') {
    return `GST and address mapping for "${review.submitted_value}" needs finance/admin approval before it becomes reusable.`;
  }
  return '"' + review.submitted_value + '" needs finance/admin approval before it becomes a reusable dropdown value.';
}

export async function createPendingMasterReviewNotifications(params: {
  adminClient: SupabaseClient;
  appUser: AppUser;
  submissionId: string;
  createdReviews: MasterReviewSummary[];
}) {
  const { adminClient, appUser, submissionId, createdReviews } = params;
  if (createdReviews.length === 0) return { success: true as const, created: 0 };

  const recipients = await getActiveUsersByRoles(adminClient, ['finance', 'admin'], [appUser.id]);
  if (recipients.length === 0) return { success: true as const, created: 0 };

  const inserts: NotificationInsert[] = [];
  for (const review of createdReviews) {
    const targetPath = '/dashboard/master-data?review_id=' + review.id;
    const title = getMasterReviewTitle(review.type);
    const message = getMasterReviewMessage(review);

    for (const recipient of recipients) {
      inserts.push({
        user_id: String(recipient.id),
        role_target: recipient.role as AppRole,
        type: 'pending_master_data_review',
        title,
        message,
        related_submission_id: submissionId,
        related_review_id: review.id,
        target_path: targetPath,
      });
    }
  }

  return createNotifications(adminClient, inserts);
}

async function upsertResubmissionRequestedNotifications(params: {
  adminClient: SupabaseClient;
  inserts: NotificationInsert[];
}) {
  const { adminClient, inserts } = params;
  if (inserts.length === 0) return { success: true as const, created: 0 };

  const userIds = uniqueStrings(inserts.map((insert) => insert.user_id));
  const relatedSubmissionId = inserts[0]?.related_submission_id ?? null;
  if (!relatedSubmissionId || userIds.length === 0) {
    return createNotifications(adminClient, inserts);
  }

  const { data: existingRows, error: existingError } = await adminClient
    .from('notifications')
    .select('id, user_id')
    .eq('type', 'resubmission_requested')
    .eq('related_submission_id', relatedSubmissionId)
    .in('user_id', userIds);

  if (existingError) {
    return { success: false as const, created: 0, error: existingError.message };
  }

  const existingByUserId = new Map(
    ((existingRows ?? []) as Array<{ id: string; user_id: string | null }>).map((row) => [String(row.user_id ?? ''), String(row.id)])
  );

  const updates = inserts.filter((insert) => existingByUserId.has(insert.user_id));
  const creates = inserts.filter((insert) => !existingByUserId.has(insert.user_id));

  if (updates.length > 0) {
    const updateResults = await Promise.all(
      updates.map((insert) =>
        adminClient
          .from('notifications')
          .update({
            title: insert.title,
            message: insert.message,
            target_path: insert.target_path,
            audit_log_id: insert.audit_log_id ?? null,
            is_read: false,
          })
          .eq('id', existingByUserId.get(insert.user_id)!)
      )
    );

    const failed = updateResults.find((result) => result.error);
    if (failed?.error) {
      return { success: false as const, created: 0, error: failed.error.message };
    }
  }

  const created = await createNotifications(adminClient, creates);
  if (!created.success) return created;

  return { success: true as const, created: updates.length + created.created };
}

export async function createEmployeeNotification(params: {
  adminClient: SupabaseClient;
  submittedBy: string;
  type: Extract<NotificationType, 'submission_rejected' | 'resubmission_requested' | 'submission_reopened' | 'invoice_updated' | 'follow_up_pending'>;
  title: string;
  message: string;
  relatedSubmissionId: string;
  auditLogId?: string | null;
  targetPath?: string;
}) {
  const { adminClient, submittedBy, type, title, message, relatedSubmissionId, auditLogId, targetPath } = params;
  const teamLeadIds = await getActiveMappedTeamLeadIdsForEmployee(adminClient, submittedBy);

  const employeeTargetPath = targetPath ?? '/dashboard/submissions?submission_id=' + relatedSubmissionId;
  const teamLeadTargetPath = targetPath ?? '/dashboard/team-submissions?submission_id=' + relatedSubmissionId;

  const inserts: NotificationInsert[] = [
    {
      user_id: submittedBy,
      role_target: 'employee',
      type,
      title,
      message,
      related_submission_id: relatedSubmissionId,
      related_review_id: null,
      audit_log_id: auditLogId ?? null,
      target_path: employeeTargetPath,
    },
  ];

  for (const teamLeadId of teamLeadIds) {
    inserts.push({
      user_id: teamLeadId,
      role_target: 'team_lead',
      type,
      title,
      message,
      related_submission_id: relatedSubmissionId,
      related_review_id: null,
      audit_log_id: auditLogId ?? null,
      target_path: teamLeadTargetPath,
    });
  }

  if (type === 'resubmission_requested') {
    return upsertResubmissionRequestedNotifications({ adminClient, inserts });
  }

  return createNotifications(adminClient, inserts);
}

export async function createSubmissionReopenedNotifications(params: {
  adminClient: SupabaseClient;
  actorUserId: string;
  submittedBy: string;
  title: string;
  message: string;
  relatedSubmissionId: string;
  auditLogId?: string | null;
}) {
  const { adminClient, actorUserId, submittedBy, title, message, relatedSubmissionId, auditLogId } = params;
  const inserts: NotificationInsert[] = [];

  const dashboardRecipients = await getActiveUsersByRoles(adminClient, ['finance', 'admin']);
  for (const recipient of dashboardRecipients) {
    inserts.push({
      user_id: String(recipient.id),
      role_target: recipient.role as AppRole,
      type: 'submission_reopened',
      title,
      message,
      related_submission_id: relatedSubmissionId,
      related_review_id: null,
      audit_log_id: auditLogId ?? null,
      target_path: '/dashboard/finance?submission_id=' + relatedSubmissionId,
    });
  }

  inserts.push({
    user_id: submittedBy,
    role_target: 'employee',
    type: 'submission_reopened',
    title,
    message,
    related_submission_id: relatedSubmissionId,
    related_review_id: null,
    audit_log_id: auditLogId ?? null,
    target_path: '/dashboard/submissions?submission_id=' + relatedSubmissionId,
  });

  const teamLeadIds = await getActiveMappedTeamLeadIdsForEmployee(adminClient, submittedBy);
  for (const teamLeadId of teamLeadIds) {
    if (teamLeadId === actorUserId) continue;
    inserts.push({
      user_id: teamLeadId,
      role_target: 'team_lead',
      type: 'submission_reopened',
      title,
      message,
      related_submission_id: relatedSubmissionId,
      related_review_id: null,
      audit_log_id: auditLogId ?? null,
      target_path: '/dashboard/team-submissions?submission_id=' + relatedSubmissionId,
    });
  }

  return createNotifications(adminClient, inserts);
}
