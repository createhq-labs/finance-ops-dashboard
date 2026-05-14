"use client";

import { FormEvent, useMemo, useState } from "react";
import { BILL_DUE_OPTIONS, BUSINESS_LINES, ENTRY_TYPES, INVOICE_TYPES } from "./constants";
import { AdditionalInfoSection } from "./sections/AdditionalInfoSection";
import { BillingEntitySection } from "./sections/BillingEntitySection";
import { CommercialsSection } from "./sections/CommercialsSection";
import { CreatorDeliverablesSection } from "./sections/CreatorDeliverablesSection";
import { FormActions } from "./sections/FormActions";
import { InvoiceDetailsSection } from "./sections/InvoiceDetailsSection";
import { ReimbursementSection } from "./sections/ReimbursementSection";
import type { BusinessLine, EntryType, InvoiceIntakeFormValues, InvoiceIntakeSubmissionPayload, MultiCreatorRow } from "./types";

type Props = {
  submitterName?: string;
  submitterEmail?: string;
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
  agencyBrandName: "",
  agencyBrandTradeName: "",
  gstNumber: "",
  addressLine: "",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
  invoiceType: INVOICE_TYPES[0],
  billDue: BILL_DUE_OPTIONS[0],
  commission: "",
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

export function InvoiceIntakeForm({
  submitterName = "",
  submitterEmail = "",
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

  const totalAmount = useMemo(() => {
    if (values.businessLine === "TM" && values.entryType === "SC") {
      const total = sumAmounts(values.scDeliverables.map((row) => row.amount));
      return total > 0 ? total.toFixed(2) : "";
    }

    if (values.businessLine === "TM" && values.entryType === "MC") {
      const total = sumAmounts(values.mcRows.map((row) => row.amount));
      return total > 0 ? total.toFixed(2) : "";
    }

    return values.imCommercials;
  }, [values.businessLine, values.entryType, values.imCommercials, values.mcRows, values.scDeliverables]);

  function update<K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) {
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
        if (patch.creator && patch.creator !== item.creator) {
          next.brand = "";
        }
        return next;
      }),
    }));
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

    const brandName =
      values.businessLine === "TM" && values.entryType === "SC"
        ? values.scBrand
        : values.businessLine === "TM" && values.entryType === "MC"
          ? uniqueBrandNames[0] || ""
          : values.campaignBrand || "";

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

    const commercials =
      values.businessLine === "IM"
        ? Number.parseFloat(values.imCommercials || "0") || 0
        : Number.parseFloat(totalAmount || "0") || 0;

    return {
      agency_brand_name: values.agencyBrandName,
      agency_brand_trade_name: values.agencyBrandTradeName,
      email_address: values.submitterEmail,
      gst_number: values.gstNumber,
      address: [values.addressLine, values.city, values.state, values.pincode].filter(Boolean).join(", "),
      bill_due: values.billDue,
      invoice_type: values.invoiceType,
      deliverables,
      creator_creators_name: creatorNames,
      brand_name: brandName,
      brand_names_text: uniqueBrandNames.join(", "),
      commercials,
      additional_information: values.additionalInformation,
      additional_agency_commission: Number.parseFloat(values.commission || "0") || 0,
      reimbursement_amount: 0,
      reimbursement_receipts: values.reimbursementProof,
      line_items: lineItems,
      integration_metadata: {
        submitterName: values.submitterName,
        businessLine: values.businessLine,
        entryType: values.businessLine === "TM" ? values.entryType : null,
        entityType: values.entityType,
        city: values.city,
        state: values.state,
        pincode: values.pincode,
        campaignCode: values.campaignCode,
        campaignNotes: [values.campaignName, values.campaignNotes].filter(Boolean).join(" | "),
        brandNamesText: uniqueBrandNames.join(", "),
      },
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!submitEnabled || !onSubmit) {
      setError("Backend wiring pending. Submission is disabled until /api/submissions/create is connected.");
      return;
    }

    if (!values.agencyBrandName.trim()) {
      setError("Agency / Brand Name is required.");
      return;
    }

    if (!values.submitterEmail.trim()) {
      setError("Email is required.");
      return;
    }

    if (values.businessLine === "TM" && values.entryType === "SC" && !values.scCreator) {
      setError("Please select a creator for the single-creator flow.");
      return;
    }

    if (values.businessLine === "IM" && !(Number.parseFloat(values.imCommercials || "0") > 0)) {
      setError("Commercials / Total Amount is required for Influencer Marketing.");
      return;
    }

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
    setError("");
  }

  return (
    <form onSubmit={handleSubmit} className="intake-form">
      <section className="intake-section">
        <div className="intake-section-header">
          <div>
            <h3 className="intake-section-title">Submitter</h3>
            <p className="text-muted intake-section-copy">The form keeps your identity locked to the current logged-in dashboard session.</p>
          </div>
        </div>

        <div className="intake-section-body intake-form-grid">
          <label className="intake-field">
            <span className="intake-label">Name</span>
            <input className="intake-input" value={values.submitterName} readOnly />
          </label>
          <label className="intake-field">
            <span className="intake-label">Email</span>
            <input className="intake-input" value={values.submitterEmail} readOnly />
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
      />
      <CommercialsSection values={values} totalAmount={totalAmount} onChange={update} />
      <ReimbursementSection values={values} onChange={update} />
      <AdditionalInfoSection values={values} onChange={update} />
      <FormActions onReset={handleReset} submitting={submitting} submitEnabled={submitEnabled && Boolean(onSubmit)} />

      {!submitEnabled || !onSubmit ? (
        <p className="text-muted intake-inline-note">Backend wiring is still deferred. This page now mirrors the CREATE ledger intake flow more closely, but final submission remains intentionally disabled.</p>
      ) : null}
      {error ? <p className="text-danger intake-inline-error">{error}</p> : null}
    </form>
  );
}
