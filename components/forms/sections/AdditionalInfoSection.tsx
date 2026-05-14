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
          <p className="text-muted intake-section-copy">
            Here add any additional information important for the finance team to know. It could be:
            <br />- Purchase Order Number
            <br />- Additional information or deliverables which need to be mentioned by us or which the brand has asked for
            <br />- If invoice needs to be made in another currency, mention it here like USD, AED, etc.
            <br />
            <br />Note:
            <br />Do not add the deliverable already selected above. For example, if reel is selected, do not add reel + story here. Do not add amount here either.
          </p>
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
