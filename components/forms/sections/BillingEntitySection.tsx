import { useRef, useState } from "react";
import { ENTITY_TYPES } from "../constants";
import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
};

export function BillingEntitySection({ values, onChange }: Props) {
  const [gstTouched, setGstTouched] = useState(false);
  const gstInputRef = useRef<HTMLInputElement | null>(null);
  const gst = (values.gstNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const gstValid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gst);

  function formatGst(raw: string) {
    const p1 = raw.slice(0, 2);
    const p2 = raw.slice(2, 12);
    const p3 = raw.slice(12, 13);
    const p4 = raw.slice(13, 14);
    const p5 = raw.slice(14, 15);
    return [p1, p2, p3, p4, p5].filter(Boolean).join(" ");
  }

  function rawIndexToFormattedIndex(rawIndex: number, formatted: string) {
    if (rawIndex <= 0) return 0;
    let seen = 0;
    for (let i = 0; i < formatted.length; i += 1) {
      if (/[A-Z0-9]/.test(formatted[i])) {
        seen += 1;
      }
      if (seen >= rawIndex) {
        return i + 1;
      }
    }
    return formatted.length;
  }

  function handleGstChange(nextDisplayValue: string, selectionStart: number | null) {
    const cleanAll = nextDisplayValue.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
    const cleanBeforeCaret = nextDisplayValue
      .slice(0, selectionStart ?? nextDisplayValue.length)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 15).length;

    onChange("gstNumber", cleanAll);

    const nextDisplay = formatGst(cleanAll);
    const nextCaret = rawIndexToFormattedIndex(cleanBeforeCaret, nextDisplay);
    requestAnimationFrame(() => {
      gstInputRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  return (
    <section className="intake-section">
      <div className="intake-section-header">
        <div>
          <h3 className="intake-section-title">Billing Entity and Address</h3>
          <p className="text-muted intake-section-copy">Capture the billed entity details exactly as they should appear in the finance workflow.</p>
        </div>
      </div>

      <div className="intake-section-body intake-form-grid">
        <label className="intake-field">
          <span className="intake-label">Entity Type</span>
          <select
            className="intake-input"
            value={values.entityType}
            onChange={(e) => onChange("entityType", e.target.value as InvoiceIntakeFormValues["entityType"])}
            required
          >
            {ENTITY_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="intake-field">
          <span className="intake-label">Agency / Brand Name</span>
          <input className="intake-input" value={values.agencyBrandName} onChange={(e) => onChange("agencyBrandName", e.target.value)} required />
        </label>

        <label className="intake-field">
          <span className="intake-label">Agency / Brand Trade Name</span>
          <input className="intake-input" value={values.agencyBrandTradeName} onChange={(e) => onChange("agencyBrandTradeName", e.target.value)} required />
        </label>

        <label className="intake-field">
          <span className="intake-label">GST Number</span>
          <input
            ref={gstInputRef}
            className="intake-input"
            value={formatGst(gst)}
            onChange={(e) => handleGstChange(e.target.value, e.target.selectionStart)}
            onBlur={() => setGstTouched(true)}
            placeholder="07-AAIFI5054J-1-Z-7"
            autoComplete="off"
            required
          />
          <p className="text-muted intake-section-copy" style={{ margin: "6px 0 0" }}>Format: 2-digit state + PAN + entity + Z + checksum.</p>
          {gstTouched && !gstValid ? (
            <p className="text-danger" style={{ margin: "4px 0 0", fontSize: 12 }}>Enter a valid 15-character GST number. Example: 07AAIFI5054J1Z7</p>
          ) : null}
        </label>

        <label className="intake-field intake-field-wide">
          <span className="intake-label">Address</span>
          <input
            className="intake-input"
            value={values.addressLine}
            onChange={(e) => onChange("addressLine", e.target.value)}
            placeholder="Street / Building / Area (e.g., Unit 22, 2nd Floor, Der Deutsche Parkz, Subhash Nagar Road)"
            required
          />
        </label>

        <label className="intake-field">
          <span className="intake-label">City</span>
          <input className="intake-input" value={values.city} onChange={(e) => onChange("city", e.target.value)} placeholder="Enter city" />
        </label>

        <label className="intake-field">
          <span className="intake-label">State</span>
          <input className="intake-input" value={values.state} onChange={(e) => onChange("state", e.target.value)} placeholder="Enter state" required />
        </label>

        <label className="intake-field">
          <span className="intake-label">Country</span>
          <input className="intake-input" value={values.country} onChange={(e) => onChange("country", e.target.value)} placeholder="Enter country" required />
        </label>

        <label className="intake-field">
          <span className="intake-label">Pincode</span>
          <input className="intake-input" value={values.pincode} onChange={(e) => onChange("pincode", e.target.value)} placeholder="Enter pincode" />
        </label>
      </div>
    </section>
  );
}
