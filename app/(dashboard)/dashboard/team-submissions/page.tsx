"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { KpiCard } from '../../../../components/dashboard/kpi-card';
import { PageHeader } from '../../../../components/dashboard/page-header';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { StatePanel } from '../../../../components/dashboard/state-panel';
import { SubmissionDrawer } from '../../../../components/dashboard/submission-drawer';
import { SubmissionTable, type SubmissionRow } from '../../../../components/dashboard/submission-table';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { getDrawerViewerRole } from '../../../../lib/client/dashboard-access';
import { TeamMemberManagement } from '../../../../components/settings/team-member-management';
import { getPiDisplayMeta } from '../../../../lib/client/pi-display';

type TeamSubmissionApiRow = {
  id: string;
  proforma_invoice: string | null;
  agency_brand_name: string | null;
  agency_brand_trade_name: string | null;
  email_address: string | null;
  gst_number: string | null;
  address: string | null;
  bill_due: string | null;
  invoice_type: string | null;
  deliverables: string | null;
  creator_creators_name: string | null;
  brand_name: string | null;
  currency?: string | null;
  campaign_code?: string | null;
  campaign_name?: string | null;
  campaign_brand?: string | null;
  campaign_notes?: string | null;
  commercials: number | string | null;
  additional_agency_commission: number | string | null;
  reimbursement_amount: number | string | null;
  reimbursement_receipts: string | null;
  additional_information: string | null;
  previous_submission_id: string | null;
  finance_notes?: string | null;
  finance_comment?: string | null;
  invoice_number?: string | null;
  debit_note_number?: string | null;
  creator_invoice_status?: string | null;
  payment_received?: string | null;
  payment_received_status?: string | null;
  payment_made?: string | null;
  payment_made_status?: string | null;
  closure_status?: string | null;
  business_line?: 'TM' | 'IM' | null;
  entry_type?: 'SC' | 'MC' | null;
  entity_type?: 'Agency' | 'Brand' | null;
  client_type?: 'Indian' | 'Foreign' | null;
  agency_name?: string | null;
  agency_trade_name?: string | null;
  brand_trade_name?: string | null;
  intake_line_items: SubmissionRow['intake_line_items'];
  intake_status: SubmissionRow['intake_status'];
  invoice_status: string | null;
  submitted_at: string | null;
  rejection_note: string | null;
  submitted_by_name?: string | null;
  submitted_by_email?: string | null;
};

type TeamMemberApiRow = {
  employee_id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  created_by: string;
};

type TeamMembersResponse = {
  success: boolean;
  members?: TeamMemberApiRow[];
  error?: string;
};

type TeamSubmissionsResponse = {
  success: boolean;
  submissions?: TeamSubmissionApiRow[];
  error?: string;
};

