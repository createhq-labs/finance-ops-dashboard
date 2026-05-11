"use client";

import { useMemo, useState } from 'react';
import { KpiCard } from '../../../components/dashboard/kpi-card';
import { SubmissionDrawer } from '../../../components/dashboard/submission-drawer';
import { SubmissionTable, type SubmissionRow } from '../../../components/dashboard/submission-table';
import { useDashboardSession } from '../../../components/layout/dashboard-session';
import { canResubmitSubmission, canViewTeamSubmissions, getDrawerViewerRole, getOverviewTitle, isEmployeeRole, isTeamLeadRole } from '../../../lib/client/dashboard-access';

const ALL_ROWS: SubmissionRow[] = [
  {
    id: '1',
    pi: 'PI-000321',
    entity: 'Auburn Digital',
    amount: 70000,
    owner_name: 'Ria Sen',
    intake_status: 'submitted',
    invoice_status: 'Invoice Pending',
    sync_status: 'pending_sheet_sync',
    submitted_at: '2026-05-04T10:00:00.000Z',
  },
  {
    id: '2',
    pi: 'PI-000322',
    entity: 'Dreamplug',
    amount: 1325000,
    owner_name: 'Ria Sen',
    intake_status: 'accepted',
    invoice_status: 'PO Created/Estimate',
    sync_status: 'synced',
    submitted_at: '2026-05-03T09:15:00.000Z',
    creator_invoice_received: 'received',
    payment_received: 'received',
    payment_made: 'pending',
    closed_status: 'open',
    comments: 'Waiting on creator settlement.',
  },
  {
    id: '3',
    pi: 'PI-000323',
    entity: 'Headout',
    amount: 220000,
    owner_name: 'Arjun Mehta',
    intake_status: 'rejected',
    invoice_status: 'On Hold',
    sync_status: 'failed',
    submitted_at: '2026-05-02T08:20:00.000Z',
    rejection_note: 'Missing GST breakup on creator invoice.',
    comments: 'Need corrected invoice before retry.',
  },
  {
    id: '4',
    pi: 'PI-000324',
    entity: 'CRED',
    amount: 480000,
    owner_name: 'Neha Kapoor',
    intake_status: 'accepted',
    invoice_status: 'Invoice Raised',
    sync_status: 'synced',
    submitted_at: '2026-05-01T11:10:00.000Z',
    creator_invoice_received: 'received',
    payment_received: 'received',
    payment_made: 'paid',
    closed_status: 'closed',
    comments: 'Closed after payout confirmation.',
  },
];

const MY_ROWS = ALL_ROWS.filter((row) => row.owner_name === 'Ria Sen');
const TEAM_ROWS = ALL_ROWS.filter((row) => row.owner_name === 'Ria Sen' || row.owner_name === 'Arjun Mehta');

