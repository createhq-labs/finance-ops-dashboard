import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
};

export function AdditionalInfoSection({ values, onChange }: Props) {
  return (
    <section className="surface p-4">
      <h3 className="mb-3 text-lg font-semibold">Additional Information</h3>
      <label className="grid gap-1 text-sm">
        <span>Internal Notes / Additional Information</span>
        <input
          className="rounded-md border border-app bg-app px-3 py-2"
          value={values.additionalInformation}
          onChange={(e) => onChange("additionalInformation", e.target.value)}
        />
      </label>
    </section>
  );
}
