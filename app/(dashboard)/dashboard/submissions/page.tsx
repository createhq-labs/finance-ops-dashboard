"use client";

import { useMemo, useState } from 'react';
import { SubmissionDrawer } from '../../../../components/dashboard/submission-drawer';
import { SubmissionTable, type SubmissionRow } from '../../../../components/dashboard/submission-table';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { canCreateSubmission, canResubmitSubmission, canViewTeamSubmissions, getDrawerViewerRole, getSubmissionsLabel } from '../../../../lib/client/dashboard-access';

const EMPLOYEE_ROWS: SubmissionRow[] = [
  {
    id: '11',
    pi: 'PI-000401',
    entity: 'Decathlon',
    amount: 180000,
    owner_name: 'Ria Sen',
    intake_status: 'submitted',
    invoice_status: 'Awaiting Finance Review',
    sync_status: 'pending_sheet_sync',
    submitted_at: '2026-05-05T10:30:00.000Z',
  },
  {
    id: '12',
    pi: 'PI-000390',
    entity: 'Nivea',
    amount: 95000,
    owner_name: 'Ria Sen',
    intake_status: 'rejected',
    invoice_status: 'On Hold',
    sync_status: 'pending_sheet_sync',
    submitted_at: '2026-05-02T14:20:00.000Z',
    rejection_note: 'Creator invoice is missing PAN details.',
  },
  {
    id: '13',
    pi: 'PI-000375',
    entity: 'Noise',
    amount: 225000,
    owner_name: 'Ria Sen',
    intake_status: 'accepted',
    invoice_status: 'Invoice Raised',
    sync_status: 'synced',
    submitted_at: '2026-04-29T08:45:00.000Z',
  },
];

const TEAM_ROWS: SubmissionRow[] = [
  ...EMPLOYEE_ROWS,
  {
    id: '14',
    pi: 'PI-000404',
    entity: 'Boat',
    amount: 142000,
    owner_name: 'Arjun Mehta',
    intake_status: 'submitted',
    invoice_status: 'Awaiting Finance Review',
    sync_status: 'pending_sheet_sync',
    submitted_at: '2026-05-06T09:00:00.000Z',
  },
  {
    id: '15',
    pi: 'PI-000396',
    entity: 'Mamaearth',
    amount: 210000,
    owner_name: 'Arjun Mehta',
    intake_status: 'accepted',
    invoice_status: 'PO Created/Estimate',
    sync_status: 'synced',
    submitted_at: '2026-05-01T12:10:00.000Z',
  },
];

export default function EmployeeSubmissionsPage() {
  const { user, loading } = useDashboardSession();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const isTeamScopedView = user ? canViewTeamSubmissions(user.role) : false;
  const sourceRows = isTeamScopedView ? TEAM_ROWS : EMPLOYEE_ROWS;
  const rows = useMemo(
    () =>
      sourceRows.filter(
        (row) => row.entity.toLowerCase().includes(query.toLowerCase()) || row.pi.toLowerCase().includes(query.toLowerCase()) || (row.owner_name || '').toLowerCase().includes(query.toLowerCase())
      ),
    [query, sourceRows]
  );
  const row = useMemo(() => rows.find((entry) => entry.id === openId) || null, [rows, openId]);

  if (loading || !user) return null;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>{getSubmissionsLabel(user.role)}</h1>
          <p className="text-muted">
            {isTeamScopedView
              ? 'Team leads can review their own and team submission statuses without seeing finance-wide operational metrics.'
              : 'This page is limited to your own intake records, status updates, rejection notes, and resubmission actions.'}
          </p>
        </div>
        {canCreateSubmission(user.role) ? <button className="btn btn-primary" type="button">New Submission</button> : null}
      </header>

      <div className="surface" style={{ padding: 12 }}>
        <input
          placeholder={isTeamScopedView ? 'Search by PI, Entity, or Team Member' : 'Search by PI or Entity'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)' }}
        />
      </div>

      <SubmissionTable
        rows={rows}
        onOpen={setOpenId}
        columns={isTeamScopedView ? ['pi', 'owner_name', 'entity', 'amount', 'intake_status', 'submitted_at', 'actions'] : ['pi', 'entity', 'amount', 'intake_status', 'submitted_at', 'rejection_note', 'actions']}
        getActionLabel={(entry) => (canResubmitSubmission(user.role, entry) ? 'Resubmit' : 'View')}
      />

      <SubmissionDrawer open={Boolean(row)} onClose={() => setOpenId(null)} row={row} viewer={getDrawerViewerRole(isTeamScopedView ? 'team_lead' : user.role)} />
    </div>
  );
}
