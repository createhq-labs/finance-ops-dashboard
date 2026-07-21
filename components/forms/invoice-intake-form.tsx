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
import type { BusinessLine, EntryType, ExistingInvoiceAttachment, GstMappingOption, InvoiceIntakeFormSubmitInput, InvoiceIntakeFormValues, InvoiceIntakeSubmissionPayload, MultiCreatorRow } from "./types";
import { PRODUCT_REIMBURSEMENT_ALLOWED_MIME_TYPES, PRODUCT_REIMBURSEMENT_MAX_FILE_SIZE_BYTES, REFERENCE_PO_ALLOWED_MIME_TYPES, REFERENCE_PO_MAX_FILE_SIZE_BYTES } from "../../lib/shared/submission-attachments";
import { hasKnownPincodeLocationMismatch, inferAddressData, normalizeState, serializeBillingAddress } from "../../lib/shared/address-utils";

type Props = {
  submitterName?: string;
  submitterEmail?: string;
  currentUserRole?: 'employee' | 'team_lead' | 'finance' | 'admin' | 'developer';
  currentUserBusinessLine?: BusinessLine | null;
  initialValues?: Partial<InvoiceIntakeFormValues> | null;
  previousSubmissionId?: string | null;
  existingProductReimbursementAttachment?: boolean;
  existingProductReimbursementAttachmentMeta?: ExistingInvoiceAttachment | null;
  existingReferencePoAttachment?: ExistingInvoiceAttachment | null;
  onSubmit?: (submission: InvoiceIntakeFormSubmitInput) => Promise<void> | void;
  submitEnabled?: boolean;
};

const EMPTY_SC_ROW = { deliverable: "", amount: "" };
const EMPTY_MC_ROW: MultiCreatorRow = { creator: "", brand: "", deliverable: "", amount: "" };
const OPTIONAL_FIELDS = new Set(["commission", "additionalInformation", "campaignNotes"]);
const REIMBURSEMENT_INVOICE_TYPES = new Set([
  "Reimbursement Invoice (With GST)",
  "Reimbursement Invoice (Without GST)",
]);
const PRODUCT_REIMBURSEMENT_UPLOAD_HINT = "Upload a PDF, PNG, JPG, or WEBP file up to 10 MB.";
const INDIAN_ADDRESS_ALIASES = [
  "delhi",
  "new delhi",
  "haryana",
  "punjab",
  "uttar pradesh",
  "madhya pradesh",
  "rajasthan",
  "gujarat",
  "maharashtra",
  "telangana",
  "karnataka",
  "tamil nadu",
  "west bengal",
  "odisha",
  "orissa",
  "bihar",
];

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
  gstSelectionMode: "existing",
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
  currency: "INR",
};

function sanitizeDecimalInput(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return "";

  const firstDotIndex = cleaned.indexOf(".");
  if (firstDotIndex === -1) return cleaned;

  const integerPart = cleaned.slice(0, firstDotIndex);
  const decimalPart = cleaned
    .slice(firstDotIndex + 1)
    .replace(/\./g, "");

  const normalizedInteger = integerPart || "0";
  return `${normalizedInteger}.${decimalPart}`;
}

function parseAmount(value: string) {
  const sanitized = sanitizeDecimalInput(value);
  return sanitized ? Number.parseFloat(sanitized) || 0 : 0;
}

function addDecimalAmounts(values: string[]) {
  const sanitizedValues = values.map(sanitizeDecimalInput).filter(Boolean);
  if (sanitizedValues.length === 0) return "";

  const scale = sanitizedValues.reduce((maxScale, value) => {
    const decimalPart = value.split(".")[1] ?? "";
    return Math.max(maxScale, decimalPart.length);
  }, 0);
  const factor = BigInt(10) ** BigInt(scale);
  const total = sanitizedValues.reduce((sum, value) => {
    const [integerPartRaw, decimalPartRaw = ""] = value.split(".");
    const integerPart = integerPartRaw || "0";
    const decimalPart = decimalPartRaw.padEnd(scale, "0");
    return sum + BigInt(integerPart) * factor + BigInt(decimalPart || "0");
  }, BigInt(0));

  if (total <= BigInt(0)) return "";
  if (scale === 0) return total.toString();

  const integerPart = total / factor;
  const decimalPart = (total % factor).toString().padStart(scale, "0").replace(/0+$/, "");
  return decimalPart ? `${integerPart}.${decimalPart}` : integerPart.toString();
}

function sumProductReimbursementRowAmounts(rows: Array<{ deliverable: string; amount: string }>) {
  return addDecimalAmounts(rows.filter((row) => isProductReimbursementDeliverable(row.deliverable)).map((row) => row.amount));
}

