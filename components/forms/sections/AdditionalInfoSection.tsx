import { useEffect, useRef } from "react";
import { AttachmentUploadField } from "../invoice-line-items";
import type { ExistingInvoiceAttachment, InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  referencePoFile: File | null;
  referencePoError?: string;
  existingReferencePoAttachment?: ExistingInvoiceAttachment | null;
  referencePoAttachmentRemoved?: boolean;
  onReferencePoFileChange: (key: string, file: File | null) => void;
  onViewExistingReferencePoAttachment?: (attachment: ExistingInvoiceAttachment) => void;
  onRemoveExistingReferencePoAttachment?: () => void;
  onRetainExistingReferencePoAttachment?: () => void;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
  errors?: Record<string, string>;
};

export function AdditionalInfoSection({
  values,
  referencePoFile,
  referencePoError = "",
  existingReferencePoAttachment = null,
  referencePoAttachmentRemoved = false,
  onReferencePoFileChange,
  onViewExistingReferencePoAttachment,
  onRemoveExistingReferencePoAttachment,
  onRetainExistingReferencePoAttachment,
  onChange,
  errors = {},
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(Math.max(element.scrollHeight, 56), 140)}px`;
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
              <div style={{ position: "relative" }}>
                <textarea
                  ref={textareaRef}
                  className="intake-input intake-textarea"
                  rows={1}
                  value={values.additionalInformation}
                  onChange={(e) => onChange("additionalInformation", e.target.value)}
                  data-field="additionalInformation"
                  style={{ minHeight: 56, maxHeight: 140, overflowY: "auto", resize: "none", paddingRight: 24, paddingBottom: 18 }}
                />
               <span
  aria-hidden="true"
  style={{
    position: "absolute",
    right: 10,
    bottom: 9,
    pointerEvents: "none",
    color: "var(--text-muted)",
    fontSize: 11,
    lineHeight: 1,
    letterSpacing: "-0.08em",
    opacity: 0.9,
  }}
>
  {"//"}
</span>
              </div>
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
                titleText="Attach reference PO file"
                helperText="PDF, PNG, JPG, or WEBP. Max 10 MB."
                existingAttachment={existingReferencePoAttachment}
                existingAttachmentRemoved={referencePoAttachmentRemoved}
                onViewExistingAttachment={onViewExistingReferencePoAttachment}
                onRemoveExistingAttachment={onRemoveExistingReferencePoAttachment}
                onRetainExistingAttachment={onRetainExistingReferencePoAttachment}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
