import { useState } from "react";
import { BILL_DUE_OPTIONS, INVOICE_TYPES } from "../constants";
import { SearchableSelect } from "../searchable-select";
import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
  errors?: Record<string, string>;
};

export function InvoiceDetailsSection({ values, onChange, errors = {} }: Props) {
  const [invoiceTypeInput, setInvoiceTypeInput] = useState("");
  const [invoiceTypeError, setInvoiceTypeError] = useState("");
  const selectedInvoiceTypes = values.invoiceType
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  function addInvoiceType(value: string) {
    const next = value.trim();
    if (!next) return;
    if (!INVOICE_TYPES.includes(next as (typeof INVOICE_TYPES)[number])) return;
    if (selectedInvoiceTypes.includes(next)) {
      setInvoiceTypeInput("");
      return;
    }
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
          <span className="intake-label">Invoice Type *</span>
          <div style={{ display: "grid", gap: 8, minHeight: 72 }}>
            <SearchableSelect
              value={invoiceTypeInput}
              options={[...INVOICE_TYPES]}
              onChange={(next) => {
                setInvoiceTypeInput(next);
                addInvoiceType(next);
              }}
              data-field="invoiceType"
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
          {errors.invoiceType ? <p className="text-danger intake-inline-error">{errors.invoiceType}</p> : null}
          {invoiceTypeError ? <p className="text-danger intake-inline-error">{invoiceTypeError}</p> : null}
        </label>

        <label className="intake-field" style={{ alignSelf: "start" }}>
          <span className="intake-label">Bill Due *</span>
          <SearchableSelect
            value={values.billDue}
            options={[...BILL_DUE_OPTIONS]}
            onChange={(next) => onChange("billDue", next)}
            data-field="billDue"
            placeholder="Select bill due"
          />
          {errors.billDue ? <p className="text-danger intake-inline-error">{errors.billDue}</p> : null}
        </label>
      </div>
    </section>
  );
}
