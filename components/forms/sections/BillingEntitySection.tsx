import { useEffect, useRef, useState } from "react";
import { ENTITY_TYPES } from "../constants";
import { GstNumberPicker } from "../gst-number-picker";
import { SearchableSelect } from "../searchable-select";
import type { GstMappingOption, InvoiceIntakeFormValues } from "../types";
import { Info } from "lucide-react";

type Props = {
  viewOnly?: boolean;
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
  viewOnly = false,
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
  const [stateTouched, setStateTouched] = useState(false);
  const [showAddressLockInfo, setShowAddressLockInfo] = useState(false);
  const addressLockInfoRef = useRef<HTMLDivElement | null>(null);
  const addressRef = useRef<HTMLTextAreaElement | null>(null);
  const gst = (values.gstNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const isIndianClient = values.clientType === "Indian";
  const approvedGstAddressLocked =
  values.gstSelectionMode === "existing" &&
  Boolean(gstMappingByNumber[values.gstNumber.trim().toUpperCase()]);
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

  const entityNameOptions = values.entityType === "Agency" ? agencyOptions : brandOptions;
  const tradeNameOptions = values.entityType === "Agency" ? agencyTradeNameOptions : brandTradeNameOptions;
  const gstEntries = gstOptions.map((gstNumber) => gstMappingByNumber[gstNumber]).filter(Boolean);

  function resizeAddressField() {
    const node = addressRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = String(Math.max(node.scrollHeight, 38)) + "px";
  }
  useEffect(() => {
  if (!showAddressLockInfo) return;

  function handleOutsideClick(event: MouseEvent) {
    const target = event.target as Node | null;

    if (
      target &&
      addressLockInfoRef.current &&
      !addressLockInfoRef.current.contains(target)
    ) {
      setShowAddressLockInfo(false);
    }
  }

  document.addEventListener("mousedown", handleOutsideClick);

  return () => {
    document.removeEventListener("mousedown", handleOutsideClick);
  };
}, [showAddressLockInfo]);

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
              clearable
              placeholder={`Select ${values.entityType.toLowerCase()} name`}
              data-field="agencyBrandName"
              editCustomOnDoubleClick
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
              clearable
              placeholder={`Select ${values.entityType.toLowerCase()} trade name`}
              data-field="agencyBrandTradeName"
              editCustomOnDoubleClick
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
                clearable
                placeholder="Select brand name"
                data-field="billingBrandName"
                editCustomOnDoubleClick
                required
              />
              <div style={{ minHeight: 16 }}>
                {errors.billingBrandName ? <p className="text-danger intake-inline-error">{errors.billingBrandName}</p> : null}
              </div>
            </label>
          ) : null}

          {isIndianClient ? (
            <div className="intake-field" data-field="gstNumber" tabIndex={-1}>
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
              <div style={{ minHeight: 16 }}>
                {errors.gstNumber ? <p className="text-danger intake-inline-error">{errors.gstNumber}</p> : null}
              </div>
            </div>
          ) : null}

          <label className="intake-field billing-entity-wide">
  <div
  ref={addressLockInfoRef}
  className="relative flex items-center gap-2"
>
  <span className="intake-label">Address *</span>

  {approvedGstAddressLocked && !viewOnly ? (
    <>
      <span
        className="gst-picker-badge gst-picker-badge-success"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 auto",
          borderRadius: 999,
          padding: "4px 10px",
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1,
          border: 0,
          outline: 0,
          boxShadow: "none",
          background:
            "color-mix(in srgb, var(--success) 18%, transparent)",
          color: "var(--success)",
        }}
      >
        Address Locked
      </span>

      <div className="relative">
        <button
          type="button"
          onClick={() =>
            setShowAddressLockInfo((current) => !current)
          }
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground"
          aria-label="Why is this address locked?"
          aria-expanded={showAddressLockInfo}
        >
          <Info size={13} />
        </button>

        {showAddressLockInfo ? (
          <div
            className="absolute z-50 w-72 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
            style={{
              left: "0.5cm",
              bottom: "calc(100% + 0.5cm)",
            }}
          >
            <div>
              This address comes from an approved GST record.
            </div>
            <div className="mt-1">
              Enter a <strong>new GST number</strong> to use a different billing address.
            </div>
          </div>
        ) : null}
      </div>
    </>
  ) : null}
</div>

  {viewOnly ? (
    <div
      className="intake-input"
      data-field="addressLine"
      style={{
        minHeight: 38,
        whiteSpace: "pre-wrap",
        overflow: "visible",
        background: "var(--intake-input-readonly-bg)",
        color: "#94a3b8",
      }}
    >
      {values.addressLine || "-"}
    </div>
  ) : (
    <textarea
      ref={addressRef}
      className="intake-input"
      rows={1}
      value={values.addressLine}
      readOnly={approvedGstAddressLocked}
      onChange={(event) => {
        onChange("addressLine", event.target.value);
        requestAnimationFrame(resizeAddressField);
      }}
      onFocus={resizeAddressField}
      placeholder="Billing address"
      data-field="addressLine"
      required
      style={{
        minHeight: 38,
        resize: "none",
        overflow: "hidden",
        cursor: approvedGstAddressLocked ? "default" : undefined,
      }}
    />
  )}

  <div style={{ minHeight: 16 }}>
    {errors.addressLine ? (
      <p className="text-danger intake-inline-error">
        {errors.addressLine}
      </p>
    ) : null}
  </div>
</label>

          <div className="billing-location-grid billing-entity-wide" style={{ display: "grid", gap: 12, alignItems: "start" }}>
            <label className="intake-field">
              <span className="intake-label">City *</span>
              <input className="intake-input" value={values.city} onChange={(event) => onChange("city", event.target.value)} data-field="city" readOnly={viewOnly || approvedGstAddressLocked} required />
              <div style={{ minHeight: 16 }}>
                {errors.city ? <p className="text-danger intake-inline-error">{errors.city}</p> : null}
              </div>
            </label>

            <label className="intake-field">
              <span className="intake-label">State *</span>
              <input className="intake-input" value={values.state} onChange={(event) => onChange("state", event.target.value)} onBlur={() => setStateTouched(true)} data-field="state" readOnly={viewOnly || approvedGstAddressLocked} required />
              <div style={{ minHeight: 16 }}>
                {errors.state ? <p className="text-danger intake-inline-error">{errors.state}</p> : null}
                {!errors.state && stateTouched && pincodeStateMismatch ? <p className="text-danger intake-inline-error">State may not match the pincode.</p> : null}
              </div>
            </label>

            <label className="intake-field">
              <span className="intake-label">Country *</span>
              <input className="intake-input" value={values.country} onChange={(event) => onChange("country", event.target.value)} data-field="country" readOnly={viewOnly || approvedGstAddressLocked} required />
              <div style={{ minHeight: 16 }}>{errors.country ? <p className="text-danger intake-inline-error">{errors.country}</p> : null}</div>
            </label>

            <label className="intake-field">
              <span className="intake-label">Pincode *</span>
              <input className="intake-input" value={values.pincode} onChange={(event) => onChange("pincode", event.target.value)} onBlur={() => setPincodeTouched(true)} data-field="pincode" readOnly={viewOnly || approvedGstAddressLocked} required={isIndianClient} />
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
