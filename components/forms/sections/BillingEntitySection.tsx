import { useEffect, useRef, useState } from "react";
import { ENTITY_TYPES, getEntityNameOptions, getMappedTradeName, getTradeNameOptions } from "../constants";
import type { InvoiceIntakeFormValues } from "../types";

type Props = {
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
};

export function BillingEntitySection({ values, onChange }: Props) {
  const [gstTouched, setGstTouched] = useState(false);
  const [pincodeTouched, setPincodeTouched] = useState(false);
  const [cityTouched, setCityTouched] = useState(false);
  const [stateTouched, setStateTouched] = useState(false);
  const [tradeNameOverridden, setTradeNameOverridden] = useState(false);
  const gstInputRef = useRef<HTMLInputElement | null>(null);
  const gst = (values.gstNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const isIndianClient = values.clientType === "Indian";
  const gstValid = !isIndianClient || !gst ? true : /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gst);
  const pincodeValid = !isIndianClient || !values.pincode ? true : /^\d{6}$/.test(values.pincode.trim());
  const stateCodeMap: Record<string, string> = {
    "27": "Maharashtra",
    "29": "Karnataka",
    "07": "Delhi",
    "33": "Tamil Nadu",
    "36": "Telangana",
    "24": "Gujarat",
    "19": "West Bengal",
  };
  const gstStateCode = gst.slice(0, 2);
  const mappedState = stateCodeMap[gstStateCode];
  const stateLooksMismatched =
    isIndianClient &&
    Boolean(mappedState) &&
    Boolean(values.state.trim()) &&
    !values.state.toLowerCase().includes(mappedState.toLowerCase());

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
  const entityNameOptions = getEntityNameOptions(values.entityType);
  const tradeNameOptions = getTradeNameOptions(values.entityType);

  useEffect(() => {
    setTradeNameOverridden(false);
  }, [values.entityType]);

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
          <span className="intake-label">Client Type</span>
          <select className="intake-input" value={values.clientType} onChange={(e) => onChange("clientType", e.target.value as InvoiceIntakeFormValues["clientType"])} required>
            <option value="Indian">Indian</option>
            <option value="Foreign">Foreign</option>
          </select>
        </label>

        <label className="intake-field">
          <span className="intake-label">{values.entityType === "Agency" ? "Agency Name" : "Brand Name"}</span>
          <input
            className="intake-input"
            list={`entity-name-options-${values.entityType.toLowerCase()}`}
            value={values.agencyBrandName}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const next = e.target.value;
              onChange("agencyBrandName", next);
              if (!tradeNameOverridden) onChange("agencyBrandTradeName", getMappedTradeName(next) ?? "");
            }}
            placeholder={`Select or type ${values.entityType.toLowerCase()} name`}
            required
          />
          <datalist id={`entity-name-options-${values.entityType.toLowerCase()}`}>
            {entityNameOptions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>

        <label className="intake-field">
          <span className="intake-label">{values.entityType === "Agency" ? "Agency Trade Name" : "Brand Trade Name"}</span>
          <input
            className="intake-input"
            list={`trade-name-options-${values.entityType.toLowerCase()}`}
            value={values.agencyBrandTradeName}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              setTradeNameOverridden(true);
              onChange("agencyBrandTradeName", e.target.value);
            }}
            placeholder={`Select or type ${values.entityType.toLowerCase()} trade name`}
            required
          />
          <datalist id={`trade-name-options-${values.entityType.toLowerCase()}`}>
            {tradeNameOptions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>

        {values.entityType === "Agency" ? (
          <label className="intake-field">
            <span className="intake-label">Brand Name</span>
            <input
              className="intake-input"
              list="agency-brand-options"
              value={values.billingBrandName}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => onChange("billingBrandName", e.target.value)}
              placeholder="Select or type brand name"
            />
            <datalist id="agency-brand-options">
              {getEntityNameOptions("Brand").map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>
        ) : null}

        <label className="intake-field">
          <span className="intake-label">GST Number</span>
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
            required={isIndianClient}
            disabled={!isIndianClient}
            style={!isIndianClient ? { color: "#dc2626" } : undefined}
          />
          {isIndianClient ? (
            <>
              <p className="text-muted intake-section-copy" style={{ margin: "6px 0 0" }}>Format: 2-digit state + PAN + entity + Z + checksum.</p>
              {gstTouched && !gstValid ? (
                <p className="text-danger" style={{ margin: "4px 0 0", fontSize: 12 }}>Enter a valid 15-character GST number. Example: 07AAIFI5054J1Z7</p>
              ) : null}
              {gstTouched && stateLooksMismatched ? (
                <p className="text-danger" style={{ margin: "4px 0 0", fontSize: 12 }}>GST state code and selected state look different. Please recheck.</p>
              ) : null}
            </>
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
          <input className="intake-input" value={values.city} onBlur={() => setCityTouched(true)} onChange={(e) => onChange("city", e.target.value)} placeholder="Enter city" />
          {cityTouched && locationMismatch ? <p className="text-danger" style={{ margin: "4px 0 0", fontSize: 12 }}>Pincode does not match selected city/state.</p> : null}
        </label>

        <label className="intake-field">
          <span className="intake-label">State</span>
          <input className="intake-input" value={values.state} onBlur={() => setStateTouched(true)} onChange={(e) => onChange("state", e.target.value)} placeholder="Enter state" required />
          {stateTouched && locationMismatch ? <p className="text-danger" style={{ margin: "4px 0 0", fontSize: 12 }}>Pincode does not match selected city/state.</p> : null}
        </label>

        <label className="intake-field">
          <span className="intake-label">Country</span>
          <input className="intake-input" value={values.country} onChange={(e) => onChange("country", e.target.value)} placeholder="Enter country" required />
        </label>

        <label className="intake-field">
          <span className="intake-label">Pincode</span>
          <input className="intake-input" value={values.pincode} onBlur={() => setPincodeTouched(true)} onChange={(e) => onChange("pincode", e.target.value)} placeholder="Enter pincode" />
          {pincodeTouched && !pincodeValid ? <p className="text-danger" style={{ margin: "4px 0 0", fontSize: 12 }}>Enter a valid 6-digit Indian pincode.</p> : null}
          {pincodeTouched && locationMismatch ? (
            <p className="text-danger" style={{ margin: "4px 0 0", fontSize: 12 }}>Pincode does not match selected city/state.</p>
          ) : null}
        </label>
      </div>
    </section>
  );
}
