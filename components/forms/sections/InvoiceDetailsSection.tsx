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
          <p className="text-muted intake-section-copy">Configure invoice type and payment terms.</p>
        </div>
      </div>

      <div
        className="intake-section-body"
        style={{ display: "grid", gap: 10, alignItems: "start", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", padding: "10px 12px 12px" }}
      >
        <style>{`
          @media (min-width: 768px) {
            .invoice-details-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
        `}</style>
        <div className="invoice-details-grid" style={{ display: "grid", gap: 12, alignItems: "start" }}>
        <label className="intake-field" style={{ alignSelf: "start" }}>
          <span className="intake-label">Invoice Type *</span>
          <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
            <SearchableSelect
              value={invoiceTypeInput}
              options={[...INVOICE_TYPES]}
              onChange={(next) => {
                setInvoiceTypeInput(next);
                addInvoiceType(next);
              }}
              deselectOnSelectedClick
              data-field="invoiceType"
              placeholder="Select invoice type"
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", minHeight: selectedInvoiceTypes.length ? 24 : 0 }}>
              {selectedInvoiceTypes.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                  style={{ display: "inline-flex", alignItems: "center" }}
                >
                  {item}
                  <button type="button" onClick={() => removeInvoiceType(item)} style={{ border: 0, background: "transparent", color: "inherit", cursor: "pointer", padding: 0, fontSize: 12 }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gap: 2, minHeight: 20 }}>
            {errors.invoiceType ? <p className="text-danger intake-inline-error">{errors.invoiceType}</p> : null}
            {invoiceTypeError ? <p className="text-danger intake-inline-error">{invoiceTypeError}</p> : null}
          </div>
        </label>

        <label className="intake-field" style={{ alignSelf: "start" }}>
          <span className="intake-label">Bill Due *</span>
          <SearchableSelect
            value={values.billDue}
            options={[...BILL_DUE_OPTIONS]}
            onChange={(next) => onChange("billDue", next)}
            deselectOnSelectedClick
            clearable
            data-field="billDue"
            placeholder="Select bill due"
          />
          <div style={{ minHeight: 16 }}>
            {errors.billDue ? <p className="text-danger intake-inline-error">{errors.billDue}</p> : null}
          </div>
        </label>
        </div>
      </div>
    </section>
  );
}
