export type NotificationRow = {
  id: string;
  role_target: string | null;
  type: string;
  title: string;
  message: string;
  related_submission_id: string | null;
  related_review_id: string | null;
  target_path: string;
  is_read: boolean;
  created_at: string;
  related_submission_status?: string | null;
  related_submission_closed_status?: string | null;
  related_review_status?: string | null;
  has_resubmission_successor?: boolean;
};

export type NotificationCategory = 'needs_action' | 'master_data' | 'updates';
export type NotificationTone = 'danger' | 'warning' | 'action' | 'info' | 'success' | 'neutral';

export function getNotificationCategory(type: string): NotificationCategory {
  if (
    [
      'finance_action_pending',
      'submission_rejected',
      'resubmission_requested',
      'resubmitted_form',
    ].includes(type)
  ) {
    return 'needs_action';
  }

  if (type === 'pending_master_data_review') {
    return 'master_data';
  }

  return 'updates';
}

export function getNotificationCategoryLabel(category: NotificationCategory) {
  if (category === 'needs_action') return 'Needs Action';
  if (category === 'master_data') return 'Master Data';
  return 'Updates';
}

export function isClosedSubmissionReopenedNotification(notification: Pick<NotificationRow, 'title' | 'message' | 'type'>) {
  return notification.type === 'submission_reopened' || notification.title === 'Submission reopened';
}

export function getNotificationDisplayType(type: string, role?: string | null) {
  if (role === 'employee' && type === 'submission_rejected') {
    return 'Correction Requested';
  }
  if (type === 'submission_reopened') {
    return 'Submission Reopened';
  }

  return formatNotificationType(type);
}

export function getNotificationTone(type: string): NotificationTone {
  if (type === 'submission_rejected' || type === 'submission_reopened') return 'danger';
  if (type === 'resubmission_requested' || type === 'resubmitted_form') return 'warning';
  if (type === 'finance_action_pending' || type === 'follow_up_pending') return 'action';
  if (type === 'new_submission') return 'success';
  if (type === 'pending_master_data_review' || type === 'invoice_updated') return 'info';
  return 'neutral';
}

function normalizeWorkflowStatus(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function isNotificationCompleted(
  notification: Pick<
    NotificationRow,
    | 'type'
    | 'related_submission_status'
    | 'related_submission_closed_status'
    | 'related_review_status'
    | 'has_resubmission_successor'
  >
) {
  if (notification.type === 'resubmission_requested' || notification.type === 'submission_rejected') {
    return Boolean(notification.has_resubmission_successor);
  }

  if (notification.type === 'finance_action_pending') {
    return normalizeWorkflowStatus(notification.related_submission_status) !== 'submitted';
  }

  if (notification.type === 'pending_master_data_review') {
    return normalizeWorkflowStatus(notification.related_review_status) !== 'pending';
  }

  if (notification.type === 'submission_reopened') {
    return normalizeWorkflowStatus(notification.related_submission_closed_status) === 'closed';
  }

  return false;
}

const COMPLETED_NOTIFICATION_TITLES: Partial<Record<NotificationRow['type'], string>> = {
  resubmission_requested: 'Resubmission Completed',
  submission_rejected: 'Correction Completed',
  finance_action_pending: 'Finance Action Completed',
  pending_master_data_review: 'Master Data Review Completed',
  submission_reopened: 'Submission Reopened Completed',
};

export function getCompletedNotificationTitle(
  notification: Pick<
    NotificationRow,
    | 'type'
    | 'title'
    | 'related_submission_status'
    | 'related_submission_closed_status'
    | 'related_review_status'
    | 'has_resubmission_successor'
  >
) {
  if (!isNotificationCompleted(notification)) {
    return notification.title;
  }

  return COMPLETED_NOTIFICATION_TITLES[notification.type] || notification.title;
}

export function sortNotificationsLatestFirst<T extends Pick<NotificationRow, 'created_at'>>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime();
    const rightTime = new Date(right.created_at).getTime();

    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
    if (Number.isNaN(leftTime)) return 1;
    if (Number.isNaN(rightTime)) return -1;

    return rightTime - leftTime;
  });
}

export function formatNotificationType(type: string) {
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
