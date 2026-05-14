import { ENTITY_TYPES } from "../constants";
import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
};

export function BillingEntitySection({ values, onChange }: Props) {
  return (
    <section className="intake-section">
      <div className="intake-section-header">
        <div>
          <h3 className="intake-section-title">Billing Entity and Address</h3>
          <p className="text-muted intake-section-copy">Capture the billed entity details exactly as they should appear in the finance workflow.</p>
        </div>
      </div>

      <div className="intake-section-body intake-form-grid">
        <label className="intake-field">
          <span className="intake-label">Entity Type</span>
          <select
            className="intake-input"
            value={values.entityType}
            onChange={(e) => onChange("entityType", e.target.value as InvoiceIntakeFormValues["entityType"])}
          >
            {ENTITY_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="intake-field">
          <span className="intake-label">Agency / Brand Name</span>
          <input className="intake-input" value={values.agencyBrandName} onChange={(e) => onChange("agencyBrandName", e.target.value)} required />
        </label>

        <label className="intake-field">
          <span className="intake-label">Agency / Brand Trade Name</span>
          <input className="intake-input" value={values.agencyBrandTradeName} onChange={(e) => onChange("agencyBrandTradeName", e.target.value)} />
        </label>

        <label className="intake-field">
          <span className="intake-label">GST Number</span>
          <input className="intake-input" value={values.gstNumber} onChange={(e) => onChange("gstNumber", e.target.value)} />
        </label>

        <label className="intake-field intake-field-wide">
          <span className="intake-label">Address</span>
          <input className="intake-input" value={values.addressLine} onChange={(e) => onChange("addressLine", e.target.value)} />
        </label>

        <label className="intake-field">
          <span className="intake-label">City</span>
          <input className="intake-input" value={values.city} onChange={(e) => onChange("city", e.target.value)} />
        </label>

        <label className="intake-field">
          <span className="intake-label">State</span>
          <input className="intake-input" value={values.state} onChange={(e) => onChange("state", e.target.value)} />
        </label>

        <label className="intake-field">
          <span className="intake-label">Pincode</span>
          <input className="intake-input" value={values.pincode} onChange={(e) => onChange("pincode", e.target.value)} />
        </label>
      </div>
    </section>
  );
}
