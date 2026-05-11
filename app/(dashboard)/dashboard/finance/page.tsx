"use client";

import { useMemo, useState } from 'react';
import { KpiCard } from '../../../../components/dashboard/kpi-card';
import { SubmissionDrawer } from '../../../../components/dashboard/submission-drawer';
import { SubmissionTable, type SubmissionRow } from '../../../../components/dashboard/submission-table';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { getDrawerViewerRole, getFinanceDashboardTitle } from '../../../../lib/client/dashboard-access';

const FINANCE_ROWS: SubmissionRow[] = [
  {
    id: '21',
    pi: 'PI-000510',
    entity: 'Honor',
    amount: 350000,
    owner_name: 'Aisha Khan',
    intake_status: 'submitted',
    invoice_status: 'Invoice Pending',
    sync_status: 'pending_sheet_sync',
    submitted_at: '2026-05-07T09:00:00.000Z',
    creator_invoice_received: 'pending',
    payment_received: 'pending',
    payment_made: 'pending',
    closed_status: 'open',
  },
  {
    id: '22',
    pi: 'PI-000511',
    entity: 'CRED',
    amount: 1325000,
    owner_name: 'Ria Sen',
    intake_status: 'accepted',
    invoice_status: 'PO Created/Estimate',
    sync_status: 'synced',
    submitted_at: '2026-05-06T11:00:00.000Z',
    creator_invoice_received: 'received',
    payment_received: 'received',
    payment_made: 'pending',
    closed_status: 'open',
    comments: 'Awaiting creator payout date.',
  },
  {
    id: '23',
    pi: 'PI-000512',
    entity: 'Headout',
    amount: 220000,
    owner_name: 'Arjun Mehta',
    intake_status: 'rejected',
    invoice_status: 'Invoice Cancelled',
    sync_status: 'failed',
    submitted_at: '2026-05-05T16:30:00.000Z',
    rejection_note: 'Amount mismatch between PI and invoice.',
    creator_invoice_received: 'received',
    payment_received: 'pending',
    payment_made: 'pending',
    closed_status: 'open',
    comments: 'Rejected pending corrected backup.',
  },
];

export default function FinanceReviewPage() {
  const { user, loading } = useDashboardSession();
  const [status, setStatus] = useState<'all' | 'submitted' | 'rejected' | 'accepted'>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => (status === 'all' ? FINANCE_ROWS : FINANCE_ROWS.filter((row) => row.intake_status === status)), [status]);
  const row = useMemo(() => rows.find((entry) => entry.id === openId) || null, [rows, openId]);

  if (loading || !user) return null;

  const pendingCount = FINANCE_ROWS.filter((entry) => entry.intake_status === 'submitted').length;
  const acceptedCount = FINANCE_ROWS.filter((entry) => entry.intake_status === 'accepted').length;
  const rejectedCount = FINANCE_ROWS.filter((entry) => entry.intake_status === 'rejected').length;
  const totalValue = FINANCE_ROWS.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ margin: 0 }}>{getFinanceDashboardTitle(user.role)}</h1>
        <p className="text-muted">
          Finance and admin roles can see all submissions, queue counts, invoice/payment tracking, and accept or reject workflows.
        </p>
      </header>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <KpiCard title="Pending Review" value={String(pendingCount)} hint="Requires finance action" />
        <KpiCard title="Accepted" value={String(acceptedCount)} hint="Approved by finance" />
        <KpiCard title="Rejected" value={String(rejectedCount)} hint="Returned with notes" />
        <KpiCard
          title="Total Intake Value"
          value={new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalValue)}
          hint="Across visible company intake"
        />
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['all', 'submitted', 'accepted', 'rejected'] as const).map((entryStatus) => (
          <button
            key={entryStatus}
            className="btn"
            onClick={() => setStatus(entryStatus)}
            style={{ background: status === entryStatus ? 'var(--primary)' : 'var(--card)', color: status === entryStatus ? '#fff' : 'var(--fg)', border: status === entryStatus ? 'none' : '1px solid var(--border)' }}
          >
            {entryStatus}
          </button>
        ))}
      </div>

      <SubmissionTable
        rows={rows}
        onOpen={setOpenId}
        columns={['pi', 'owner_name', 'entity', 'amount', 'intake_status', 'invoice_status', 'submitted_at', 'actions']}
      />

      <SubmissionDrawer open={Boolean(row)} onClose={() => setOpenId(null)} row={row} viewer={getDrawerViewerRole(user.role)} />
    </div>
  );
}
