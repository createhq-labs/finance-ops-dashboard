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
          <p className="text-muted intake-section-copy">Add relevant details like PO numbers or special instructions.</p>
        </div>
      </div>

      <div className="intake-section-body" style={{ display: "grid", gap: 12 }}>
        <label className="intake-field">
          <span className="intake-label">Internal Notes / Additional Information</span>
          <textarea
            ref={textareaRef}
            className="intake-input intake-textarea"
            rows={1}
            value={values.additionalInformation}
            onChange={(e) => onChange("additionalInformation", e.target.value)}
            data-field="additionalInformation"
            style={{ minHeight: 36, maxHeight: 160, overflowY: "auto", resize: "vertical" }}
          />
          <div style={{ minHeight: 16 }}>
            {errors.additionalInformation ? <p className="text-danger intake-inline-error">{errors.additionalInformation}</p> : null}
          </div>
        </label>
      </div>
    </section>
  );
}
