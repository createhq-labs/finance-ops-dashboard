"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../../../components/dashboard/page-header';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { StatePanel } from '../../../../components/dashboard/state-panel';
import { SubmissionDrawer } from '../../../../components/dashboard/submission-drawer';
import { SubmissionTable, type SubmissionRow } from '../../../../components/dashboard/submission-table';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { PAYMENT_RECEIVED_STATUS_OPTIONS } from '../../../../lib/client/finance-status';
import { canSubmitInvoice, getDrawerViewerRole, getSubmissionsLabel } from '../../../../lib/client/dashboard-access';
import { getPiDisplayMeta } from '../../../../lib/client/pi-display';

type MySubmissionApiRow = {
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
  creator_invoice_status?: string | null;
  payment_received?: string | null;
  payment_received_status?: string | null;
  payment_made?: string | null;
  payment_made_status?: string | null;
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
};

type EmployeePaymentFilter = 'all' | (typeof PAYMENT_RECEIVED_STATUS_OPTIONS)[number]['value'];

function normalizeStatusValue(value: string | null | undefined) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (normalized === 'not_received') return 'not_received';
  if (normalized === 'not_paid') return 'not_paid';
  if (normalized === 'received') return 'received';
  if (normalized === 'paid') return 'paid';
  if (normalized === 'full') return 'full';
  if (normalized === 'partial') return 'partial';
  if (normalized === 'pending') return 'pending';
  return normalized;
}

function matchesEmployeePaymentFilter(row: SubmissionRow, filter: EmployeePaymentFilter) {
  if (filter === 'all') return true;
  const paymentReceived = normalizeStatusValue(row.payment_received);
  return paymentReceived === filter;
}

