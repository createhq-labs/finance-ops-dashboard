"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { KpiCard } from '../../../components/dashboard/kpi-card';
import { PageHeader } from '../../../components/dashboard/page-header';
import { SectionCard } from '../../../components/dashboard/section-card';
import { StatePanel } from '../../../components/dashboard/state-panel';
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

type FinanceOverviewApiRow = MySubmissionApiRow & {
  email_address?: string | null;
  campaign_code?: string | null;
  campaign_name?: string | null;
  campaign_brand?: string | null;
  campaign_notes?: string | null;
  previous_submission_id?: string | null;
  business_line?: 'TM' | 'IM' | null;
  entity_type?: 'Agency' | 'Brand' | null;
  client_type?: 'Indian' | 'Foreign' | null;
  agency_name?: string | null;
  agency_trade_name?: string | null;
  brand_trade_name?: string | null;
  integration_metadata?: SubmissionRow['integration_metadata'];
  intake_line_items?: SubmissionRow['intake_line_items'];
  sync_status?: SubmissionRow['sync_status'];
  submitted_by_name?: string | null;
  submitted_by_email?: string | null;
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
    const isOperationalRole = user.role === 'finance' || user.role === 'admin';
    fetch(isOperationalRole ? '/api/submissions/finance' : '/api/submissions/my', { method: 'GET', cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Failed to load overview data.');
        }
        const mapped = ((json.submissions ?? []) as FinanceOverviewApiRow[]).map((item): SubmissionRow => ({
          id: String(item.id),
          pi: item.proforma_invoice || '-',
          entity: item.agency_brand_name || '-',
          amount: Number(item.commercials ?? 0),
          owner_name: item.submitted_by_name || user.full_name || undefined,
          submitter_email: item.submitted_by_email || item.email_address || undefined,
          intake_status: item.intake_status,
          invoice_status: item.invoice_status || '-',
          sync_status: item.sync_status || 'pending_sheet_sync',
          submitted_at: item.submitted_at || new Date().toISOString(),
          rejection_note: item.rejection_note || null,
          trade_name: item.agency_brand_trade_name || null,
          gst_number: item.gst_number || null,
          address: item.address || null,
          bill_due: item.bill_due || null,
          invoice_type: item.invoice_type || null,
          creator_creators_name: item.creator_creators_name || null,
          brand_name: item.brand_name || null,
          campaign_code: item.campaign_code || null,
          campaign_name: item.campaign_name || null,
          campaign_brand: item.campaign_brand || null,
          campaign_notes: item.campaign_notes || null,
          deliverables: item.deliverables || null,
          additional_agency_commission: Number(item.additional_agency_commission ?? 0),
          reimbursement_amount: Number(item.reimbursement_amount ?? 0),
          reimbursement_receipts: item.reimbursement_receipts || null,
          additional_information: item.additional_information || null,
          previous_submission_id: item.previous_submission_id || null,
          business_line: item.business_line || null,
          entity_type: item.entity_type || null,
          client_type: item.client_type || null,
          agency_name: item.agency_name || null,
          agency_trade_name: item.agency_trade_name || null,
          brand_trade_name: item.brand_trade_name || null,
          integration_metadata: item.integration_metadata || null,
          intake_line_items: item.intake_line_items || [],
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

  const visibleRows = useMemo(() => [...rows].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()), [rows]);
  const employeeRecentRows = useMemo(() => visibleRows.slice(0, 5), [visibleRows]);

  const row = useMemo(() => visibleRows.find((entry) => entry.id === openId) || null, [openId, visibleRows]);

  if (loading || !user) return null;
  const isEmployee = isEmployeeRole(user.role);
  const isTeamLead = isTeamLeadRole(user.role);
  const isDeveloper = user.role === 'developer';
  const isFinance = user.role === 'finance';

  if (rowsLoading) return <StatePanel>Loading overview...</StatePanel>;
  if (rowsError) return <StatePanel tone="danger">{rowsError}</StatePanel>;

  if (isEmployee) {
    const submittedCount = visibleRows.filter((entry) => entry.intake_status === 'submitted').length;
    const acceptedCount = visibleRows.filter((entry) => entry.intake_status === 'accepted').length;
    const rejectedCount = visibleRows.filter((entry) => entry.intake_status === 'rejected').length;

    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <PageHeader
          title={getOverviewTitle(user.role)}
          description="Only your submissions, statuses, rejection notes, and next actions appear here."
          actions={canSubmitInvoice(user.role) ? (
            <Link href={getInvoiceIntakePath()} className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Submit Invoice
            </Link>
          ) : null}
        />

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

        <SectionCard title="Recent Activity">
          <div>
            {visibleRows.length === 0 ? (
              <div className="text-muted">No recent activity yet.</div>
            ) : (
              employeeRecentRows.slice(0, 2).map((entry) => (
                <div key={`recent-${entry.id}`} style={{ marginTop: 8 }}>
                  {entry.pi} is currently <strong>{entry.intake_status}</strong>.
                  {entry.intake_status === 'rejected' && entry.rejection_note ? ` Note: ${entry.rejection_note}` : ''}
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <section>
          <h2 style={{ marginTop: 0 }}>My Recent Submissions</h2>
          <SubmissionTable
            rows={employeeRecentRows}
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
        <PageHeader
          title={getOverviewTitle(user.role)}
          description="Team leads see their own work plus their team pipeline, not company-wide finance metrics."
          secondaryDescription="Finance-wide role data is still under development; full overview metrics will appear after that wiring is complete."
          actions={canSubmitInvoice(user.role) ? (
            <Link href={getInvoiceIntakePath()} className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Submit Invoice
            </Link>
          ) : null}
        />

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
        <PageHeader
          title={getOverviewTitle(user.role)}
          description="Developer access is limited to technical visibility, sync health, and debugging context."
          secondaryDescription="Finance-role overview data is not fully developed yet and will be shown after implementation is completed."
        />

        <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <KpiCard title="Failed Syncs" value={String(failedSyncs)} hint="Needs technical investigation" />
          <KpiCard title="Auth Session Route" value="Healthy" hint="/api/auth/session responding" />
          <KpiCard title="Submission Create Route" value="Healthy" hint="/api/submissions/create compiled" />
        </section>

        <SectionCard title="Current Technical Scope">
          <p className="text-muted" style={{ marginBottom: 0 }}>
            This role can inspect sync state and logs, but cannot approve finance submissions or edit finance payment fields.
          </p>
        </SectionCard>
      </div>
    );
  }

  const totalValue = visibleRows.reduce((sum, entry) => sum + entry.amount, 0);
  const pendingCount = visibleRows.filter((entry) => entry.intake_status === 'submitted').length;
  const acceptedCount = visibleRows.filter((entry) => entry.intake_status === 'accepted').length;
  const rejectedCount = visibleRows.filter((entry) => entry.intake_status === 'rejected').length;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        title={getOverviewTitle(user.role)}
        description={
          isFinance
            ? 'Finance sees operational queue metrics and all submissions, without employee-only or developer-only views.'
            : 'Admin sees the full system overview, including finance operations and user management access.'
        }
        secondaryDescription="Finance-role overview data is partially placeholder right now; complete data will appear after finance dashboard wiring is finished."
        actions={canSubmitInvoice(user.role) ? (
          <Link href={getInvoiceIntakePath()} className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Submit Invoice
          </Link>
        ) : null}
      />

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
