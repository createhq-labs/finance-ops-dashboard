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
import type { InvoiceIntakeFormValues, InvoiceIntakeSubmissionPayload } from "./types";

type Props = {
  submitterName?: string;
  submitterEmail?: string;
  onSubmit?: (payload: InvoiceIntakeSubmissionPayload) => Promise<void> | void;
};

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
  scDeliverables: [{ deliverable: "", amount: "" }],
  mcRows: [{ creator: "", brand: "", deliverable: "", amount: "" }],
  campaignCode: "",
  campaignBrand: "",
  campaignDeliverable: "",
  campaignNotes: "",
  totalAmount: "",
};

export function InvoiceIntakeForm({ submitterName = "", submitterEmail = "", onSubmit }: Props) {
  const [values, setValues] = useState<InvoiceIntakeFormValues>({
    ...INITIAL_VALUES,
    submitterName,
    submitterEmail,
  });
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const totalAmount = useMemo(() => {
    let total = 0;
    if (values.businessLine === "TM" && values.entryType === "SC") {
      for (const row of values.scDeliverables) {
        const amount = parseFloat(row.amount);
        if (!Number.isNaN(amount) && amount > 0) total += amount;
      }
    } else if (values.businessLine === "TM" && values.entryType === "MC") {
      for (const row of values.mcRows) {
        const amount = parseFloat(row.amount);
        if (!Number.isNaN(amount) && amount > 0) total += amount;
      }
    }
    return total > 0 ? total.toFixed(2) : "";
  }, [values.businessLine, values.entryType, values.scDeliverables, values.mcRows]);

  function update<K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function setBranch(branch: InvoiceIntakeFormValues["businessLine"]) {
    setValues((prev) => ({
      ...prev,
      businessLine: branch,
      entryType: "SC",
    }));
  }

  function setEntryType(entry: InvoiceIntakeFormValues["entryType"]) {
    setValues((prev) => ({ ...prev, entryType: entry }));
  }

  function addScDeliverable() {
    setValues((prev) => ({ ...prev, scDeliverables: [...prev.scDeliverables, { deliverable: "", amount: "" }] }));
  }
  function removeScDeliverable(index: number) {
    setValues((prev) => ({
      ...prev,
      scDeliverables: prev.scDeliverables.filter((_, i) => i !== index),
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
      mcRows: [...prev.mcRows, { creator: "", brand: "", deliverable: "", amount: "" }],
    }));
  }
  function removeMcRow(index: number) {
    setValues((prev) => ({ ...prev, mcRows: prev.mcRows.filter((_, i) => i !== index) }));
  }
  function patchMcRow(index: number, patch: { creator?: string; brand?: string; deliverable?: string; amount?: string }) {
    setValues((prev) => ({
      ...prev,
      mcRows: prev.mcRows.map((item, i) => (i === index ? { ...item, ...patch } : item)),
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
          ? values.mcRows.map((row) => row.creator).join(", ")
          : "";

    const brandName =
      values.businessLine === "TM" && values.entryType === "SC"
        ? values.scBrand
        : values.businessLine === "TM" && values.entryType === "MC"
          ? values.mcRows.map((row) => row.brand).find(Boolean) || ""
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
      commercials: Number.parseFloat((values.businessLine === "IM" ? values.totalAmount : totalAmount) || "0") || 0,
      additional_information: values.additionalInformation,
      additional_agency_commission: Number.parseFloat(values.commission || "0") || 0,
      reimbursement_amount: 0,
      reimbursement_receipts: values.reimbursementProof,
      integration_metadata: {
        business_line: values.businessLine,
        entry_type: values.businessLine === "TM" ? values.entryType : "SC",
        entity_type: values.entityType,
        campaign_code: values.campaignCode,
        campaign_notes: values.campaignNotes,
      },
      line_items: lineItems,
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!values.agencyBrandName.trim()) {
      setError("Entity Name is required.");
      return;
    }
    if (!values.submitterEmail.trim()) {
      setError("Email is required.");
      return;
    }

    const payload = buildPayload();

    try {
      setSubmitting(true);
      if (onSubmit) await onSubmit(payload);
      else {
        // Frontend-only fallback for current task.
        console.log("Invoice intake payload", payload);
      }
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
    <form onSubmit={handleSubmit} className="grid gap-4">
      <section className="surface p-4">
        <h3 className="mb-3 text-lg font-semibold">Submitter</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Name</span>
            <input
              className="rounded-md border border-app bg-app px-3 py-2"
              value={values.submitterName}
              onChange={(e) => update("submitterName", e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Email</span>
            <input
              className="rounded-md border border-app bg-app px-3 py-2"
              value={values.submitterEmail}
              onChange={(e) => update("submitterEmail", e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="surface p-4">
        <h3 className="mb-3 text-lg font-semibold">Business Workflow</h3>
        <div className="grid gap-3">
          <div>
            <label className="mb-1 block text-sm">Business Line</label>
            <div className="flex flex-wrap gap-2">
              {BUSINESS_LINES.map((line) => (
                <button
                  key={line.value}
                  type="button"
                  className={`btn ${values.businessLine === line.value ? "btn-primary" : ""}`}
                  onClick={() => setBranch(line.value)}
                >
                  {line.label}
                </button>
              ))}
            </div>
          </div>

          {values.businessLine === "TM" ? (
            <div>
              <label className="mb-1 block text-sm">Entry Type</label>
              <div className="flex flex-wrap gap-2">
                {ENTRY_TYPES.map((entry) => (
                  <button
                    key={entry.value}
                    type="button"
                    className={`btn ${values.entryType === entry.value ? "btn-primary" : ""}`}
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

      <CommercialsSection values={{ ...values, totalAmount }} onChange={update} />
      <ReimbursementSection values={values} onChange={update} />
      <AdditionalInfoSection values={values} onChange={update} />
      <FormActions onReset={handleReset} submitting={submitting} />

      {error ? <p className="text-danger text-sm">{error}</p> : null}
    </form>
  );
}
