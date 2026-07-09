import { useMemo, useRef, useState } from "react";
import { ENTITY_TYPES } from "../constants";
import { SearchableSelect } from "../searchable-select";
import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
  errors?: Record<string, string>;
  agencyOptions: string[];
  brandOptions: string[];
  agencyTradeNameOptions: string[];
  brandTradeNameOptions: string[];
  agencyTradeNameMap: Record<string, string>;
  brandTradeNameMap: Record<string, string>;
  agencyNameMap: Record<string, string>;
  brandNameMap: Record<string, string>;
};

export function BillingEntitySection({
  values,
  onChange,
  errors = {},
  agencyOptions,
  brandOptions,
  agencyTradeNameOptions,
  brandTradeNameOptions,
  agencyTradeNameMap,
  brandTradeNameMap,
  agencyNameMap,
  brandNameMap,
}: Props) {
  const [gstTouched, setGstTouched] = useState(false);
  const [pincodeTouched, setPincodeTouched] = useState(false);
  const [cityTouched, setCityTouched] = useState(false);
  const [stateTouched, setStateTouched] = useState(false);
  const gstInputRef = useRef<HTMLInputElement | null>(null);
  const gst = (values.gstNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const isIndianClient = values.clientType === "Indian";
  const gstValid = !isIndianClient || !gst ? true : gst === 'NA' || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gst);
  const pincodeValid = !isIndianClient || !values.pincode ? true : /^\d{6}$/.test(values.pincode.trim());
  const pincodePrefix = values.pincode.trim().slice(0, 2);
  const pincodeStateMap: Record<string, string> = {
    "11": "Delhi",
    "12": "Haryana",
    "14": "Punjab",
    "20": "Uttar Pradesh",
    "22": "Uttar Pradesh",
    "24": "Uttar Pradesh",
    "28": "Madhya Pradesh",
    "30": "Rajasthan",
    "32": "Rajasthan",
    "36": "Gujarat",
    "38": "Gujarat",
    "40": "Maharashtra",
    "41": "Maharashtra",
    "42": "Maharashtra",
    "43": "Maharashtra",
    "44": "Maharashtra",
    "45": "Madhya Pradesh",
    "50": "Telangana",
    "56": "Karnataka",
    "57": "Karnataka",
    "60": "Tamil Nadu",
    "70": "West Bengal",
    "75": "Odisha",
    "80": "Bihar",
  };
  const pincodeState = pincodeStateMap[pincodePrefix];
  const pincodeStateMismatch =
    isIndianClient &&
    /^\d{6}$/.test(values.pincode.trim()) &&
    !!pincodeState &&
    !!values.state.trim() &&
    !values.state.toLowerCase().includes(pincodeState.toLowerCase());

  const pincodeCityHints: Record<string, string[]> = {
    "11": ["Delhi", "New Delhi"],
    "40": ["Mumbai", "Thane", "Navi Mumbai"],
    "41": ["Pune", "Nashik"],
    "42": ["Nashik", "Jalgaon"],
    "43": ["Nagpur", "Amravati"],
    "44": ["Pune", "Kolhapur", "Sangli"],
    "50": ["Hyderabad", "Secunderabad"],
    "56": ["Bengaluru", "Bangalore"],
    "57": ["Mysuru", "Mysore"],
    "60": ["Chennai"],
    "70": ["Kolkata", "Calcutta"],
  };
  const hintedCities = pincodeCityHints[pincodePrefix] || [];
  const pincodeCityMismatch =
    isIndianClient &&
    /^\d{6}$/.test(values.pincode.trim()) &&
    hintedCities.length > 0 &&
    !!values.city.trim() &&
    !hintedCities.some((city) => values.city.toLowerCase().includes(city.toLowerCase()));
  const locationMismatch = pincodeStateMismatch || pincodeCityMismatch;
  const entityNameOptions = values.entityType === "Agency" ? agencyOptions : brandOptions;
  const tradeNameOptions = values.entityType === "Agency" ? agencyTradeNameOptions : brandTradeNameOptions;
  const tradeNameMap = useMemo(
    () => (values.entityType === "Agency" ? agencyTradeNameMap : brandTradeNameMap),
    [agencyTradeNameMap, brandTradeNameMap, values.entityType]
  );
  const entityNameMap = useMemo(
    () => (values.entityType === "Agency" ? agencyNameMap : brandNameMap),
    [agencyNameMap, brandNameMap, values.entityType]
  );

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
      if (/[A-Z0-9]/.test(formatted[i])) seen += 1;
      if (seen >= rawIndex) return i + 1;
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
          <p className="text-muted intake-section-copy">Entity details for finance workflows.</p>
        </div>
      </div>

      <div
        className="intake-section-body"
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
          alignItems: "start",
          padding: "10px 12px 12px",
        }}
      >
        <style>{`
          @media (min-width: 640px) {
            .billing-entity-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
          @media (min-width: 1024px) {
            .billing-entity-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .billing-entity-wide {
              grid-column: span 2 / span 2;
            }
            .billing-location-grid {
              grid-template-columns: repeat(4, minmax(0, 1fr));
            }
          }
        `}</style>
        <div className="billing-entity-grid" style={{ display: "grid", gap: 12, alignItems: "start" }}>
        <label className="intake-field">
          <span className="intake-label">Entity Type *</span>
          <SearchableSelect
            value={values.entityType}
            options={[...ENTITY_TYPES]}
            onChange={(next) => onChange("entityType", next as InvoiceIntakeFormValues["entityType"])}
            data-field="entityType"
            placeholder="Select entity type"
            required
          />
          <div style={{ minHeight: 16 }}>
            {errors.entityType ? <p className="text-danger intake-inline-error">{errors.entityType}</p> : null}
          </div>
        </label>

        <label className="intake-field">
          <span className="intake-label">Client Type *</span>
          <SearchableSelect
            value={values.clientType}
            options={["Indian", "Foreign"]}
            onChange={(next) => onChange("clientType", next as InvoiceIntakeFormValues["clientType"])}
            data-field="clientType"
            placeholder="Select client type"
            required
          />
          <div style={{ minHeight: 16 }}>
            {errors.clientType ? <p className="text-danger intake-inline-error">{errors.clientType}</p> : null}
          </div>
        </label>

        <label className="intake-field">
          <span className="intake-label">{values.entityType === "Agency" ? "Agency Name *" : "Brand Name *"}</span>
          <SearchableSelect
            value={values.agencyBrandName}
            options={entityNameOptions}
            allowCustom
            panelMaxHeight={160}
            onChange={(next) => {
              onChange("agencyBrandName", next);
              const mappedTradeName = tradeNameMap[next.trim().toLowerCase()];
              if (mappedTradeName) {
                onChange("agencyBrandTradeName", mappedTradeName);
              }
            }}
            placeholder={`Select ${values.entityType.toLowerCase()} name`}
            data-field="agencyBrandName"
            required
          />
          <div style={{ minHeight: 16 }}>
            {errors.agencyBrandName ? <p className="text-danger intake-inline-error">{errors.agencyBrandName}</p> : null}
          </div>
        </label>

        <label className="intake-field">
          <span className="intake-label">{values.entityType === "Agency" ? "Agency Trade Name *" : "Brand Trade Name *"}</span>
          <SearchableSelect
            value={values.agencyBrandTradeName}
            options={tradeNameOptions}
            allowCustom
            panelMaxHeight={160}
            onChange={(next) => {
              onChange("agencyBrandTradeName", next);
              const mappedEntityName = entityNameMap[next.trim().toLowerCase()];
              if (mappedEntityName) {
                onChange("agencyBrandName", mappedEntityName);
              }
            }}
            placeholder={`Select ${values.entityType.toLowerCase()} trade name`}
            data-field="agencyBrandTradeName"
            required
          />
          <div style={{ minHeight: 16 }}>
            {errors.agencyBrandTradeName ? <p className="text-danger intake-inline-error">{errors.agencyBrandTradeName}</p> : null}
          </div>
        </label>

        {values.entityType === "Agency" ? (
          <label className="intake-field">
            <span className="intake-label">Brand Name *</span>
            <SearchableSelect
              value={values.billingBrandName}
              options={brandOptions}
              allowCustom
              panelMaxHeight={160}
              onChange={(next) => onChange("billingBrandName", next)}
              placeholder="Select brand name"
              data-field="billingBrandName"
            />
            <div style={{ minHeight: 16 }}>
              {errors.billingBrandName ? <p className="text-danger intake-inline-error">{errors.billingBrandName}</p> : null}
            </div>
          </label>
        ) : null}

        <label className="intake-field">
          <span className="intake-label">GST Number{isIndianClient ? " *" : ""}</span>
          <input
            ref={gstInputRef}
            className="intake-input"
            value={isIndianClient ? formatGst(gst) : "Not applicable for foreign clients"}
            onChange={(e) => {
              if (!isIndianClient) return;
              handleGstChange(e.target.value, e.target.selectionStart);
            }}
            onBlur={() => setGstTouched(true)}
            placeholder="07-AAIFI5054J-1-Z-7"
            autoComplete="off"
            data-field="gstNumber"
            required={isIndianClient}
            disabled={!isIndianClient}
            style={!isIndianClient ? { color: "#dc2626" } : undefined}
          />
          <div style={{ display: "grid", gap: 2, minHeight: isIndianClient ? 30 : 16 }}>
            {isIndianClient ? (
              <p className="text-muted intake-inline-note">(Format: state code + PAN + entity + Z + checksum. Type NA if no GST number.)</p>
            ) : null}
            {errors.gstNumber ? <p className="text-danger intake-inline-error">{errors.gstNumber}</p> : null}
            {gstTouched && !gstValid && isIndianClient && !errors.gstNumber ? (
              <p className="text-danger intake-inline-error">Enter a valid 15-character GST number or NA. Example: 07AAIFI5054J1Z7</p>
            ) : null}
          </div>
        </label>

        <label className="intake-field billing-entity-wide">
          <span className="intake-label">Address *</span>
          <input
            className="intake-input"
            value={values.addressLine}
            onChange={(e) => onChange("addressLine", e.target.value)}
            placeholder="Street / Building / Area (e.g., Unit 22, 2nd Floor, Der Deutsche Parkz, Subhash Nagar Road)"
            data-field="addressLine"
            autoComplete="off"
            required
          />
          <div style={{ minHeight: 16 }}>
            {errors.addressLine ? <p className="text-danger intake-inline-error">{errors.addressLine}</p> : null}
          </div>
        </label>
        <div className="billing-location-grid" style={{ display: "grid", gap: 12, alignItems: "start", gridColumn: "1 / -1" }}>
          <label className="intake-field">
            <span className="intake-label">City *</span>
            <input className="intake-input" value={values.city} onBlur={() => setCityTouched(true)} onChange={(e) => onChange("city", e.target.value)} placeholder="Enter city" data-field="city" autoComplete="off" />
            <div style={{ display: "grid", gap: 2, minHeight: 30 }}>
              {errors.city ? <p className="text-danger intake-inline-error">{errors.city}</p> : null}
              {cityTouched && locationMismatch ? <p className="text-danger intake-inline-error">Pincode does not match selected city/state.</p> : null}
            </div>
          </label>

          <label className="intake-field">
            <span className="intake-label">State *</span>
            <input className="intake-input" value={values.state} onBlur={() => setStateTouched(true)} onChange={(e) => onChange("state", e.target.value)} placeholder="Enter state" data-field="state" autoComplete="off" required />
            <div style={{ display: "grid", gap: 2, minHeight: 30 }}>
              {errors.state ? <p className="text-danger intake-inline-error">{errors.state}</p> : null}
              {stateTouched && locationMismatch ? <p className="text-danger intake-inline-error">Pincode does not match selected city/state.</p> : null}
            </div>
          </label>

          <label className="intake-field">
            <span className="intake-label">Country *</span>
            <input className="intake-input" value={values.country} onChange={(e) => onChange("country", e.target.value)} placeholder="Enter country" data-field="country" autoComplete="off" required />
            <div style={{ minHeight: 16 }}>
              {errors.country ? <p className="text-danger intake-inline-error">{errors.country}</p> : null}
            </div>
          </label>

          <label className="intake-field">
            <span className="intake-label">Pincode{isIndianClient ? " *" : ""}</span>
            <input className="intake-input" value={values.pincode} onBlur={() => setPincodeTouched(true)} onChange={(e) => onChange("pincode", e.target.value)} placeholder="Enter pincode / postal code" data-field="pincode" autoComplete="off" required={isIndianClient} />
            <div style={{ display: "grid", gap: 2, minHeight: 30 }}>
              {errors.pincode ? <p className="text-danger intake-inline-error">{errors.pincode}</p> : null}
              {pincodeTouched && !pincodeValid ? <p className="text-danger intake-inline-error">Enter a valid 6-digit Indian pincode.</p> : null}
              {pincodeTouched && locationMismatch ? <p className="text-danger intake-inline-error">Pincode does not match selected city/state.</p> : null}
            </div>
          </label>
        </div>
        </div>
      </div>
    </section>
  );
}




