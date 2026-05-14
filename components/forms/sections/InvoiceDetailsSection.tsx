import { BILL_DUE_OPTIONS, INVOICE_TYPES } from "../constants";
import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
};

export function InvoiceDetailsSection({ values, onChange }: Props) {
  return (
    <section className="surface p-4">
      <h3 className="mb-3 text-lg font-semibold">Invoice &amp; Finance</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>Invoice Type</span>
          <select
            className="rounded-md border border-app bg-app px-3 py-2"
            value={values.invoiceType}
            onChange={(e) => onChange("invoiceType", e.target.value)}
            required
          >
            {INVOICE_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span>Payment Terms</span>
          <select
            className="rounded-md border border-app bg-app px-3 py-2"
            value={values.billDue}
            onChange={(e) => onChange("billDue", e.target.value)}
            required
          >
            {BILL_DUE_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
