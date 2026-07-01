import { useEffect, useRef } from "react";
import { AttachmentUploadField } from "../invoice-line-items";
import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  referencePoFile: File | null;
  referencePoError?: string;
  onReferencePoFileChange: (key: string, file: File | null) => void;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
  errors?: Record<string, string>;
};

export function AdditionalInfoSection({
  values,
  referencePoFile,
  referencePoError = "",
  onReferencePoFileChange,
  onChange,
  errors = {},
}: Props) {
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
          <h3 className="intake-section-title">Additional Information &amp; PO Reference</h3>
          <p className="text-muted intake-section-copy">Add relevant details and attach the purchase order reference if available.</p>
        </div>
      </div>

      <div className="intake-section-body" style={{ display: "grid", gap: 12 }}>
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'minmax(0, 1fr)',
            alignItems: 'start',
          }}
        >
          <style>{`
            @media (min-width: 900px) {
              .additional-info-po-grid {
                grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.8fr);
              }
            }
          `}</style>
          <div className="additional-info-po-grid" style={{ display: 'grid', gap: 12, alignItems: 'start' }}>
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

            <div className="intake-field">
              <span className="intake-label">Reference PO File</span>
              <AttachmentUploadField
                fieldKey="reference-po"
                file={referencePoFile}
                error={referencePoError}
                onChange={onReferencePoFileChange}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