function sumNonReimbursementRowAmounts(rows: Array<{ deliverable: string; amount: string }>) {
  return addDecimalAmounts(rows.filter((row) => !isProductReimbursementDeliverable(row.deliverable)).map((row) => row.amount));
}

function isProductReimbursementDeliverable(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase() === "product reimbursement";
}

function sumProductReimbursementRows(rows: Array<{ deliverable: string; amount: string }>) {
  return rows.reduce(
    (total, row) => total + (isProductReimbursementDeliverable(row.deliverable) ? parseAmount(row.amount) : 0),
    0
  );
}

function sumNonReimbursementRows(rows: Array<{ deliverable: string; amount: string }>) {
  return rows.reduce(
    (total, row) => total + (isProductReimbursementDeliverable(row.deliverable) ? 0 : parseAmount(row.amount)),
    0
  );
}

function normalizeGstNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isValidGstin(value: string) {
  const gst = normalizeGstNumber(value);
  return gst === 'NA' || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gst);
}
function isObviouslyIndianAddress(values: Pick<InvoiceIntakeFormValues, "addressLine" | "city" | "state" | "country" | "pincode">) {
  const haystack = `${values.addressLine} ${values.city} ${values.state} ${values.country}`.toLowerCase();
  if (/\bindia\b/.test(haystack)) return true;
  if (INDIAN_ADDRESS_ALIASES.some((alias) => haystack.includes(alias))) return true;
  if (/^\d{6}$/.test(values.pincode.trim())) return true;
  if (/\b\d{6}\b/.test(values.addressLine)) return true;
  return false;
}

