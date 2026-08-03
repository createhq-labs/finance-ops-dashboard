import { isPiNotRequiredSubmission } from './pi-display';

export type FinanceQueueLineItem = {
  deliverable_name?: string | null;
};

export type FinanceQueueSortableRow = {
  id: string;
  intake_status: string;
  pi: string | null | undefined;
  submitted_at: string | null | undefined;
  accepted_at?: string | null;
  invoice_type?: string | null;
  intake_line_items?: FinanceQueueLineItem[] | null;
};

export type FinancePiState = 'numbered' | 'not_required' | 'pending_approval';

function getTimeMs(value: string | null | undefined) {
  const time = new Date(value || '').getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function parsePiNumber(pi: string | null | undefined) {
  const match = String(pi || '').match(/(\d+)/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isNaN(value) ? null : value;
}

/**
 * Mirrors the repository's existing PI classification
 * (lib/client/pi-display.ts getPiDisplayMeta): a numbered PI always wins;
 * otherwise the real "PI Not Required" business rule decides, never a bare
 * null-PI check, so "PI Pending Approval" and "PI Not Required" are never
 * conflated.
 */
export function classifyFinancePiState(
  row: Pick<FinanceQueueSortableRow, 'pi' | 'invoice_type' | 'intake_line_items'>
): FinancePiState {
  if (parsePiNumber(row.pi) !== null) return 'numbered';
  if (isPiNotRequiredSubmission({ invoiceType: row.invoice_type, lineItems: row.intake_line_items })) {
    return 'not_required';
  }
  return 'pending_approval';
}

/**
 * The acceptance moment, sourced from the derived `accepted_at` field (the
 * `submission_approved` activity_log entry's created_at, batched server-side
 * in app/api/submissions/finance/route.ts) — never `reviewed_at`, which is
 * overwritten by later, unrelated finance actions. Falls back to
 * `submitted_at` only when no acceptance log entry exists.
 */
function getAcceptanceTimeMs(row: FinanceQueueSortableRow) {
  return getTimeMs(row.accepted_at ?? row.submitted_at);
}

function compareNotAcceptedRows<T extends FinanceQueueSortableRow>(left: T, right: T) {
  const diff = getTimeMs(right.submitted_at) - getTimeMs(left.submitted_at);
  if (diff !== 0) return diff;
  return left.id.localeCompare(right.id);
}

function compareNumberedPiRows<T extends FinanceQueueSortableRow>(left: T, right: T) {
  const diff = (parsePiNumber(right.pi) ?? 0) - (parsePiNumber(left.pi) ?? 0);
  if (diff !== 0) return diff;
  return left.id.localeCompare(right.id);
}

function compareByAcceptanceTime<T extends FinanceQueueSortableRow>(left: T, right: T) {
  const diff = getAcceptanceTimeMs(right) - getAcceptanceTimeMs(left);
  if (diff !== 0) return diff;
  return left.id.localeCompare(right.id);
}

/**
 * Merges the fixed, PI-sorted `numbered` sequence with the time-sorted
 * `unnumbered` (accepted, no PI number) sequence. Advancing `i` only ever
 * forward through `numbered` guarantees numbered rows retain their
 * pre-sorted relative order in the output — their order is never decided
 * by a time comparison.
 */
function mergeNumberedAndUnnumbered<T extends FinanceQueueSortableRow>(numbered: T[], unnumbered: T[]) {
  const merged: T[] = [];
  let i = 0;
  let j = 0;
  while (i < numbered.length && j < unnumbered.length) {
    if (getAcceptanceTimeMs(unnumbered[j]) > getAcceptanceTimeMs(numbered[i])) {
      merged.push(unnumbered[j]);
      j += 1;
    } else {
      merged.push(numbered[i]);
      i += 1;
    }
  }
  while (i < numbered.length) {
    merged.push(numbered[i]);
    i += 1;
  }
  while (j < unnumbered.length) {
    merged.push(unnumbered[j]);
    j += 1;
  }
  return merged;
}

export function sortFinanceQueueRows<T extends FinanceQueueSortableRow>(rows: T[]): T[] {
  const notAccepted: T[] = [];
  const numbered: T[] = [];
  const unnumberedAccepted: T[] = [];

  for (const row of rows) {
    if (row.intake_status !== 'accepted') {
      notAccepted.push(row);
      continue;
    }
    if (classifyFinancePiState(row) === 'numbered') {
      numbered.push(row);
    } else {
      unnumberedAccepted.push(row);
    }
  }

  notAccepted.sort(compareNotAcceptedRows);
  numbered.sort(compareNumberedPiRows);
  unnumberedAccepted.sort(compareByAcceptanceTime);

  return [...notAccepted, ...mergeNumberedAndUnnumbered(numbered, unnumberedAccepted)];
}
