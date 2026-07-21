import { useRef, useState } from "react";
import { ENTITY_TYPES } from "../constants";
import { GstNumberPicker } from "../gst-number-picker";
import { SearchableSelect } from "../searchable-select";
import type { GstMappingOption, InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
  onEntityNameSelect: (value: string) => void;
  onTradeNameSelect: (value: string) => void;
  onGstSelect: (value: string) => void;
  onGstClear: () => void;
  onAddNewGstSelect: () => void;
  errors?: Record<string, string>;
  agencyOptions: string[];
  brandOptions: string[];
  agencyTradeNameOptions: string[];
  brandTradeNameOptions: string[];
  gstOptions: string[];
  gstMappingByNumber: Record<string, GstMappingOption>;
};

export function BillingEntitySection({
  values,
  onChange,
  onEntityNameSelect,
  onTradeNameSelect,
  onGstSelect,
  onGstClear,
  onAddNewGstSelect,
  errors = {},
  agencyOptions,
  brandOptions,
  agencyTradeNameOptions,
  brandTradeNameOptions,
  gstOptions,
  gstMappingByNumber,
}: Props) {
  const [pincodeTouched, setPincodeTouched] = useState(false);
  const [cityTouched, setCityTouched] = useState(false);
  const [stateTouched, setStateTouched] = useState(false);
  const addressRef = useRef<HTMLTextAreaElement | null>(null);
  const gst = (values.gstNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const isIndianClient = values.clientType === "Indian";
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
  const gstEntries = gstOptions.map((gstNumber) => gstMappingByNumber[gstNumber]).filter(Boolean);

  function resizeAddressField() {
    const node = addressRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = String(Math.max(node.scrollHeight, 38)) + "px";
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
              onChange={onEntityNameSelect}
              deselectOnSelectedClick
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
              onChange={onTradeNameSelect}
              deselectOnSelectedClick
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
                deselectOnSelectedClick
                placeholder="Select brand name"
                data-field="billingBrandName"
                required
              />
              <div style={{ minHeight: 16 }}>
                {errors.billingBrandName ? <p className="text-danger intake-inline-error">{errors.billingBrandName}</p> : null}
              </div>
            </label>
          ) : null}

          {isIndianClient ? (
            <div className="intake-field">
              <span className="intake-label">GST Number</span>
              <GstNumberPicker
                value={values.gstNumber}
                mode={values.gstSelectionMode}
                options={gstEntries}
                onSelect={(next) => {
                  onGstSelect(next);
                }}
                onStartAddNew={() => {
                  onAddNewGstSelect();
                }}
                onClear={() => {
                  onGstClear();
                }}
              />
              <div style={{ minHeight: 0 }} />
            </div>
          ) : null}

          <label className="intake-field billing-entity-wide">
            <span className="intake-label">Address *</span>
            <textarea
              ref={addressRef}
              className="intake-input"
              rows={1}
              value={values.addressLine}
              onChange={(event) => {
                onChange("addressLine", event.target.value);
                requestAnimationFrame(resizeAddressField);
              }}
              onFocus={resizeAddressField}
              placeholder="Billing address"
              data-field="addressLine"
              required
              style={{ minHeight: 38, resize: "none", overflow: "hidden" }}
            />
            <div style={{ minHeight: 16 }}>
              {errors.addressLine ? <p className="text-danger intake-inline-error">{errors.addressLine}</p> : null}
            </div>
          </label>

          <div className="billing-location-grid billing-entity-wide" style={{ display: "grid", gap: 12, alignItems: "start" }}>
            <label className="intake-field">
              <span className="intake-label">City *</span>
              <input className="intake-input" value={values.city} onChange={(event) => onChange("city", event.target.value)} onBlur={() => setCityTouched(true)} data-field="city" required />
              <div style={{ minHeight: 16 }}>
                {errors.city ? <p className="text-danger intake-inline-error">{errors.city}</p> : null}
                {!errors.city && cityTouched && locationMismatch ? <p className="text-danger intake-inline-error">City may not match the pincode.</p> : null}
              </div>
            </label>

            <label className="intake-field">
              <span className="intake-label">State *</span>
              <input className="intake-input" value={values.state} onChange={(event) => onChange("state", event.target.value)} onBlur={() => setStateTouched(true)} data-field="state" required />
              <div style={{ minHeight: 16 }}>
                {errors.state ? <p className="text-danger intake-inline-error">{errors.state}</p> : null}
                {!errors.state && stateTouched && pincodeStateMismatch ? <p className="text-danger intake-inline-error">State may not match the pincode.</p> : null}
              </div>
            </label>

            <label className="intake-field">
              <span className="intake-label">Country *</span>
              <input className="intake-input" value={values.country} onChange={(event) => onChange("country", event.target.value)} data-field="country" required />
              <div style={{ minHeight: 16 }}>{errors.country ? <p className="text-danger intake-inline-error">{errors.country}</p> : null}</div>
            </label>

            <label className="intake-field">
              <span className="intake-label">Pincode *</span>
              <input className="intake-input" value={values.pincode} onChange={(event) => onChange("pincode", event.target.value)} onBlur={() => setPincodeTouched(true)} data-field="pincode" required />
              <div style={{ minHeight: 16 }}>
                {errors.pincode ? <p className="text-danger intake-inline-error">{errors.pincode}</p> : null}
                {!errors.pincode && pincodeTouched && !pincodeValid ? <p className="text-danger intake-inline-error">Enter a valid 6 digit pincode.</p> : null}
              </div>
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