function normalizeStatus(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function mapTeamSubmissionRow(item: TeamSubmissionApiRow): SubmissionRow {
  return {
    id: String(item.id),
    pi: item.proforma_invoice ?? '',
    entity: item.agency_brand_name || '-',
    amount: Number(item.commercials ?? 0),
    currency: item.currency || 'INR',
    owner_name:
      [item.submitted_by_name, item.submitted_by_email]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join('\n') || '-',
    submitter_email: item.submitted_by_email || item.email_address || undefined,
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
    invoice_number: item.invoice_number || null,
    debit_note_number: item.debit_note_number || null,
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
    finance_notes: item.finance_notes || null,
    finance_comment: item.finance_comment || undefined,
    creator_invoice_received: normalizeStatus(item.creator_invoice_status) || undefined,
    payment_received: normalizeStatus(item.payment_received_status || item.payment_received) || undefined,
    payment_made: normalizeStatus(item.payment_made_status || item.payment_made) || undefined,
    closed_status: normalizeStatus(item.closure_status) || undefined,
    business_line: item.business_line || null,
    entry_type: item.entry_type || null,
    entity_type: item.entity_type || null,
    client_type: item.client_type || null,
    agency_name: item.agency_name || null,
    agency_trade_name: item.agency_trade_name || null,
    brand_trade_name: item.brand_trade_name || null,
    intake_line_items: item.intake_line_items || [],
  };
}

export default function TeamSubmissionsPage() {
  const { user, loading } = useDashboardSession();
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberApiRow[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SubmissionRow['intake_status']>('all');
  const [memberQuery, setMemberQuery] = useState('');
  const [rowsLoading, setRowsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rowsError, setRowsError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showTeamMembers, setShowTeamMembers] = useState(false);

  const loadTeamData = useCallback(
    async (silent = false) => {
      if (!user) return;

      if (silent) setRefreshing(true);
      else setRowsLoading(true);
      setRowsError('');

      try {
        const [submissionsRes, membersRes] = await Promise.all([
          fetch('/api/submissions/team', { method: 'GET', cache: 'no-store' }),
          fetch('/api/team/members', { method: 'GET', cache: 'no-store' }),
        ]);
        const submissionsJson = (await submissionsRes.json().catch(() => ({}))) as TeamSubmissionsResponse;
        const membersJson = (await membersRes.json().catch(() => ({}))) as TeamMembersResponse;

        if (!submissionsRes.ok || !submissionsJson.success) {
          throw new Error(submissionsJson.error || 'Failed to load team submissions.');
        }
        if (!membersRes.ok || !membersJson.success) {
          throw new Error(membersJson.error || 'Failed to load team members.');
        }

        setRows((submissionsJson.submissions ?? []).map(mapTeamSubmissionRow));
        setTeamMembers(Array.isArray(membersJson.members) ? membersJson.members : []);
      } catch (error) {
        setRowsError(error instanceof Error ? error.message : 'Failed to load team data.');
      } finally {
        if (silent) setRefreshing(false);
        else setRowsLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (!user) return;
    void loadTeamData(false);
  }, [loadTeamData, user]);

  const row = useMemo(() => rows.find((entry) => entry.id === openId) || null, [rows, openId]);
  const teamMembersCount = teamMembers.length;
  const submissionCount = rows.length;
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedMemberQuery = memberQuery.trim().toLowerCase();

    return rows.filter((entry) => {
      if (statusFilter !== 'all' && entry.intake_status !== statusFilter) return false;
      if (normalizedMemberQuery) {
        const memberHaystack = `${entry.owner_name || ''} ${entry.submitter_email || ''}`.toLowerCase();
        if (!memberHaystack.includes(normalizedMemberQuery)) return false;
      }

      if (!normalizedQuery) return true;

      const piMeta = getPiDisplayMeta({
        pi: entry.pi,
        submittedAt: entry.submitted_at,
        invoiceType: entry.invoice_type,
        lineItems: entry.intake_line_items,
      });
      const haystack = [
        entry.pi,
        piMeta.label,
        piMeta.title,
        entry.entity,
        entry.brand_name,
        entry.creator_creators_name,
        entry.campaign_brand,
        entry.owner_name,
        entry.submitter_email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [memberQuery, query, rows, statusFilter]);

  const pendingOrReviewCount = rows.filter((entry) => {
    const intakeStatus = normalizeStatus(entry.intake_status);
    const closedStatus = normalizeStatus(entry.closed_status);
    return intakeStatus === 'submitted' || (intakeStatus === 'accepted' && closedStatus !== 'closed');
  }).length;
  const resubmissionCount = rows.filter((entry) => normalizeStatus(entry.intake_status) === 'rejected').length;
  const closedCount = rows.filter((entry) => normalizeStatus(entry.closed_status) === 'closed').length;

  if (loading || !user) return null;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <PageHeader
        title="Team Submissions"
        description="Read-only submissions from mapped employees."
        className="border-b-0 pb-2"
        actions={
          <button className="btn btn-primary" type="button" onClick={() => setShowTeamMembers(true)}>
            Manage Team Members
          </button>
        }
      />

      {rowsLoading ? <StatePanel padding={12}>Loading team submissions...</StatePanel> : null}
      {rowsError ? <StatePanel tone="danger" padding={12}>{rowsError}</StatePanel> : null}
      {refreshing ? <p className="text-muted m-0 text-sm">Refreshing team data...</p> : null}

      {!rowsLoading && !rowsError ? (
        teamMembersCount === 0 ? (
          <StatePanel padding={12}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="mb-1 font-semibold">No team members yet.</p>
                <p className="text-muted mb-0 text-sm">Add employees to see submissions.</p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => setShowTeamMembers(true)}>
                Manage Team Members
              </button>
            </div>
          </StatePanel>
        ) : (
          <>
        <section style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <KpiCard title="Team Members" value={String(teamMembersCount)} hint="Mapped employees" compact />
          <KpiCard title="Team Submissions" value={String(submissionCount)} hint="Visible records" compact />
          <KpiCard title="Pending / Review" value={String(pendingOrReviewCount)} hint="Waiting on finance" compact />
          <KpiCard title="Resubmissions" value={String(resubmissionCount)} hint="Needs fixes" compact />
          <KpiCard title="Closed" value={String(closedCount)} hint="Completed" compact />
        </section>

        <SectionCard padding={12}>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Search</span>
              <input
                className="intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20"
                placeholder="Search PI, entity, creator, or brand"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <select
                className="intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | SubmissionRow['intake_status'])}
              >
                <option value="all">All</option>
                <option value="submitted">Submitted</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Team Member</span>
              <input
                className="intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20"
                placeholder="Search member name or email"
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
              />
            </label>
          </div>
        </SectionCard>

            <SectionCard padding={0}>
              <SubmissionTable
                rows={filteredRows}
                onOpen={(id) => setOpenId(id)}
                emptyLabel="No mapped employee submissions found yet."
                getActionLabel={() => 'View'}
                viewer="team_lead"
              />
            </SectionCard>
          </>
        )
      ) : null}

      <SubmissionDrawer open={Boolean(row)} onClose={() => setOpenId(null)} row={row} viewer={getDrawerViewerRole(user.role)} />

      {showTeamMembers ? (
        <div className="fixed inset-0 z-50 bg-slate-950/50 p-4 backdrop-blur-[1px]" onClick={() => setShowTeamMembers(false)}>
          <div
            className="mx-auto mt-10 max-h-[calc(100vh-5rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-app p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-lg font-semibold">Manage Team Members</h2>
              </div>
              <button className="btn" type="button" onClick={() => setShowTeamMembers(false)}>
                Close
              </button>
            </div>
            <TeamMemberManagement onChanged={() => void loadTeamData(true)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
