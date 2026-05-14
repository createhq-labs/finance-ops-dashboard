import { BILL_DUE_OPTIONS, INVOICE_TYPES } from "../constants";
import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
};

export function InvoiceDetailsSection({ values, onChange }: Props) {
  return (
    <section className="intake-section">
      <div className="intake-section-header">
        <div>
          <h3 className="intake-section-title">Invoice and Finance</h3>
          <p className="text-muted intake-section-copy">Set the invoice type and payment terms used downstream by the finance team.</p>
        </div>
      </div>

      <div className="intake-section-body intake-form-grid">
        <label className="intake-field">
          <span className="intake-label">Invoice Type</span>
          <select className="intake-input" value={values.invoiceType} onChange={(e) => onChange("invoiceType", e.target.value)} required>
            {INVOICE_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="intake-field">
          <span className="intake-label">Bill Due</span>
          <select className="intake-input" value={values.billDue} onChange={(e) => onChange("billDue", e.target.value)} required>
            {BILL_DUE_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
