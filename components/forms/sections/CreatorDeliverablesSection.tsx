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
}: Props) {
  if (values.businessLine === "TM" && values.entryType === "SC") {
    return (
      <SingleCreatorRows
        scCreator={values.scCreator}
        scBrand={values.scBrand}
        rows={values.scDeliverables}
        onCreatorChange={(value) => onChange("scCreator", value)}
        onBrandChange={(value) => onChange("scBrand", value)}
        onAddRow={addScDeliverable}
        onRemoveRow={removeScDeliverable}
        onRowChange={patchScDeliverable}
      />
    );
  }

  if (values.businessLine === "TM" && values.entryType === "MC") {
    return <MultiCreatorRows rows={values.mcRows} onAddRow={addMcRow} onRemoveRow={removeMcRow} onRowChange={patchMcRow} />;
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
          <select className="intake-input" value={values.campaignBrand} onChange={(e) => onChange("campaignBrand", e.target.value)}>
            <option value="">Select brand</option>
            {getBrandOptions().map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="intake-field">
          <span className="intake-label">Deliverable</span>
          <select className="intake-input" value={values.campaignDeliverable} onChange={(e) => onChange("campaignDeliverable", e.target.value)}>
            <option value="">Select deliverable</option>
            {getDeliverableOptions().map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="intake-field intake-field-wide">
          <span className="intake-label">Campaign Notes</span>
          <textarea className="intake-input intake-textarea" rows={3} value={values.campaignNotes} onChange={(e) => onChange("campaignNotes", e.target.value)} />
        </label>
      </div>
    </section>
  );
}