export default function EmployeeSubmissionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useDashboardSession();
  const [query, setQuery] = useState('');
  const [intakeStatusFilter, setIntakeStatusFilter] = useState<'all' | SubmissionRow['intake_status']>('all');
  const [versionStatusFilter, setVersionStatusFilter] = useState<'all' | NonNullable<SubmissionRow['version_status']>>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<EmployeePaymentFilter>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [rowsError, setRowsError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) return;

    setRowsLoading(true);
    setRowsError('');

    fetch('/api/submissions/my', { method: 'GET', cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Failed to load submissions.');
        }
        const mapped = ((json.submissions ?? []) as MySubmissionApiRow[]).map((item): SubmissionRow => ({
          id: String(item.id),
          pi: item.proforma_invoice ?? '',
          entity: item.agency_brand_name || '-',
          amount: Number(item.commercials ?? 0),
          currency: item.currency || 'INR',
          owner_name: user.full_name || undefined,
          submitter_email: item.email_address || user.email || undefined,
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
          creator_invoice_received: normalizeStatusValue(item.creator_invoice_status) || undefined,
          payment_received: normalizeStatusValue(item.payment_received_status || item.payment_received) || undefined,
          payment_made: normalizeStatusValue(item.payment_made_status || item.payment_made) || undefined,
          business_line: item.business_line || null,
          entry_type: item.entry_type || null,
          entity_type: item.entity_type || null,
          client_type: item.client_type || null,
          agency_name: item.agency_name || null,
          agency_trade_name: item.agency_trade_name || null,
          brand_trade_name: item.brand_trade_name || null,
          intake_line_items: item.intake_line_items || [],
        }));
        const piById = new Map(mapped.map((entry) => [entry.id, entry.pi]));
        const newerByPreviousId = new Set(mapped.map((entry) => entry.previous_submission_id).filter(Boolean));
        const versioned = mapped.map((entry) => ({
          ...entry,
          previous_submission_pi: entry.previous_submission_id ? piById.get(entry.previous_submission_id) || null : null,
          version_status: entry.previous_submission_id
            ? 'resubmitted'
            : newerByPreviousId.has(entry.id)
              ? 'superseded'
              : 'original',
        })) satisfies SubmissionRow[];
        if (active) setRows(versioned);
      })
      .catch((error) => {
        if (active) setRowsError(error instanceof Error ? error.message : 'Failed to load submissions.');
      })
      .finally(() => {
        if (active) setRowsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (intakeStatusFilter !== 'all' && row.intake_status !== intakeStatusFilter) return false;
      if (versionStatusFilter !== 'all' && (row.version_status || 'original') !== versionStatusFilter) return false;
      if (!matchesEmployeePaymentFilter(row, paymentStatusFilter)) return false;

      if (!normalizedQuery) return true;

      const piMeta = getPiDisplayMeta({
        pi: row.pi,
        submittedAt: row.submitted_at,
        invoiceType: row.invoice_type,
        lineItems: row.intake_line_items,
      });
      const haystack = [
        row.pi,
        piMeta.label,
        piMeta.title,
        row.entity,
        row.brand_name,
        row.creator_creators_name,
        row.campaign_brand,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [intakeStatusFilter, paymentStatusFilter, query, rows, versionStatusFilter]);
  const row = useMemo(() => filteredRows.find((entry) => entry.id === openId) || null, [filteredRows, openId]);
  const activeAdvancedFilterCount = [versionStatusFilter !== 'all', paymentStatusFilter !== 'all'].filter(Boolean).length;

  function resetAdvancedFilters() {
    setVersionStatusFilter('all');
    setPaymentStatusFilter('all');
  }

  useEffect(() => {
    const submissionId = searchParams.get('submission_id');
    if (!submissionId) return;
    if (rows.some((entry) => entry.id === submissionId)) {
      setOpenId(submissionId);
    }
  }, [rows, searchParams]);

  if (loading || !user) return null;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        title={getSubmissionsLabel(user.role)}
        description="Review your intake records, status updates, resubmission notes, and resubmission actions."
        className="border-b-0 pb-4"
        actions={canSubmitInvoice(user.role) ? (
          <Link className="btn btn-primary" href="/dashboard/submissions/new">
            New Submission
          </Link>
        ) : null}
      />

      <SectionCard padding={16}>
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_auto]">
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
              <select className="intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20" value={intakeStatusFilter} onChange={(e) => setIntakeStatusFilter(e.target.value as 'all' | SubmissionRow['intake_status'])}>
                <option value="all">All</option>
                <option value="submitted">Submitted</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <div className="flex items-end">
              <button className="btn w-full md:w-auto" type="button" onClick={() => setShowAdvancedFilters((current) => !current)}>
                More Filters{activeAdvancedFilterCount > 0 ? ` (${activeAdvancedFilterCount})` : ''}
              </button>
            </div>
          </div>

          {showAdvancedFilters ? (
            <div className="rounded-xl border border-border/60 bg-card/90 p-3 dark:bg-card/70">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Version Status</span>
                  <select
                    className="intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20"
                    value={versionStatusFilter}
                    onChange={(e) => setVersionStatusFilter(e.target.value as 'all' | NonNullable<SubmissionRow['version_status']>)}
                  >
                    <option value="all">All</option>
                    <option value="original">Original</option>
                    <option value="resubmitted">Resubmitted</option>
                    <option value="superseded">Superseded</option>
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Payment Status</span>
                  <select className="intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20" value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value as EmployeePaymentFilter)}>
                    <option value="all">All</option>
                    {PAYMENT_RECEIVED_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <button className="btn" type="button" onClick={resetAdvancedFilters}>Reset Advanced</button>
              </div>
            </div>
          ) : null}
        </div>
      </SectionCard>

      {rowsLoading ? <StatePanel padding={12}>Loading submissions...</StatePanel> : null}
      {rowsError ? <StatePanel tone="danger" padding={12}>{rowsError}</StatePanel> : null}
      {!rowsLoading && !rowsError ? (
        <SubmissionTable
          rows={filteredRows}
          onOpen={(id, selectedRow) => {
            if (user.role === 'employee' && selectedRow?.intake_status === 'rejected') {
              router.push(`/dashboard/submissions/new?resubmit_id=${id}`);
              return;
            }
            setOpenId(id);
          }}
          columns={['pi', 'entity', 'amount', 'intake_status', 'invoice_status', 'submitted_at', 'rejection_note', 'actions']}
          emptyLabel="No submissions found yet."
          getActionLabel={(row) => user.role === 'employee' && row.intake_status === 'rejected' ? 'Resubmit' : 'View'}
          viewer={user.role}
        />
      ) : null}

      <SubmissionDrawer
        open={Boolean(row)}
        onClose={() => setOpenId(null)}
        row={row}
        viewer={getDrawerViewerRole(user.role)}
        onResubmit={(id) => {
          router.push(`/dashboard/submissions/new?resubmit_id=${id}`);
        }}
      />
    </div>
  );
}
