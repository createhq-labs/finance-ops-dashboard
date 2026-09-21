export const ENABLE_TRANSFERRED_SUBMISSIONS =
  process.env.NEXT_PUBLIC_ENABLE_TRANSFERRED_SUBMISSIONS === 'true';

export const GOOGLE_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === 'true';

// Go-live cutoff for the Finance Review sidebar badges ("New Submissions" /
// "New Resubmissions"). Only intake_submissions rows with created_at on or
// after this timestamp are eligible to be counted, so pre-existing backlog
// sitting in `submitted` is never surfaced as "new" work.
//
// This value is permanent once set: it must never move forward automatically
// (no "today minus N days"), and it must not be changed after go-live, since
// that would make the badge counts inconsistent with the audit trail.
//
// REQUIRED BEFORE DEPLOY: replace this placeholder with the exact go-live
// ISO timestamp for this feature. Until it is replaced, it is deliberately
// set far in the future so both badge counts fail closed at zero instead of
// counting historical backlog.
export const FINANCE_BADGE_TRACKING_SINCE = '2026-09-20T00:00:00.000Z';
