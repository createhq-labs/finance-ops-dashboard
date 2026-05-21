"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BUSINESS_LINES, ENTRY_TYPES } from "./constants";
import { AdditionalInfoSection } from "./sections/AdditionalInfoSection";
import { BillingEntitySection } from "./sections/BillingEntitySection";
import { CommercialsSection } from "./sections/CommercialsSection";
import { CreatorDeliverablesSection } from "./sections/CreatorDeliverablesSection";
import { FormActions } from "./sections/FormActions";
import { InvoiceDetailsSection } from "./sections/InvoiceDetailsSection";
import type { BusinessLine, EntryType, InvoiceIntakeFormValues, InvoiceIntakeSubmissionPayload, MultiCreatorRow } from "./types";

type Props = {
  submitterName?: string;
  submitterEmail?: string;
  initialValues?: Partial<InvoiceIntakeFormValues> | null;
  previousSubmissionId?: string | null;
  onSubmit?: (payload: InvoiceIntakeSubmissionPayload) => Promise<void> | void;
  submitEnabled?: boolean;
};

const EMPTY_SC_ROW = { deliverable: "", amount: "" };
const EMPTY_MC_ROW: MultiCreatorRow = { creator: "", brand: "", deliverable: "", amount: "" };

const INITIAL_VALUES: InvoiceIntakeFormValues = {
  submitterName: "",
  submitterEmail: "",
  businessLine: "TM",
  entryType: "SC",
  entityType: "Agency",
  clientType: "Indian",
  agencyBrandName: "",
  agencyBrandTradeName: "",
  billingBrandName: "",
  gstNumber: "",
  addressLine: "",
  city: "",
  state: "",
  country: "",
  pincode: "",
  invoiceType: "",
  billDue: "",
  commission: "",
  reimbursementIncluded: "no",
  reimbursementAmount: "0",
  reimbursementProof: "",
  additionalInformation: "",
  scCreator: "",
  scBrand: "",
  scDeliverables: [{ ...EMPTY_SC_ROW }],
  mcRows: [{ ...EMPTY_MC_ROW }],
  campaignCode: "",
  campaignBrand: "",
  campaignDeliverable: "",
  campaignName: "",
  campaignNotes: "",
  imCommercials: "",
  totalAmount: "",
};

function sumAmounts(values: string[]) {
  return values.reduce((total, value) => {
    const next = Number.parseFloat(value || "0");
    return Number.isNaN(next) || next <= 0 ? total : total + next;
  }, 0);
}

function isValidGstin(value: string) {
  const gst = value.toUpperCase();
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gst);
}

