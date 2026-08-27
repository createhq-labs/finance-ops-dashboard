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
import { hasVerifiedPincodeStateMismatch, inferAddressData, normalizeState, serializeBillingAddress } from "../../lib/shared/address-utils";

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
  viewOnly?: boolean;
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

const FORM_RECOVERY_VERSION = 1;
const FORM_RECOVERY_KEY_PREFIX = "finance-ops:invoice-form";
const MAX_HISTORY_ENTRIES = 5;

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
  viewOnly = false,
}: Props) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const previousBillingBrandRef = useRef("");
  const gstAddressSnapshotRef = useRef<Pick<InvoiceIntakeFormValues, "addressLine" | "city" | "state" | "country" | "pincode"> | null>(null);
  // Armed on resubmission prefill (see the initialValues effect below) and
  // consumed by the approved-mapping hydration effect once masters finish
  // loading and the prefilled GST/entity resolves to an active approved
  // gst_address_mappings row. Prevents re-hydrating after the employee has
  // started editing, and prevents repeated hydration on every render.
  const resubmissionApprovedMappingPendingRef = useRef(false);
  const undoStackRef = useRef<InvoiceIntakeFormValues[]>([]);
  const redoStackRef = useRef<InvoiceIntakeFormValues[]>([]);
  const lastHistoryValuesRef = useRef<InvoiceIntakeFormValues | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredStorageKeyRef = useRef("");
  const suppressHistoryRef = useRef(false);
  const lastRequestedPincodeRef = useRef("");
  // Only a successful /api/pincode lookup (source: "postal-api") counts as
  // verified for blocking mismatch validation. Keyed by pincode so a stale
  // entry for a different pincode is naturally ignored at comparison time.
  const verifiedPincodeStateRef = useRef<{ pincode: string; state: string } | null>(null);
  const [values, setValues] = useState<InvoiceIntakeFormValues>({
    ...INITIAL_VALUES,
    submitterName,
    submitterEmail,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [, setActiveField] = useState<string>("submitterName");
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [readOnlyClickHint, setReadOnlyClickHint] = useState<{ x: number; y: number; message: string } | null>(null);
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
  const effectiveBusinessLine =
    previousSubmissionId && initialValues?.businessLine
      ? initialValues.businessLine
      : lockedBusinessLine ?? INITIAL_VALUES.businessLine;
  const formRecoveryContext = useMemo(
    () => ({
      user: (submitterEmail || "anonymous").trim().toLowerCase(),
      mode: previousSubmissionId ? "resubmission" : "new",
      previousSubmissionId: previousSubmissionId || null,
      role: currentUserRole || "unknown",
      lockedBusinessLine: lockedBusinessLine || null,
    }),
    [currentUserRole, lockedBusinessLine, previousSubmissionId, submitterEmail]
  );
  const formRecoveryKey = useMemo(
    () => [
      FORM_RECOVERY_KEY_PREFIX,
      `v${FORM_RECOVERY_VERSION}`,
      formRecoveryContext.user,
      formRecoveryContext.mode,
      formRecoveryContext.previousSubmissionId || "new",
      formRecoveryContext.role,
      formRecoveryContext.lockedBusinessLine || "any",
    ].join(":"),
    [formRecoveryContext]
  );

  function getRecoveryValues(nextValues: InvoiceIntakeFormValues): InvoiceIntakeFormValues {
    return {
      ...nextValues,
      totalAmount: "",
    };
  }

  function getRecognizedRecoveryValues(savedValues: Partial<InvoiceIntakeFormValues>) {
    const recognized: Partial<InvoiceIntakeFormValues> = {};
    (Object.keys(INITIAL_VALUES) as Array<keyof InvoiceIntakeFormValues>).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(savedValues, key)) {
        (recognized as Record<string, unknown>)[key] = savedValues[key];
      }
    });
    return recognized;
  }

  function valuesMatch(left: InvoiceIntakeFormValues, right: InvoiceIntakeFormValues) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function cssAttributeValue(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function getFirstChangedFieldKey(previous: InvoiceIntakeFormValues, next: InvoiceIntakeFormValues) {
    const scLength = Math.max(previous.scDeliverables.length, next.scDeliverables.length);
    for (let index = 0; index < scLength; index += 1) {
      const before = previous.scDeliverables[index];
      const after = next.scDeliverables[index];
      if (before?.deliverable !== after?.deliverable) return `scDeliverables.${index}.deliverable`;
      if (before?.amount !== after?.amount) return `scDeliverables.${index}.amount`;
    }

    const mcLength = Math.max(previous.mcRows.length, next.mcRows.length);
    for (let index = 0; index < mcLength; index += 1) {
      const before = previous.mcRows[index];
      const after = next.mcRows[index];
      if (before?.creator !== after?.creator) return `mcRows.${index}.creator`;
      if (before?.brand !== after?.brand) return `mcRows.${index}.brand`;
      if (before?.deliverable !== after?.deliverable) return `mcRows.${index}.deliverable`;
      if (before?.amount !== after?.amount) return `mcRows.${index}.amount`;
    }

    if (JSON.stringify(previous.campaignExtraDeliverables) !== JSON.stringify(next.campaignExtraDeliverables)) {
      return "campaignDeliverable";
    }

    const directKeys: Array<keyof InvoiceIntakeFormValues> = [
      "businessLine",
      "entryType",
      "entityType",
      "clientType",
      "agencyBrandName",
      "agencyBrandTradeName",
      "billingBrandName",
      "gstNumber",
      "addressLine",
      "city",
      "state",
      "country",
      "pincode",
      "invoiceType",
      "billDue",
      "commission",
      "reimbursementIncluded",
      "reimbursementAmount",
      "reimbursementProof",
      "additionalInformation",
      "scCreator",
      "scBrand",
      "campaignCode",
      "campaignBrand",
      "campaignDeliverable",
      "campaignName",
      "campaignNotes",
      "imCommercials",
      "currency",
    ];

    return directKeys.find((key) => previous[key] !== next[key]) ?? null;
  }

  function highlightHistoryField(fieldKey: string | null) {
    if (!fieldKey) return;
    const form = formRef.current;
    if (!form) return;

    const field = form.querySelector<HTMLElement>(`[data-field="${cssAttributeValue(fieldKey)}"]`);
    if (!field) return;

    setActiveField(fieldKey);
    const rect = field.getBoundingClientRect();
    const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!isVisible) field.scrollIntoView({ behavior: "smooth", block: "center" });
    field.classList.add("intake-history-highlight");
    window.setTimeout(() => field.classList.remove("intake-history-highlight"), 1500);
  }

  function clearHistory(nextValues: InvoiceIntakeFormValues = values) {
    undoStackRef.current = [];
    redoStackRef.current = [];
    lastHistoryValuesRef.current = nextValues;
  }

  function clearSavedRecovery() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(formRecoveryKey);
  }

  function applyHistoryValues(nextValues: InvoiceIntakeFormValues, changedField: string | null) {
    suppressHistoryRef.current = true;
    lastHistoryValuesRef.current = nextValues;
    setValues(nextValues);
    setHasInteracted(true);
    setFieldErrors({});
    setError("");
    requestAnimationFrame(() => highlightHistoryField(changedField));
  }

  function undoLastChange() {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    const changedField = getFirstChangedFieldKey(values, previous);
    redoStackRef.current = [...redoStackRef.current.slice(-(MAX_HISTORY_ENTRIES - 1)), values];
    applyHistoryValues(previous, changedField);
  }

  function redoLastChange() {
    const next = redoStackRef.current.pop();
    if (!next) return;
    const changedField = getFirstChangedFieldKey(values, next);
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_HISTORY_ENTRIES - 1)), values];
    applyHistoryValues(next, changedField);
  }

  function handleUndoRedoShortcut(event: Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey" | "key" | "preventDefault" | "stopPropagation">) {
    const key = event.key.toLowerCase();
    const isUndo = (event.ctrlKey || event.metaKey) && !event.shiftKey && key === "z";
    const isRedo =
      ((event.ctrlKey || event.metaKey) && key === "y") ||
      ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "z");

    if (!isUndo && !isRedo) return false;
    event.preventDefault();
    event.stopPropagation();
    if (isUndo) undoLastChange();
    else redoLastChange();
    return true;
  }

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
    lastRequestedPincodeRef.current = "";
    gstAddressSnapshotRef.current = null;
    // Resubmission (not plain view-only) prefill: give the approved-mapping
    // hydration effect a chance to replace the raw-address-derived structured
    // fields with the current active gst_address_mappings row, once masters
    // are available, as long as the employee hasn't started editing yet.
    resubmissionApprovedMappingPendingRef.current = Boolean(previousSubmissionId) && !viewOnly;
    setFieldErrors({});
    setHasInteracted(false);
    setProductReimbursementAttachmentRemoved(false);
    setReferencePoAttachmentRemoved(false);
  }, [initialValues, previousSubmissionId, submitterEmail, submitterName, viewOnly]);

  useEffect(() => {
    if (viewOnly) return;
    if (typeof window === "undefined") return;
    if (!formRecoveryKey) return;
    if (previousSubmissionId && !initialValues) return;
    if (restoredStorageKeyRef.current === formRecoveryKey) return;

    let nextValues: InvoiceIntakeFormValues = {
      ...INITIAL_VALUES,
      ...(initialValues ?? {}),
      submitterName: submitterName || initialValues?.submitterName || "",
      submitterEmail: submitterEmail || initialValues?.submitterEmail || "",
      campaignExtraDeliverables: initialValues?.campaignExtraDeliverables ?? INITIAL_VALUES.campaignExtraDeliverables,
      scDeliverables: initialValues?.scDeliverables ?? INITIAL_VALUES.scDeliverables,
      mcRows: initialValues?.mcRows ?? INITIAL_VALUES.mcRows,
    };

    try {
      const raw = window.localStorage.getItem(formRecoveryKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          version?: number;
          formContext?: typeof formRecoveryContext;
          values?: Partial<InvoiceIntakeFormValues>;
        };
        const compatible =
          parsed.version === FORM_RECOVERY_VERSION &&
          parsed.formContext?.user === formRecoveryContext.user &&
          parsed.formContext?.mode === formRecoveryContext.mode &&
          parsed.formContext?.previousSubmissionId === formRecoveryContext.previousSubmissionId;

        if (compatible && parsed.values && typeof parsed.values === "object") {
          const recoveredValues = getRecognizedRecoveryValues(parsed.values);
          nextValues = {
            ...nextValues,
            ...recoveredValues,
            submitterName: submitterName || recoveredValues.submitterName || nextValues.submitterName,
            submitterEmail: submitterEmail || recoveredValues.submitterEmail || nextValues.submitterEmail,
            scDeliverables: recoveredValues.scDeliverables ?? nextValues.scDeliverables,
            mcRows: recoveredValues.mcRows ?? nextValues.mcRows,
            campaignExtraDeliverables: recoveredValues.campaignExtraDeliverables ?? nextValues.campaignExtraDeliverables,
          };
        }
      }
    } catch {
      // Ignore incompatible or malformed local recovery data.
    }

    nextValues.businessLine = effectiveBusinessLine;

    suppressHistoryRef.current = true;
    undoStackRef.current = [];
    redoStackRef.current = [];
    lastHistoryValuesRef.current = nextValues;
    restoredStorageKeyRef.current = formRecoveryKey;
    setValues(nextValues);
  }, [effectiveBusinessLine, formRecoveryContext, formRecoveryKey, initialValues, previousSubmissionId, submitterEmail, submitterName]);

  useEffect(() => {
    if (viewOnly) return;
    if (typeof window === "undefined") return;
    if (!formRecoveryKey || restoredStorageKeyRef.current !== formRecoveryKey) return;

    if (suppressHistoryRef.current) {
      suppressHistoryRef.current = false;
      lastHistoryValuesRef.current = values;
    } else if (hasInteracted && lastHistoryValuesRef.current && !valuesMatch(lastHistoryValuesRef.current, values)) {
      undoStackRef.current = [...undoStackRef.current.slice(-(MAX_HISTORY_ENTRIES - 1)), lastHistoryValuesRef.current];
      redoStackRef.current = [];
      lastHistoryValuesRef.current = values;
    } else if (!lastHistoryValuesRef.current) {
      lastHistoryValuesRef.current = values;
    }

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      window.localStorage.setItem(
        formRecoveryKey,
        JSON.stringify({
          version: FORM_RECOVERY_VERSION,
          savedAt: new Date().toISOString(),
          formContext: formRecoveryContext,
          values: getRecoveryValues(values),
        })
      );
    }, 250);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [formRecoveryContext, formRecoveryKey, hasInteracted, values]);

  useEffect(() => {
    if (!readOnlyClickHint) return;
    const timer = window.setTimeout(() => setReadOnlyClickHint(null), 1400);
    return () => window.clearTimeout(timer);
  }, [readOnlyClickHint]);

  useEffect(() => {
    if (viewOnly) return;
    function handleDocumentKeyDown(event: KeyboardEvent) {
      const form = formRef.current;
      if (!form) return;
      const target = event.target as Node | null;
      if (!target || !form.contains(target)) return;
      handleUndoRedoShortcut(event);
    }

    document.addEventListener("keydown", handleDocumentKeyDown, true);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown, true);
    // Rebind with current values so undo/redo closures use the latest form state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

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

  // Resubmission approved-mapping hydration: a prefilled draft's GST number
  // may resolve to an active approved gst_address_mappings row for the same
  // entity that didn't exist (or wasn't matched) when the original submission
  // was made. Runs once per resubmission load, only until the employee starts
  // interacting with the form, and only if the prefilled GST/entity actually
  // resolves to an approved mapping using the same matching semantics as
  // handleGstSelect (gstMappingByNumber, built from entityType + entityName).
  useEffect(() => {
    if (!resubmissionApprovedMappingPendingRef.current) return;
    if (hasInteracted) return;
    if (values.clientType !== "Indian") return;
    const gstKey = values.gstNumber.trim().toUpperCase();
    if (!gstKey) return;
    const mapped = gstMappingByNumber[gstKey];
    if (!mapped) return;

    resubmissionApprovedMappingPendingRef.current = false;
    applyApprovedGstAddress(mapped);
  }, [gstMappingByNumber, hasInteracted, values.clientType, values.gstNumber]);

  useEffect(() => {
    if (viewOnly) return;
    if (values.clientType !== "Indian") return;
    const inferred = inferAddressData(values.addressLine, values.clientType);
    const pincode = inferred.pincode;
    if (!/^\d{6}$/.test(pincode)) return;
    if (lastRequestedPincodeRef.current === pincode) return;
    if (values.gstNumber.trim() && gstMappingByNumber[values.gstNumber.trim().toUpperCase()]) return;

    const controller = new AbortController();
    let completed = false;

    fetch(`/api/pincode?pincode=${pincode}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json().catch(() => null) as Promise<{
          success?: boolean;
          city?: string;
          state?: string;
          country?: string;
          pincode?: string;
          source?: string;
        } | null>;
      })
      .then((lookup) => {
        if (!lookup || controller.signal.aborted) return;
        const lookupPincode = String(lookup.pincode || "").trim();
        if (lookupPincode !== pincode) return;

        // A "success: false" (local-fallback) response must not consume this
        // pincode's retry eligibility — only a genuinely verified lookup can.
        const isVerifiedSuccess = lookup.success === true;
        const verifiedState = String(lookup.state || "").trim();

        setValues((prev) => {
          if (viewOnly) return prev;
          if (prev.clientType !== "Indian") return prev;
          if (prev.gstNumber.trim() && gstMappingByNumber[prev.gstNumber.trim().toUpperCase()]) return prev;

          const currentInferred = inferAddressData(prev.addressLine, prev.clientType);
          if (currentInferred.pincode !== pincode) return prev;

          // Only mark this pincode as handled (and only record the verified
          // state) once the response is verified AND the current address
          // still resolves to it, in lockstep — a stale/discarded or
          // fallback response (guarded above) must leave both refs
          // untouched and the pincode eligible for retry.
          if (isVerifiedSuccess) {
            completed = true;
            lastRequestedPincodeRef.current = pincode;
            if (verifiedState) {
              verifiedPincodeStateRef.current = { pincode, state: verifiedState };
            }
          }

          const next = { ...prev };
          let changed = false;
          const nextCity = String(lookup.city || currentInferred.city || "").trim();
          const nextState = String(lookup.state || currentInferred.state || "").trim();

          if (!manualLocationEdits.pincode && next.pincode !== pincode) {
            next.pincode = pincode;
            changed = true;
          }
          if (!manualLocationEdits.state && nextState && next.state !== nextState) {
            next.state = nextState;
            changed = true;
          }
          if (!manualLocationEdits.city && nextCity && next.city !== nextCity) {
            next.city = nextCity;
            changed = true;
          }
          if (!manualLocationEdits.country && next.country !== "India") {
            next.country = "India";
            changed = true;
          }

          return changed ? next : prev;
        });

        setAutoFilledLocation((prev) => {
          const currentInferred = inferAddressData(values.addressLine, values.clientType);
          return {
            ...prev,
            city: prev.city || (!manualLocationEdits.city && Boolean(String(lookup.city || currentInferred.city || "").trim())),
            state: prev.state || (!manualLocationEdits.state && Boolean(String(lookup.state || currentInferred.state || "").trim())),
            country: prev.country || !manualLocationEdits.country,
            pincode: prev.pincode || !manualLocationEdits.pincode,
          };
        });
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
      });

    return () => {
      controller.abort();
      if (!completed && lastRequestedPincodeRef.current === pincode) {
        lastRequestedPincodeRef.current = "";
      }
    };
  }, [gstMappingByNumber, manualLocationEdits, values.addressLine, values.clientType, values.gstNumber, viewOnly]);

  useEffect(() => {
    if (values.clientType !== "Indian") {
      lastRequestedPincodeRef.current = "";
      return;
    }
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

      const nextMcRows = Array.isArray(prev.mcRows) ? prev.mcRows.map((row) => {
        if (row.brand.trim() && row.brand !== previousBillingBrand) return row;
        changed = true;
        return { ...row, brand: billingBrand };
      }) : [];

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
    if (key === "addressLine" && !String(nextValue).trim()) {
      lastRequestedPincodeRef.current = "";
      setManualLocationEdits({ city: false, state: false, country: false, pincode: false });
      setAutoFilledLocation({ city: false, state: false, country: false, pincode: false });
      setValues((prev) => ({
        ...prev,
        addressLine: "",
        city: "",
        state: "",
        country: prev.clientType === "Indian" ? "India" : "",
        pincode: "",
      }));
      clearErrors(["addressLine", "city", "state", "country", "pincode"]);
      setError("");
      return;
    }
    if (key === "city" || key === "state" || key === "country" || key === "pincode") {
      setManualLocationEdits((prev) => ({ ...prev, [key]: true }));
      setAutoFilledLocation((prev) => ({ ...prev, [key]: false }));
    }

    if (key === "entityType") {
      lastRequestedPincodeRef.current = "";
      setManualLocationEdits({ city: false, state: false, country: false, pincode: false });
      setAutoFilledLocation({ city: false, state: false, country: false, pincode: false });
      setValues((prev) => ({
        ...prev,
        entityType: nextValue as InvoiceIntakeFormValues["entityType"],
        agencyBrandName: "",
        agencyBrandTradeName: "",
        billingBrandName: "",
        gstSelectionMode: "existing",
        gstNumber: "",
        addressLine: "",
        city: "",
        state: "",
        country: prev.clientType === "Indian" ? "India" : "",
        pincode: "",
      }));
      clearErrors(["entityType", "agencyBrandName", "agencyBrandTradeName", "billingBrandName", "gstNumber", "addressLine", "city", "state", "country", "pincode"]);
      setError("");
      return;
    }

    setValues((prev) => ({ ...prev, [key]: nextValue }));
    clearErrors([String(key), "creatorDeliverables"]);
    setError("");
  }

  function handleEntityNameSelect(next: string) {
    if (!next.trim()) {
      lastRequestedPincodeRef.current = "";
      setHasInteracted(true);
      setValues((prev) => ({
        ...prev,
        agencyBrandName: "",
        agencyBrandTradeName: "",
        gstSelectionMode: "existing",
        gstNumber: "",
        addressLine: "",
        city: "",
        state: "",
        country: prev.clientType === "Indian" ? "India" : "",
        pincode: "",
      }));
      setManualLocationEdits({ city: false, state: false, country: false, pincode: false });
      setAutoFilledLocation({ city: false, state: false, country: false, pincode: false });
      clearErrors(["agencyBrandName", "agencyBrandTradeName", "gstNumber", "addressLine", "city", "state", "country", "pincode"]);
      setError("");
      return;
    }

    const tradeNameMap = values.entityType === "Agency" ? agencyTradeNameMap : brandTradeNameMap;
    const mappedTradeName = tradeNameMap[next.trim().toLowerCase()];
    setHasInteracted(true);
    setValues((prev) => ({
      ...prev,
      agencyBrandName: next,
      ...(mappedTradeName ? { agencyBrandTradeName: mappedTradeName } : {}),
    }));
    clearErrors(["agencyBrandName", "agencyBrandTradeName"]);
    setError("");
  }

  function handleTradeNameSelect(next: string) {
    if (!next.trim()) {
      lastRequestedPincodeRef.current = "";
      setHasInteracted(true);
      setValues((prev) => ({
        ...prev,
        agencyBrandTradeName: "",
        agencyBrandName: "",
        gstSelectionMode: "existing",
        gstNumber: "",
        addressLine: "",
        city: "",
        state: "",
        country: prev.clientType === "Indian" ? "India" : "",
        pincode: "",
      }));
      setManualLocationEdits({ city: false, state: false, country: false, pincode: false });
      setAutoFilledLocation({ city: false, state: false, country: false, pincode: false });
      clearErrors(["agencyBrandTradeName", "agencyBrandName", "gstNumber", "addressLine", "city", "state", "country", "pincode"]);
      setError("");
      return;
    }

    const entityNameMap = values.entityType === "Agency" ? agencyNameMap : brandNameMap;
    const mappedEntityName = entityNameMap[next.trim().toLowerCase()];
    setHasInteracted(true);
    setValues((prev) => ({
      ...prev,
      agencyBrandTradeName: next,
      ...(mappedEntityName ? { agencyBrandName: mappedEntityName } : {}),
    }));
    clearErrors(["agencyBrandTradeName", "agencyBrandName"]);
    setError("");
  }

  // Approved mapping-derived values are authoritative Master Data, not
  // parser output: mark them the same way a manual employee correction is
  // marked so the address-reparse effect (which already skips
  // manualLocationEdits fields) leaves them alone instead of re-deriving
  // or clearing them from `mapped.address`. Shared by the GST picker
  // (handleGstSelect) and the resubmission approved-mapping hydration effect
  // so both paths apply an approved mapping identically.
  function applyApprovedGstAddress(mapped: GstMappingOption) {
    setManualLocationEdits({ city: true, state: true, country: true, pincode: true });
    setAutoFilledLocation({ city: false, state: false, country: false, pincode: false });
    const nextAddress = {
      addressLine: mapped.address,
      city: mapped.city,
      state: mapped.state,
      country: mapped.country || 'India',
      pincode: mapped.pincode,
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

  function handleGstSelect(next: string) {
    const normalizedGst = next.toUpperCase();
    const mapped = gstMappingByNumber[next.trim().toUpperCase()];
    setHasInteracted(true);

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

    applyApprovedGstAddress(mapped);
  }

  function handleGstClear() {
    setHasInteracted(true);
    lastRequestedPincodeRef.current = "";
    setManualLocationEdits({ city: false, state: false, country: false, pincode: false });
    setAutoFilledLocation({ city: false, state: false, country: false, pincode: false });
    setValues((prev) => ({
      ...prev,
      gstSelectionMode: "existing",
      gstNumber: "",
      addressLine: "",
      city: "",
      state: "",
      country: prev.clientType === "Indian" ? "India" : "",
      pincode: "",
    }));
    gstAddressSnapshotRef.current = null;
    clearErrors(["gstNumber", "addressLine", "city", "state", "country", "pincode"]);
    setError("");
  }

  function handleAddNewGstSelect() {
    setHasInteracted(true);
    gstAddressSnapshotRef.current = null;
    lastRequestedPincodeRef.current = "";
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
    setHasInteracted(true);
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
    setHasInteracted(true);
    setValues((prev) => ({
      ...prev,
      ...resetTalentManagementState(entry),
      businessLine: "TM",
    }));
    clearErrors(["creatorDeliverables"]);
  }

  function addScDeliverable() {
    setHasInteracted(true);
    setValues((prev) => ({ ...prev, scDeliverables: [...prev.scDeliverables, { ...EMPTY_SC_ROW }] }));
  }

  function removeScDeliverable(index: number) {
    setHasInteracted(true);
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
    setHasInteracted(true);
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
    setHasInteracted(true);
    setValues((prev) => ({
      ...prev,
      mcRows: [...prev.mcRows, { ...EMPTY_MC_ROW, brand: prev.mcRows[0]?.brand || "" }],
    }));
  }

  function removeMcRow(index: number) {
    setHasInteracted(true);
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
    setHasInteracted(true);
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
    setHasInteracted(true);
    setValues((prev) => ({
      ...prev,
      campaignExtraDeliverables: [...prev.campaignExtraDeliverables, ""],
    }));
  }

  function removeImDeliverable(index: number) {
    setHasInteracted(true);
    setValues((prev) => ({
      ...prev,
      campaignExtraDeliverables: prev.campaignExtraDeliverables.filter((_, i) => i !== index),
    }));
    clearErrors([`campaignExtraDeliverables.${index}`, "creatorDeliverables"]);
  }

  function patchImDeliverable(index: number, value: string) {
    setHasInteracted(true);
    setValues((prev) => ({
      ...prev,
      campaignExtraDeliverables: prev.campaignExtraDeliverables.map((item, i) => (i === index ? value : item)),
    }));
    clearErrors([`campaignExtraDeliverables.${index}`, "creatorDeliverables"]);
  }

  function patchScCreator(nextCreator: string) {
    setHasInteracted(true);
    setValues((prev) => ({
      ...prev,
      scCreator: nextCreator,
    }));
    clearErrors(["scCreator", "creatorDeliverables"]);
  }

  function patchMcCreator(index: number, creator: string) {
    setHasInteracted(true);
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

      // Blocking mismatch validation relies only on a verified /api/pincode
      // response (source: "postal-api"), never the coarse local prefix map.
      // Timeout, error, missing result, or an unverified lookup must never
      // block submission.
      if (hasVerifiedPincodeStateMismatch(verifiedPincodeStateRef.current, nextValues.pincode, nextValues.state)) {
        if (!errors.state) errors.state = "State may not match the pincode.";
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


  const visibleFieldErrors = useMemo(() => {
    const next: Record<string, string> = {};

    Object.entries(fieldErrors).forEach(([key, message]) => {
      if (!message) return;
      next[key] = message;
    });

    return next;
  }, [fieldErrors]);

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
    if (viewOnly) return;
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
      clearSavedRecovery();
      clearHistory(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    lastRequestedPincodeRef.current = "";
    setValues({
      ...INITIAL_VALUES,
      businessLine: effectiveBusinessLine,
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
    clearSavedRecovery();
    clearHistory({
      ...INITIAL_VALUES,
      businessLine: effectiveBusinessLine,
      submitterName: values.submitterName,
      submitterEmail: values.submitterEmail,
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="intake-form"
      autoComplete="off"
      noValidate
      style={{ position: 'relative' }}
      onFocusCapture={(event) => {
        const target = event.target as HTMLElement | null;
        const field = target?.closest?.("[data-field]") as HTMLElement | null;
        const fieldKey = field?.getAttribute("data-field");
        if (fieldKey) setActiveField(fieldKey);
      }}
      onClickCapture={(event) => {
        if (!viewOnly) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest?.('[data-view-allowed="true"]')) return;
        const field = target?.closest?.('[data-field], .intake-field, .intake-section-body, .intake-toggle-group') as HTMLElement | null;
        if (!field) return;
        setReadOnlyClickHint({ x: event.clientX, y: event.clientY, message: 'Click Edit to modify this submission.' });
      }}
    >
      <fieldset disabled={viewOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: 'grid', gap: 16 }}>
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
        viewOnly={viewOnly}
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
        viewOnly={viewOnly}
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
      <CommercialsSection viewOnly={viewOnly} values={values} totalAmount={totalAmount} onChange={update} errors={visibleFieldErrors} />
      <AdditionalInfoSection
        viewOnly={viewOnly}
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
      </fieldset>

      {!viewOnly ? <FormActions onReset={handleReset} submitting={submitting} submitEnabled={submitEnabled && Boolean(onSubmit)} /> : null}

      {readOnlyClickHint ? (
        <div
          className="pointer-events-none fixed z-[90] rounded-md border border-sky-300/70 bg-card px-2 py-1 text-[11px] font-medium text-sky-700 shadow-sm dark:border-sky-300/35 dark:text-sky-200"
          style={{ left: readOnlyClickHint.x + 10, top: readOnlyClickHint.y - 12 }}
        >
          {readOnlyClickHint.message}
        </div>
      ) : null}

      {error ? <p className="text-danger intake-inline-error">{error}</p> : null}
    </form>
  );
}

