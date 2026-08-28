import type { SessionUser } from './session';

// Established role-based polling architecture (see project polling audit):
// Employee -> 60s, Team Lead -> 20-30s, Finance/Admin -> 10-15s. One
// deterministic interval per role, no jitter. Finance/Admin keep polling even
// after Realtime is added later, since polling is the reconciliation layer.
const EMPLOYEE_POLL_INTERVAL_MS = 60000;
const TEAM_LEAD_POLL_INTERVAL_MS = 30000;
const FINANCE_ADMIN_POLL_INTERVAL_MS = 15000;

/**
 * Resolves the single polling interval for the current session role. Roles
 * outside the four the architecture defines (e.g. `developer`) fall back to
 * the tightest defined tier (Finance/Admin) rather than an undefined/ad-hoc
 * value, since those surfaces already polled at a flat interval for every
 * role before this normalization.
 */
export function getPollingIntervalMs(role: SessionUser['role'] | null | undefined): number {
  if (role === 'employee') return EMPLOYEE_POLL_INTERVAL_MS;
  if (role === 'team_lead') return TEAM_LEAD_POLL_INTERVAL_MS;
  return FINANCE_ADMIN_POLL_INTERVAL_MS;
}
