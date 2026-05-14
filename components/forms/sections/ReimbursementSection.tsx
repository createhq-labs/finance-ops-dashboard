import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
};

export function ReimbursementSection({ values, onChange }: Props) {
  const showProof = values.invoiceType === "Reimbursement with GST" || values.invoiceType === "Reimbursement without GST";

  if (!showProof) return null;

  return (
    <section className="intake-section">
      <div className="intake-section-header">
        <div>
          <h3 className="intake-section-title">Reimbursement</h3>
          <p className="text-muted intake-section-copy">Attach the reimbursement proof reference used by the original CREATE ledger process.</p>
        </div>
      </div>

      <div className="intake-section-body">
        <label className="intake-field">
          <span className="intake-label">Reimbursement Invoices / Receipts</span>
          <input
            className="intake-input"
            type="url"
            placeholder="Paste receipt or invoice URL"
            value={values.reimbursementProof}
            onChange={(e) => onChange("reimbursementProof", e.target.value)}
          />
        </label>
      </div>
    </section>
  );
}
