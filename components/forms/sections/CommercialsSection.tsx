import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  totalAmount: string;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
  errors?: Record<string, string>;
};

export function CommercialsSection({ values, totalAmount, onChange, errors = {} }: Props) {
  const isInfluencerMarketing = values.businessLine === "IM";
  const commissionValue = Number.parseInt(values.commission || "0", 10) || 0;
  const imBaseAmount = Math.max((Number.parseInt(totalAmount || "0", 10) || 0) - commissionValue, 0);

  return (
    <section className="intake-section">
      <div className="intake-section-header">
        <div>
          <h3 className="intake-section-title">Commercials</h3>
          <p className="text-muted intake-section-copy">
            {isInfluencerMarketing
              ? "Enter the IM base amount. The final submitted commercials automatically include any additional agency commission."
              : "The total is derived from TM line items and automatically includes any additional agency commission."}
          </p>
        </div>
      </div>

      <div className="intake-section-body intake-form-grid">
        <label className="intake-field">
          <span className="intake-label">{isInfluencerMarketing ? "Commercials / Total Amount (INR) *" : "Total Amount (INR)"}</span>
          <input
            className="intake-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={isInfluencerMarketing ? totalAmount : totalAmount}
            readOnly={!isInfluencerMarketing}
            placeholder={isInfluencerMarketing ? "Enter total amount" : "Auto-calculated from rows"}
            onChange={(e) => {
              const nextTotal = Number.parseInt(e.target.value.replace(/[^0-9]/g, ""), 10) || 0;
              const nextBase = Math.max(nextTotal - commissionValue, 0);
              onChange("imCommercials", String(nextBase));
            }}
            data-field="imCommercials"
            autoComplete="off"
          />
          {errors.imCommercials ? <p className="text-danger intake-inline-error">{errors.imCommercials}</p> : null}
          {isInfluencerMarketing && commissionValue > 0 ? (
            <p className="text-muted intake-section-copy" style={{ margin: "6px 0 0" }}>
              Base IM amount: {imBaseAmount}
            </p>
          ) : null}
        </label>

        <label className="intake-field">
          <span className="intake-label">Additional Agency Commission (INR)</span>
          <input
            className="intake-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={values.commission}
            onChange={(e) => onChange("commission", e.target.value)}
            data-field="commission"
            autoComplete="off"
          />
        </label>
      </div>
    </section>
  );
}
