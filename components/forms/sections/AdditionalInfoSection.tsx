import { useEffect, useRef } from "react";
import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
  errors?: Record<string, string>;
};

export function AdditionalInfoSection({ values, onChange, errors = {} }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(Math.max(element.scrollHeight, 40), 180)}px`;
  }, [values.additionalInformation]);

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
          <textarea
            ref={textareaRef}
            className="intake-input intake-textarea"
            rows={1}
            value={values.additionalInformation}
            onChange={(e) => onChange("additionalInformation", e.target.value)}
            data-field="additionalInformation"
            style={{ minHeight: 40, maxHeight: 180, overflowY: "auto", resize: "vertical" }}
          />
          {errors.additionalInformation ? <p className="text-danger intake-inline-error">{errors.additionalInformation}</p> : null}
        </label>
      </div>
    </section>
  );
}
