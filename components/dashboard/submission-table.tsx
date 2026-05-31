export type SubmissionRow = {
  id: string;
  pi: string;
  entity: string;
  amount: number;
  owner_name?: string;
  submitter_email?: string;
  intake_status: 'submitted' | 'rejected' | 'accepted';
  invoice_status: string;
  sync_status: 'pending_sheet_sync' | 'synced' | 'failed';
  submitted_at: string;
  rejection_note?: string | null;
  creator_invoice_received?: 'received' | 'pending' | string;
  payment_received?: 'received' | 'pending' | 'partial' | 'full' | 'not_received' | string;
  payment_made?: 'paid' | 'pending' | 'partial' | 'full' | 'not_paid' | string;
  closed_status?: 'open' | 'closed' | 'cancelled' | string;
  comments?: string;
  trade_name?: string | null;
  gst_number?: string | null;
  address?: string | null;
  bill_due?: string | null;
  invoice_type?: string | null;
  creator_creators_name?: string | null;
  brand_name?: string | null;
  campaign_code?: string | null;
  campaign_name?: string | null;
  campaign_brand?: string | null;
  campaign_notes?: string | null;
  deliverables?: string | null;
  additional_agency_commission?: number | null;
  reimbursement_amount?: number | null;
  reimbursement_receipts?: string | null;
  additional_information?: string | null;
  previous_submission_id?: string | null;
  previous_submission_pi?: string | null;
  version_status?: 'original' | 'resubmitted' | 'superseded';
  business_line?: 'TM' | 'IM' | null;
  entity_type?: 'Agency' | 'Brand' | null;
  client_type?: 'Indian' | 'Foreign' | null;
  agency_name?: string | null;
  agency_trade_name?: string | null;
  brand_trade_name?: string | null;
  integration_metadata?: {
    submitterName?: string;
    businessLine?: 'TM' | 'IM';
    entryType?: 'SC' | 'MC' | null;
    entityType?: 'Agency' | 'Brand';
    clientType?: 'Indian' | 'Foreign';
    billingBrandName?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
    campaignCode?: string;
    campaignName?: string;
    campaignBrand?: string;
    campaignDeliverable?: string;
    campaignNotes?: string;
    brandNamesText?: string;
  } | null;
  intake_line_items?: Array<{
    creator_name?: string | null;
    brand_name?: string | null;
    deliverable_name?: string | null;
    amount?: number | null;
    line_order?: number | null;
  }>;
};

export type SubmissionTableColumn =
  | 'pi'
  | 'entity'
  | 'owner_name'
  | 'amount'
  | 'intake_status'
  | 'invoice_status'
  | 'sync_status'
  | 'submitted_at'
  | 'rejection_note'
  | 'actions';

function money(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function badgeClass(row: SubmissionRow) {
  if (row.intake_status === 'accepted') {
    return 'inline-flex items-center rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200';
  }
  if (row.intake_status === 'rejected') {
    return 'inline-flex items-center rounded-lg bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-200';
  }
  return 'inline-flex items-center rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200';
}

function syncClass(sync: SubmissionRow['sync_status']) {
  if (sync === 'synced') {
    return 'inline-flex items-center rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200';
  }
  if (sync === 'failed') {
    return 'inline-flex items-center rounded-lg bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-200';
  }
  return 'inline-flex items-center rounded-lg bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-200';
}

const COLUMN_LABELS: Record<SubmissionTableColumn, string> = {
  pi: 'PI',
  entity: 'Entity',
  owner_name: 'Team Member',
  amount: 'Amount',
  intake_status: 'Status',
  invoice_status: 'Invoice',
  sync_status: 'Sync',
  submitted_at: 'Submitted',
  rejection_note: 'Rejection Note',
  actions: 'Action',
};

function renderCell(column: SubmissionTableColumn, row: SubmissionRow) {
  if (column === 'pi') {
    const piClass =
      row.version_status === 'resubmitted'
        ? 'submission-pi submission-pi-resubmitted'
        : row.version_status === 'superseded'
          ? 'submission-pi submission-pi-superseded'
          : 'submission-pi';

    return (
      <span className={piClass}>{row.pi}</span>
    );
  }
  if (column === 'entity') return <span className="font-medium text-foreground">{row.entity}</span>;
  if (column === 'owner_name') return <span className="text-muted-foreground">{row.owner_name || '—'}</span>;
  if (column === 'amount') return <span className="font-semibold tabular-nums text-foreground">{money(row.amount)}</span>;
  if (column === 'intake_status') return <span className={badgeClass(row)}>{row.intake_status}</span>;
  if (column === 'invoice_status') return <span className="text-sm text-muted-foreground">{row.invoice_status || '—'}</span>;
  if (column === 'sync_status') return <span className={syncClass(row.sync_status)}>{row.sync_status}</span>;
  if (column === 'submitted_at') return <span className="text-xs text-muted-foreground">{new Date(row.submitted_at).toLocaleDateString()}</span>;
  if (column === 'rejection_note') {
    return <span className="text-sm italic text-muted-foreground">{row.intake_status === 'rejected' ? row.rejection_note || 'No note added' : '—'}</span>;
  }
  return null;
}

export function SubmissionTable({
  rows,
  onOpen,
  columns,
  emptyLabel,
  getActionLabel,
}: {
  rows: SubmissionRow[];
  onOpen?: (id: string) => void;
  columns?: SubmissionTableColumn[];
  emptyLabel?: string;
  getActionLabel?: (row: SubmissionRow) => string;
}) {
  const activeColumns = columns || ['pi', 'entity', 'amount', 'intake_status', 'invoice_status', 'sync_status', 'submitted_at', 'actions'];

  return (
    <div className="overflow-x-auto rounded-xl border border-border/70 bg-card/60">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {activeColumns.map((column) => (
              <th key={column} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {COLUMN_LABELS[column]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="cursor-default border-b border-border transition-colors duration-150 hover:bg-muted/30 last:border-b-0">
              {activeColumns.map((column) => (
                <td key={`${r.id}-${column}`} className="px-4 py-3 align-middle">
                  {column === 'actions' ? (
                    <button
                      className="inline-flex items-center rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-foreground transition-all duration-150 hover:border-accent hover:bg-accent/10 hover:text-accent"
                      type="button"
                      onClick={() => onOpen?.(r.id)}
                    >
                      {getActionLabel ? getActionLabel(r) : 'View'}
                    </button>
                  ) : (
                    renderCell(column, r)
                  )}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr><td colSpan={activeColumns.length} className="text-muted">{emptyLabel || 'No submissions yet.'}</td></tr>
          ) : null}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <div className="px-4 py-12 text-center text-muted-foreground">
          {emptyLabel || 'No submissions yet.'}
        </div>
      ) : null}
    </div>
  );
}
