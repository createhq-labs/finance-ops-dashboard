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
              ? "Enter total amount and commission."
              : "Total auto-calculated from line items + commission."}
          </p>
        </div>
      </div>

      <div
        className="intake-section-body"
        style={{ display: "grid", gap: 12, alignItems: "start", gridTemplateColumns: "repeat(1, minmax(0, 1fr))" }}
      >
        <style>{`
          @media (min-width: 768px) {
            .commercials-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
        `}</style>
        <div className="commercials-grid" style={{ display: "grid", gap: 12, alignItems: "start" }}>
        <label className="intake-field">
          <span className="intake-label">{isInfluencerMarketing ? "Commercials / Total Amount (INR) *" : "Total Amount *"}</span>
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
          <div style={{ display: "grid", gap: 2, minHeight: isInfluencerMarketing && commissionValue > 0 ? 28 : 16 }}>
            {errors.imCommercials ? <p className="text-danger intake-inline-error">{errors.imCommercials}</p> : null}
            {isInfluencerMarketing && commissionValue > 0 ? (
              <p className="text-muted intake-inline-note" style={{ marginTop: 0 }}>
                Base IM amount: {imBaseAmount}
              </p>
            ) : null}
          </div>
        </label>

        <label className="intake-field">
          <span className="intake-label">Additional Agency Commission </span>
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
          <div style={{ minHeight: 16 }} />
        </label>
        </div>
      </div>
    </section>
  );
}
