import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyFinancePiState, sortFinanceQueueRows, type FinanceQueueSortableRow } from './finance-queue-sort';

const NOT_REQUIRED_INVOICE_TYPE = 'Reimbursement Invoice (Without GST)';
const NOT_REQUIRED_LINE_ITEMS = [{ deliverable_name: 'Product Reimbursement' }];

function row(overrides: Partial<FinanceQueueSortableRow> & { id: string }): FinanceQueueSortableRow {
  return {
    intake_status: 'accepted',
    pi: null,
    submitted_at: '2026-01-01T00:00:00.000Z',
    accepted_at: null,
    invoice_type: null,
    intake_line_items: [],
    ...overrides,
  };
}

function notRequiredRow(overrides: Partial<FinanceQueueSortableRow> & { id: string }): FinanceQueueSortableRow {
  return row({
    invoice_type: NOT_REQUIRED_INVOICE_TYPE,
    intake_line_items: NOT_REQUIRED_LINE_ITEMS,
    ...overrides,
  });
}

test('classification: numbered PI wins regardless of invoice_type/line items', () => {
  assert.equal(
    classifyFinancePiState({ pi: 'PI-000158', invoice_type: NOT_REQUIRED_INVOICE_TYPE, intake_line_items: NOT_REQUIRED_LINE_ITEMS }),
    'numbered'
  );
});

test('classification: PI Not Required requires the real business rule, not just a null PI', () => {
  assert.equal(
    classifyFinancePiState({ pi: null, invoice_type: NOT_REQUIRED_INVOICE_TYPE, intake_line_items: NOT_REQUIRED_LINE_ITEMS }),
    'not_required'
  );
});

test('classification: null PI without the Not-Required rule is Pending Approval, not Not Required', () => {
  assert.equal(
    classifyFinancePiState({ pi: null, invoice_type: 'Tax Invoice (With GST)', intake_line_items: [{ deliverable_name: 'Content Fee' }] }),
    'pending_approval'
  );
  assert.equal(classifyFinancePiState({ pi: null, invoice_type: null, intake_line_items: [] }), 'pending_approval');
});

test('unaccepted PI Pending Approval stays in Group 1, sorted by submitted_at', () => {
  const pendingNewer = row({
    id: 'pending-newer',
    intake_status: 'submitted',
    pi: null,
    invoice_type: 'Tax Invoice (With GST)',
    submitted_at: '2026-01-10T00:00:00.000Z',
  });
  const pendingOlder = row({
    id: 'pending-older',
    intake_status: 'submitted',
    pi: null,
    invoice_type: 'Tax Invoice (With GST)',
    submitted_at: '2026-01-05T00:00:00.000Z',
  });

  const result = sortFinanceQueueRows([pendingOlder, pendingNewer]);

  assert.deepEqual(result.map((r) => r.id), ['pending-newer', 'pending-older']);
});

test('unaccepted PI Not Required stays in Group 1, sorted by submitted_at (not accepted_at)', () => {
  const notRequiredUnaccepted = notRequiredRow({
    id: 'nr-unaccepted',
    intake_status: 'submitted',
    submitted_at: '2026-01-08T00:00:00.000Z',
    accepted_at: null,
  });
  const pendingUnaccepted = row({
    id: 'pending-unaccepted',
    intake_status: 'submitted',
    pi: null,
    invoice_type: 'Tax Invoice (With GST)',
    submitted_at: '2026-01-06T00:00:00.000Z',
  });
  const acceptedNumbered = row({ id: 'accepted-numbered', pi: 'PI-000001', accepted_at: '2026-01-01T00:00:00.000Z' });

  const result = sortFinanceQueueRows([acceptedNumbered, pendingUnaccepted, notRequiredUnaccepted]);

  // Both unaccepted rows precede the accepted row, ordered by submitted_at desc.
  assert.deepEqual(result.map((r) => r.id), ['nr-unaccepted', 'pending-unaccepted', 'accepted-numbered']);
});

test('accepted numbered PI rows form a fixed PI-descending sequence', () => {
  const pi158 = row({ id: 'pi158', pi: 'PI-000158', accepted_at: '2026-01-03T00:00:00.000Z' });
  const pi157 = row({ id: 'pi157', pi: 'PI-000157', accepted_at: '2026-01-02T00:00:00.000Z' });
  const pi156 = row({ id: 'pi156', pi: 'PI-000156', accepted_at: '2026-01-01T00:00:00.000Z' });

  const result = sortFinanceQueueRows([pi156, pi158, pi157]);

  assert.deepEqual(result.map((r) => r.id), ['pi158', 'pi157', 'pi156']);
});

test('accepted PI Not Required is inserted by accepted_at, interleaved with numbered PI rows', () => {
  const pi158 = row({ id: 'pi158', pi: 'PI-000158', accepted_at: '2026-01-03T00:00:00.000Z' });
  const nr = notRequiredRow({ id: 'nr', accepted_at: '2026-01-02T00:00:00.000Z' });
  const pi157 = row({ id: 'pi157', pi: 'PI-000157', accepted_at: '2026-01-01T00:00:00.000Z' });

  const result = sortFinanceQueueRows([pi157, nr, pi158]);

  assert.deepEqual(result.map((r) => r.id), ['pi158', 'nr', 'pi157']);
});

