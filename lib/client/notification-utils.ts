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
};

export type NotificationCategory = 'needs_action' | 'master_data' | 'updates';

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