export default function DashboardHomePage() {
  const { user, loading } = useDashboardSession();
  const [openId, setOpenId] = useState<string | null>(null);
  const role = user?.role;

  const visibleRows = useMemo(() => {
    if (!role) return ALL_ROWS;
    if (isEmployeeRole(role)) return MY_ROWS;
    if (canViewTeamSubmissions(role) && !isEmployeeRole(role)) return TEAM_ROWS;
    return ALL_ROWS;
  }, [role]);

  const row = useMemo(() => visibleRows.find((entry) => entry.id === openId) || null, [openId, visibleRows]);

  if (loading || !user) return null;
  const isEmployee = isEmployeeRole(user.role);
  const isTeamLead = isTeamLeadRole(user.role);
  const isDeveloper = user.role === 'developer';
  const isFinance = user.role === 'finance';

  if (isEmployee) {
    const submittedCount = visibleRows.filter((entry) => entry.intake_status === 'submitted').length;
    const acceptedCount = visibleRows.filter((entry) => entry.intake_status === 'accepted').length;
    const rejectedCount = visibleRows.filter((entry) => entry.intake_status === 'rejected').length;

    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0 }}>{getOverviewTitle(user.role)}</h1>
            <p className="text-muted">Only your submissions, statuses, rejection notes, and next actions appear here.</p>
          </div>
          <button className="btn btn-primary" type="button">Submit New Intake</button>
        </header>

        <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <KpiCard title="Submitted by Me" value={String(submittedCount)} hint="Awaiting finance review" />
          <KpiCard title="Accepted" value={String(acceptedCount)} hint="Approved and in processing" />
          <KpiCard title="Rejected" value={String(rejectedCount)} hint="Needs correction and resubmission" />
        </section>

        <section>
          <h2 style={{ marginTop: 0 }}>Recent Activity</h2>
          <div className="surface" style={{ padding: 16 }}>
            <div>PI-000322 was accepted by finance yesterday.</div>
            <div style={{ marginTop: 8 }}>PI-000323 needs invoice corrections before resubmission.</div>
          </div>
        </section>

        <section>
            <h2 style={{ marginTop: 0 }}>My Recent Submissions</h2>
          <SubmissionTable
            rows={visibleRows}
            onOpen={setOpenId}
            columns={['pi', 'entity', 'amount', 'intake_status', 'submitted_at', 'rejection_note', 'actions']}
            getActionLabel={(entry) => (canResubmitSubmission(user.role, entry) ? 'Resubmit' : 'View')}
          />
        </section>

        <SubmissionDrawer open={Boolean(row)} onClose={() => setOpenId(null)} row={row} viewer={getDrawerViewerRole(user.role)} />
      </div>
    );
  }

  if (isTeamLead) {
    const pendingCount = visibleRows.filter((entry) => entry.intake_status === 'submitted').length;
    const acceptedCount = visibleRows.filter((entry) => entry.intake_status === 'accepted').length;
    const rejectedCount = visibleRows.filter((entry) => entry.intake_status === 'rejected').length;

    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <header>
          <h1 style={{ margin: 0 }}>{getOverviewTitle(user.role)}</h1>
          <p className="text-muted">Team leads see their own work plus their team pipeline, not company-wide finance metrics.</p>
        </header>

        <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <KpiCard title="Team Pending" value={String(pendingCount)} hint="Awaiting finance review" />
          <KpiCard title="Team Accepted" value={String(acceptedCount)} hint="Moved forward by finance" />
          <KpiCard title="Team Rejected" value={String(rejectedCount)} hint="Needs fixes from creators" />
        </section>

        <section>
          <h2 style={{ marginTop: 0 }}>Team Submission List</h2>
          <SubmissionTable
            rows={visibleRows}
            onOpen={setOpenId}
            columns={['pi', 'owner_name', 'entity', 'amount', 'intake_status', 'submitted_at', 'actions']}
          />
        </section>

        <SubmissionDrawer open={Boolean(row)} onClose={() => setOpenId(null)} row={row} viewer={getDrawerViewerRole(user.role)} />
      </div>
    );
  }

  if (isDeveloper) {
    const failedSyncs = ALL_ROWS.filter((entry) => entry.sync_status === 'failed').length;

    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <header>
          <h1 style={{ margin: 0 }}>{getOverviewTitle(user.role)}</h1>
          <p className="text-muted">Developer access is limited to technical visibility, sync health, and debugging context.</p>
        </header>

        <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <KpiCard title="Failed Syncs" value={String(failedSyncs)} hint="Needs technical investigation" />
          <KpiCard title="Auth Session Route" value="Healthy" hint="/api/auth/session responding" />
          <KpiCard title="Submission Create Route" value="Healthy" hint="/api/submissions/create compiled" />
        </section>

        <section className="surface" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Current Technical Scope</h2>
          <p className="text-muted" style={{ marginBottom: 0 }}>
            This role can inspect sync state and logs, but cannot approve finance submissions or edit finance payment fields.
          </p>
        </section>
      </div>
    );
  }

  const totalValue = visibleRows.reduce((sum, entry) => sum + entry.amount, 0);
  const pendingCount = visibleRows.filter((entry) => entry.intake_status === 'submitted').length;
  const acceptedCount = visibleRows.filter((entry) => entry.intake_status === 'accepted').length;
  const rejectedCount = visibleRows.filter((entry) => entry.intake_status === 'rejected').length;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ margin: 0 }}>{getOverviewTitle(user.role)}</h1>
        <p className="text-muted">
          {isFinance
            ? 'Finance sees operational queue metrics and all submissions, without employee-only or developer-only views.'
            : 'Admin sees the full system overview, including finance operations and user management access.'}
        </p>
      </header>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <KpiCard title="Pending Review" value={String(pendingCount)} hint="Finance queue" />
        <KpiCard title="Accepted" value={String(acceptedCount)} hint="Approved by finance" />
        <KpiCard title="Rejected" value={String(rejectedCount)} hint="Sent back with notes" />
        <KpiCard
          title="Total Intake Value"
          value={new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalValue)}
          hint="All visible submissions"
        />
      </section>

      <section>
        <h2 style={{ marginTop: 0 }}>Operational Queue</h2>
        <SubmissionTable
          rows={visibleRows}
          onOpen={setOpenId}
          columns={['pi', 'owner_name', 'entity', 'amount', 'intake_status', 'invoice_status', 'submitted_at', 'actions']}
        />
      </section>

      <SubmissionDrawer open={Boolean(row)} onClose={() => setOpenId(null)} row={row} viewer={getDrawerViewerRole(user.role)} />
    </div>
  );
}
