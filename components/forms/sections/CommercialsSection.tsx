import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  totalAmount: string;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
  errors?: Record<string, string>;
};

export function CommercialsSection({ values, totalAmount, onChange, errors = {} }: Props) {
  const isInfluencerMarketing = values.businessLine === "IM";

  return (
    <section className="intake-section">
      <div className="intake-section-header">
        <div>
          <h3 className="intake-section-title">Commercials</h3>
          <p className="text-muted intake-section-copy">
            {isInfluencerMarketing
              ? "Enter deal amount and commission. Gross total is calculated automatically."
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
            .commercials-grid-tm {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .commercials-grid-im {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }
        `}</style>
        <div className={isInfluencerMarketing ? "commercials-grid-im" : "commercials-grid-tm"} style={{ display: "grid", gap: 12, alignItems: "start" }}>
        <label className="intake-field">
          <span className="intake-label">{isInfluencerMarketing ? `Deal Amount (${values.currency}) *` : `Total Amount (${values.currency}) *`}</span>
          <input
            className="intake-input"
            type={isInfluencerMarketing ? "number" : "text"}
            inputMode={isInfluencerMarketing ? "decimal" : undefined}
            step={isInfluencerMarketing ? "0.01" : undefined}
            min={isInfluencerMarketing ? "0" : undefined}
            value={isInfluencerMarketing ? values.imCommercials : totalAmount}
            readOnly={!isInfluencerMarketing}
            placeholder={isInfluencerMarketing ? "Enter deal amount" : "Auto-calculated from rows"}
            onChange={(e) => onChange("imCommercials", e.target.value)}
            data-field="imCommercials"
            autoComplete="off"
          />
          <div style={{ minHeight: 16 }}>
            {errors.imCommercials ? <p className="text-danger intake-inline-error">{errors.imCommercials}</p> : null}
          </div>
        </label>

        <label className="intake-field">
          <span className="intake-label">Additional Agency Commission ({values.currency})</span>
          <input
            className="intake-input"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={values.commission}
            onChange={(e) => onChange("commission", e.target.value)}
            data-field="commission"
            autoComplete="off"
          />
          <div style={{ minHeight: 16 }} />
        </label>

        {isInfluencerMarketing ? (
          <label className="intake-field">
            <span className="intake-label">Total/Gross Amount ({values.currency})</span>
            <input
              className="intake-input"
              type="text"
              value={totalAmount}
              readOnly
              placeholder="Auto-calculated"
              data-field="totalAmount"
              autoComplete="off"
            />
            <div style={{ minHeight: 16 }} />
          </label>
        ) : null}
        </div>
      </div>
    </section>
  );
}
