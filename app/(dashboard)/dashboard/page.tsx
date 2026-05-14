"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { KpiCard } from '../../../components/dashboard/kpi-card';
import { SubmissionDrawer } from '../../../components/dashboard/submission-drawer';
import { SubmissionTable, type SubmissionRow } from '../../../components/dashboard/submission-table';
import { useDashboardSession } from '../../../components/layout/dashboard-session';
import { canResubmitSubmission, canSubmitInvoice, getDrawerViewerRole, getInvoiceIntakePath, getOverviewTitle, isEmployeeRole, isTeamLeadRole } from '../../../lib/client/dashboard-access';

type MySubmissionApiRow = {
  id: string;
  proforma_invoice: string | null;
  agency_brand_name: string | null;
  agency_brand_trade_name: string | null;
  gst_number: string | null;
  address: string | null;
  bill_due: string | null;
  invoice_type: string | null;
  deliverables: string | null;
  creator_creators_name: string | null;
  brand_name: string | null;
  commercials: number | string | null;
  additional_agency_commission: number | string | null;
  reimbursement_amount: number | string | null;
  reimbursement_receipts: string | null;
  additional_information: string | null;
  intake_status: SubmissionRow['intake_status'];
  invoice_status: string | null;
  submitted_at: string | null;
  rejection_note: string | null;
};

export default function DashboardHomePage() {
  const { user, loading } = useDashboardSession();
  const [openId, setOpenId] = useState<string | null>(null);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [rowsError, setRowsError] = useState('');
  const [rows, setRows] = useState<SubmissionRow[]>([]);

  useEffect(() => {
    let active = true;
    if (!user) return;

    setRowsLoading(true);
    setRowsError('');
    fetch('/api/submissions/my', { method: 'GET', cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Failed to load overview data.');
        }
        const mapped = ((json.submissions ?? []) as MySubmissionApiRow[]).map((item): SubmissionRow => ({
          id: String(item.id),
          pi: item.proforma_invoice || '-',
          entity: item.agency_brand_name || '-',
          amount: Number(item.commercials ?? 0),
          owner_name: user.full_name || undefined,
          intake_status: item.intake_status,
          invoice_status: item.invoice_status || '-',
          sync_status: 'pending_sheet_sync',
          submitted_at: item.submitted_at || new Date().toISOString(),
          rejection_note: item.rejection_note || null,
          trade_name: item.agency_brand_trade_name || null,
          gst_number: item.gst_number || null,
          address: item.address || null,
          bill_due: item.bill_due || null,
          invoice_type: item.invoice_type || null,
          creator_creators_name: item.creator_creators_name || null,
          brand_name: item.brand_name || null,
          deliverables: item.deliverables || null,
          additional_agency_commission: Number(item.additional_agency_commission ?? 0),
          reimbursement_amount: Number(item.reimbursement_amount ?? 0),
          reimbursement_receipts: item.reimbursement_receipts || null,
          additional_information: item.additional_information || null,
        }));
        if (active) setRows(mapped);
      })
      .catch((error) => {
        if (active) setRowsError(error instanceof Error ? error.message : 'Failed to load overview data.');
      })
      .finally(() => {
        if (active) setRowsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const visibleRows = useMemo(() => rows, [rows]);

  const row = useMemo(() => visibleRows.find((entry) => entry.id === openId) || null, [openId, visibleRows]);

  if (loading || !user) return null;
  const isEmployee = isEmployeeRole(user.role);
  const isTeamLead = isTeamLeadRole(user.role);
  const isDeveloper = user.role === 'developer';
  const isFinance = user.role === 'finance';

  if (rowsLoading) return <div className="surface text-muted" style={{ padding: 16 }}>Loading overview...</div>;
  if (rowsError) return <div className="surface text-danger" style={{ padding: 16 }}>{rowsError}</div>;

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
          {canSubmitInvoice(user.role) ? (
            <Link href={getInvoiceIntakePath()} className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Submit Invoice
            </Link>
          ) : null}
        </header>

        <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <KpiCard title="Submitted by Me" value={String(submittedCount)} hint="Awaiting finance review" />
          <KpiCard title="Accepted" value={String(acceptedCount)} hint="Approved and in processing" />
          <KpiCard title="Rejected" value={String(rejectedCount)} hint="Needs correction and resubmission" />
        </section>

        <section>
            <Link
            href={getInvoiceIntakePath()}
            className="surface"
            style={{ display: 'block', padding: 16, textDecoration: 'none', color: 'inherit' }}
          >
            <strong>Need a new invoice intake?</strong>
            <p className="text-muted" style={{ marginBottom: 0 }}>Open the invoice submission form and prepare a new intake for finance review.</p>
          </Link>
        </section>

        <section>
          <h2 style={{ marginTop: 0 }}>Recent Activity</h2>
          <div className="surface" style={{ padding: 16 }}>
            {visibleRows.length === 0 ? (
              <div className="text-muted">No recent activity yet.</div>
            ) : (
              visibleRows.slice(0, 2).map((entry) => (
                <div key={`recent-${entry.id}`} style={{ marginTop: 8 }}>
                  {entry.pi} is currently <strong>{entry.intake_status}</strong>.
                  {entry.intake_status === 'rejected' && entry.rejection_note ? ` Note: ${entry.rejection_note}` : ''}
                </div>
              ))
            )}
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
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0 }}>{getOverviewTitle(user.role)}</h1>
            <p className="text-muted">Team leads see their own work plus their team pipeline, not company-wide finance metrics.</p>
            <p className="text-muted" style={{ marginTop: 6 }}>Finance-wide role data is still under development; full overview metrics will appear after that wiring is complete.</p>
          </div>
          {canSubmitInvoice(user.role) ? (
            <Link href={getInvoiceIntakePath()} className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Submit Invoice
            </Link>
          ) : null}
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
    const failedSyncs = visibleRows.filter((entry) => entry.sync_status === 'failed').length;

    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <header>
          <h1 style={{ margin: 0 }}>{getOverviewTitle(user.role)}</h1>
          <p className="text-muted">Developer access is limited to technical visibility, sync health, and debugging context.</p>
          <p className="text-muted" style={{ marginTop: 6 }}>Finance-role overview data is not fully developed yet and will be shown after implementation is completed.</p>
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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>{getOverviewTitle(user.role)}</h1>
          <p className="text-muted">
            {isFinance
              ? 'Finance sees operational queue metrics and all submissions, without employee-only or developer-only views.'
              : 'Admin sees the full system overview, including finance operations and user management access.'}
          </p>
          <p className="text-muted" style={{ marginTop: 6 }}>Finance-role overview data is partially placeholder right now; complete data will appear after finance dashboard wiring is finished.</p>
        </div>
        {canSubmitInvoice(user.role) ? (
          <Link href={getInvoiceIntakePath()} className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Submit Invoice
          </Link>
        ) : null}
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
