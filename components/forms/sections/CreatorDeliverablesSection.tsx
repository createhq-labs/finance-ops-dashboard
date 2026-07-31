import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MultiCreatorRows, ProductReimbursementField, SingleCreatorRows } from "../invoice-line-items";
import { SearchableSelect } from "../searchable-select";
import type { ExistingInvoiceAttachment, InvoiceIntakeFormValues } from "../types";
import { CURRENCY_OPTIONS, CURRENCY_SEARCH_TEXT_BY_OPTION } from "../../../lib/shared/currency";

type Props = {
  viewOnly?: boolean;
  values: InvoiceIntakeFormValues;
  onChange: <K extends keyof InvoiceIntakeFormValues>(key: K, value: InvoiceIntakeFormValues[K]) => void;
  errors?: Record<string, string>;
  brandOptions: string[];
  creatorOptions: string[];
  deliverableOptions: {
    TM: string[];
    IM: string[];
  };
  addScDeliverable: () => void;
  removeScDeliverable: (index: number) => void;
  patchScDeliverable: (index: number, patch: { deliverable?: string; amount?: string }) => void;
  addMcRow: () => void;
  removeMcRow: (index: number) => void;
  patchMcRow: (index: number, patch: { creator?: string; brand?: string; deliverable?: string; amount?: string }) => void;
  addImDeliverable: () => void;
  removeImDeliverable: (index: number) => void;
  patchImDeliverable: (index: number, value: string) => void;
  onPatchScCreator: (creator: string) => void;
  onPatchMcCreator: (index: number, creator: string) => void;
  getProductReimbursementFile: (key: string) => File | null;
  getProductReimbursementError: (key: string) => string;
  onProductReimbursementFileChange: (key: string, file: File | null) => void;
  existingProductReimbursementAttachment?: ExistingInvoiceAttachment | null;
  productReimbursementAttachmentRemoved?: boolean;
  onViewExistingProductReimbursementAttachment?: (attachment: ExistingInvoiceAttachment) => void;
  onRemoveExistingProductReimbursementAttachment?: () => void;
  onRetainExistingProductReimbursementAttachment?: () => void;
};

function CurrencyField({
  currency,
  onCurrencyChange,
}: {
  currency: string;
  onCurrencyChange: (next: string) => void;
}) {
  return (
    <label className="intake-field invoice-row-currency-cell min-w-0" style={{ width: 86, maxWidth: '100%' }}>
      <span className="intake-label">Curr. *</span>
      <SearchableSelect
        value={currency}
        options={CURRENCY_OPTIONS}
        onChange={onCurrencyChange}
        placeholder="Select currency"
        dataField="currency"
        panelMaxHeight={160}
        searchTextByOption={CURRENCY_SEARCH_TEXT_BY_OPTION}
      />
    </label>
  );
}

