import { useState } from "react";
import { BILL_DUE_OPTIONS, INVOICE_TYPES } from "../constants";
import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
};

export function InvoiceDetailsSection({ values, onChange }: Props) {
  const [invoiceTypeInput, setInvoiceTypeInput] = useState("");
  const [invoiceTypeError, setInvoiceTypeError] = useState("");
  const selectedInvoiceTypes = values.invoiceType
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  function addInvoiceType(value: string) {
    const next = value.trim();
    if (!INVOICE_TYPES.includes(next as (typeof INVOICE_TYPES)[number])) return;
    if (selectedInvoiceTypes.includes(next)) return;
    if (selectedInvoiceTypes.length >= 2) {
      setInvoiceTypeError("You can select up to 2 invoice types.");
      setInvoiceTypeInput("");
      return;
    }
    setInvoiceTypeError("");
    onChange("invoiceType", [...selectedInvoiceTypes, next].join(", "));
    setInvoiceTypeInput("");
  }

  function removeInvoiceType(value: string) {
    setInvoiceTypeError("");
    onChange(
      "invoiceType",
      selectedInvoiceTypes.filter((item) => item !== value).join(", ")
    );
  }

  return (
    <section className="intake-section">
      <div className="intake-section-header">
        <div>
          <h3 className="intake-section-title">Invoice and Finance</h3>
          <p className="text-muted intake-section-copy">Set the invoice type and payment terms used downstream by the finance team.</p>
        </div>
      </div>

      <div className="intake-section-body intake-form-grid" style={{ alignItems: "start" }}>
        <label className="intake-field" style={{ alignSelf: "start" }}>
          <span className="intake-label">Invoice Type</span>
          <div style={{ display: "grid", gap: 8, minHeight: 72 }}>
            <input
              className="intake-input"
              list="invoice-type-options"
              value={invoiceTypeInput}
              onChange={(e) => {
                const next = e.target.value;
                setInvoiceTypeInput(next);
                addInvoiceType(next);
              }}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addInvoiceType(invoiceTypeInput);
                }
              }}
              onBlur={() => setInvoiceTypeInput("")}
              placeholder="Select invoice type"
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minHeight: 28 }}>
              {selectedInvoiceTypes.map((item) => (
                <span key={item} className="badge badge-submitted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {item}
                  <button type="button" onClick={() => removeInvoiceType(item)} style={{ border: 0, background: "transparent", color: "inherit", cursor: "pointer", padding: 0 }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          {invoiceTypeError ? <p className="text-danger intake-inline-error">{invoiceTypeError}</p> : null}
          <datalist id="invoice-type-options">
            {INVOICE_TYPES.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>

        <label className="intake-field" style={{ alignSelf: "start" }}>
          <span className="intake-label">Bill Due</span>
          <input
            className="intake-input"
            list="bill-due-options"
            value={values.billDue}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => onChange("billDue", e.target.value)}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && !BILL_DUE_OPTIONS.includes(next as (typeof BILL_DUE_OPTIONS)[number])) onChange("billDue", "");
            }}
            placeholder="Select bill due"
            required={values.billDue.trim() === ""}
          />
          <datalist id="bill-due-options">
            {BILL_DUE_OPTIONS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
      </div>
    </section>
  );
}
