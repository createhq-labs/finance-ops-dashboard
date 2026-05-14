import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
};

export function ReimbursementSection({ values, onChange }: Props) {
  const showReimbursementFields = values.reimbursementIncluded === "yes";

  return (
    <section className="intake-section">
      <div className="intake-section-header">
        <div>
          <h3 className="intake-section-title">Reimbursement</h3>
          <p className="text-muted intake-section-copy">Capture reimbursement only when applicable for this submission.</p>
        </div>
      </div>

      <div className="intake-section-body" style={{ display: "grid", gap: 14 }}>
        <label className="intake-field">
          <span className="intake-label">Includes reimbursement?</span>
          <div className="intake-toggle-group">
            <button
              type="button"
              className={values.reimbursementIncluded === "yes" ? "intake-toggle intake-toggle-active" : "intake-toggle"}
              onClick={() => onChange("reimbursementIncluded", "yes")}
            >
              Yes
            </button>
            <button
              type="button"
              className={values.reimbursementIncluded === "no" ? "intake-toggle intake-toggle-active" : "intake-toggle"}
              onClick={() => onChange("reimbursementIncluded", "no")}
            >
              No
            </button>
          </div>
        </label>

        {showReimbursementFields ? (
          <>
            <label className="intake-field">
              <span className="intake-label">Reimbursement Amount (INR)</span>
              <input
                className="intake-input"
                type="number"
                min={0}
                step="0.01"
                placeholder="Enter reimbursement amount"
                value={values.reimbursementAmount}
                onChange={(e) => onChange("reimbursementAmount", e.target.value)}
              />
            </label>

            <label className="intake-field">
              <span className="intake-label">Reimbursement Invoices/Receipts</span>
              <p className="text-muted intake-section-copy" style={{ marginTop: 0 }}>
                Add the invoices/receipts via creators for reimbursements.
                Upload up to 10 supported files: PDF, document, image or spreadsheet. Max 100 MB per file.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn" type="button" disabled>
                  Upload Files (Placeholder)
                </button>
                <input
                  className="intake-input"
                  type="url"
                  placeholder="Paste receipt link/reference (optional)"
                  value={values.reimbursementProof}
                  onChange={(e) => onChange("reimbursementProof", e.target.value)}
                />
              </div>
            </label>
          </>
        ) : null}
      </div>
    </section>
  );
}
