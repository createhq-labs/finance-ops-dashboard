import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
};

export function ReimbursementSection({ values, onChange }: Props) {
  const showProof = values.invoiceType === "Reimbursement with GST" || values.invoiceType === "Reimbursement without GST";

  if (!showProof) return null;

  return (
    <section className="surface p-4">
      <h3 className="mb-3 text-lg font-semibold">Reimbursement</h3>
      <div className="grid gap-1 text-sm">
        <label>Reimbursement Proof</label>
        <input
          className="rounded-md border border-app bg-app px-3 py-2"
          type="url"
          placeholder="Paste receipt/invoice URL"
          value={values.reimbursementProof}
          onChange={(e) => onChange("reimbursementProof", e.target.value)}
        />
        <p className="text-muted text-xs">Legacy behavior: URL placeholder only, no file upload widget.</p>
      </div>
    </section>
  );
}
