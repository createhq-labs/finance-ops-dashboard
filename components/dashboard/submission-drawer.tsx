import type { SubmissionRow } from './submission-table';
import { canResubmitSubmission, canViewFinanceFields, canViewInvoiceStatus, canViewSystemFields } from '../../lib/client/dashboard-access';

export function SubmissionDrawer({
  open,
  onClose,
  row,
  viewer,
}: {
  open: boolean;
  onClose: () => void;
  row: SubmissionRow | null;
  viewer: 'employee' | 'team_lead' | 'finance' | 'admin' | 'developer';
}) {
  if (!open || !row) return null;

  const canSeeFinanceFields = canViewFinanceFields(viewer);
  const canSeeSystemFields = canViewSystemFields(viewer);
  const canSeeInvoice = canViewInvoiceStatus(viewer);
  const canResubmit = canResubmitSubmission(viewer, row);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Submission Details</h3>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          <div className="surface" style={{ padding: 12 }}>
            <div className="text-muted" style={{ fontSize: 12 }}>Proforma Invoice</div>
            <div style={{ fontWeight: 600 }}>{row.pi}</div>
          </div>
          <div className="surface" style={{ padding: 12 }}>
            <div className="text-muted" style={{ fontSize: 12 }}>Entity</div>
            <div style={{ fontWeight: 600 }}>{row.entity}</div>
          </div>
          <div className="surface" style={{ padding: 12 }}>
            <div className="text-muted" style={{ fontSize: 12 }}>Amount</div>
            <div style={{ fontWeight: 600 }}>
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(row.amount)}
            </div>
          </div>
          <div className="surface" style={{ padding: 12 }}>
            <div className="text-muted" style={{ fontSize: 12 }}>Intake Status</div>
            <div style={{ fontWeight: 600 }}>{row.intake_status}</div>
          </div>
          {row.rejection_note ? (
            <div className="surface" style={{ padding: 12 }}>
              <div className="text-muted" style={{ fontSize: 12 }}>Rejection Note</div>
              <div style={{ fontWeight: 600 }}>{row.rejection_note}</div>
            </div>
          ) : null}
          {canSeeInvoice ? (
            <div className="surface" style={{ padding: 12 }}>
              <div className="text-muted" style={{ fontSize: 12 }}>Invoice Status</div>
              <div style={{ fontWeight: 600 }}>{row.invoice_status || '-'}</div>
            </div>
          ) : null}
          {canSeeFinanceFields ? (
            <>
              <div className="surface" style={{ padding: 12 }}>
                <div className="text-muted" style={{ fontSize: 12 }}>Creator Invoice</div>
                <div style={{ fontWeight: 600 }}>{row.creator_invoice_received || 'pending'}</div>
              </div>
              <div className="surface" style={{ padding: 12 }}>
                <div className="text-muted" style={{ fontSize: 12 }}>Payment Received</div>
                <div style={{ fontWeight: 600 }}>{row.payment_received || 'pending'}</div>
              </div>
              <div className="surface" style={{ padding: 12 }}>
                <div className="text-muted" style={{ fontSize: 12 }}>Payment Made</div>
                <div style={{ fontWeight: 600 }}>{row.payment_made || 'pending'}</div>
              </div>
              <div className="surface" style={{ padding: 12 }}>
                <div className="text-muted" style={{ fontSize: 12 }}>Closed Status</div>
                <div style={{ fontWeight: 600 }}>{row.closed_status || 'open'}</div>
              </div>
              <div className="surface" style={{ padding: 12 }}>
                <div className="text-muted" style={{ fontSize: 12 }}>Comments</div>
                <div style={{ fontWeight: 600 }}>{row.comments || 'No finance comments yet.'}</div>
              </div>
            </>
          ) : null}
          {canSeeSystemFields ? (
            <div className="surface" style={{ padding: 12 }}>
              <div className="text-muted" style={{ fontSize: 12 }}>Sync Status</div>
              <div style={{ fontWeight: 600 }}>{row.sync_status}</div>
            </div>
          ) : null}
          {canResubmit ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" type="button">Resubmit Intake</button>
            </div>
          ) : null}
          {canSeeFinanceFields ? (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn" type="button">Reject with Note</button>
              <button className="btn btn-primary" type="button">Accept Submission</button>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
