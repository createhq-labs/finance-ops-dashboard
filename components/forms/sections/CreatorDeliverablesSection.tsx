import { MASTER_BRANDS, MASTER_DELIVERABLES } from "../constants";
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
  patchMcRow: (
    index: number,
    patch: { creator?: string; brand?: string; deliverable?: string; amount?: string }
  ) => void;
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
    <section className="surface p-4">
      <h3 className="mb-3 text-lg font-semibold">Campaign Details</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>Campaign Code</span>
          <input
            className="rounded-md border border-app bg-app px-3 py-2"
            value={values.campaignCode}
            onChange={(e) => onChange("campaignCode", e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Campaign Brand</span>
          <select
            className="rounded-md border border-app bg-app px-3 py-2"
            value={values.campaignBrand}
            onChange={(e) => onChange("campaignBrand", e.target.value)}
          >
            <option value="">Select</option>
            {MASTER_BRANDS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>Deliverable</span>
          <select
            className="rounded-md border border-app bg-app px-3 py-2"
            value={values.campaignDeliverable}
            onChange={(e) => onChange("campaignDeliverable", e.target.value)}
          >
            <option value="">Select</option>
            {MASTER_DELIVERABLES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm md:col-span-2">
          <span>Notes</span>
          <textarea
            className="rounded-md border border-app bg-app px-3 py-2"
            rows={2}
            value={values.campaignNotes}
            onChange={(e) => onChange("campaignNotes", e.target.value)}
          />
        </label>
      </div>
    </section>
  );
}
