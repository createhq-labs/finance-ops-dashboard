import type { SubmissionRow } from './submission-table';
import {
  formatClosureStatus,
  formatCreatorInvoiceStatus,
  formatInvoiceStatus,
  formatPaymentMadeStatus,
  formatPaymentReceivedStatus,
} from '../../lib/client/finance-status';
import { getPiDisplayMeta } from '../../lib/client/pi-display';
import { formatSubmissionAmount, getCurrencyTitle } from '../../lib/shared/currency';
import { canResubmitSubmission, canViewFinanceFields, canViewInvoiceStatus, canViewSystemFields } from '../../lib/client/dashboard-access';

function money(value: number | null | undefined, currency?: string | null) {
  return formatSubmissionAmount(value || 0, currency);
}

function isBlank(value: React.ReactNode) {
  return value === undefined || value === null || value === '' || value === false;
}

function cleanFullAddress(address: string | null | undefined) {
  if (!address) return '';
  const normalizedAddress = address.trim().replace(/^"+|"+$/g, '');
  const parts = normalizedAddress
    .split(',')
    .map((part) => part.trim().replace(/^"+|"+$/g, ''))
    .filter(Boolean);

  return parts.join(', ') || normalizedAddress;
}

function getAddressSegments(address: string | null | undefined) {
  return String(address || '')
    .split(/[\n,]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getAddressPart(address: string | null | undefined, part: 'city' | 'state' | 'country' | 'pincode') {
  const segments = getAddressSegments(address);
  if (!segments.length) return '';

  const pincodeMatch = String(address || '').match(/\b\d{4,8}\b/);
  const pincode = pincodeMatch?.[0] || '';
  const withoutPincode = segments
    .map((segment) => segment.replace(/\b\d{4,8}\b/g, '').trim())
    .filter(Boolean);

  if (part === 'pincode') return pincode;
  if (part === 'country') return withoutPincode[withoutPincode.length - 1] || '';
  if (part === 'state') return withoutPincode[withoutPincode.length - 2] || '';
  if (part === 'city') return withoutPincode[withoutPincode.length - 3] || '';
  return '';
}

function uniqueCommaSeparated(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const value of values) {
    const parts = String(value || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    for (const part of parts) {
      const key = part.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      ordered.push(part);
    }
  }

  return ordered;
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
  financePanel,
}: {
  open: boolean;
  onClose: () => void;
  row: SubmissionRow | null;
  viewer: 'employee' | 'team_lead' | 'finance' | 'admin' | 'developer';
  onResubmit?: (id: string) => void;
  financePanel?: React.ReactNode;
}) {
  if (!open || !row) return null;

  const canSeeFinanceFields = canViewFinanceFields(viewer);
  const canSeeSystemFields = canViewSystemFields(viewer);
  const canSeeInvoice = canViewInvoiceStatus(viewer) || viewer === 'employee' || viewer === 'team_lead';
  const shouldShowFinanceStatus = viewer === 'employee' || (canSeeFinanceFields && !financePanel);
  const canResubmit = viewer === 'employee' || canResubmitSubmission(viewer, row);
  const lineItems = [...(row.intake_line_items || [])].sort((a, b) => (a.line_order ?? 0) - (b.line_order ?? 0));
  const businessLine = row.business_line || null;
  const entityType = row.entity_type || null;
  const clientType = row.client_type || null;
  const entryType = row.entry_type || null;
  const isIM = businessLine === 'IM';
  const businessLineLabel = businessLine === 'IM' ? 'Influencer Marketing' : businessLine === 'TM' ? 'Talent Management' : '';
  const entryTypeLabel = entryType === 'SC' ? 'Single Creator' : entryType === 'MC' ? 'Multiple Creators' : isIM ? 'IM Campaign' : '';
  const isIndianClient = clientType === 'Indian' || (!clientType && Boolean(row.gst_number));
  const cleanAddress = cleanFullAddress(row.address);
  const versionLabel =
    row.version_status === 'resubmitted'
      ? 'Resubmitted version'
      : row.version_status === 'superseded'
        ? 'Superseded by newer submission'
        : 'Original submission';
  const agencyName = entityType === 'Agency' ? row.agency_name || row.entity : '';
  const agencyTradeName = entityType === 'Agency' ? row.agency_trade_name || row.trade_name : '';
  const billingBrandName =
    entityType === 'Agency'
      ? row.brand_name || ''
      : row.brand_name || row.entity;
  const billingBrandTradeName = entityType === 'Brand' ? row.brand_trade_name || row.trade_name : '';
  const scPrimaryLine = lineItems[0];
  const singleCreatorName = row.creator_creators_name || scPrimaryLine?.creator_name || '';
  const singleCreatorBrand = row.brand_name || scPrimaryLine?.brand_name || '';
  const imDeliverableNames = uniqueCommaSeparated([
    row.deliverables,
    ...lineItems.map((item) => item.deliverable_name),
  ]);
  const imCampaignBrand = row.campaign_brand || row.brand_name || lineItems.find((item) => item.brand_name)?.brand_name || '';
  const resubmissionNote = row.finance_comment || row.rejection_note || '';
  const internalFinanceNotes = row.finance_notes || '';
  const externalFinanceNotes = row.finance_external_notes || '';
  const piDisplay = getPiDisplayMeta({
    pi: row.pi,
    submittedAt: row.submitted_at,
    invoiceType: row.invoice_type,
    lineItems,
  });

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
            {row.previous_submission_pi ? <DetailItem label="Previous Submission" value={row.previous_submission_pi} /> : null}
            <DetailItem
              label="Proforma Invoice"
              value={
                piDisplay.description ? (
                  <div style={{ display: 'grid', gap: 2 }}>
                    <span>{piDisplay.label}</span>
                    <span className="text-muted" style={{ fontSize: 12 }}>{piDisplay.description}</span>
                  </div>
                ) : (
                  piDisplay.label
                )
              }
              alwaysShow
            />
            <DetailItem label="Intake Status" value={row.intake_status} alwaysShow />
            {canSeeInvoice ? <DetailItem label="Invoice Status" value={formatInvoiceStatus(row.invoice_status)} alwaysShow /> : null}
            <DetailItem label="Submitted At" value={new Date(row.submitted_at).toLocaleString()} alwaysShow />
            <DetailItem label="Submitter Name" value={row.owner_name} />
            <DetailItem label="Submitter Email" value={row.submitter_email} />
          </DetailSection>

          <DetailSection title="Business Workflow">
            <DetailItem label="Business Line" value={businessLineLabel} alwaysShow />
            <DetailItem label="Client Type" value={clientType} alwaysShow />
            {!isIM ? <DetailItem label="Entry Type" value={entryTypeLabel} alwaysShow /> : null}
          </DetailSection>

          <DetailSection title="Billing Entity">
            <DetailItem label="Entity Type" value={entityType} />
            {entityType === 'Agency' ? <DetailItem label="Agency Name" value={agencyName} /> : null}
            {entityType === 'Agency' ? <DetailItem label="Agency Trade / Legal Name" value={agencyTradeName} /> : null}
            <DetailItem label="Brand Name" value={billingBrandName} />
            {entityType === 'Brand' ? <DetailItem label="Brand Trade / Legal Name" value={billingBrandTradeName} /> : null}
            {isIndianClient ? <DetailItem label="GST Number" value={row.gst_number} /> : null}
            <DetailItem label="Full Address" value={cleanAddress} />
            <DetailItem label="City" value={getAddressPart(row.address, 'city')} />
            <DetailItem label="State" value={getAddressPart(row.address, 'state')} />
            <DetailItem label="Country" value={getAddressPart(row.address, 'country')} />
            <DetailItem label="Pincode" value={getAddressPart(row.address, 'pincode')} />
          </DetailSection>

          <DetailSection title="Invoice">
            <DetailItem label="Invoice Type" value={row.invoice_type} />
            <DetailItem label="Bill Due" value={row.bill_due} />
          </DetailSection>

          {isIM ? (
            <DetailSection title="Campaign Details">
              <DetailItem label="Campaign Name" value={row.campaign_name} />
              <DetailItem label="Campaign Brand" value={imCampaignBrand} />
              <DetailItem label="Campaign Code" value={row.campaign_code} />
              <DetailItem label="Deliverables" value={imDeliverableNames.join(', ')} />
            </DetailSection>
          ) : (
            <DetailSection title="Creator / Deliverables">
              {entryType === 'SC' ? <DetailItem label="Entry Type" value="Single Creator" /> : null}
              {entryType === 'SC' ? <DetailItem label="Creator Name" value={singleCreatorName} /> : null}
              {entryType === 'SC' ? <DetailItem label="Brand Name" value={singleCreatorBrand} /> : null}
              {entryType === 'SC' ? <DetailItem label="Deliverables" value={row.deliverables} /> : null}
              {entryType === 'MC' ? <DetailItem label="Entry Type" value="Multiple Creators" /> : null}
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
                          <td title={getCurrencyTitle(row.currency, item.amount || 0)}>{money(item.amount || 0, row.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </DetailSection>
          )}

          <DetailSection title="Commercials">
            <DetailItem label="Deal Amount" value={money(row.amount, row.currency)} alwaysShow />
            {(row.reimbursement_amount || 0) > 0 ? (
              <DetailItem
                label="Product Reimbursement"
                value={money(row.reimbursement_amount, row.currency)}
              />
            ) : null}
            {(row.additional_agency_commission || 0) > 0 ? (
              <DetailItem
                label="Additional Agency Commission"
                value={money(row.additional_agency_commission, row.currency)}
              />
            ) : null}
            <DetailItem
              label="Total/Gross Amount"
              value={money(row.amount + (row.additional_agency_commission || 0), row.currency)}
            />
          </DetailSection>

          <DetailSection title="Additional">
            <DetailItem label="Additional Information" value={row.additional_information} />
            <DetailItem label="Reimbursement/Product Reimbursement File Info" value={row.reimbursement_receipts} />
            <DetailItem label="Product Reimbursement File" value={row.product_reimbursement_attachment?.file_name || '-'} />
            <DetailItem label="Reference PO File" value={row.reference_po_attachment?.file_name || '-'} />
          </DetailSection>

          {resubmissionNote ? (
            <DetailSection title="Resubmission Note">
              <DetailItem label="Resubmission Note" value={resubmissionNote} />
            </DetailSection>
          ) : null}
          {shouldShowFinanceStatus ? (
            <DetailSection title="Finance Status">
              <DetailItem label="Invoice Status" value={formatInvoiceStatus(row.invoice_status)} alwaysShow />
              <DetailItem label="Creator Invoice" value={row.creator_invoice_received ? formatCreatorInvoiceStatus(row.creator_invoice_received) : '-'} />
              <DetailItem label="Payment Received" value={row.payment_received ? formatPaymentReceivedStatus(row.payment_received) : '-'} />
              <DetailItem label="Payment Made" value={row.payment_made ? formatPaymentMadeStatus(row.payment_made) : '-'} />
              <DetailItem label="Closure Status" value={formatClosureStatus(row.closed_status || 'open')} />
              {externalFinanceNotes ? <DetailItem label={canSeeFinanceFields ? "Finance External Notes" : "Finance Notes"} value={externalFinanceNotes} /> : null}
              {canSeeFinanceFields && internalFinanceNotes ? <DetailItem label="Finance Internal Notes" value={internalFinanceNotes} /> : null}
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
          {canSeeFinanceFields && financePanel ? financePanel : null}
        </div>
      </aside>
    </div>
  );
}