test('multiple accepted PI Not Required rows order among themselves by accepted_at', () => {
  const pi158 = row({ id: 'pi158', pi: 'PI-000158', accepted_at: '2026-01-05T00:00:00.000Z' });
  const nrNewer = notRequiredRow({ id: 'nr-newer', accepted_at: '2026-01-04T00:00:00.000Z' });
  const nrOlder = notRequiredRow({ id: 'nr-older', accepted_at: '2026-01-03T00:00:00.000Z' });
  const pi157 = row({ id: 'pi157', pi: 'PI-000157', accepted_at: '2026-01-02T00:00:00.000Z' });

  const result = sortFinanceQueueRows([pi157, nrOlder, pi158, nrNewer]);

  assert.deepEqual(result.map((r) => r.id), ['pi158', 'nr-newer', 'nr-older', 'pi157']);
});

test('later finance actions that overwrite reviewed_at must not affect ordering (reviewed_at is unused)', () => {
  // reviewed_at is intentionally absent from FinanceQueueSortableRow, but a
  // stray property on the object (as would happen if the full SubmissionRow
  // is passed through) must still be ignored by the algorithm.
  const pi158 = { ...row({ id: 'pi158', pi: 'PI-000158', accepted_at: '2026-01-01T00:00:00.000Z' }), reviewed_at: '2099-01-01T00:00:00.000Z' };
  const pi157 = { ...row({ id: 'pi157', pi: 'PI-000157', accepted_at: '2026-01-02T00:00:00.000Z' }), reviewed_at: '2000-01-01T00:00:00.000Z' };
  const nr = { ...notRequiredRow({ id: 'nr', accepted_at: '2026-01-15T00:00:00.000Z' }), reviewed_at: '2010-01-01T00:00:00.000Z' };

  const result = sortFinanceQueueRows([pi157, nr, pi158]);

  // Despite reviewed_at claiming pi158 (2099) is "most recent", numbered order
  // must follow PI descending only: 158 before 157, unaffected by reviewed_at.
  const numberedOnly = result.filter((r) => r.id === 'pi158' || r.id === 'pi157').map((r) => r.id);
  assert.deepEqual(numberedOnly, ['pi158', 'pi157']);

  // NR's real accepted_at (Jan 15) is newer than both numbered rows'
  // accepted_at values, so it must lead the accepted group despite
  // reviewed_at suggesting otherwise.
  assert.deepEqual(result.map((r) => r.id), ['nr', 'pi158', 'pi157']);
});

test('PI Not Required with no accepted_at falls back to submitted_at, never reviewed_at', () => {
  const pi158 = row({ id: 'pi158', pi: 'PI-000158', accepted_at: '2026-01-03T00:00:00.000Z' });
  const nrNoAcceptedAt = {
    ...notRequiredRow({ id: 'nr-no-accepted-at', accepted_at: null, submitted_at: '2026-01-02T00:00:00.000Z' }),
    reviewed_at: '2099-01-01T00:00:00.000Z',
  };
  const pi157 = row({ id: 'pi157', pi: 'PI-000157', accepted_at: '2026-01-01T00:00:00.000Z' });

  const result = sortFinanceQueueRows([pi157, nrNoAcceptedAt, pi158]);

  assert.deepEqual(result.map((r) => r.id), ['pi158', 'nr-no-accepted-at', 'pi157']);
});

test('output is deterministic regardless of input order', () => {
  const rows = [
    row({ id: 'pi158', pi: 'PI-000158', accepted_at: '2026-01-05T00:00:00.000Z' }),
    notRequiredRow({ id: 'nr-a', accepted_at: '2026-01-04T00:00:00.000Z' }),
    notRequiredRow({ id: 'nr-b', accepted_at: '2026-01-03T00:00:00.000Z' }),
    row({ id: 'pi157', pi: 'PI-000157', accepted_at: '2026-01-02T00:00:00.000Z' }),
    row({
      id: 'unaccepted-new',
      intake_status: 'submitted',
      pi: null,
      invoice_type: 'Tax Invoice (With GST)',
      submitted_at: '2026-01-10T00:00:00.000Z',
    }),
    row({
      id: 'unaccepted-old',
      intake_status: 'submitted',
      pi: null,
      invoice_type: 'Tax Invoice (With GST)',
      submitted_at: '2026-01-09T00:00:00.000Z',
    }),
  ];

  const forward = sortFinanceQueueRows(rows).map((r) => r.id);
  const reversed = sortFinanceQueueRows([...rows].reverse()).map((r) => r.id);
  const shuffled = [rows[3], rows[0], rows[5], rows[1], rows[4], rows[2]];
  const shuffledResult = sortFinanceQueueRows(shuffled).map((r) => r.id);

  assert.deepEqual(forward, ['unaccepted-new', 'unaccepted-old', 'pi158', 'nr-a', 'nr-b', 'pi157']);
  assert.deepEqual(reversed, forward);
  assert.deepEqual(shuffledResult, forward);
});

test('not-accepted rows always precede accepted rows, sorted by submitted_at descending', () => {
  const accepted = row({ id: 'accepted', pi: 'PI-000100', accepted_at: '2026-01-01T00:00:00.000Z' });
  const rejectedNewer = row({
    id: 'rejected-newer',
    intake_status: 'rejected',
    pi: null,
    submitted_at: '2026-02-01T00:00:00.000Z',
  });
  const submittedOlder = row({
    id: 'submitted-older',
    intake_status: 'submitted',
    pi: null,
    submitted_at: '2026-01-15T00:00:00.000Z',
  });

  const result = sortFinanceQueueRows([accepted, submittedOlder, rejectedNewer]);

  assert.deepEqual(result.map((r) => r.id), ['rejected-newer', 'submitted-older', 'accepted']);
});
