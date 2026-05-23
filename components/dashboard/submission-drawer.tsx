import type { SubmissionRow } from './submission-table';
import { canResubmitSubmission, canViewFinanceFields, canViewInvoiceStatus, canViewSystemFields } from '../../lib/client/dashboard-access';

function money(value: number | null | undefined) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}

function isBlank(value: React.ReactNode) {
  return value === undefined || value === null || value === '' || value === false;
}

function cleanFullAddress(address: string | null | undefined, metadata: SubmissionRow['integration_metadata']) {
  if (!address) return '';
  const tokensToRemove = [metadata?.pincode, metadata?.country, metadata?.state, metadata?.city]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  while (parts.length && tokensToRemove.includes(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }

  return parts.join(', ') || address;
}

function DetailItem({
  label,
  value,
  alwaysShow = false,
}: {
  label: string;
  value: React.ReactNode;
  alwaysShow?: boolean;
}) {
  if (!alwaysShow && isBlank(value)) return null;

  return (
    <div className="surface" style={{ padding: 12 }}>
      <div className="text-muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 600, whiteSpace: 'pre-wrap' }}>{value || '-'}</div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <h4 style={{ margin: '8px 0 0', fontSize: 13, letterSpacing: 0, textTransform: 'uppercase' }} className="text-muted">
        {title}
      </h4>
      <div style={{ display: 'grid', gap: 10 }}>{children}</div>
    </section>
  );
}

export function SubmissionDrawer({
  open,
  onClose,
  row,
  viewer,
  onResubmit,
}: {
  open: boolean;
  onClose: () => void;
  row: SubmissionRow | null;
  viewer: 'employee' | 'team_lead' | 'finance' | 'admin' | 'developer';
  onResubmit?: (id: string) => void;
}) {
  if (!open || !row) return null;

  const canSeeFinanceFields = canViewFinanceFields(viewer);
  const canSeeSystemFields = canViewSystemFields(viewer);
  const canSeeInvoice = canViewInvoiceStatus(viewer) || viewer === 'employee';
  const canResubmit = viewer === 'employee' || canResubmitSubmission(viewer, row);
  const metadata = row.integration_metadata;
  const lineItems = [...(row.intake_line_items || [])].sort((a, b) => (a.line_order ?? 0) - (b.line_order ?? 0));
  const isIM = metadata?.businessLine === 'IM';
  const isIndianClient = metadata?.clientType === 'Indian' || (!metadata?.clientType && Boolean(row.gst_number));
  const cleanAddress = cleanFullAddress(row.address, metadata);
  const versionLabel =
    row.version_status === 'resubmitted'
      ? 'Resubmitted version'
      : row.version_status === 'superseded'
        ? 'Superseded by newer submission'
        : 'Original submission';
  const agencyName = metadata?.entityType === 'Agency' ? row.entity : '';
  const agencyTradeName = metadata?.entityType === 'Agency' ? row.trade_name : '';
  const billingBrandName = metadata?.entityType === 'Agency' ? metadata?.billingBrandName || row.brand_name : row.entity;
  const billingBrandTradeName = metadata?.entityType === 'Brand' ? row.trade_name : '';

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Submission Details</h3>
          <button className="btn" type="button" onClick={onClose}>Close</button>
        </div>

        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          <DetailSection title="Submission Info">
            <DetailItem label="Version Status" value={versionLabel} alwaysShow />
            {row.previous_submission_id ? <DetailItem label="Previous Submission ID" value={row.previous_submission_id} /> : null}
            <DetailItem label="Proforma Invoice" value={row.pi} alwaysShow />
            <DetailItem label="Intake Status" value={row.intake_status} alwaysShow />
            {canSeeInvoice ? <DetailItem label="Invoice Status" value={row.invoice_status || '-'} alwaysShow /> : null}
            <DetailItem label="Submitted At" value={new Date(row.submitted_at).toLocaleString()} alwaysShow />
            <DetailItem label="Submitter Name" value={metadata?.submitterName || row.owner_name} />
            <DetailItem label="Submitter Email" value={row.submitter_email} />
          </DetailSection>

          <DetailSection title="Business Workflow">
            <DetailItem label="Business Line" value={metadata?.businessLine} />
            <DetailItem label="Entry Type" value={metadata?.entryType || (isIM ? 'IM Campaign' : '')} />
          </DetailSection>

          <DetailSection title="Billing Entity">
            <DetailItem label="Entity Type" value={metadata?.entityType} />
            <DetailItem label="Client Type" value={metadata?.clientType} />
            <DetailItem label="Agency Name" value={agencyName} />
            <DetailItem label="Agency Trade Name / Legal Name" value={agencyTradeName} />
            <DetailItem label="Brand Name" value={billingBrandName} />
            <DetailItem label="Brand Trade Name / Legal Name" value={billingBrandTradeName} />
            {isIndianClient ? <DetailItem label="GST Number" value={row.gst_number} /> : null}
            <DetailItem label="Full Address" value={cleanAddress} />
            <DetailItem label="City" value={metadata?.city} />
            <DetailItem label="State" value={metadata?.state} />
            <DetailItem label="Country" value={metadata?.country} />
            <DetailItem label="Pincode" value={metadata?.pincode} />
          </DetailSection>

          <DetailSection title="Invoice">
            <DetailItem label="Invoice Type" value={row.invoice_type} />
            <DetailItem label="Bill Due" value={row.bill_due} />
          </DetailSection>

          {isIM ? (
            <DetailSection title="Campaign Details">
              <DetailItem label="Campaign Code" value={metadata?.campaignCode} />
              <DetailItem label="Campaign Name" value={metadata?.campaignName} />
              <DetailItem label="Campaign Brand" value={metadata?.campaignBrand || row.brand_name} />
              <DetailItem label="Deliverable" value={metadata?.campaignDeliverable || row.deliverables} />
              <DetailItem label="Campaign Notes" value={metadata?.campaignNotes} />
            </DetailSection>
          ) : (
            <DetailSection title="Creator / Deliverables">
              <DetailItem label="Creator Name" value={row.creator_creators_name} />
              <DetailItem label="Brand Name" value={row.brand_name || metadata?.brandNamesText} />
              <DetailItem label="Deliverables" value={row.deliverables} />
              {lineItems.length ? (
                <div className="surface" style={{ padding: 12, overflowX: 'auto' }}>
                  <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Line Items</div>
                  <table className="table" style={{ minWidth: 520 }}>
                    <thead>
                      <tr>
                        <th>Creator</th>
                        <th>Brand</th>
                        <th>Deliverable</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, index) => (
                        <tr key={`${item.creator_name || 'creator'}-${item.deliverable_name || 'deliverable'}-${index}`}>
                          <td>{item.creator_name || '-'}</td>
                          <td>{item.brand_name || '-'}</td>
                          <td>{item.deliverable_name || '-'}</td>
                          <td>{money(item.amount || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </DetailSection>
          )}

          <DetailSection title="Commercials">
            <DetailItem label="Total Amount" value={money(row.amount)} alwaysShow />
            {(row.additional_agency_commission || 0) > 0 ? (
              <DetailItem label="Additional Agency Commission" value={money(row.additional_agency_commission)} />
            ) : null}
          </DetailSection>

          <DetailSection title="Additional">
            <DetailItem label="Internal Notes / Additional Information" value={row.additional_information} />
            {(row.reimbursement_amount || 0) > 0 ? <DetailItem label="Product Reimbursement Amount" value={money(row.reimbursement_amount)} /> : null}
            <DetailItem label="Reimbursement/Product Reimbursement File Info" value={row.reimbursement_receipts} />
          </DetailSection>

          {row.rejection_note ? (
            <DetailSection title="Review">
              <DetailItem label="Rejection Note" value={row.rejection_note} />
            </DetailSection>
          ) : null}
          {canSeeFinanceFields ? (
            <DetailSection title="Finance">
              <DetailItem label="Creator Invoice" value={row.creator_invoice_received || 'pending'} />
              <DetailItem label="Payment Received" value={row.payment_received || 'pending'} />
              <DetailItem label="Payment Made" value={row.payment_made || 'pending'} />
              <DetailItem label="Closed Status" value={row.closed_status || 'open'} />
              <DetailItem label="Comments" value={row.comments || 'No finance comments yet.'} />
            </DetailSection>
          ) : null}
          {canSeeSystemFields ? (
            <DetailSection title="System">
              <DetailItem label="Sync Status" value={row.sync_status} />
            </DetailSection>
          ) : null}
          {canResubmit ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" type="button" onClick={() => onResubmit?.(row.id)}>Edit / Resubmit</button>
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
