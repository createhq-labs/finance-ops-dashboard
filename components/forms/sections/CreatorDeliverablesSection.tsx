import { MultiCreatorRows, SingleCreatorRows } from "../invoice-line-items";
import { SearchableSelect } from "../searchable-select";
import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
  errors?: Record<string, string>;
  brandOptions: string[];
  creatorOptions: string[];
  deliverableOptions: {
    TM: string[];
    IM: string[];
  };
  addScDeliverable: () => void;
  removeScDeliverable: (index: number) => void;
  patchScDeliverable: (index: number, patch: { deliverable?: string; amount?: string }) => void;
  addMcRow: () => void;
  removeMcRow: (index: number) => void;
  patchMcRow: (index: number, patch: { creator?: string; brand?: string; deliverable?: string; amount?: string }) => void;
  onPatchScCreator: (creator: string) => void;
  onPatchMcCreator: (index: number, creator: string) => void;
  getProductReimbursementFile: (key: string) => File | null;
  getProductReimbursementError: (key: string) => string;
  onProductReimbursementFileChange: (key: string, file: File | null) => void;
};

export function CreatorDeliverablesSection({
  values,
  onChange,
  errors = {},
  brandOptions,
  creatorOptions,
  deliverableOptions,
  addScDeliverable,
  removeScDeliverable,
  patchScDeliverable,
  addMcRow,
  removeMcRow,
  patchMcRow,
  onPatchScCreator,
  onPatchMcCreator,
  getProductReimbursementFile,
  getProductReimbursementError,
  onProductReimbursementFileChange,
}: Props) {
  if (values.businessLine === "TM" && values.entryType === "SC") {
    return (
      <SingleCreatorRows
        scCreator={values.scCreator}
        scBrand={values.scBrand}
        rows={values.scDeliverables}
        errors={errors}
        creatorOptions={creatorOptions}
        brandOptions={brandOptions}
        deliverableOptions={deliverableOptions.TM}
        getProductReimbursementFile={getProductReimbursementFile}
        getProductReimbursementError={getProductReimbursementError}
        onCreatorChange={onPatchScCreator}
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
        rows={values.mcRows}
        errors={errors}
        creatorOptions={creatorOptions}
        brandOptions={brandOptions}
        deliverableOptions={deliverableOptions.TM}
        getProductReimbursementFile={getProductReimbursementFile}
        getProductReimbursementError={getProductReimbursementError}
        onAddRow={addMcRow}
        onRemoveRow={removeMcRow}
        onRowChange={patchMcRow}
        onCreatorChange={onPatchMcCreator}
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
          <span className="intake-label">Campaign Code *</span>
          <input className="intake-input" value={values.campaignCode} onChange={(e) => onChange("campaignCode", e.target.value)} data-field="campaignCode" autoComplete="off" />
          {errors.campaignCode ? <p className="text-danger intake-inline-error">{errors.campaignCode}</p> : null}
        </label>

        <label className="intake-field">
          <span className="intake-label">Campaign Name *</span>
          <input className="intake-input" value={values.campaignName} onChange={(e) => onChange("campaignName", e.target.value)} data-field="campaignName" autoComplete="off" />
          {errors.campaignName ? <p className="text-danger intake-inline-error">{errors.campaignName}</p> : null}
        </label>

        <label className="intake-field">
          <span className="intake-label">Campaign Brand *</span>
          <SearchableSelect value={values.campaignBrand} options={brandOptions} onChange={(next) => onChange("campaignBrand", next)} placeholder="Select brand" data-field="campaignBrand" />
          {errors.campaignBrand ? <p className="text-danger intake-inline-error">{errors.campaignBrand}</p> : null}
        </label>

        <label className="intake-field">
          <span className="intake-label">Deliverable *</span>
          <SearchableSelect
            value={values.campaignDeliverable}
            options={deliverableOptions.IM}
            onChange={(next) => onChange("campaignDeliverable", next)}
            placeholder="Select deliverable"
            data-field="campaignDeliverable"
          />
          {errors.campaignDeliverable ? <p className="text-danger intake-inline-error">{errors.campaignDeliverable}</p> : null}
          {values.campaignDeliverable === "Product Reimbursement" ? (
            <div className="grid gap-1" style={{ marginTop: 8, maxWidth: 320 }}>
              <input
                className="intake-input"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*"
                style={{ width: "fit-content", maxWidth: 280, minWidth: 220 }}
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
          <textarea className="intake-input intake-textarea" rows={3} value={values.campaignNotes} onChange={(e) => onChange("campaignNotes", e.target.value)} data-field="campaignNotes" />
        </label>
        {errors.creatorDeliverables ? <p className="text-danger intake-inline-error">{errors.creatorDeliverables}</p> : null}
      </div>
    </section>
  );
}
