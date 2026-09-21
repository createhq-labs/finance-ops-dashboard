export const FINANCE_BADGE_REFRESH_EVENT = 'finance-ops:finance-badge-refresh';

export function triggerFinanceBadgeRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FINANCE_BADGE_REFRESH_EVENT));
}
