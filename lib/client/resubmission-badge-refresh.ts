export const PENDING_RESUBMISSION_BADGE_REFRESH_EVENT = 'finance-ops:pending-resubmission-badge-refresh';

export function triggerPendingResubmissionBadgeRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PENDING_RESUBMISSION_BADGE_REFRESH_EVENT));
}
