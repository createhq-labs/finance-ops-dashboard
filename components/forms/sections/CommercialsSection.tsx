import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  totalAmount: string;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
  errors?: Record<string, string>;
};

export function CommercialsSection({ values, totalAmount, onChange, errors = {} }: Props) {
  const isInfluencerMarketing = values.businessLine === "IM";

  return (
    <section className="intake-section">
      <div className="intake-section-header">
        <div>
          <h3 className="intake-section-title">Commercials</h3>
          <p className="text-muted intake-section-copy">The total is derived from SC and MC line items, while IM requires an explicit total amount.</p>
        </div>
      </div>

      <div className="intake-section-body intake-form-grid">
        <label className="intake-field">
          <span className="intake-label">{isInfluencerMarketing ? "Commercials / Total Amount (INR) *" : "Total Amount (INR)"}</span>
          <input
            className="intake-input"
            type="number"
            min={0}
            step="0.01"
            value={isInfluencerMarketing ? values.imCommercials : totalAmount}
            readOnly={!isInfluencerMarketing}
            placeholder={isInfluencerMarketing ? "Enter commercials" : "Auto-calculated from rows"}
            onChange={(e) => onChange("imCommercials", e.target.value)}
            data-field="imCommercials"
          />
          {errors.imCommercials ? <p className="text-danger intake-inline-error">{errors.imCommercials}</p> : null}
        </label>

        <label className="intake-field">
          <span className="intake-label">Additional Agency Commission (INR)</span>
          <input className="intake-input" type="number" min={0} step="0.01" value={values.commission} onChange={(e) => onChange("commission", e.target.value)} data-field="commission" />
        </label>
      </div>
    </section>
  );
}
