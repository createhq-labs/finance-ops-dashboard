import { ENTITY_TYPES } from "../constants";
import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
};

export function BillingEntitySection({ values, onChange }: Props) {
  return (
    <section className="surface p-4">
      <h3 className="mb-3 text-lg font-semibold">Billing Entity &amp; Address</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>Entity Type</span>
          <select
            className="rounded-md border border-app bg-app px-3 py-2"
            value={values.entityType}
            onChange={(e) => onChange("entityType", e.target.value as InvoiceIntakeFormValues["entityType"])}
          >
            {ENTITY_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span>Entity Name *</span>
          <input
            className="rounded-md border border-app bg-app px-3 py-2"
            value={values.agencyBrandName}
            onChange={(e) => onChange("agencyBrandName", e.target.value)}
            required
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>Legal Name</span>
          <input
            className="rounded-md border border-app bg-app px-3 py-2"
            value={values.agencyBrandTradeName}
            onChange={(e) => onChange("agencyBrandTradeName", e.target.value)}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>GST Number</span>
          <input
            className="rounded-md border border-app bg-app px-3 py-2"
            value={values.gstNumber}
            onChange={(e) => onChange("gstNumber", e.target.value)}
          />
        </label>

        <label className="grid gap-1 text-sm md:col-span-2">
          <span>Address</span>
          <input
            className="rounded-md border border-app bg-app px-3 py-2"
            value={values.addressLine}
            onChange={(e) => onChange("addressLine", e.target.value)}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>City</span>
          <input
            className="rounded-md border border-app bg-app px-3 py-2"
            value={values.city}
            onChange={(e) => onChange("city", e.target.value)}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>State</span>
          <input
            className="rounded-md border border-app bg-app px-3 py-2"
            value={values.state}
            onChange={(e) => onChange("state", e.target.value)}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>Pincode</span>
          <input
            className="rounded-md border border-app bg-app px-3 py-2"
            value={values.pincode}
            onChange={(e) => onChange("pincode", e.target.value)}
          />
        </label>
      </div>
    </section>
  );
}
