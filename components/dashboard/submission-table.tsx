export type SubmissionRow = {
  id: string;
  pi: string;
  entity: string;
  amount: number;
  owner_name?: string;
  intake_status: 'submitted' | 'rejected' | 'accepted';
  invoice_status: string;
  sync_status: 'pending_sheet_sync' | 'synced' | 'failed';
  submitted_at: string;
  rejection_note?: string | null;
  creator_invoice_received?: 'received' | 'pending';
  payment_received?: 'received' | 'pending';
  payment_made?: 'paid' | 'pending';
  closed_status?: 'open' | 'closed';
  comments?: string;
  trade_name?: string | null;
  gst_number?: string | null;
  address?: string | null;
  bill_due?: string | null;
  invoice_type?: string | null;
  creator_creators_name?: string | null;
  brand_name?: string | null;
  deliverables?: string | null;
  additional_agency_commission?: number | null;
  reimbursement_amount?: number | null;
  reimbursement_receipts?: string | null;
  additional_information?: string | null;
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
  if (row.intake_status === 'accepted') return 'badge badge-accepted';
  if (row.intake_status === 'rejected') return 'badge badge-rejected';
  return 'badge badge-submitted';
}

function syncClass(sync: SubmissionRow['sync_status']) {
  if (sync === 'synced') return 'badge badge-sync-synced';
  if (sync === 'failed') return 'badge badge-sync-failed';
  return 'badge badge-sync-pending';
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
  if (column === 'pi') return row.pi;
  if (column === 'entity') return row.entity;
  if (column === 'owner_name') return row.owner_name || '-';
  if (column === 'amount') return money(row.amount);
  if (column === 'intake_status') return <span className={badgeClass(row)}>{row.intake_status}</span>;
  if (column === 'invoice_status') return row.invoice_status || '-';
  if (column === 'sync_status') return <span className={syncClass(row.sync_status)}>{row.sync_status}</span>;
  if (column === 'submitted_at') return new Date(row.submitted_at).toLocaleDateString();
  if (column === 'rejection_note') return row.intake_status === 'rejected' ? row.rejection_note || 'No note added' : '-';
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
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {activeColumns.map((column) => (
              <th key={column}>{COLUMN_LABELS[column]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {activeColumns.map((column) => (
                <td key={`${r.id}-${column}`}>
                  {column === 'actions' ? (
                    <button className="btn" type="button" onClick={() => onOpen?.(r.id)}>
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
    </div>
  );
}
