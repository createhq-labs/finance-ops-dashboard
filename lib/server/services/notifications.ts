import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole, AppUser } from '../types/submissions';

type NotificationType =
  | 'new_submission'
  | 'pending_master_data_review'
  | 'resubmitted_form'
  | 'finance_action_pending'
  | 'submission_rejected'
  | 'resubmission_requested'
  | 'invoice_updated';

type NotificationInsert = {
  user_id: string;
  role_target: AppRole | null;
  type: NotificationType;
  title: string;
  message: string;
  related_submission_id: string | null;
  related_review_id: string | null;
  target_path: string;
  is_read?: boolean;
};

type MasterReviewSummary = {
  id: string;
  type: 'agency' | 'brand' | 'creator';
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

export async function createNotifications(adminClient: SupabaseClient, inserts: NotificationInsert[]) {
  if (inserts.length === 0) return { success: true as const, created: 0 };

  const { error } = await adminClient.from('notifications').insert(inserts);
  if (error) {
    return { success: false as const, created: 0, error: error.message };
  }

  return { success: true as const, created: inserts.length };
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
  if (recipients.length === 0) return { success: true as const, created: 0 };

  const targetPath = `/dashboard/finance?submission_id=${submissionId}${isResubmission ? '&context=resubmission' : '&context=new_submission'}`;
  const primaryType: NotificationType = isResubmission ? 'resubmitted_form' : 'new_submission';
  const primaryTitle = isResubmission ? 'Resubmitted submission received' : 'New submission received';
  const primaryMessage = `${piNumber} for ${entityName} was submitted by ${appUser.email}.`;

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
      message: `Review is pending for ${piNumber}.`,
      related_submission_id: submissionId,
      related_review_id: null,
      target_path: targetPath,
    });
  }

  return createNotifications(adminClient, inserts);
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
    const targetPath = `/dashboard/finance?tab=master-data&review_id=${review.id}&submission_id=${submissionId}`;
    const title = `${review.type[0].toUpperCase()}${review.type.slice(1)} master review pending`;
    const message = `"${review.submitted_value}" needs finance/admin approval before it becomes a reusable dropdown value.`;

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

export async function createEmployeeNotification(params: {
  adminClient: SupabaseClient;
  submittedBy: string;
  type: Extract<NotificationType, 'submission_rejected' | 'resubmission_requested' | 'invoice_updated'>;
  title: string;
  message: string;
  relatedSubmissionId: string;
}) {
  const { adminClient, submittedBy, type, title, message, relatedSubmissionId } = params;
  return createNotifications(adminClient, [
    {
      user_id: submittedBy,
      role_target: 'employee',
      type,
      title,
      message,
      related_submission_id: relatedSubmissionId,
      related_review_id: null,
      target_path: `/dashboard/submissions?submission_id=${relatedSubmissionId}`,
    },
  ]);
}

export function summarizeCreatedReviews(createdReviews: MasterReviewSummary[]) {
  return uniqueStrings(createdReviews.map((review) => `${review.type}:${review.submitted_value}`));
}
