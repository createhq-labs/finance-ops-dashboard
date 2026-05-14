import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
};

export function CommercialsSection({ values, onChange }: Props) {
  return (
    <section className="surface p-4">
      <h3 className="mb-3 text-lg font-semibold">Commercials</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>Total Amount (₹)</span>
          <input
            className="rounded-md border border-app bg-app px-3 py-2"
            type="number"
            min={0}
            step="0.01"
            value={values.totalAmount}
            readOnly={values.businessLine === "TM"}
            placeholder={values.businessLine === "TM" ? "Auto-calculated" : "Enter campaign total"}
            onChange={(e) => onChange("totalAmount", e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Commission (₹)</span>
          <input
            className="rounded-md border border-app bg-app px-3 py-2"
            type="number"
            min={0}
            step="0.01"
            value={values.commission}
            onChange={(e) => onChange("commission", e.target.value)}
          />
        </label>
      </div>
    </section>
  );
}