function normalizeSelectedDeliverables(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function ImDeliverablesField({
  options,
  selected,
  error,
  onChange,
}: {
  options: string[];
  selected: string[];
  error?: string;
  onChange: (next: string[]) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const skipNextOptionClickRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalizedOptions = useMemo(() => Array.from(new Set(options.map((option) => option.trim()).filter(Boolean))), [options]);
  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return normalizedOptions;
    return normalizedOptions.filter((option) => option.toLowerCase().includes(needle));
  }, [normalizedOptions, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  function toggleOption(option: string) {
    if (selected.includes(option)) {
      onChange(selected.filter((entry) => entry !== option));
    } else {
      onChange([...selected, option]);
    }
    setOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  return (
    <div
      ref={rootRef}
      className="intake-searchable-root"
      style={{ position: "relative", zIndex: open ? 90 : undefined }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`intake-select-trigger${open ? " intake-select-trigger-open" : ""}${selected.length === 0 ? " intake-select-trigger-placeholder" : ""}`}
        data-field="campaignDeliverable"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
        style={{ minHeight: 38, height: "auto", maxWidth: "100%", alignItems: "flex-start", paddingRight: 34, paddingBlock: 8, overflow: "hidden" }}
      >
        <span className="intake-select-trigger-label" style={{ display: "flex", flex: 1, minWidth: 0, maxWidth: "100%", flexDirection: "column", alignItems: "flex-start", gap: 6, paddingBlock: 2, overflow: "hidden" }}>
          {selected.length === 0 ? (
            <span>Select deliverables</span>
          ) : (
            selected.map((deliverable) => {
              return (
                <span
                  key={deliverable}
                  title={deliverable}
                  className={[
                    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium",
                    "border border-sky-300/70 bg-sky-100/95 text-sky-950 dark:border-sky-300/30 dark:bg-sky-400/16 dark:text-sky-50",
                  ].join(" ")}
                >
                  <span className="truncate" title={deliverable} style={{ display: "block", maxWidth: "calc(100% - 20px)" }}>{deliverable}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Remove ${deliverable}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onChange(selected.filter((entry) => entry !== deliverable));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        onChange(selected.filter((entry) => entry !== deliverable));
                      }
                    }}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <X size={10} />
                  </span>
                </span>
              );
            })
          )}
        </span>
        <ChevronDown className={`intake-select-chevron${open ? " intake-select-chevron-open" : ""}`} size={16} />
      </button>

      {open ? (
        <div className="intake-searchable-panel intake-select-panel" style={{ maxHeight: 240 }} role="listbox">
          <div className="intake-select-search-shell" style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <div className="flex items-center gap-2 px-3">
              <Search size={16} className="text-muted-foreground" />
              <input
                ref={searchInputRef}
                className="intake-select-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setOpen(false);
                    requestAnimationFrame(() => triggerRef.current?.focus());
                  }
                }}
                placeholder="Search..."
                autoComplete="off"
                style={{ paddingInline: 0 }}
              />
            </div>
          </div>

          <div className="intake-select-options">
            {filteredOptions.length === 0 ? (
              <div className="intake-select-empty">No matching option</div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selected.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    title={option}
                    className={["intake-searchable-option", isSelected ? "intake-searchable-option-selected" : ""].filter(Boolean).join(" ")}
                    onPointerDownCapture={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      skipNextOptionClickRef.current = true;
                      toggleOption(option);
                    }}
                    onMouseDownCapture={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (skipNextOptionClickRef.current) return;
                      skipNextOptionClickRef.current = true;
                      toggleOption(option);
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => {
                      if (skipNextOptionClickRef.current) {
                        skipNextOptionClickRef.current = false;
                        return;
                      }
                      toggleOption(option);
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                        style={isSelected
                          ? { borderColor: "var(--ring)", backgroundColor: "var(--bg-accent)", color: "var(--text-accent)" }
                          : { borderColor: "var(--border)" }}
                      >
                        {isSelected ? <Check size={12} /> : null}
                      </span>
                      <span className={`truncate ${isSelected ? "font-medium" : ""}`} title={option} style={isSelected ? { color: "var(--text-accent)" } : undefined}>{option}</span>
                    </span>
                    <span className="intake-searchable-option-check" aria-hidden="true" />
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      <div style={{ minHeight: 16 }}>
        {error ? <p className="text-danger intake-inline-error">{error}</p> : null}
      </div>
    </div>
  );
}

export function CreatorDeliverablesSection({
  viewOnly = false,
  values,
  onChange,
  errors = {},
  brandOptions,
  creatorOptions,
  deliverableOptions,
  addScDeliverable,
  removeScDeliverable,
  patchScDeliverable,
  addMcRow,
  removeMcRow,
  patchMcRow,
  onPatchScCreator,
  onPatchMcCreator,
  getProductReimbursementFile,
  getProductReimbursementError,
  onProductReimbursementFileChange,
  existingProductReimbursementAttachment = null,
  productReimbursementAttachmentRemoved = false,
  onViewExistingProductReimbursementAttachment,
  onRemoveExistingProductReimbursementAttachment,
  onRetainExistingProductReimbursementAttachment,
}: Props) {
  const showCurrency = values.clientType === "Foreign";
  const selectedImDeliverables = useMemo(
    () => normalizeSelectedDeliverables([values.campaignDeliverable, ...values.campaignExtraDeliverables]),
    [values.campaignDeliverable, values.campaignExtraDeliverables]
  );
  const previousImDeliverablesRef = useRef<string[]>(selectedImDeliverables);

  useEffect(() => {
    const previous = previousImDeliverablesRef.current;
    const hadProductReimbursement = previous.includes("Product Reimbursement");
    const hasProductReimbursement = selectedImDeliverables.includes("Product Reimbursement");

    if (hadProductReimbursement && !hasProductReimbursement) {
      onProductReimbursementFileChange("campaign-0", null);
      onChange("reimbursementIncluded", "no");
      onChange("reimbursementAmount", "0");
      onChange("reimbursementProof", "");
    }

    previousImDeliverablesRef.current = selectedImDeliverables;
  }, [onChange, onProductReimbursementFileChange, selectedImDeliverables]);

  function updateImDeliverables(nextDeliverables: string[]) {
    const normalized = normalizeSelectedDeliverables(nextDeliverables);
    onChange("campaignDeliverable", (normalized[0] ?? "") as InvoiceIntakeFormValues["campaignDeliverable"]);
    onChange("campaignExtraDeliverables", normalized.slice(1) as InvoiceIntakeFormValues["campaignExtraDeliverables"]);
  }

  const imDeliverableError =
    errors.campaignDeliverable ||
    Object.keys(errors).find((key) => key.startsWith("campaignExtraDeliverables."))
      ? (errors.campaignDeliverable || "Check selected deliverables.")
      : "";

  if (values.businessLine === "TM" && values.entryType === "SC") {
    return (
      <SingleCreatorRows
        scCreator={values.scCreator}
        scBrand={values.scBrand}
        currency={values.currency}
        showCurrency={showCurrency}
        rows={values.scDeliverables}
        errors={errors}
        creatorOptions={creatorOptions}
        brandOptions={brandOptions}
        deliverableOptions={deliverableOptions.TM}
        getProductReimbursementFile={getProductReimbursementFile}
        getProductReimbursementError={getProductReimbursementError}
        onCurrencyChange={(next) => onChange("currency", next as InvoiceIntakeFormValues["currency"])}
        onCreatorChange={onPatchScCreator}
        onBrandChange={(value) => onChange("scBrand", value)}
        onAddRow={addScDeliverable}
        onRemoveRow={removeScDeliverable}
        onRowChange={patchScDeliverable}
        onProductReimbursementFileChange={onProductReimbursementFileChange}
        existingProductReimbursementAttachment={existingProductReimbursementAttachment}
        productReimbursementAttachmentRemoved={productReimbursementAttachmentRemoved}
        onViewExistingProductReimbursementAttachment={onViewExistingProductReimbursementAttachment}
        onRemoveExistingProductReimbursementAttachment={onRemoveExistingProductReimbursementAttachment}
        onRetainExistingProductReimbursementAttachment={onRetainExistingProductReimbursementAttachment}
        viewOnly={viewOnly}
      />
    );
  }

  if (values.businessLine === "TM" && values.entryType === "MC") {
    return (
      <MultiCreatorRows
        rows={values.mcRows}
        errors={errors}
        currency={values.currency}
        showCurrency={showCurrency}
        creatorOptions={creatorOptions}
        brandOptions={brandOptions}
        deliverableOptions={deliverableOptions.TM}
        getProductReimbursementFile={getProductReimbursementFile}
        getProductReimbursementError={getProductReimbursementError}
        onCurrencyChange={(next) => onChange("currency", next as InvoiceIntakeFormValues["currency"])}
        onAddRow={addMcRow}
        onRemoveRow={removeMcRow}
        onRowChange={patchMcRow}
        onCreatorChange={onPatchMcCreator}
        onProductReimbursementFileChange={onProductReimbursementFileChange}
        existingProductReimbursementAttachment={existingProductReimbursementAttachment}
        productReimbursementAttachmentRemoved={productReimbursementAttachmentRemoved}
        onViewExistingProductReimbursementAttachment={onViewExistingProductReimbursementAttachment}
        onRemoveExistingProductReimbursementAttachment={onRemoveExistingProductReimbursementAttachment}
        onRetainExistingProductReimbursementAttachment={onRetainExistingProductReimbursementAttachment}
        viewOnly={viewOnly}
      />
    );
  }

  return (
    <section className="intake-section">
      <div className="intake-section-header">
        <div>
          <h3 className="intake-section-title">Campaign Details</h3>
          <p className="text-muted intake-section-copy">Campaign reference and deliverables.</p>
        </div>
      </div>

      <div className="intake-section-body" style={{ display: "grid", gap: 10, padding: "10px 12px 12px" }}>
        <style>{`
          .campaign-grid {
            display: grid;
            gap: 12px;
            grid-template-columns: repeat(1, minmax(0, 1fr));
          }
          .campaign-grid-foreign {
            display: grid;
            gap: 12px;
            grid-template-columns: repeat(1, minmax(0, 1fr));
          }
          .campaign-grid > *,
          .campaign-grid-foreign > * {
            min-width: 0;
          }
          @media (min-width: 640px) {
            .campaign-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .campaign-grid-foreign {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
          @media (min-width: 1024px) {
            .campaign-grid {
              grid-template-columns: minmax(0, 0.72fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.5fr);
            }
            .campaign-grid-foreign {
              grid-template-columns: minmax(0, 0.7fr) minmax(0, 1fr) minmax(0, 1fr) 86px minmax(0, 1.68fr);
            }
          }
        `}</style>
        <div className={showCurrency ? "campaign-grid-foreign" : "campaign-grid"}>
          <label className="intake-field min-w-0">
            <span className="intake-label">Campaign Code *</span>
            <input className="intake-input min-w-0" value={values.campaignCode} onChange={(e) => onChange("campaignCode", e.target.value)} data-field="campaignCode" readOnly={viewOnly} autoComplete="off" title={values.campaignCode} />
            <div style={{ minHeight: 16 }}>
              {errors.campaignCode ? <p className="text-danger intake-inline-error">{errors.campaignCode}</p> : null}
            </div>
          </label>

          <label className="intake-field min-w-0">
            <span className="intake-label">Campaign Name *</span>
            <input className="intake-input min-w-0" value={values.campaignName} onChange={(e) => onChange("campaignName", e.target.value)} data-field="campaignName" readOnly={viewOnly} autoComplete="off" title={values.campaignName} />
            <div style={{ minHeight: 16 }}>
              {errors.campaignName ? <p className="text-danger intake-inline-error">{errors.campaignName}</p> : null}
            </div>
          </label>

          <label className="intake-field min-w-0">
            <span className="intake-label">Campaign Brand *</span>
            <SearchableSelect value={values.campaignBrand} options={brandOptions} allowCustom panelMaxHeight={160} onChange={(next) => onChange("campaignBrand", next)} deselectOnSelectedClick clearable editCustomOnDoubleClick placeholder="Select brand" data-field="campaignBrand" />
            <div style={{ minHeight: 16 }}>
              {errors.campaignBrand ? <p className="text-danger intake-inline-error">{errors.campaignBrand}</p> : null}
            </div>
          </label>

          {showCurrency ? (
            <CurrencyField currency={values.currency} onCurrencyChange={(next) => onChange("currency", next as InvoiceIntakeFormValues["currency"])} />
          ) : null}

          <label className="intake-field min-w-0">
            <span className="intake-label">Deliverable *</span>
            <ImDeliverablesField
              options={deliverableOptions.IM}
              selected={selectedImDeliverables}
              error={String(imDeliverableError || "")}
              onChange={updateImDeliverables}
            />
            {selectedImDeliverables.includes("Product Reimbursement") ? (
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                <label className="intake-field">
                  <span className="intake-label">Product Reimbursement Amount ({values.currency}) *</span>
                  <input
                    className="intake-input"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={values.reimbursementAmount}
                    readOnly={viewOnly}
                    onChange={(event) => onChange("reimbursementAmount", event.target.value)}
                    data-field="reimbursementAmount"
                    autoComplete="off"
                    placeholder={`Amount ${values.currency}`}
                  />
                  <div style={{ minHeight: 16 }}>
                    {errors.reimbursementAmount ? <p className="text-danger intake-inline-error">{errors.reimbursementAmount}</p> : null}
                  </div>
                </label>
                <ProductReimbursementField
                  fieldKey="campaign-0"
                  file={getProductReimbursementFile("campaign-0")}
                  error={getProductReimbursementError("campaign-0")}
                  onChange={onProductReimbursementFileChange}
                  helperText="PDF, PNG, JPG, or WEBP. Max 10 MB."
                  formError={errors["campaign-0"]}
                  existingAttachment={existingProductReimbursementAttachment}
                  existingAttachmentRemoved={productReimbursementAttachmentRemoved}
                  onViewExistingAttachment={onViewExistingProductReimbursementAttachment}
                  onRemoveExistingAttachment={onRemoveExistingProductReimbursementAttachment}
                  onRetainExistingAttachment={onRetainExistingProductReimbursementAttachment}
                  viewOnly={viewOnly}
                />
              </div>
            ) : null}
          </label>
        </div>
      </div>
    </section>
  );
}
