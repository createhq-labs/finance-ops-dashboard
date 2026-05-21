import { getBrandOptions, getDeliverableOptions } from "../constants";
import { MultiCreatorRows, SingleCreatorRows } from "../invoice-line-items";
import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
  addScDeliverable: () => void;
  removeScDeliverable: (index: number) => void;
  patchScDeliverable: (index: number, patch: { deliverable?: string; amount?: string }) => void;
  addMcRow: () => void;
  removeMcRow: (index: number) => void;
  patchMcRow: (index: number, patch: { creator?: string; brand?: string; deliverable?: string; amount?: string }) => void;
  getProductReimbursementFile: (key: string) => File | null;
  getProductReimbursementError: (key: string) => string;
  onProductReimbursementFileChange: (key: string, file: File | null) => void;
};

export function CreatorDeliverablesSection({
  values,
  onChange,
  addScDeliverable,
  removeScDeliverable,
  patchScDeliverable,
  addMcRow,
  removeMcRow,
  patchMcRow,
  getProductReimbursementFile,
  getProductReimbursementError,
  onProductReimbursementFileChange,
}: Props) {
  if (values.businessLine === "TM" && values.entryType === "SC") {
    return (
      <SingleCreatorRows
        businessLine={values.businessLine}
        scCreator={values.scCreator}
        scBrand={values.scBrand}
        rows={values.scDeliverables}
        getProductReimbursementFile={getProductReimbursementFile}
        getProductReimbursementError={getProductReimbursementError}
        onCreatorChange={(value) => onChange("scCreator", value)}
        onBrandChange={(value) => onChange("scBrand", value)}
        onAddRow={addScDeliverable}
        onRemoveRow={removeScDeliverable}
        onRowChange={patchScDeliverable}
        onProductReimbursementFileChange={onProductReimbursementFileChange}
      />
    );
  }

  if (values.businessLine === "TM" && values.entryType === "MC") {
    return (
      <MultiCreatorRows
        businessLine={values.businessLine}
        rows={values.mcRows}
        getProductReimbursementFile={getProductReimbursementFile}
        getProductReimbursementError={getProductReimbursementError}
        onAddRow={addMcRow}
        onRemoveRow={removeMcRow}
        onRowChange={patchMcRow}
        onProductReimbursementFileChange={onProductReimbursementFileChange}
      />
    );
  }

  return (
    <section className="intake-section">
      <div className="intake-section-header">
        <div>
          <h3 className="intake-section-title">Campaign Details</h3>
          <p className="text-muted intake-section-copy">Capture the campaign reference, brand, deliverable, and any internal notes for IM submissions.</p>
        </div>
      </div>

      <div className="intake-section-body intake-form-grid">
        <label className="intake-field">
          <span className="intake-label">Campaign Code</span>
          <input className="intake-input" value={values.campaignCode} onChange={(e) => onChange("campaignCode", e.target.value)} />
        </label>

        <label className="intake-field">
          <span className="intake-label">Campaign Name</span>
          <input className="intake-input" value={values.campaignName} onChange={(e) => onChange("campaignName", e.target.value)} />
        </label>

        <label className="intake-field">
          <span className="intake-label">Campaign Brand</span>
          <input className="intake-input" list="campaign-brand-options" value={values.campaignBrand} onFocus={(e) => e.currentTarget.select()} onChange={(e) => onChange("campaignBrand", e.target.value)} placeholder="Select or type brand" />
          <datalist id="campaign-brand-options">
            {getBrandOptions().map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>

        <label className="intake-field">
          <span className="intake-label">Deliverable</span>
          <input className="intake-input" list="campaign-deliverable-options" value={values.campaignDeliverable} onFocus={(e) => e.currentTarget.select()} onChange={(e) => onChange("campaignDeliverable", e.target.value)} placeholder="Select or type deliverable" />
          <datalist id="campaign-deliverable-options">
            {getDeliverableOptions(values.businessLine).map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
          {values.campaignDeliverable === "Product Reimbursement" ? (
            <div className="grid gap-1" style={{ marginTop: 8 }}>
              <input
                className="intake-input"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*"
                style={{ width: "fit-content", maxWidth: 320, minWidth: 220 }}
                onChange={(e) => onProductReimbursementFileChange("campaign", e.target.files?.[0] ?? null)}
              />
              <p className="text-muted intake-section-copy" style={{ margin: 0 }}>
                PDF, image, document, or spreadsheet. Ideal size: 5 MB. Hard max: 10 MB.
              </p>
              {getProductReimbursementError("campaign") ? <p className="text-danger intake-inline-error">{getProductReimbursementError("campaign")}</p> : null}
              {getProductReimbursementFile("campaign") ? (
                <p className="text-muted intake-section-copy" style={{ margin: 0 }}>
                  {getProductReimbursementFile("campaign")?.name}
                </p>
              ) : null}
            </div>
          ) : null}
        </label>

        <label className="intake-field intake-field-wide">
          <span className="intake-label">Campaign Notes</span>
          <textarea className="intake-input intake-textarea" rows={3} value={values.campaignNotes} onChange={(e) => onChange("campaignNotes", e.target.value)} />
        </label>
      </div>
    </section>
  );
}
