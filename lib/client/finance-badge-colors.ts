// Solid count-badge styles for the Finance Review sidebar item, matching the
// weight/contrast of the existing red Follow-ups `.nav-badge` (solid fill,
// bold white text) rather than the translucent table-chip treatment. The
// hue for each stays anchored to its existing semantic elsewhere in the app:
// - submission: same green family as getStatusTone('intake_status', 'accepted')
//   in components/dashboard/submission-table.tsx (the "Accepted" chip).
// - resubmission: same blue family as the `piVersionState === 'resubmitted'`
//   branch in components/dashboard/submission-table.tsx (the "Resubmitted" PI chip).
//
// Defined as plain CSS classes (see .finance-nav-badge* in app/globals.css,
// next to .nav-badge) rather than imported from submission-table.tsx, so the
// lightweight, always-mounted dashboard shell does not pull in the large
// Finance Review table module.
export const FINANCE_NEW_SUBMISSION_BADGE_CLASSES = 'finance-nav-badge finance-nav-badge-submission';

export const FINANCE_NEW_RESUBMISSION_BADGE_CLASSES = 'finance-nav-badge finance-nav-badge-resubmission';
