import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
};

export function AdditionalInfoSection({ values, onChange }: Props) {
  return (
    <section className="intake-section">
      <div className="intake-section-header">
        <div>
          <h3 className="intake-section-title">Additional Information</h3>
          <p className="text-muted intake-section-copy">Use this space for the internal notes and supporting context that finance should see with the submission.</p>
        </div>
      </div>

      <div className="intake-section-body">
        <label className="intake-field">
          <span className="intake-label">Internal Notes / Additional Information</span>
          <textarea className="intake-input intake-textarea" rows={4} value={values.additionalInformation} onChange={(e) => onChange("additionalInformation", e.target.value)} />
        </label>
      </div>
    </section>
  );
}