function normalizeState(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function hasKnownPincodeLocationMismatch(pincodeRaw: string, cityRaw: string, stateRaw: string) {
  const pincode = pincodeRaw.trim();
  if (!/^\d{6}$/.test(pincode)) return false;

  const prefix = pincode.slice(0, 2);
  const pincodeStateMap: Record<string, string> = {
    "11": "delhi",
    "12": "haryana",
    "14": "punjab",
    "20": "uttarpradesh",
    "22": "uttarpradesh",
    "24": "uttarpradesh",
    "28": "madhyapradesh",
    "30": "rajasthan",
    "32": "rajasthan",
    "36": "gujarat",
    "38": "gujarat",
    "40": "maharashtra",
    "41": "maharashtra",
    "42": "maharashtra",
    "43": "maharashtra",
    "44": "maharashtra",
    "45": "madhyapradesh",
    "50": "telangana",
    "56": "karnataka",
    "57": "karnataka",
    "60": "tamilnadu",
    "70": "westbengal",
    "75": "odisha",
    "80": "bihar",
  };
  const pincodeCityHints: Record<string, string[]> = {
    "11": ["delhi", "newdelhi"],
    "40": ["mumbai", "thane", "navimumbai"],
    "41": ["pune", "nashik"],
    "42": ["nashik", "jalgaon"],
    "43": ["nagpur", "amravati"],
    "44": ["pune", "kolhapur", "sangli"],
    "50": ["hyderabad", "secunderabad"],
    "56": ["bengaluru", "bangalore"],
    "57": ["mysuru", "mysore"],
    "60": ["chennai"],
    "70": ["kolkata", "calcutta"],
  };

  const mappedState = pincodeStateMap[prefix];
  const normalizedState = normalizeState(stateRaw);
  if (mappedState && normalizedState && normalizedState !== mappedState) return true;

  const cityHints = pincodeCityHints[prefix] ?? [];
  const normalizedCity = cityRaw.toLowerCase().replace(/[^a-z]/g, "");
  if (cityHints.length > 0 && normalizedCity && !cityHints.some((hint) => normalizedCity.includes(hint))) return true;

  return false;
}

export function InvoiceIntakeForm({
  submitterName = "",
  submitterEmail = "",
  initialValues = null,
  previousSubmissionId = null,
  onSubmit,
  submitEnabled = false,
}: Props) {
  const [values, setValues] = useState<InvoiceIntakeFormValues>({
    ...INITIAL_VALUES,
    submitterName,
    submitterEmail,
  });
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [manualLocationEdits, setManualLocationEdits] = useState({
    city: false,
    state: false,
    country: false,
    pincode: false,
  });
  const [productReimbursementFiles, setProductReimbursementFiles] = useState<Record<string, File | null>>({});
  const [productReimbursementErrors, setProductReimbursementErrors] = useState<Record<string, string>>({});
  const previousBillingBrandRef = useRef("");

  useEffect(() => {
    setValues((prev) => ({
      ...prev,
      submitterName: submitterName || prev.submitterName,
      submitterEmail: submitterEmail || prev.submitterEmail,
    }));
  }, [submitterName, submitterEmail]);

  useEffect(() => {
    if (!initialValues) return;
    setValues((prev) => ({
      ...prev,
      ...initialValues,
      submitterName: submitterName || prev.submitterName,
      submitterEmail: submitterEmail || prev.submitterEmail,
    }));
    setManualLocationEdits({ city: false, state: false, country: false, pincode: false });
  }, [initialValues, submitterEmail, submitterName]);

  useEffect(() => {
    const address = values.addressLine;
    if (!address.trim()) return;

    const nextCity = values.city.trim();
    const nextState = values.state.trim();
    const nextCountry = values.country.trim();
    const nextPincode = values.pincode.trim();

    const pinMatch = address.match(/\b(\d{6})\b/);
    const inferredPincode = pinMatch?.[1] ?? "";
    const hasIndia = /\bindia\b/i.test(address);
    const normalized = address.toLowerCase();

    const knownPlaces = [
      { city: "Mumbai", state: "Maharashtra", match: /(mumbai|bhandup|andheri|thane|maharashtra)/i },
      { city: "Bengaluru", state: "Karnataka", match: /(bengaluru|bangalore|karnataka|indiranagar|hsr)/i },
      { city: "New Delhi", state: "Delhi", match: /(new delhi|delhi|paschim vihar)/i },
      { city: "Kolkata", state: "West Bengal", match: /(kolkata|calcutta|west bengal)/i },
      { city: "Hyderabad", state: "Telangana", match: /(hyderabad|telangana)/i },
      { city: "Chennai", state: "Tamil Nadu", match: /(chennai|tamil nadu)/i },
      { city: "Pune", state: "Maharashtra", match: /(pune|maharashtra)/i },
      { city: "Ahmedabad", state: "Gujarat", match: /(ahmedabad|gujarat)/i },
    ];

    const place = knownPlaces.find((item) => item.match.test(normalized));

    const updates: Partial<InvoiceIntakeFormValues> = {};
    if (!manualLocationEdits.pincode && inferredPincode && nextPincode !== inferredPincode) updates.pincode = inferredPincode;
    if (!manualLocationEdits.country && hasIndia && nextCountry.toLowerCase() !== "india") updates.country = "India";
    if (!manualLocationEdits.city && place?.city && nextCity !== place.city) updates.city = place.city;
    if (!manualLocationEdits.state && place?.state && nextState !== place.state) updates.state = place.state;

    if (Object.keys(updates).length > 0) {
      setValues((prev) => ({ ...prev, ...updates }));
    }
  }, [manualLocationEdits.city, manualLocationEdits.country, manualLocationEdits.pincode, manualLocationEdits.state, values.addressLine, values.city, values.country, values.pincode, values.state]);

  useEffect(() => {
    const billingBrand = values.entityType === "Agency" ? values.billingBrandName.trim() : values.agencyBrandName.trim();
    const previousBillingBrand = previousBillingBrandRef.current;
    previousBillingBrandRef.current = billingBrand;
    if (!billingBrand) return;

    setValues((prev) => {
      let changed = false;
      const next = { ...prev };

      if (!prev.scBrand.trim() || prev.scBrand === previousBillingBrand) {
        next.scBrand = billingBrand;
        changed = true;
      }
      if (!prev.campaignBrand.trim() || prev.campaignBrand === previousBillingBrand) {
        next.campaignBrand = billingBrand;
        changed = true;
      }

      const nextMcRows = prev.mcRows.map((row) => {
        if (row.brand.trim() && row.brand !== previousBillingBrand) return row;
        changed = true;
        return { ...row, brand: billingBrand };
      });

      if (changed) next.mcRows = nextMcRows;
      return changed ? next : prev;
    });
  }, [values.agencyBrandName, values.billingBrandName, values.entityType]);

  const totalAmount = useMemo(() => {
    const commission = Number.parseFloat(values.commission || "0");
    const commissionValue = Number.isNaN(commission) || commission <= 0 ? 0 : commission;

    if (values.businessLine === "TM" && values.entryType === "SC") {
      const base = sumAmounts(values.scDeliverables.map((row) => row.amount));
      const total = base + commissionValue;
      return total > 0 ? total.toFixed(2) : "";
    }
    if (values.businessLine === "TM" && values.entryType === "MC") {
      const base = sumAmounts(values.mcRows.map((row) => row.amount));
      const total = base + commissionValue;
      return total > 0 ? total.toFixed(2) : "";
    }
    const imBase = Number.parseFloat(values.imCommercials || "0");
    const imBaseValue = Number.isNaN(imBase) || imBase <= 0 ? 0 : imBase;
    const imTotal = imBaseValue + commissionValue;
    return imTotal > 0 ? imTotal.toFixed(2) : "";
  }, [values.businessLine, values.entryType, values.imCommercials, values.mcRows, values.scDeliverables, values.commission]);

  const canSubmit = useMemo(() => {
    if (!values.submitterName.trim()) return false;
    if (!values.submitterEmail.trim()) return false;
    if (!values.entityType.trim()) return false;
    if (!values.agencyBrandName.trim()) return false;
    if (!values.agencyBrandTradeName.trim()) return false;
    if (values.clientType === "Indian") {
      if (!values.gstNumber.trim()) return false;
      if (!isValidGstin(values.gstNumber)) return false;
      if (values.pincode.trim() && !/^\d{6}$/.test(values.pincode.trim())) return false;
    }
    if (!values.addressLine.trim()) return false;
    if (!values.state.trim()) return false;
    if (!values.country.trim()) return false;
    if (values.businessLine === "TM" && values.entryType === "SC" && !values.scCreator.trim()) return false;
    if (values.businessLine === "IM" && !(Number.parseFloat(values.imCommercials || "0") > 0)) return false;
    return true;
  }, [
    values.submitterName,
    values.submitterEmail,
    values.entityType,
    values.clientType,
    values.agencyBrandName,
    values.agencyBrandTradeName,
    values.gstNumber,
    values.addressLine,
    values.state,
    values.country,
    values.businessLine,
    values.entryType,
    values.scCreator,
    values.imCommercials,
    values.pincode,
  ]);

  function update<K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) {
    if (key === "city" || key === "state" || key === "country" || key === "pincode") {
      setManualLocationEdits((prev) => ({ ...prev, [key]: true }));
    }
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function resetTalentManagementState(entryType: EntryType) {
    return {
      entryType,
      scCreator: "",
      scBrand: "",
      scDeliverables: [{ ...EMPTY_SC_ROW }],
      mcRows: [{ ...EMPTY_MC_ROW }],
      campaignCode: "",
      campaignBrand: "",
      campaignDeliverable: "",
      campaignName: "",
      campaignNotes: "",
      imCommercials: "",
    };
  }

  function setBranch(branch: BusinessLine) {
    setValues((prev) => ({
      ...prev,
      businessLine: branch,
      ...(branch === "TM"
        ? resetTalentManagementState("SC")
        : {
            entryType: prev.entryType,
            scCreator: "",
            scBrand: "",
            scDeliverables: [{ ...EMPTY_SC_ROW }],
            mcRows: [{ ...EMPTY_MC_ROW }],
            campaignCode: prev.campaignCode,
            campaignBrand: prev.campaignBrand,
            campaignDeliverable: prev.campaignDeliverable,
            campaignName: prev.campaignName,
            campaignNotes: prev.campaignNotes,
          }),
    }));
  }

  function setEntryType(entry: EntryType) {
    setValues((prev) => ({
      ...prev,
      ...resetTalentManagementState(entry),
      businessLine: "TM",
    }));
  }

  function addScDeliverable() {
    setValues((prev) => ({ ...prev, scDeliverables: [...prev.scDeliverables, { ...EMPTY_SC_ROW }] }));
  }

  function removeScDeliverable(index: number) {
    setValues((prev) => ({
      ...prev,
      scDeliverables: prev.scDeliverables.length === 1 ? prev.scDeliverables : prev.scDeliverables.filter((_, i) => i !== index),
    }));
  }

  function patchScDeliverable(index: number, patch: { deliverable?: string; amount?: string }) {
    setValues((prev) => ({
      ...prev,
      scDeliverables: prev.scDeliverables.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function addMcRow() {
    setValues((prev) => ({
      ...prev,
      mcRows: [...prev.mcRows, { ...EMPTY_MC_ROW }],
    }));
  }

  function removeMcRow(index: number) {
    setValues((prev) => ({
      ...prev,
      mcRows: prev.mcRows.length === 1 ? prev.mcRows : prev.mcRows.filter((_, i) => i !== index),
    }));
  }

  function patchMcRow(index: number, patch: { creator?: string; brand?: string; deliverable?: string; amount?: string }) {
    setValues((prev) => ({
      ...prev,
      mcRows: prev.mcRows.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        if (patch.creator && patch.creator !== item.creator) next.brand = "";
        return next;
      }),
    }));
  }

  function getProductReimbursementFile(key: string) {
    return productReimbursementFiles[key] ?? null;
  }

  function getProductReimbursementError(key: string) {
    return productReimbursementErrors[key] ?? "";
  }

  function onProductReimbursementFileChange(key: string, file: File | null) {
    if (file && file.size > 10 * 1024 * 1024) {
      setProductReimbursementErrors((prev) => ({ ...prev, [key]: "File must be 10 MB or smaller." }));
      setProductReimbursementFiles((prev) => ({ ...prev, [key]: null }));
      return;
    }

    setProductReimbursementErrors((prev) => ({ ...prev, [key]: "" }));
    setProductReimbursementFiles((prev) => ({ ...prev, [key]: file }));
  }

  function buildPayload(): InvoiceIntakeSubmissionPayload {
    const deliverables =
      values.businessLine === "TM" && values.entryType === "SC"
        ? values.scDeliverables.map((row) => row.deliverable).filter(Boolean).join(", ")
        : values.businessLine === "TM" && values.entryType === "MC"
          ? values.mcRows.map((row) => row.deliverable).filter(Boolean).join(", ")
          : values.campaignDeliverable || "";

    const creatorNames =
      values.businessLine === "TM" && values.entryType === "SC"
        ? values.scCreator
        : values.businessLine === "TM" && values.entryType === "MC"
          ? values.mcRows.map((row) => row.creator).filter(Boolean).join(", ")
          : "";

    const uniqueBrandNames = Array.from(
      new Set(
        (
          values.businessLine === "TM" && values.entryType === "SC"
            ? [values.scBrand]
            : values.businessLine === "TM" && values.entryType === "MC"
              ? values.mcRows.map((row) => row.brand)
              : [values.campaignBrand]
        ).filter(Boolean)
      )
    );

    const billingBrandName = values.entityType === "Agency" ? values.billingBrandName : values.agencyBrandName;
    const brandName =
      values.businessLine === "TM" && values.entryType === "SC"
        ? values.scBrand || billingBrandName || ""
        : values.businessLine === "TM" && values.entryType === "MC"
          ? uniqueBrandNames[0] || billingBrandName || ""
          : values.campaignBrand || billingBrandName || "";

    const lineItems =
      values.businessLine === "TM" && values.entryType === "SC"
        ? values.scDeliverables.map((row, idx) => ({
            creator_name: values.scCreator || null,
            brand_name: values.scBrand || null,
            deliverable_name: row.deliverable || null,
            amount: Number.parseFloat(row.amount || "0") || 0,
            line_order: idx,
          }))
        : values.businessLine === "TM" && values.entryType === "MC"
          ? values.mcRows.map((row, idx) => ({
              creator_name: row.creator || null,
              brand_name: row.brand || null,
              deliverable_name: row.deliverable || null,
              amount: Number.parseFloat(row.amount || "0") || 0,
              line_order: idx,
            }))
          : [];

    const commercials = Number.parseFloat(totalAmount || "0") || 0;

    return {
      previous_submission_id: previousSubmissionId || null,
      agency_brand_name: values.agencyBrandName,
      agency_brand_trade_name: values.agencyBrandTradeName,
      email_address: values.submitterEmail,
      gst_number: values.gstNumber.toUpperCase(),
      address: [values.addressLine, values.city, values.state, values.country, values.pincode].filter(Boolean).join(", "),
      bill_due: values.billDue,
      invoice_type: values.invoiceType,
      deliverables,
      creator_creators_name: creatorNames,
      brand_name: brandName,
      brand_names_text: uniqueBrandNames.join(", "),
      commercials,
      additional_information: values.additionalInformation,
      additional_agency_commission: Number.parseFloat(values.commission || "0") || 0,
      reimbursement_amount: values.reimbursementIncluded === "yes" ? Number.parseFloat(values.reimbursementAmount || "0") || 0 : 0,
      reimbursement_receipts: values.reimbursementIncluded === "yes" ? values.reimbursementProof : "",
      line_items: lineItems,
      integration_metadata: {
        submitterName: values.submitterName,
        businessLine: values.businessLine,
        entryType: values.businessLine === "TM" ? values.entryType : null,
        entityType: values.entityType,
        clientType: values.clientType,
        billingBrandName: values.billingBrandName,
        city: values.city,
        state: values.state,
        country: values.country,
        pincode: values.pincode,
        campaignCode: values.campaignCode,
        campaignNotes: [values.campaignName, values.campaignNotes].filter(Boolean).join(" | "),
        brandNamesText: uniqueBrandNames.join(", "),
      },
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");

    if (!values.submitterName.trim()) return setError("Submitter name is required.");
    if (!values.submitterEmail.trim()) return setError("Submitter email is required.");
    if (!values.entityType.trim()) return setError("Entity Type is required.");
    if (!values.agencyBrandName.trim()) return setError(`${values.entityType} Name is required.`);
    if (!values.agencyBrandTradeName.trim()) return setError(`${values.entityType} Trade Name is required.`);
    if (values.clientType === "Indian") {
      if (!values.gstNumber.trim()) return setError("GST Number is required.");
      if (!isValidGstin(values.gstNumber)) return setError("GST Number must be a valid 15-character GSTIN.");
      if (values.pincode.trim() && !/^\d{6}$/.test(values.pincode.trim())) return setError("Pincode must be a valid 6-digit Indian pincode.");

      const stateCodeMap: Record<string, string> = {
        "27": "maharashtra",
        "29": "karnataka",
        "07": "delhi",
        "33": "tamilnadu",
        "36": "telangana",
        "24": "gujarat",
        "19": "westbengal",
      };
      const stateCode = values.gstNumber.slice(0, 2);
      const mappedState = stateCodeMap[stateCode];
      if (mappedState && values.state.trim() && normalizeState(values.state) !== mappedState) {
        return setError("GST state code and selected state do not match. Please verify.");
      }

      if (hasKnownPincodeLocationMismatch(values.pincode, values.city, values.state)) {
        return setError("Pincode does not match selected city/state.");
      }
    }
    if (!values.addressLine.trim()) return setError("Address is required.");
    if (!values.state.trim()) return setError("State is required.");
    if (!values.country.trim()) return setError("Country is required.");
    if (values.businessLine === "TM" && values.entryType === "SC" && !values.scCreator) {
      return setError("Please select a creator for the single-creator flow.");
    }
    if (values.businessLine === "IM" && !(Number.parseFloat(values.imCommercials || "0") > 0)) {
      return setError("Commercials / Total Amount is required for Influencer Marketing.");
    }
    if (!submitEnabled || !onSubmit) return setError("Submit is unavailable.");

    const payload = buildPayload();

    try {
      setSubmitting(true);
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setValues({
      ...INITIAL_VALUES,
      submitterName: values.submitterName,
      submitterEmail: values.submitterEmail,
    });
    setManualLocationEdits({ city: false, state: false, country: false, pincode: false });
    setProductReimbursementFiles({});
    setProductReimbursementErrors({});
    previousBillingBrandRef.current = "";
    setError("");
  }

  return (
    <form onSubmit={handleSubmit} className="intake-form">
      <section className="intake-section">
        <div className="intake-section-header">
          <div>
            <h3 className="intake-section-title">Submitter</h3>
            <p className="text-muted intake-section-copy">Provide submitter details exactly as shared with finance.</p>
          </div>
        </div>

        <div className="intake-section-body intake-form-grid">
          <label className="intake-field">
            <span className="intake-label">Name</span>
            <input className="intake-input" value={values.submitterName} onChange={(e) => update("submitterName", e.target.value)} required />
          </label>
          <label className="intake-field">
            <span className="intake-label">Email</span>
            <input className="intake-input" type="email" value={values.submitterEmail} readOnly required />
          </label>
        </div>
      </section>

      <section className="intake-section">
        <div className="intake-section-header">
          <div>
            <h3 className="intake-section-title">Business Workflow</h3>
            <p className="text-muted intake-section-copy">Select the business line first, then choose the correct TM flow when applicable.</p>
          </div>
        </div>

        <div className="intake-section-body" style={{ display: "grid", gap: 16 }}>
          <div>
            <label className="intake-label" style={{ marginBottom: 8, display: "block" }}>Business Line</label>
            <div className="intake-toggle-group">
              {BUSINESS_LINES.map((line) => (
                <button
                  key={line.value}
                  type="button"
                  className={values.businessLine === line.value ? "intake-toggle intake-toggle-active" : "intake-toggle"}
                  onClick={() => setBranch(line.value)}
                >
                  {line.label}
                </button>
              ))}
            </div>
          </div>

          {values.businessLine === "TM" ? (
            <div>
              <label className="intake-label" style={{ marginBottom: 8, display: "block" }}>Entry Type</label>
              <div className="intake-toggle-group">
                {ENTRY_TYPES.map((entry) => (
                  <button
                    key={entry.value}
                    type="button"
                    className={values.entryType === entry.value ? "intake-toggle intake-toggle-active" : "intake-toggle"}
                    onClick={() => setEntryType(entry.value)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <BillingEntitySection values={values} onChange={update} />
      <InvoiceDetailsSection values={values} onChange={update} />
      <CreatorDeliverablesSection
        values={values}
        onChange={update}
        addScDeliverable={addScDeliverable}
        removeScDeliverable={removeScDeliverable}
        patchScDeliverable={patchScDeliverable}
        addMcRow={addMcRow}
        removeMcRow={removeMcRow}
        patchMcRow={patchMcRow}
        getProductReimbursementFile={getProductReimbursementFile}
        getProductReimbursementError={getProductReimbursementError}
        onProductReimbursementFileChange={onProductReimbursementFileChange}
      />
      <CommercialsSection values={values} totalAmount={totalAmount} onChange={update} />
      <AdditionalInfoSection values={values} onChange={update} />
      <FormActions onReset={handleReset} submitting={submitting} submitEnabled={submitEnabled && Boolean(onSubmit) && canSubmit} />

      {error ? <p className="text-danger intake-inline-error">{error}</p> : null}
    </form>
  );
}
