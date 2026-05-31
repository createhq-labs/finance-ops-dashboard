"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { SubmissionDrawer } from '../../../../components/dashboard/submission-drawer';
import { SubmissionTable, type SubmissionRow } from '../../../../components/dashboard/submission-table';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { canSubmitInvoice, getDrawerViewerRole, getSubmissionsLabel } from '../../../../lib/client/dashboard-access';

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
  business_line?: 'TM' | 'IM' | null;
  entity_type?: 'Agency' | 'Brand' | null;
  client_type?: 'Indian' | 'Foreign' | null;
  agency_name?: string | null;
  agency_trade_name?: string | null;
  brand_trade_name?: string | null;
  integration_metadata: SubmissionRow['integration_metadata'];
  intake_line_items: SubmissionRow['intake_line_items'];
  intake_status: SubmissionRow['intake_status'];
  invoice_status: string | null;
  submitted_at: string | null;
  rejection_note: string | null;
};

export default function EmployeeSubmissionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useDashboardSession();
  const [query, setQuery] = useState('');
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
          pi: item.proforma_invoice || '-',
          entity: item.agency_brand_name || '-',
          amount: Number(item.commercials ?? 0),
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
          business_line: item.business_line || null,
          entity_type: item.entity_type || null,
          client_type: item.client_type || null,
          agency_name: item.agency_name || null,
          agency_trade_name: item.agency_trade_name || null,
          brand_trade_name: item.brand_trade_name || null,
          integration_metadata: item.integration_metadata || null,
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

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) => row.entity.toLowerCase().includes(query.toLowerCase()) || row.pi.toLowerCase().includes(query.toLowerCase()) || (row.owner_name || '').toLowerCase().includes(query.toLowerCase())
      ),
    [query, rows]
  );
  const row = useMemo(() => filteredRows.find((entry) => entry.id === openId) || null, [filteredRows, openId]);

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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>{getSubmissionsLabel(user.role)}</h1>
          <p className="text-muted">This page is limited to your own intake records, status updates, rejection notes, and resubmission actions.</p>
        </div>
        {canSubmitInvoice(user.role) ? (
          <Link className="btn btn-primary" href="/dashboard/submissions/new">
            New Submission
          </Link>
        ) : null}
      </header>

      <div className="surface" style={{ padding: 12 }}>
        <input
          placeholder="Search by PI or Entity"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)' }}
        />
      </div>

      {rowsLoading ? <div className="surface text-muted" style={{ padding: 12 }}>Loading submissions...</div> : null}
      {rowsError ? <div className="surface text-danger" style={{ padding: 12 }}>{rowsError}</div> : null}
      {!rowsLoading && !rowsError ? (
        <SubmissionTable
          rows={filteredRows}
          onOpen={setOpenId}
          columns={['pi', 'entity', 'amount', 'intake_status', 'invoice_status', 'submitted_at', 'rejection_note', 'actions']}
          emptyLabel="No submissions found yet."
          getActionLabel={() => 'View'}
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
