"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BILL_DUE_OPTIONS,
  BUSINESS_LINES,
  ENTRY_TYPES,
  INVOICE_TYPES,
  getFallbackMasterData,
  type FormDropdownMasterData,
} from "./constants";
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
const OPTIONAL_FIELDS = new Set(["commission", "additionalInformation", "campaignNotes"]);
const REIMBURSEMENT_INVOICE_TYPES = new Set([
  "Reimbursement Invoice (With GST)",
  "Reimbursement Invoice (Without GST)",
]);
const INDIAN_STATES: Array<{ name: string; aliases: string[] }> = [
  { name: "Delhi", aliases: ["delhi", "new delhi"] },
  { name: "Haryana", aliases: ["haryana"] },
  { name: "Punjab", aliases: ["punjab"] },
  { name: "Uttar Pradesh", aliases: ["uttar pradesh"] },
  { name: "Madhya Pradesh", aliases: ["madhya pradesh"] },
  { name: "Rajasthan", aliases: ["rajasthan"] },
  { name: "Gujarat", aliases: ["gujarat"] },
  { name: "Maharashtra", aliases: ["maharashtra"] },
  { name: "Telangana", aliases: ["telangana"] },
  { name: "Karnataka", aliases: ["karnataka"] },
  { name: "Tamil Nadu", aliases: ["tamil nadu"] },
  { name: "West Bengal", aliases: ["west bengal"] },
  { name: "Odisha", aliases: ["odisha", "orissa"] },
  { name: "Bihar", aliases: ["bihar"] },
];
const CITY_ALIASES: Array<{ name: string; aliases: string[]; state: string }> = [
  { name: "Mumbai", aliases: ["mumbai"], state: "Maharashtra" },
  { name: "Bengaluru", aliases: ["bengaluru", "bangalore"], state: "Karnataka" },
  { name: "Delhi", aliases: ["new delhi", "delhi"], state: "Delhi" },
  { name: "Gurugram", aliases: ["gurugram", "gurgaon"], state: "Haryana" },
  { name: "Hyderabad", aliases: ["hyderabad"], state: "Telangana" },
  { name: "Chennai", aliases: ["chennai"], state: "Tamil Nadu" },
  { name: "Kolkata", aliases: ["kolkata", "calcutta"], state: "West Bengal" },
  { name: "Pune", aliases: ["pune"], state: "Maharashtra" },
  { name: "Ahmedabad", aliases: ["ahmedabad"], state: "Gujarat" },
];
const PINCODE_STATE_MAP: Record<string, string> = {
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
const PINCODE_CITY_HINTS: Record<string, string[]> = {
  "11": ["Delhi"],
  "12": ["Gurugram", "Gurgaon"],
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
  campaignExtraDeliverables: [],
  campaignName: "",
  campaignNotes: "",
  imCommercials: "",
  totalAmount: "",
};

function sanitizeWholeNumberInput(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function parseAmount(value: string) {
  const digits = sanitizeWholeNumberInput(value);
  return digits ? Number.parseInt(digits, 10) : 0;
}

function sumAmounts(values: string[]) {
  return values.reduce((total, value) => total + parseAmount(value), 0);
}

function isValidGstin(value: string) {
  const gst = value.toUpperCase();
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gst);
}

function normalizeState(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function normalizeCity(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function findLastAlias(text: string, aliases: string[]) {
  let bestIndex = -1;
  for (const alias of aliases) {
    const idx = text.lastIndexOf(alias.toLowerCase());
    if (idx > bestIndex) bestIndex = idx;
  }
  return bestIndex;
}

function extractLastPincode(text: string) {
  const matches = [...text.matchAll(/\b(\d{6})\b/g)];
  return matches.length > 0 ? matches[matches.length - 1][1] : "";
}

function inferAddressData(address: string, clientType: InvoiceIntakeFormValues["clientType"]) {
  const text = address.trim();
  if (!text) return { city: "", state: "", country: clientType === "Indian" ? "India" : "", pincode: "" };

  const normalized = text.toLowerCase();
  const pincode = extractLastPincode(text);
  const country = clientType === "Indian" || /\bindia\b/i.test(text) || Boolean(pincode) ? "India" : "";

  let state = "";
  let stateIndex = -1;
  for (const entry of INDIAN_STATES) {
    const idx = findLastAlias(normalized, entry.aliases);
    if (idx > stateIndex) {
      stateIndex = idx;
      state = entry.name;
    }
  }

  let city = "";
  let cityIndex = -1;
  for (const entry of CITY_ALIASES) {
    const idx = findLastAlias(normalized, entry.aliases);
    if (idx > cityIndex) {
      cityIndex = idx;
      city = entry.name;
      if (!state || idx > stateIndex) state = entry.state;
    }
  }

  if (!state && /^\d{6}$/.test(pincode)) {
    state = PINCODE_STATE_MAP[pincode.slice(0, 2)] ?? "";
  }

  if (!city && /^\d{6}$/.test(pincode)) {
    city = (PINCODE_CITY_HINTS[pincode.slice(0, 2)] ?? [])[0] ?? "";
  }

  return { city, state, country, pincode };
}

function hasKnownPincodeLocationMismatch(pincodeRaw: string, cityRaw: string, stateRaw: string) {
  const pincode = pincodeRaw.trim();
  if (!/^\d{6}$/.test(pincode)) return false;

  const prefix = pincode.slice(0, 2);
  const mappedState = PINCODE_STATE_MAP[prefix];
  const normalizedState = normalizeState(stateRaw);
  if (mappedState && normalizedState && normalizedState !== normalizeState(mappedState)) return true;

  const cityHints = PINCODE_CITY_HINTS[prefix] ?? [];
  const normalizedCity = normalizeCity(cityRaw);
  if (cityHints.length > 0 && normalizedCity && !cityHints.some((hint) => normalizedCity.includes(normalizeCity(hint)))) return true;

  return false;
}

function isObviouslyIndianAddress(values: Pick<InvoiceIntakeFormValues, "addressLine" | "city" | "state" | "country" | "pincode">) {
  const haystack = `${values.addressLine} ${values.city} ${values.state} ${values.country}`.toLowerCase();
  if (/\bindia\b/.test(haystack)) return true;
  if (INDIAN_STATES.some((entry) => entry.aliases.some((alias) => haystack.includes(alias)))) return true;
  if (/^\d{6}$/.test(values.pincode.trim())) return true;
  if (/\b\d{6}\b/.test(values.addressLine)) return true;
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
  const formRef = useRef<HTMLFormElement | null>(null);
  const previousBillingBrandRef = useRef("");
  const [values, setValues] = useState<InvoiceIntakeFormValues>({
    ...INITIAL_VALUES,
    submitterName,
    submitterEmail,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [manualLocationEdits, setManualLocationEdits] = useState({
    city: false,
    state: false,
    country: false,
    pincode: false,
  });
  const [autoFilledLocation, setAutoFilledLocation] = useState({
    city: false,
    state: false,
    country: false,
    pincode: false,
  });
  const [productReimbursementFiles, setProductReimbursementFiles] = useState<Record<string, File | null>>({});
  const [productReimbursementErrors, setProductReimbursementErrors] = useState<Record<string, string>>({});
  const [masters, setMasters] = useState<FormDropdownMasterData>(getFallbackMasterData);

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
      campaignExtraDeliverables: initialValues.campaignExtraDeliverables ?? prev.campaignExtraDeliverables,
      submitterName: submitterEmail ? prev.submitterName || submitterName : submitterName || prev.submitterName,
      submitterEmail: submitterEmail || prev.submitterEmail,
    }));
    setManualLocationEdits({ city: false, state: false, country: false, pincode: false });
    setAutoFilledLocation({ city: false, state: false, country: false, pincode: false });
    setFieldErrors({});
    setHasInteracted(false);
  }, [initialValues, submitterEmail, submitterName]);

  useEffect(() => {
    let mounted = true;

    async function loadMasters() {
      try {
        const response = await fetch("/api/form-masters", { method: "GET", cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body?.success || !body?.data) return;
        if (!mounted) return;
        const fallback = getFallbackMasterData();

        const nextMasters: FormDropdownMasterData = {
          agencies: Array.isArray(body.data.agencies)
            ? body.data.agencies
                .map((row: { name?: string; tradeName?: string }) => ({
                  name: String(row.name ?? "").trim(),
                  tradeName: String(row.tradeName ?? "").trim(),
                }))
                .filter((row: { name: string }) => row.name)
            : [],
          brands: Array.isArray(body.data.brands)
            ? body.data.brands
                .map((row: { name?: string; tradeName?: string }) => ({
                  name: String(row.name ?? "").trim(),
                  tradeName: String(row.tradeName ?? "").trim(),
                }))
                .filter((row: { name: string }) => row.name)
            : [],
          creators: Array.isArray(body.data.creators)
            ? body.data.creators
                .map((row: { name?: string; linkedBrandName?: string }) => ({
                  name: String(row.name ?? "").trim(),
                  linkedBrandName: String(row.linkedBrandName ?? "").trim(),
                }))
                .filter((row: { name: string }) => row.name)
            : [],
          deliverables: {
            TM: Array.isArray(body.data.deliverables?.TM)
              ? body.data.deliverables.TM.map((name: string) => String(name ?? "").trim()).filter(Boolean)
              : [],
            IM: Array.isArray(body.data.deliverables?.IM)
              ? body.data.deliverables.IM.map((name: string) => String(name ?? "").trim()).filter(Boolean)
              : [],
          },
        };

        setMasters({
          agencies: nextMasters.agencies.length > 0 ? nextMasters.agencies : fallback.agencies,
          brands: nextMasters.brands.length > 0 ? nextMasters.brands : fallback.brands,
          creators: nextMasters.creators.length > 0 ? nextMasters.creators : fallback.creators,
          deliverables: {
            TM: nextMasters.deliverables.TM.length > 0 ? nextMasters.deliverables.TM : fallback.deliverables.TM,
            IM: nextMasters.deliverables.IM.length > 0 ? nextMasters.deliverables.IM : fallback.deliverables.IM,
          },
        });
      } catch {
        // Keep fallback constants when master data fetch fails.
      }
    }

    void loadMasters();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const inferred = inferAddressData(values.addressLine, values.clientType);

    setValues((prev) => {
      const next = { ...prev };
      let changed = false;

      (["city", "state", "country", "pincode"] as const).forEach((field) => {
        if (manualLocationEdits[field]) return;
        const inferredValue = inferred[field];
        if (inferredValue) {
          if (prev[field] !== inferredValue) {
            next[field] = inferredValue;
            changed = true;
          }
        } else if (autoFilledLocation[field] && prev[field]) {
          next[field] = "";
          changed = true;
        }
      });

      return changed ? next : prev;
    });

    setAutoFilledLocation((prev) => {
      const next = { ...prev };
      let changed = false;

      (["city", "state", "country", "pincode"] as const).forEach((field) => {
        if (manualLocationEdits[field]) {
          if (next[field]) {
            next[field] = false;
            changed = true;
          }
          return;
        }

        const shouldBeAutoFilled = Boolean(inferred[field]);
        if (next[field] !== shouldBeAutoFilled) {
          next[field] = shouldBeAutoFilled;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [autoFilledLocation, manualLocationEdits, values.addressLine, values.clientType]);

  useEffect(() => {
    if (values.clientType !== "Indian") return;
    setValues((prev) => (prev.country === "India" ? prev : { ...prev, country: "India" }));
    setManualLocationEdits((prev) => (prev.country ? { ...prev, country: false } : prev));
    setAutoFilledLocation((prev) => ({ ...prev, country: true }));
  }, [values.clientType]);

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
    const commissionValue = parseAmount(values.commission);

    if (values.businessLine === "TM" && values.entryType === "SC") {
      const total = sumAmounts(values.scDeliverables.map((row) => row.amount)) + commissionValue;
      return total > 0 ? String(total) : "";
    }
    if (values.businessLine === "TM" && values.entryType === "MC") {
      const total = sumAmounts(values.mcRows.map((row) => row.amount)) + commissionValue;
      return total > 0 ? String(total) : "";
    }
    const imTotal = parseAmount(values.imCommercials) + commissionValue;
    return imTotal > 0 ? String(imTotal) : "";
  }, [values.businessLine, values.entryType, values.imCommercials, values.mcRows, values.scDeliverables, values.commission]);

  const agencyOptions = useMemo(() => masters.agencies.map((row) => row.name), [masters.agencies]);
  const agencyTradeNameOptions = useMemo(
    () => Array.from(new Set(masters.agencies.map((row) => row.tradeName).filter(Boolean))),
    [masters.agencies]
  );
  const brandOptions = useMemo(() => masters.brands.map((row) => row.name), [masters.brands]);
  const brandTradeNameOptions = useMemo(
    () => Array.from(new Set(masters.brands.map((row) => row.tradeName).filter(Boolean))),
    [masters.brands]
  );
  const creatorOptions = useMemo(() => masters.creators.map((row) => row.name), [masters.creators]);
  const deliverableOptions = useMemo(
    () => ({
      TM: masters.deliverables.TM,
      IM: masters.deliverables.IM,
    }),
    [masters.deliverables.IM, masters.deliverables.TM]
  );
  const agencyTradeNameMap = useMemo(
    () =>
      masters.agencies.reduce<Record<string, string>>((acc, row) => {
        if (!row.name || !row.tradeName) return acc;
        acc[row.name.trim().toLowerCase()] = row.tradeName.trim();
        return acc;
      }, {}),
    [masters.agencies]
  );
  const brandTradeNameMap = useMemo(
    () =>
      masters.brands.reduce<Record<string, string>>((acc, row) => {
        if (!row.name || !row.tradeName) return acc;
        acc[row.name.trim().toLowerCase()] = row.tradeName.trim();
        return acc;
      }, {}),
    [masters.brands]
  );

  function clearErrors(keys: string[]) {
    setFieldErrors((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of keys) {
        if (next[key]) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }

  function update<K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) {
    setHasInteracted(true);

    let nextValue = value;
    if (key === "commission" || key === "reimbursementAmount" || key === "imCommercials") {
      nextValue = sanitizeWholeNumberInput(String(value)) as InvoiceIntakeFormValues[K];
    }
    if (key === "addressLine") {
      setManualLocationEdits({ city: false, state: false, country: false, pincode: false });
    }
    if (key === "city" || key === "state" || key === "country" || key === "pincode") {
      setManualLocationEdits((prev) => ({ ...prev, [key]: true }));
      setAutoFilledLocation((prev) => ({ ...prev, [key]: false }));
    }

    setValues((prev) => ({ ...prev, [key]: nextValue }));
    clearErrors([String(key), "creatorDeliverables"]);
    setError("");
  }

  useEffect(() => {
    if (!hasInteracted) return;
    const liveErrors = validateForm(values);
    setFieldErrors(liveErrors);
  }, [hasInteracted, values]);

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
      campaignExtraDeliverables: [],
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
            campaignExtraDeliverables: prev.campaignExtraDeliverables,
            campaignName: prev.campaignName,
            campaignNotes: prev.campaignNotes,
          }),
    }));
    clearErrors(["creatorDeliverables", "imCommercials"]);
  }

  function setEntryType(entry: EntryType) {
    setValues((prev) => ({
      ...prev,
      ...resetTalentManagementState(entry),
      businessLine: "TM",
    }));
    clearErrors(["creatorDeliverables"]);
  }

  function addScDeliverable() {
    setValues((prev) => ({ ...prev, scDeliverables: [...prev.scDeliverables, { ...EMPTY_SC_ROW }] }));
  }

  function removeScDeliverable(index: number) {
    setValues((prev) => ({
      ...prev,
      scDeliverables: prev.scDeliverables.length === 1 ? prev.scDeliverables : prev.scDeliverables.filter((_, i) => i !== index),
    }));
    clearErrors([`scDeliverables.${index}.deliverable`, `scDeliverables.${index}.amount`, "creatorDeliverables"]);
  }

  function patchScDeliverable(index: number, patch: { deliverable?: string; amount?: string }) {
    setValues((prev) => ({
      ...prev,
      scDeliverables: prev.scDeliverables.map((item, i) =>
        i === index
          ? {
              ...item,
              ...patch,
              ...(patch.amount !== undefined ? { amount: sanitizeWholeNumberInput(patch.amount) } : {}),
            }
          : item
      ),
    }));
    clearErrors([`scDeliverables.${index}.deliverable`, `scDeliverables.${index}.amount`, "creatorDeliverables"]);
  }

  function addMcRow() {
    setValues((prev) => ({
      ...prev,
      mcRows: [...prev.mcRows, { ...EMPTY_MC_ROW, brand: prev.mcRows[0]?.brand || "" }],
    }));
  }

  function removeMcRow(index: number) {
    setValues((prev) => ({
      ...prev,
      mcRows: prev.mcRows.length === 1 ? prev.mcRows : prev.mcRows.filter((_, i) => i !== index),
    }));
    clearErrors([`mcRows.${index}.creator`, `mcRows.${index}.brand`, `mcRows.${index}.deliverable`, `mcRows.${index}.amount`, "creatorDeliverables"]);
  }

  function patchMcRow(index: number, patch: { creator?: string; brand?: string; deliverable?: string; amount?: string }) {
    setValues((prev) => ({
      ...prev,
      mcRows: prev.mcRows.map((item, i) => {
        const nextPatch =
          patch.brand !== undefined
            ? { ...patch, brand: patch.brand }
            : i === index
              ? patch
              : {};

        return i === index || patch.brand !== undefined
          ? {
              ...item,
              ...nextPatch,
              ...(nextPatch.amount !== undefined ? { amount: sanitizeWholeNumberInput(nextPatch.amount) } : {}),
            }
          : item;
      }),
    }));
    clearErrors([`mcRows.${index}.creator`, `mcRows.${index}.brand`, `mcRows.${index}.deliverable`, `mcRows.${index}.amount`, "creatorDeliverables"]);
  }

  function addImDeliverable() {
    setValues((prev) => ({
      ...prev,
      campaignExtraDeliverables: [...prev.campaignExtraDeliverables, ""],
    }));
  }

  function removeImDeliverable(index: number) {
    setValues((prev) => ({
      ...prev,
      campaignExtraDeliverables: prev.campaignExtraDeliverables.filter((_, i) => i !== index),
    }));
    clearErrors([`campaignExtraDeliverables.${index}`, "creatorDeliverables"]);
  }

  function patchImDeliverable(index: number, value: string) {
    setValues((prev) => ({
      ...prev,
      campaignExtraDeliverables: prev.campaignExtraDeliverables.map((item, i) => (i === index ? value : item)),
    }));
    clearErrors([`campaignExtraDeliverables.${index}`, "creatorDeliverables"]);
  }

  function patchScCreator(nextCreator: string) {
    setValues((prev) => ({
      ...prev,
      scCreator: nextCreator,
    }));
    clearErrors(["scCreator", "creatorDeliverables"]);
  }

  function patchMcCreator(index: number, creator: string) {
    setValues((prev) => ({
      ...prev,
      mcRows: prev.mcRows.map((row, i) => (i === index ? { ...row, creator } : row)),
    }));
    clearErrors([`mcRows.${index}.creator`, "creatorDeliverables"]);
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

  function validateForm(nextValues: InvoiceIntakeFormValues) {
    const errors: Record<string, string> = {};
    const invoiceTypes = nextValues.invoiceType.split(",").map((item) => item.trim()).filter(Boolean);
    const allowedDeliverables = nextValues.businessLine === "IM" ? deliverableOptions.IM : deliverableOptions.TM;
    const imDeliverables = [nextValues.campaignDeliverable, ...nextValues.campaignExtraDeliverables].filter(Boolean);

    if (!nextValues.submitterName.trim()) errors.submitterName = "Name is required.";
    if (!nextValues.submitterEmail.trim()) errors.submitterEmail = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextValues.submitterEmail.trim())) errors.submitterEmail = "Enter a valid email address.";

    if (!nextValues.entityType.trim()) errors.entityType = "Entity type is required.";
    if (!nextValues.clientType.trim()) errors.clientType = "Client type is required.";
    if (!nextValues.agencyBrandName.trim()) errors.agencyBrandName = `${nextValues.entityType === "Agency" ? "Agency" : "Brand"} name is required.`;
    if (!nextValues.agencyBrandTradeName.trim()) errors.agencyBrandTradeName = `${nextValues.entityType === "Agency" ? "Agency" : "Brand"} trade name is required.`;
    if (nextValues.entityType === "Agency" && !nextValues.billingBrandName.trim()) errors.billingBrandName = "Brand name is required.";
    if (!nextValues.addressLine.trim()) errors.addressLine = "Address is required.";
    if (!nextValues.city.trim()) errors.city = "City is required.";
    if (!nextValues.state.trim()) errors.state = "State is required.";
    if (!nextValues.country.trim()) errors.country = "Country is required.";
    if (nextValues.clientType === "Indian" && !nextValues.pincode.trim()) errors.pincode = "Pincode is required.";

    if (nextValues.clientType === "Indian") {
      if (!nextValues.gstNumber.trim()) errors.gstNumber = "GST number is required.";
      else if (!isValidGstin(nextValues.gstNumber)) errors.gstNumber = "Enter a valid 15-character GST number. Example: 07AAIFI5054J1Z7";

      if (!/^\d{6}$/.test(nextValues.pincode.trim())) errors.pincode = "Enter a valid 6-digit Indian pincode.";
      if (hasKnownPincodeLocationMismatch(nextValues.pincode, nextValues.city, nextValues.state)) {
        errors.pincode = "Pincode does not match selected city/state.";
        if (!errors.city) errors.city = "Pincode does not match selected city/state.";
        if (!errors.state) errors.state = "Pincode does not match selected city/state.";
      }

      const stateCodeMap: Record<string, string> = {
        "27": "maharashtra",
        "29": "karnataka",
        "07": "delhi",
        "33": "tamilnadu",
        "36": "telangana",
        "24": "gujarat",
        "19": "westbengal",
        "06": "haryana",
      };
      const stateCode = nextValues.gstNumber.slice(0, 2);
      const mappedState = stateCodeMap[stateCode];
      if (mappedState && nextValues.state.trim() && normalizeState(nextValues.state) !== mappedState) {
        errors.gstNumber = "GST state code and selected state do not match.";
      }
    }

    if (nextValues.clientType === "Foreign" && isObviouslyIndianAddress(nextValues)) {
      const msg = "Foreign client address cannot be an Indian address.";
      errors.addressLine = msg;
      if (!errors.city) errors.city = msg;
      if (!errors.state) errors.state = msg;
      if (!errors.country) errors.country = msg;
      if (!errors.pincode) errors.pincode = msg;
    }

    if (invoiceTypes.length === 0) errors.invoiceType = "Select at least one invoice type.";
    else if (invoiceTypes.some((item) => !INVOICE_TYPES.includes(item as (typeof INVOICE_TYPES)[number]))) errors.invoiceType = "Select a valid invoice type.";
    if (!nextValues.billDue.trim()) errors.billDue = "Bill due is required.";
    else if (!BILL_DUE_OPTIONS.includes(nextValues.billDue as (typeof BILL_DUE_OPTIONS)[number])) errors.billDue = "Select a valid bill due option.";

    if (nextValues.businessLine === "TM" && nextValues.entryType === "SC") {
      if (!nextValues.scCreator.trim()) errors.scCreator = "Creator is required.";
      if (!nextValues.scBrand.trim()) errors.scBrand = "Brand is required.";

      nextValues.scDeliverables.forEach((row, idx) => {
        if (!row.deliverable.trim()) errors[`scDeliverables.${idx}.deliverable`] = "Deliverable is required.";
        else if (!allowedDeliverables.includes(row.deliverable)) errors[`scDeliverables.${idx}.deliverable`] = "Select a valid deliverable.";
        if (!(parseAmount(row.amount) > 0)) errors[`scDeliverables.${idx}.amount`] = "Amount is required.";
      });
    }

    if (nextValues.businessLine === "TM" && nextValues.entryType === "MC") {
      nextValues.mcRows.forEach((row, idx) => {
        if (!row.creator.trim()) errors[`mcRows.${idx}.creator`] = "Creator is required.";
        if (!row.brand.trim()) errors[`mcRows.${idx}.brand`] = "Brand is required.";
        if (!row.deliverable.trim()) errors[`mcRows.${idx}.deliverable`] = "Deliverable is required.";
        else if (!allowedDeliverables.includes(row.deliverable)) errors[`mcRows.${idx}.deliverable`] = "Select a valid deliverable.";
        if (!(parseAmount(row.amount) > 0)) errors[`mcRows.${idx}.amount`] = "Amount is required.";
      });
    }

    if (nextValues.businessLine === "IM") {
      if (!nextValues.campaignCode.trim()) errors.campaignCode = "Campaign code is required.";
      if (!nextValues.campaignName.trim()) errors.campaignName = "Campaign name is required.";
      if (!nextValues.campaignBrand.trim()) errors.campaignBrand = "Campaign brand is required.";
      if (!nextValues.campaignDeliverable.trim()) errors.campaignDeliverable = "Deliverable is required.";
      else if (!deliverableOptions.IM.includes(nextValues.campaignDeliverable)) errors.campaignDeliverable = "Select a valid deliverable.";
      nextValues.campaignExtraDeliverables.forEach((deliverable, index) => {
        if (!deliverable.trim()) errors[`campaignExtraDeliverables.${index}`] = "Deliverable is required.";
        else if (!deliverableOptions.IM.includes(deliverable)) errors[`campaignExtraDeliverables.${index}`] = "Select a valid deliverable.";
      });
      if (!(parseAmount(nextValues.imCommercials) > 0)) errors.imCommercials = "Commercials / Total Amount is required.";
      if (imDeliverables.length === 0) errors.creatorDeliverables = "At least one deliverable is required.";
    }

    const requiresProductReimbursement = invoiceTypes.some((item) => REIMBURSEMENT_INVOICE_TYPES.has(item));
    const hasProductReimbursement =
      (nextValues.businessLine === "TM" && nextValues.entryType === "SC" && nextValues.scDeliverables.some((row) => row.deliverable === "Product Reimbursement")) ||
      (nextValues.businessLine === "TM" && nextValues.entryType === "MC" && nextValues.mcRows.some((row) => row.deliverable === "Product Reimbursement")) ||
      (nextValues.businessLine === "IM" && imDeliverables.includes("Product Reimbursement"));
    if (requiresProductReimbursement && !hasProductReimbursement) {
      errors.creatorDeliverables = "Reimbursement invoice requires at least one Product Reimbursement deliverable.";
    }

    return errors;
  }

  function focusFirstInvalid(nextErrors: Record<string, string>) {
    const form = formRef.current;
    if (!form) return;
    const firstKey = Object.keys(nextErrors).find((key) => !OPTIONAL_FIELDS.has(key));
    if (!firstKey) return;
    const escapedKey = firstKey.replace(/"/g, '\\"');
    const field = form.querySelector<HTMLElement>(`[data-field="${escapedKey}"]`);
    if (!field) return;
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    if ("focus" in field) field.focus();
  }

  function buildPayload(): InvoiceIntakeSubmissionPayload {
    const imDeliverables = [values.campaignDeliverable, ...values.campaignExtraDeliverables].filter(Boolean);
    const deliverables =
      values.businessLine === "TM" && values.entryType === "SC"
        ? values.scDeliverables.map((row) => row.deliverable).filter(Boolean).join(", ")
        : values.businessLine === "TM" && values.entryType === "MC"
          ? values.mcRows.map((row) => row.deliverable).filter(Boolean).join(", ")
          : imDeliverables.join(", ");

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
            amount: parseAmount(row.amount),
            line_order: idx,
          }))
        : values.businessLine === "TM" && values.entryType === "MC"
          ? values.mcRows.map((row, idx) => ({
              creator_name: row.creator || null,
              brand_name: row.brand || null,
              deliverable_name: row.deliverable || null,
              amount: parseAmount(row.amount),
              line_order: idx,
            }))
          : imDeliverables.map((deliverable, idx) => ({
              creator_name: null,
              brand_name: values.campaignBrand || brandName || null,
              deliverable_name: deliverable || null,
              amount: 0,
              line_order: idx,
            }));

    const commercials = parseAmount(totalAmount);

    return {
      previous_submission_id: previousSubmissionId || null,
      agency_brand_name: values.agencyBrandName,
      agency_brand_trade_name: values.agencyBrandTradeName,
      email_address: values.submitterEmail,
      gst_number: values.clientType === "Indian" ? values.gstNumber.toUpperCase() : "",
      address: [values.addressLine, values.city, values.state, values.country, values.pincode].filter(Boolean).join(", "),
      bill_due: values.billDue,
      invoice_type: values.invoiceType,
      deliverables,
      creator_creators_name: creatorNames,
      brand_name: brandName,
      brand_names_text: uniqueBrandNames.join(", "),
      commercials,
      additional_information: values.additionalInformation,
      additional_agency_commission: parseAmount(values.commission),
      reimbursement_amount: values.reimbursementIncluded === "yes" ? parseAmount(values.reimbursementAmount) : 0,
      reimbursement_receipts: values.reimbursementIncluded === "yes" ? values.reimbursementProof : "",
      line_items: lineItems,
      campaign_code: values.businessLine === "IM" ? values.campaignCode : "",
      campaign_name: values.businessLine === "IM" ? values.campaignName : "",
      campaign_brand: values.businessLine === "IM" ? values.campaignBrand : "",
      campaign_notes: values.businessLine === "IM" ? values.campaignNotes : "",
      integration_metadata: {
        submitterName: values.submitterName,
        businessLine: values.businessLine,
        entryType: values.businessLine === "TM" ? values.entryType : null,
        entityType: values.entityType,
        clientType: values.clientType,
        billingBrandName: values.entityType === "Agency" ? values.billingBrandName : values.agencyBrandName,
        city: values.city,
        state: values.state,
        country: values.country,
        pincode: values.pincode,
        campaignCode: values.campaignCode,
        campaignName: values.campaignName,
        campaignBrand: values.campaignBrand,
        campaignDeliverable: deliverables,
        campaignNotes: values.campaignNotes,
        brandNamesText: uniqueBrandNames.join(", "),
      },
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validateForm(values);
    setFieldErrors(nextErrors);
    setError("");

    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(nextErrors);
      return;
    }

    if (!submitEnabled || !onSubmit) {
      setError("Submit is unavailable.");
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
    setManualLocationEdits({ city: false, state: false, country: false, pincode: false });
    setAutoFilledLocation({ city: false, state: false, country: false, pincode: false });
    setProductReimbursementFiles({});
    setProductReimbursementErrors({});
    previousBillingBrandRef.current = "";
    setFieldErrors({});
    setHasInteracted(false);
    setError("");
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="intake-form" autoComplete="off">
      <section className="intake-section">
        <div className="intake-section-header">
          <div>
            <h3 className="intake-section-title">Submitter</h3>
            <p className="text-muted intake-section-copy">Provide submitter details exactly as shared with finance.</p>
          </div>
        </div>
        <div className="intake-section-body intake-form-grid" style={{ alignItems: "start" }}>
          <label className="intake-field" style={{ minWidth: 0 }}>
            <span className="intake-label">Name *</span>
            <input className="intake-input" value={values.submitterName} onChange={(e) => update("submitterName", e.target.value)} data-field="submitterName" autoComplete="off" required />
            {fieldErrors.submitterName ? <p className="text-danger intake-inline-error">{fieldErrors.submitterName}</p> : null}
          </label>
          <label className="intake-field" style={{ minWidth: 0 }}>
            <span className="intake-label">Email *</span>
            <input className="intake-input" type="email" value={values.submitterEmail} readOnly data-field="submitterEmail" required />
            {fieldErrors.submitterEmail ? <p className="text-danger intake-inline-error">{fieldErrors.submitterEmail}</p> : null}
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
        <div className="intake-section-body" style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "minmax(130px, auto) minmax(0, 1fr)",
              alignItems: "center",
            }}
          >
            <label className="intake-label" style={{ margin: 0, display: "block" }}>Business Line *</label>
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
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "minmax(130px, auto) minmax(0, 1fr)",
                alignItems: "center",
              }}
            >
              <label className="intake-label" style={{ margin: 0, display: "block" }}>Entry Type *</label>
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

      <BillingEntitySection
        values={values}
        onChange={update}
        errors={fieldErrors}
        agencyOptions={agencyOptions}
        brandOptions={brandOptions}
        agencyTradeNameOptions={agencyTradeNameOptions}
        brandTradeNameOptions={brandTradeNameOptions}
        agencyTradeNameMap={agencyTradeNameMap}
        brandTradeNameMap={brandTradeNameMap}
      />
      <InvoiceDetailsSection values={values} onChange={update} errors={fieldErrors} />
      <CreatorDeliverablesSection
        values={values}
        onChange={update}
        errors={fieldErrors}
        brandOptions={brandOptions}
        creatorOptions={creatorOptions}
        deliverableOptions={deliverableOptions}
        addScDeliverable={addScDeliverable}
        removeScDeliverable={removeScDeliverable}
        patchScDeliverable={patchScDeliverable}
        addMcRow={addMcRow}
        removeMcRow={removeMcRow}
        patchMcRow={patchMcRow}
        addImDeliverable={addImDeliverable}
        removeImDeliverable={removeImDeliverable}
        patchImDeliverable={patchImDeliverable}
        getProductReimbursementFile={getProductReimbursementFile}
        getProductReimbursementError={getProductReimbursementError}
        onProductReimbursementFileChange={onProductReimbursementFileChange}
        onPatchScCreator={patchScCreator}
        onPatchMcCreator={patchMcCreator}
      />
      <CommercialsSection values={values} totalAmount={totalAmount} onChange={update} errors={fieldErrors} />
      <AdditionalInfoSection values={values} onChange={update} errors={fieldErrors} />
      <FormActions onReset={handleReset} submitting={submitting} submitEnabled={submitEnabled && Boolean(onSubmit)} />

      {error ? <p className="text-danger intake-inline-error">{error}</p> : null}
    </form>
  );
}