export function InvoiceIntakeForm({
  submitterName = "",
  submitterEmail = "",
  currentUserRole,
  currentUserBusinessLine = null,
  initialValues = null,
  previousSubmissionId = null,
  existingProductReimbursementAttachment = false,
  existingProductReimbursementAttachmentMeta = null,
  existingReferencePoAttachment = null,
  onSubmit,
  submitEnabled = false,
}: Props) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const previousBillingBrandRef = useRef("");
  const gstAddressSnapshotRef = useRef<Pick<InvoiceIntakeFormValues, "addressLine" | "city" | "state" | "country" | "pincode"> | null>(null);
  const [values, setValues] = useState<InvoiceIntakeFormValues>({
    ...INITIAL_VALUES,
    submitterName,
    submitterEmail,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [activeField, setActiveField] = useState<string>("submitterName");
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
  const [productReimbursementAttachmentRemoved, setProductReimbursementAttachmentRemoved] = useState(false);
  const [referencePoFile, setReferencePoFile] = useState<File | null>(null);
  const [referencePoError, setReferencePoError] = useState('');
  const [referencePoAttachmentRemoved, setReferencePoAttachmentRemoved] = useState(false);
  const [masters, setMasters] = useState<FormDropdownMasterData>(getFallbackMasterData);
  const lockedBusinessLine = currentUserRole === 'employee' && currentUserBusinessLine ? currentUserBusinessLine : null;

  useEffect(() => {
    setValues((prev) => ({
      ...prev,
      submitterName: submitterName || prev.submitterName,
      submitterEmail: submitterEmail || prev.submitterEmail,
    }));
  }, [submitterName, submitterEmail]);

  useEffect(() => {
    if (!lockedBusinessLine) return;
    setValues((prev) => (prev.businessLine === lockedBusinessLine ? prev : { ...prev, businessLine: lockedBusinessLine }));
  }, [lockedBusinessLine]);

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
    gstAddressSnapshotRef.current = null;
    setFieldErrors({});
    setHasInteracted(false);
    setProductReimbursementAttachmentRemoved(false);
    setReferencePoAttachmentRemoved(false);
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
          gstMappings: Array.isArray(body.data.gstMappings)
            ? body.data.gstMappings
                .map((row: { entityType?: string; entityName?: string; entityTradeName?: string; gstNumber?: string; address?: string; city?: string; state?: string; country?: string; pincode?: string }) => ({
                  entityType: String(row.entityType ?? "").trim(),
                  entityName: String(row.entityName ?? "").trim(),
                  entityTradeName: String(row.entityTradeName ?? "").trim(),
                  gstNumber: String(row.gstNumber ?? "").trim(),
                  address: String(row.address ?? "").trim(),
                  city: String(row.city ?? "").trim(),
                  state: String(row.state ?? "").trim(),
                  country: String(row.country ?? "").trim(),
                  pincode: String(row.pincode ?? "").trim(),
                }))
                .filter((row: { entityType: string; entityName: string; gstNumber: string; address: string }) => row.entityType && row.entityName && row.gstNumber && row.address)
            : [],
        };

        setMasters({
          agencies: nextMasters.agencies.length > 0 ? nextMasters.agencies : fallback.agencies,
          brands: nextMasters.brands.length > 0 ? nextMasters.brands : fallback.brands,
          creators: nextMasters.creators.length > 0 ? nextMasters.creators : fallback.creators,
          deliverables: {
            TM: nextMasters.deliverables.TM.length > 0 ? nextMasters.deliverables.TM : fallback.deliverables.TM,
            IM: nextMasters.deliverables.IM.length > 0 ? nextMasters.deliverables.IM : fallback.deliverables.IM,
          },
          gstMappings: nextMasters.gstMappings,
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
    const legacyReimbursementValue =
      values.reimbursementIncluded === "yes" ? parseAmount(values.reimbursementAmount) : 0;

    if (values.businessLine === "TM" && values.entryType === "SC") {
      const reimbursementValue = sumProductReimbursementRowAmounts(values.scDeliverables) || String(legacyReimbursementValue || "");
      return addDecimalAmounts([sumNonReimbursementRowAmounts(values.scDeliverables), reimbursementValue, values.commission]);
    }
    if (values.businessLine === "TM" && values.entryType === "MC") {
      const reimbursementValue = sumProductReimbursementRowAmounts(values.mcRows) || String(legacyReimbursementValue || "");
      return addDecimalAmounts([sumNonReimbursementRowAmounts(values.mcRows), reimbursementValue, values.commission]);
    }
    const imDeliverables = [values.campaignDeliverable, ...values.campaignExtraDeliverables];
    const reimbursementValue = imDeliverables.some(isProductReimbursementDeliverable)
      ? values.reimbursementAmount
      : String(legacyReimbursementValue || "");
    return addDecimalAmounts([values.imCommercials, reimbursementValue, values.commission]);
  }, [
    values.businessLine,
    values.campaignDeliverable,
    values.campaignExtraDeliverables,
    values.entryType,
    values.imCommercials,
    values.mcRows,
    values.reimbursementAmount,
    values.reimbursementIncluded,
    values.scDeliverables,
    values.commission,
  ]);

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
  const agencyNameMap = useMemo(() => {
    const grouped = masters.agencies.reduce<Record<string, Set<string>>>((acc, row) => {
      if (!row.name || !row.tradeName) return acc;
      const key = row.tradeName.trim().toLowerCase();
      if (!key) return acc;
      acc[key] ??= new Set();
      acc[key].add(row.name.trim());
      return acc;
    }, {});

    return Object.entries(grouped).reduce<Record<string, string>>((acc, [key, names]) => {
      if (names.size === 1) {
        acc[key] = Array.from(names)[0];
      }
      return acc;
    }, {});
  }, [masters.agencies]);
  const brandNameMap = useMemo(() => {
    const grouped = masters.brands.reduce<Record<string, Set<string>>>((acc, row) => {
      if (!row.name || !row.tradeName) return acc;
      const key = row.tradeName.trim().toLowerCase();
      if (!key) return acc;
      acc[key] ??= new Set();
      acc[key].add(row.name.trim());
      return acc;
    }, {});

    return Object.entries(grouped).reduce<Record<string, string>>((acc, [key, names]) => {
      if (names.size === 1) {
        acc[key] = Array.from(names)[0];
      }
      return acc;
    }, {});
  }, [masters.brands]);
  const gstMappingsForEntity = useMemo(
    () => masters.gstMappings.filter((row) => row.entityType === values.entityType && row.entityName.trim().toLowerCase() === values.agencyBrandName.trim().toLowerCase()),
    [masters.gstMappings, values.entityType, values.agencyBrandName]
  );
  const gstOptions = useMemo(() => gstMappingsForEntity.map((row) => row.gstNumber), [gstMappingsForEntity]);


  const gstMappingByNumber = useMemo(
    () =>
      gstMappingsForEntity.reduce<Record<string, GstMappingOption>>((acc, row) => {
        acc[row.gstNumber.toUpperCase()] = row;
        return acc;
      }, {}),
    [gstMappingsForEntity]
  );

  useEffect(() => {
    setValues((prev) => {
      if (prev.clientType !== "Indian") return prev;
      if (!prev.gstNumber.trim()) {
        if (prev.gstSelectionMode === "new") return prev;
        const nextMode = gstOptions.length > 0 ? "existing" : "new";
        return prev.gstSelectionMode === nextMode ? prev : { ...prev, gstSelectionMode: nextMode };
      }

      const hasApprovedMapping = Boolean(gstMappingByNumber[prev.gstNumber.trim().toUpperCase()]);
      const nextMode = hasApprovedMapping ? "existing" : "new";
      return prev.gstSelectionMode === nextMode ? prev : { ...prev, gstSelectionMode: nextMode };
    });
  }, [gstMappingByNumber, gstOptions.length, values.entityType, values.agencyBrandName, values.clientType]);
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
      nextValue = sanitizeDecimalInput(String(value)) as InvoiceIntakeFormValues[K];
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

  function handleEntityNameSelect(next: string) {
    if (!next.trim()) {
      update("agencyBrandName", "");
      update("agencyBrandTradeName", "");
      return;
    }

    update("agencyBrandName", next);
    const tradeNameMap = values.entityType === "Agency" ? agencyTradeNameMap : brandTradeNameMap;
    const mappedTradeName = tradeNameMap[next.trim().toLowerCase()];
    if (mappedTradeName) {
      update("agencyBrandTradeName", mappedTradeName);
    }
  }

  function handleTradeNameSelect(next: string) {
    if (!next.trim()) {
      update("agencyBrandTradeName", "");
      update("agencyBrandName", "");
      return;
    }

    update("agencyBrandTradeName", next);
    const entityNameMap = values.entityType === "Agency" ? agencyNameMap : brandNameMap;
    const mappedEntityName = entityNameMap[next.trim().toLowerCase()];
    if (mappedEntityName) {
      update("agencyBrandName", mappedEntityName);
    }
  }

  function handleGstSelect(next: string) {
    const normalizedGst = next.toUpperCase();
    const mapped = gstMappingByNumber[next.trim().toUpperCase()];

    if (!mapped) {
      gstAddressSnapshotRef.current = null;
      setValues((prev) => ({
        ...prev,
        gstSelectionMode: "new",
        gstNumber: normalizedGst,
      }));
      clearErrors(["gstNumber", "addressLine", "city", "state", "country", "pincode"]);
      setError("");
      return;
    }

    setManualLocationEdits({ city: false, state: false, country: false, pincode: false });
    setAutoFilledLocation({ city: true, state: true, country: true, pincode: true });
    setHasInteracted(true);
    const inferredMappedAddress = inferAddressData(mapped.address, values.clientType);
    const nextAddress = {
      addressLine: mapped.address,
      city: mapped.city || inferredMappedAddress.city,
      state: mapped.state || inferredMappedAddress.state,
      country: mapped.country || inferredMappedAddress.country || 'India',
      pincode: mapped.pincode || inferredMappedAddress.pincode,
    };
    gstAddressSnapshotRef.current = nextAddress;
    setValues((prev) => ({
      ...prev,
      gstSelectionMode: "existing",
      gstNumber: mapped.gstNumber,
      ...nextAddress,
    }));
    clearErrors(["gstNumber", "addressLine", "city", "state", "country", "pincode"]);
    setError("");
  }

  function handleGstClear() {
    setHasInteracted(true);
    setManualLocationEdits({ city: false, state: false, country: false, pincode: false });
    setAutoFilledLocation({ city: false, state: false, country: false, pincode: false });
    setValues((prev) => {
      const snapshot = gstAddressSnapshotRef.current;
      const addressStillFromGst = snapshot !== null &&
        prev.addressLine === snapshot.addressLine &&
        prev.city === snapshot.city &&
        prev.state === snapshot.state &&
        prev.country === snapshot.country &&
        prev.pincode === snapshot.pincode;

      return {
        ...prev,
        gstSelectionMode: "existing",
        gstNumber: "",
        ...(addressStillFromGst
          ? {
              addressLine: "",
              city: "",
              state: "",
              country: prev.clientType === "Indian" ? "India" : "",
              pincode: "",
            }
          : {}),
      };
    });
    gstAddressSnapshotRef.current = null;
    clearErrors(["gstNumber", "addressLine", "city", "state", "country", "pincode"]);
    setError("");
  }

  function handleAddNewGstSelect() {
    setHasInteracted(true);
    gstAddressSnapshotRef.current = null;
    setManualLocationEdits({ city: false, state: false, country: false, pincode: false });
    setAutoFilledLocation({ city: false, state: false, country: false, pincode: false });
    setValues((prev) => ({
      ...prev,
      gstSelectionMode: "new",
      gstNumber: "",
      addressLine: "",
      city: "",
      state: "",
      country: prev.clientType === "Indian" ? "India" : "",
      pincode: "",
    }));
    clearErrors(["gstNumber", "addressLine", "city", "state", "country", "pincode"]);
    setError("");
  }
  function handleUseApprovedGstSelect() {
    setHasInteracted(true);
    setValues((prev) => ({
      ...prev,
      gstSelectionMode: "existing",
      gstNumber: "",
    }));
    clearErrors(["gstNumber"]);
    setError("");
  }

  useEffect(() => {
    if (!hasInteracted) return;
    const liveErrors = validateForm(values);
    setFieldErrors(liveErrors);
  }, [hasInteracted, values]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (lockedBusinessLine && branch !== lockedBusinessLine) return;
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
      ...(() => {
        const nextRows = prev.scDeliverables.length === 1 ? prev.scDeliverables : prev.scDeliverables.filter((_, i) => i !== index);
        const hasProductReimbursement = nextRows.some((row) => isProductReimbursementDeliverable(row.deliverable));
        return {
          scDeliverables: nextRows,
          ...(hasProductReimbursement ? {} : { reimbursementIncluded: "no" as const, reimbursementAmount: "0", reimbursementProof: "" }),
        };
      })(),
    }));
    clearErrors([`scDeliverables.${index}.deliverable`, `scDeliverables.${index}.amount`, "creatorDeliverables"]);
  }

  function patchScDeliverable(index: number, patch: { deliverable?: string; amount?: string }) {
    setValues((prev) => ({
      ...prev,
      ...(() => {
        const nextRows = prev.scDeliverables.map((item, i) =>
          i === index
            ? {
                ...item,
                ...patch,
                ...(patch.amount !== undefined ? { amount: sanitizeDecimalInput(patch.amount) } : {}),
              }
            : item
        );
        const hasProductReimbursement = nextRows.some((row) => isProductReimbursementDeliverable(row.deliverable));
        return {
          scDeliverables: nextRows,
          ...(hasProductReimbursement ? {} : { reimbursementIncluded: "no" as const, reimbursementAmount: "0", reimbursementProof: "" }),
        };
      })(),
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
      ...(() => {
        const nextRows = prev.mcRows.length === 1 ? prev.mcRows : prev.mcRows.filter((_, i) => i !== index);
        const hasProductReimbursement = nextRows.some((row) => isProductReimbursementDeliverable(row.deliverable));
        return {
          mcRows: nextRows,
          ...(hasProductReimbursement ? {} : { reimbursementIncluded: "no" as const, reimbursementAmount: "0", reimbursementProof: "" }),
        };
      })(),
    }));
    clearErrors([`mcRows.${index}.creator`, `mcRows.${index}.brand`, `mcRows.${index}.deliverable`, `mcRows.${index}.amount`, "creatorDeliverables"]);
  }

  function patchMcRow(index: number, patch: { creator?: string; brand?: string; deliverable?: string; amount?: string }) {
    setValues((prev) => {
      const nextRows = prev.mcRows.map((item, i) => {
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
              ...(nextPatch.amount !== undefined ? { amount: sanitizeDecimalInput(nextPatch.amount) } : {}),
            }
          : item;
      });
      const hasProductReimbursement = nextRows.some((row) => isProductReimbursementDeliverable(row.deliverable));
      return {
        ...prev,
        mcRows: nextRows,
        ...(hasProductReimbursement ? {} : { reimbursementIncluded: "no" as const, reimbursementAmount: "0", reimbursementProof: "" }),
      };
    });
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

  function getVisibleProductReimbursementKeys(nextValues: InvoiceIntakeFormValues) {
    const keys: string[] = [];
    if (nextValues.businessLine === "TM" && nextValues.entryType === "SC") {
      nextValues.scDeliverables.forEach((row, index) => {
        if (row.deliverable === "Product Reimbursement") keys.push(`sc-${index}`);
      });
      return keys;
    }

    if (nextValues.businessLine === "TM" && nextValues.entryType === "MC") {
      nextValues.mcRows.forEach((row, index) => {
        if (row.deliverable === "Product Reimbursement") keys.push(`mc-${index}`);
      });
      return keys;
    }

    if ([nextValues.campaignDeliverable, ...nextValues.campaignExtraDeliverables].some(isProductReimbursementDeliverable)) {
      keys.push("campaign-0");
    }
    return keys;
  }

  function getSelectedProductReimbursementFile(nextValues: InvoiceIntakeFormValues) {
    const keys = getVisibleProductReimbursementKeys(nextValues);
    for (const key of keys) {
      const file = productReimbursementFiles[key];
      if (file) return file;
    }
    return null;
  }

  function validateAttachmentFile(file: File | null, allowedMimeTypes: readonly string[], maxSizeBytes: number) {
    if (!file) return '';
    if (file.size > maxSizeBytes) return 'File exceeds 10 MB. Please compress it below 10 MB and try again.';
    if (!allowedMimeTypes.includes(file.type as (typeof allowedMimeTypes)[number])) return 'Only PDF, PNG, JPG, or WEBP files are allowed.';
    return '';
  }

  function onProductReimbursementFileChange(key: string, file: File | null) {
    const validationMessage = validateAttachmentFile(file, PRODUCT_REIMBURSEMENT_ALLOWED_MIME_TYPES, PRODUCT_REIMBURSEMENT_MAX_FILE_SIZE_BYTES);
    if (validationMessage) {
      setProductReimbursementErrors((prev) => ({ ...prev, [key]: validationMessage }));
      setProductReimbursementFiles((prev) => ({ ...prev, [key]: null }));
      return;
    }

    setProductReimbursementErrors((prev) => {
      const next: Record<string, string> = {};
      Object.keys(prev).forEach((entryKey) => {
        if (entryKey !== key) next[entryKey] = "";
      });
      next[key] = "";
      return next;
    });
    setProductReimbursementFiles(() => (file ? { [key]: file } : { [key]: null }));
    if (file) setProductReimbursementAttachmentRemoved(false);
  }

  function onReferencePoFileChange(_key: string, file: File | null) {
    const validationMessage = validateAttachmentFile(file, REFERENCE_PO_ALLOWED_MIME_TYPES, REFERENCE_PO_MAX_FILE_SIZE_BYTES);
    if (validationMessage) {
      setReferencePoError(validationMessage);
      setReferencePoFile(null);
      return;
    }

    setReferencePoError('');
    setReferencePoFile(file);
    if (file) setReferencePoAttachmentRemoved(false);
  }

  async function openExistingAttachment(attachment: ExistingInvoiceAttachment) {
    try {
      const res = await fetch(`/api/submissions/attachments/${attachment.id}/signed-url`, {
        method: 'GET',
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.url) throw new Error(body?.error || 'Unable to open attachment.');
      window.open(body.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open attachment.');
    }
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
      else if (!isValidGstin(nextValues.gstNumber)) errors.gstNumber = "Enter a valid 15-character GST number or NA. Example: 07AAIFI5054J1Z7";

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
      if (!(parseAmount(nextValues.imCommercials) > 0)) errors.imCommercials = "Deal amount is required.";
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

    if (hasProductReimbursement) {
      const visibleKeys = getVisibleProductReimbursementKeys(nextValues);
      const hasFile =
        visibleKeys.some((key) => Boolean(productReimbursementFiles[key])) ||
        (existingProductReimbursementAttachment && !productReimbursementAttachmentRemoved);
      const hasFileError = visibleKeys.some((key) => Boolean(productReimbursementErrors[key]));
      if (nextValues.businessLine === "IM" && !(parseAmount(nextValues.reimbursementAmount) > 0)) {
        errors.reimbursementAmount = "Product Reimbursement amount is required.";
      }
      if (!hasFile) {
        errors.creatorDeliverables = errors.creatorDeliverables || "Upload a Product Reimbursement document before submitting.";
        visibleKeys.forEach((key) => {
          if (!productReimbursementErrors[key]) errors[key] = "Upload a Product Reimbursement document before submitting.";
        });
      } else if (hasFileError) {
        errors.creatorDeliverables = errors.creatorDeliverables || "Fix the Product Reimbursement document before submitting.";
      }
    }

    return errors;
  }


  function isDeliverableFieldKey(key: string | null) {
    if (!key) return false;
    return key === "campaignDeliverable" || key.startsWith("campaignExtraDeliverables.") || key.includes(".deliverable") || key.startsWith("sc-") || key.startsWith("mc-") || key.startsWith("campaign-");
  }

  const visibleFieldErrors = useMemo(() => {
    const next: Record<string, string> = {};

    Object.entries(fieldErrors).forEach(([key, message]) => {
      if (!message) return;
      if (key === activeField) {
        next[key] = message;
        return;
      }
      if (key === "creatorDeliverables" && isDeliverableFieldKey(activeField)) {
        next[key] = message;
      }
    });

    return next;
  }, [activeField, fieldErrors]);

  function focusFirstInvalid(nextErrors: Record<string, string>) {
    const form = formRef.current;
    if (!form) return;

    let firstKey = Object.keys(nextErrors).find((key) => !OPTIONAL_FIELDS.has(key));
    if (!firstKey) return;

    if (firstKey === "creatorDeliverables") {
      const visibleUploadKey = getVisibleProductReimbursementKeys(values)[0];
      if (visibleUploadKey && nextErrors[visibleUploadKey]) {
        firstKey = visibleUploadKey;
      } else if (values.businessLine === "IM") {
        firstKey = "campaignDeliverable";
      } else if (values.businessLine === "TM" && values.entryType === "SC") {
        firstKey = values.scDeliverables.findIndex((row) => !row.deliverable.trim()) >= 0
          ? `scDeliverables.${values.scDeliverables.findIndex((row) => !row.deliverable.trim())}.deliverable`
          : "scDeliverables.0.deliverable";
      } else if (values.businessLine === "TM" && values.entryType === "MC") {
        firstKey = values.mcRows.findIndex((row) => !row.deliverable.trim()) >= 0
          ? `mcRows.${values.mcRows.findIndex((row) => !row.deliverable.trim())}.deliverable`
          : "mcRows.0.deliverable";
      }
    }

    const escapedKey = firstKey.replace(/"/g, '\\"');
    const field = form.querySelector<HTMLElement>(`[data-field="${escapedKey}"]`);
    if (!field) return;
    setActiveField(firstKey);
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    if ("focus" in field) field.focus();
  }

  function buildPayload(): InvoiceIntakeSubmissionPayload {
    const imDeliverables = [values.campaignDeliverable, ...values.campaignExtraDeliverables].filter(Boolean);
    const legacyReimbursementValue =
      values.reimbursementIncluded === "yes" ? parseAmount(values.reimbursementAmount) : 0;
    const productReimbursementAmount =
      values.businessLine === "TM" && values.entryType === "SC"
        ? sumProductReimbursementRows(values.scDeliverables) || legacyReimbursementValue
        : values.businessLine === "TM" && values.entryType === "MC"
          ? sumProductReimbursementRows(values.mcRows) || legacyReimbursementValue
          : imDeliverables.some(isProductReimbursementDeliverable)
            ? parseAmount(values.reimbursementAmount)
            : legacyReimbursementValue;
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
              amount: isProductReimbursementDeliverable(deliverable) ? productReimbursementAmount : 0,
              line_order: idx,
            }));

    const commercials =
      values.businessLine === "IM"
        ? parseAmount(values.imCommercials)
        : values.entryType === "SC"
          ? sumNonReimbursementRows(values.scDeliverables)
          : sumNonReimbursementRows(values.mcRows);

    return {
      previous_submission_id: previousSubmissionId || null,
      business_line: values.businessLine,
      entry_type: values.businessLine === "TM" ? values.entryType : null,
      entity_type: values.entityType,
      client_type: values.clientType,
      agency_brand_name: values.agencyBrandName,
      agency_brand_trade_name: values.agencyBrandTradeName,
      email_address: values.submitterEmail,
      gst_number: values.clientType === "Indian" ? normalizeGstNumber(values.gstNumber) : "",
      address: serializeBillingAddress({
        addressLine: values.addressLine,
        city: values.city,
        state: values.state,
        country: values.country,
        pincode: values.pincode,
      }),
      city: values.city,
      state: values.state,
      country: values.country,
      pincode: values.pincode,
      bill_due: values.billDue,
      invoice_type: values.invoiceType,
      deliverables,
      creator_creators_name: creatorNames,
      brand_name: brandName,
      brand_names_text: uniqueBrandNames.join(", "),
      currency: values.currency,
      commercials,
      additional_information: values.additionalInformation,
      additional_agency_commission: parseAmount(values.commission),
      reimbursement_amount: productReimbursementAmount,
      reimbursement_receipts: values.reimbursementIncluded === "yes" ? values.reimbursementProof : "",
      line_items: lineItems,
      campaign_code: values.businessLine === "IM" ? values.campaignCode : "",
      campaign_name: values.businessLine === "IM" ? values.campaignName : "",
      campaign_brand: values.businessLine === "IM" ? values.campaignBrand : "",
      campaign_notes: values.businessLine === "IM" ? values.campaignNotes : "",
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
    const productReimbursementFile = getSelectedProductReimbursementFile(values);

    try {
      setSubmitting(true);
      await onSubmit({
        payload,
        files: { productReimbursementFile, referencePoFile },
        existingProductReimbursementAttachment,
        retainProductReimbursementAttachment: Boolean(existingProductReimbursementAttachmentMeta && !productReimbursementFile && !productReimbursementAttachmentRemoved),
        removeProductReimbursementAttachment: productReimbursementAttachmentRemoved,
        retainReferencePoAttachment: Boolean(existingReferencePoAttachment && !referencePoFile && !referencePoAttachmentRemoved),
        removeReferencePoAttachment: referencePoAttachmentRemoved,
      });
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
    setProductReimbursementAttachmentRemoved(false);
    setReferencePoFile(null);
    setReferencePoError('');
    setReferencePoAttachmentRemoved(false);
    previousBillingBrandRef.current = "";
    gstAddressSnapshotRef.current = null;
    setFieldErrors({});
    setActiveField("submitterName");
    setHasInteracted(false);
    setError("");
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="intake-form"
      autoComplete="off"
      onFocusCapture={(event) => {
        const target = event.target as HTMLElement | null;
        const field = target?.closest?.("[data-field]") as HTMLElement | null;
        const fieldKey = field?.getAttribute("data-field");
        if (fieldKey) setActiveField(fieldKey);
      }}
    >
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
            <input className="intake-input" value={values.submitterName} readOnly data-field="submitterName" autoComplete="off" required />
            {visibleFieldErrors.submitterName ? <p className="text-danger intake-inline-error">{visibleFieldErrors.submitterName}</p> : null}
          </label>
          <label className="intake-field" style={{ minWidth: 0 }}>
            <span className="intake-label">Email *</span>
            <input className="intake-input" type="email" value={values.submitterEmail} readOnly data-field="submitterEmail" required />
            {visibleFieldErrors.submitterEmail ? <p className="text-danger intake-inline-error">{visibleFieldErrors.submitterEmail}</p> : null}
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
            {lockedBusinessLine ? (
              <div className="intake-toggle-group" aria-readonly="true">
                {BUSINESS_LINES.filter((line) => line.value === lockedBusinessLine).map((line) => (
                  <span key={line.value} className="intake-toggle intake-toggle-active" style={{ cursor: 'default', pointerEvents: 'none' }}>
                    {line.label}
                  </span>
                ))}
              </div>
            ) : (
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
            )}
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
        onEntityNameSelect={handleEntityNameSelect}
        onTradeNameSelect={handleTradeNameSelect}
        onGstSelect={handleGstSelect}
        onGstClear={handleGstClear}
        onAddNewGstSelect={handleAddNewGstSelect}
        errors={visibleFieldErrors}
        agencyOptions={agencyOptions}
        brandOptions={brandOptions}
        agencyTradeNameOptions={agencyTradeNameOptions}
        brandTradeNameOptions={brandTradeNameOptions}
        gstOptions={gstOptions}
        gstMappingByNumber={gstMappingByNumber}
      />
      <InvoiceDetailsSection values={values} onChange={update} errors={visibleFieldErrors} />
      <CreatorDeliverablesSection
        values={values}
        onChange={update}
        errors={visibleFieldErrors}
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
        existingProductReimbursementAttachment={existingProductReimbursementAttachmentMeta}
        productReimbursementAttachmentRemoved={productReimbursementAttachmentRemoved}
        onViewExistingProductReimbursementAttachment={openExistingAttachment}
        onRemoveExistingProductReimbursementAttachment={() => {
          setProductReimbursementAttachmentRemoved(true);
          setProductReimbursementFiles({});
        }}
        onRetainExistingProductReimbursementAttachment={() => setProductReimbursementAttachmentRemoved(false)}
        onPatchScCreator={patchScCreator}
        onPatchMcCreator={patchMcCreator}
      />
      <CommercialsSection values={values} totalAmount={totalAmount} onChange={update} errors={visibleFieldErrors} />
      <AdditionalInfoSection
        values={values}
        referencePoFile={referencePoFile}
        referencePoError={referencePoError}
        existingReferencePoAttachment={existingReferencePoAttachment}
        referencePoAttachmentRemoved={referencePoAttachmentRemoved}
        onReferencePoFileChange={onReferencePoFileChange}
        onViewExistingReferencePoAttachment={openExistingAttachment}
        onRemoveExistingReferencePoAttachment={() => {
          setReferencePoAttachmentRemoved(true);
          setReferencePoFile(null);
          setReferencePoError('');
        }}
        onRetainExistingReferencePoAttachment={() => setReferencePoAttachmentRemoved(false)}
        onChange={update}
        errors={visibleFieldErrors}
      />
      <FormActions onReset={handleReset} submitting={submitting} submitEnabled={submitEnabled && Boolean(onSubmit)} />

      {error ? <p className="text-danger intake-inline-error">{error}</p> : null}
    </form>
  );
}

