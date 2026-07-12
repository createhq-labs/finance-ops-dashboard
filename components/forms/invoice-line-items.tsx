import { useEffect, useMemo, useRef, useState } from "react";
import type { DeliverableAmountRow, MultiCreatorRow } from "./types";
import { CURRENCY_OPTIONS, CURRENCY_SEARCH_TEXT_BY_OPTION } from "../../lib/shared/currency";
import { SearchableSelect } from "./searchable-select";

function CurrencyField({
  currency,
  onChange,
}: {
  currency: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="grid gap-1 min-w-0">
      <SearchableSelect
        value={currency}
        options={CURRENCY_OPTIONS}
        onChange={onChange}
        placeholder="INR"
        dataField="currency"
        searchTextByOption={CURRENCY_SEARCH_TEXT_BY_OPTION}
      />
      <div style={{ minHeight: 16 }} />
    </div>
  );
}

function formatSelectedFileSize(file: File | null) {
  if (!file) return '';
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb >= 1) return `${sizeMb.toFixed(sizeMb >= 10 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(file.size / 1024))} KB`;
}

export function AttachmentUploadField({
  fieldKey,
  file,
  error,
  onChange,
  helperText = 'PDF, PNG, JPG, or WEBP. Max 10 MB.',
}: {
  fieldKey: string;
  file: File | null;
  error: string;
  onChange: (key: string, file: File | null) => void;
  helperText?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const isImage = Boolean(file?.type?.startsWith('image/'));

  function clearSelectedFile() {
    if (inputRef.current) inputRef.current.value = '';
    setPreviewOpen(false);
    onChange(fieldKey, null);
  }

  return (
    <>
      <div className="grid gap-2" style={{ maxWidth: 440 }}>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(e) => onChange(fieldKey, e.target.files?.[0] ?? null)}
          style={{ display: 'none' }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn"
            onClick={() => inputRef.current?.click()}
            style={{ minWidth: 122 }}
          >
            {file ? 'Replace File' : 'Choose File'}
          </button>
          <span className="text-muted intake-section-copy" style={{ margin: 0 }}>
            {helperText}
          </span>
        </div>
        {error ? <p className="text-danger intake-inline-error">{error}</p> : null}
        {file ? (
          <div
            className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-200/70 bg-sky-50/80 px-3 py-2 dark:border-sky-400/20 dark:bg-sky-500/10"
            title={file.name}
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{file.name}</span>
            <span className="text-xs text-muted-foreground">{formatSelectedFileSize(file)}</span>
            <button
              type="button"
              className="btn"
              onClick={() => setPreviewOpen(true)}
              style={{ paddingInline: 10, minHeight: 30 }}
            >
              View
            </button>
            <button
              type="button"
              className="btn"
              onClick={clearSelectedFile}
              style={{ paddingInline: 10, minHeight: 30 }}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>

      {previewOpen && file ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="surface w-full max-w-2xl rounded-2xl border border-border/70 bg-background p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            style={{ display: 'grid', gap: 12 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{file.name}</div>
                <div className="text-xs text-muted-foreground">{formatSelectedFileSize(file)}</div>
              </div>
              <button type="button" className="btn" onClick={() => setPreviewOpen(false)}>Close</button>
            </div>
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card/80" style={{ height: 420 }}>
              {isImage ? (
                <img src={previewUrl} alt={file.name} className="h-full w-full object-contain bg-black/5 dark:bg-white/5" />
              ) : (
                <iframe src={previewUrl} title={file.name} className="h-full w-full border-0" />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ProductReimbursementField({
  fieldKey,
  file,
  error,
  onChange,
}: {
  fieldKey: string;
  file: File | null;
  error: string;
  onChange: (key: string, file: File | null) => void;
}) {
  return (
    <AttachmentUploadField
      fieldKey={fieldKey}
      file={file}
      error={error}
      onChange={onChange}
      helperText="PDF, PNG, JPG, or WEBP. Max 10 MB."
    />
  );
}

type SingleCreatorProps = {
  scCreator: string;
  scBrand: string;
  currency: string;
  onCurrencyChange: (next: string) => void;
  rows: DeliverableAmountRow[];
  errors?: Record<string, string>;
  creatorOptions: string[];
  brandOptions: string[];
  deliverableOptions: string[];
  getProductReimbursementFile: (key: string) => File | null;
  getProductReimbursementError: (key: string) => string;
  onCreatorChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  onRowChange: (index: number, patch: Partial<DeliverableAmountRow>) => void;
  onProductReimbursementFileChange: (key: string, file: File | null) => void;
  showCurrency?: boolean;
};

export function SingleCreatorRows({
  scCreator,
  scBrand,
  currency,
  onCurrencyChange,
  rows,
  errors = {},
  creatorOptions,
  brandOptions,
  deliverableOptions,
  getProductReimbursementFile,
  getProductReimbursementError,
  onCreatorChange,
  onBrandChange,
  onAddRow,
  onRemoveRow,
  onRowChange,
  onProductReimbursementFileChange,
  showCurrency = false,
}: SingleCreatorProps) {
  const gridColumns = showCurrency
    ? "grid gap-x-1 gap-y-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_92px_minmax(0,1fr)_minmax(0,0.85fr)_96px]"
    : "grid gap-x-1 gap-y-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.85fr)_96px]";
  return (
    <section className="intake-section">
      <div className="intake-section-header">
        <div>
          <h3 className="intake-section-title">Single Creator</h3>
          <p className="text-muted intake-section-copy">Select creator, brand, deliverable, and amount.</p>
        </div>
      </div>

      <div className="intake-section-body">
        <div className="intake-row-stack">
          {rows.map((row, idx) => (
            <div key={`sc-${idx}`} className="grid gap-2">
              <div className={`${gridColumns} intake-row-grid-multi`} style={showCurrency ? { gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1.1fr) 92px minmax(0,1fr) minmax(0,0.85fr) 96px" } : { gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,1fr) minmax(0,0.85fr) 96px" }}>
                <div className="grid gap-1">
                  <SearchableSelect
                    value={scCreator}
                    options={creatorOptions}
                    allowCustom
                    panelMaxHeight={160}
                    onChange={onCreatorChange}
                    placeholder="Select creator"
                    disabled={idx > 0}
                    data-field="scCreator"
                  />
                  <div style={{ minHeight: 16 }}>
                    {idx === 0 && errors.scCreator ? <p className="text-danger intake-inline-error">{errors.scCreator}</p> : null}
                  </div>
                </div>
                <div className="grid gap-1">
                  <SearchableSelect
                    value={scBrand}
                    options={brandOptions}
                    allowCustom
                    panelMaxHeight={160}
                    onChange={onBrandChange}
                    placeholder="Select brand"
                    disabled={idx > 0}
                    data-field="scBrand"
                  />
                  <div style={{ minHeight: 16 }}>
                    {idx === 0 && errors.scBrand ? <p className="text-danger intake-inline-error">{errors.scBrand}</p> : null}
                  </div>
                </div>
                {showCurrency ? (
  <CurrencyField
    currency={currency}
    onChange={onCurrencyChange}
  />
) : null}
                <div className="grid gap-1">
                  <SearchableSelect
                    value={row.deliverable}
                    options={deliverableOptions}
                    onChange={(next) => onRowChange(idx, { deliverable: next })}
                    data-field={`scDeliverables.${idx}.deliverable`}
                    placeholder="Select deliverable"
                  />
                  <div style={{ minHeight: 16 }}>
                    {errors[`scDeliverables.${idx}.deliverable`] ? <p className="text-danger intake-inline-error">{errors[`scDeliverables.${idx}.deliverable`]}</p> : null}
                  </div>
                </div>
                <div className="grid gap-1">
                  <input
                    className="intake-input"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder={`Amount ${currency}`}
                    value={row.amount}
                    onChange={(e) => onRowChange(idx, { amount: e.target.value })}
                    data-field={`scDeliverables.${idx}.amount`}
                    autoComplete="off"
                  />
                  <div style={{ minHeight: 16 }}>
                    {errors[`scDeliverables.${idx}.amount`] ? <p className="text-danger intake-inline-error">{errors[`scDeliverables.${idx}.amount`]}</p> : null}
                  </div>
                </div>
                <button className="btn intake-row-action" type="button" onClick={() => onRemoveRow(idx)} disabled={rows.length === 1}>
                  Remove
                </button>
              </div>

              {row.deliverable === "Product Reimbursement" ? (
                <ProductReimbursementField
                  fieldKey={`sc-${idx}`}
                  file={getProductReimbursementFile(`sc-${idx}`)}
                  error={getProductReimbursementError(`sc-${idx}`)}
                  onChange={onProductReimbursementFileChange}
                />
              ) : null}
            </div>
          ))}
        </div>

        <div style={{ minHeight: 16 }}>
          {errors.creatorDeliverables ? <p className="text-danger intake-inline-error">{errors.creatorDeliverables}</p> : null}
        </div>
        <button className="btn" type="button" onClick={onAddRow}>
          + Add Deliverable
        </button>
      </div>
    </section>
  );
}

type MultiCreatorProps = {
  rows: MultiCreatorRow[];
  errors?: Record<string, string>;
  currency: string;
  onCurrencyChange: (next: string) => void;
  creatorOptions: string[];
  brandOptions: string[];
  deliverableOptions: string[];
  getProductReimbursementFile: (key: string) => File | null;
  getProductReimbursementError: (key: string) => string;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  onRowChange: (index: number, patch: Partial<MultiCreatorRow>) => void;
  onCreatorChange: (index: number, creator: string) => void;
  onProductReimbursementFileChange: (key: string, file: File | null) => void;
  showCurrency?: boolean;
};

export function MultiCreatorRows({
  rows,
  errors = {},
  currency,
  onCurrencyChange,
  creatorOptions,
  brandOptions,
  deliverableOptions,
  getProductReimbursementFile,
  getProductReimbursementError,
  onAddRow,
  onRemoveRow,
  onRowChange,
  onCreatorChange,
  onProductReimbursementFileChange,
  showCurrency = false,
}: MultiCreatorProps) {
  const gridColumns = showCurrency
    ? "grid gap-x-1 gap-y-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_92px_minmax(0,1fr)_minmax(0,0.85fr)_96px]"
    : "grid gap-x-1 gap-y-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.85fr)_96px]";
  return (
    <section className="intake-section">
      <div className="intake-section-header">
        <div>
          <h3 className="intake-section-title">Multiple Creators</h3>
          <p className="text-muted intake-section-copy">Capture each creator, deliverable, and amount.</p>
        </div>
      </div>

      <div className="intake-section-body">
        <div className="intake-row-stack">
          {rows.map((row, idx) => (
            <div key={`mc-${idx}`} className="grid gap-2">
              <div className={`${gridColumns} intake-row-grid-multi`} style={showCurrency ? { gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1.1fr) 92px minmax(0,1fr) minmax(0,0.85fr) 96px" } : { gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,1fr) minmax(0,0.85fr) 96px" }}>
                <div className="grid gap-1">
                  <SearchableSelect
                    value={row.creator}
                    options={creatorOptions}
                    allowCustom
                    panelMaxHeight={160}
                    onChange={(next) => onCreatorChange(idx, next)}
                    placeholder="Select creator"
                    data-field={`mcRows.${idx}.creator`}
                  />
                  <div style={{ minHeight: 16 }}>
                    {errors[`mcRows.${idx}.creator`] ? <p className="text-danger intake-inline-error">{errors[`mcRows.${idx}.creator`]}</p> : null}
                  </div>
                </div>

                <div className="grid gap-1">
                  <SearchableSelect
                    value={row.brand}
                    options={brandOptions}
                    allowCustom
                    panelMaxHeight={160}
                    onChange={(next) => onRowChange(idx, { brand: next })}
                    placeholder="Select brand"
                    disabled={idx > 0}
                    data-field={`mcRows.${idx}.brand`}
                  />
                  <div style={{ minHeight: 16 }}>
                    {errors[`mcRows.${idx}.brand`] ? <p className="text-danger intake-inline-error">{errors[`mcRows.${idx}.brand`]}</p> : null}
                  </div>
                </div>
                {showCurrency ? (
  <CurrencyField
    currency={currency}
    onChange={onCurrencyChange}
  />
) : null}

                <div className="grid gap-1">
                  <SearchableSelect
                    value={row.deliverable}
                    options={deliverableOptions}
                    onChange={(next) => onRowChange(idx, { deliverable: next })}
                    data-field={`mcRows.${idx}.deliverable`}
                    placeholder="Select deliverable"
                  />
                  <div style={{ minHeight: 16 }}>
                    {errors[`mcRows.${idx}.deliverable`] ? <p className="text-danger intake-inline-error">{errors[`mcRows.${idx}.deliverable`]}</p> : null}
                  </div>
                </div>

                <div className="grid gap-1">
                  <input
                    className="intake-input"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder={`Amount ${currency}`}
                    value={row.amount}
                    onChange={(e) => onRowChange(idx, { amount: e.target.value })}
                    data-field={`mcRows.${idx}.amount`}
                    autoComplete="off"
                  />
                  <div style={{ minHeight: 16 }}>
                    {errors[`mcRows.${idx}.amount`] ? <p className="text-danger intake-inline-error">{errors[`mcRows.${idx}.amount`]}</p> : null}
                  </div>
                </div>

                <button className="btn intake-row-action" type="button" onClick={() => onRemoveRow(idx)} disabled={rows.length === 1}>
                  Remove
                </button>
              </div>

              {row.deliverable === "Product Reimbursement" ? (
                <ProductReimbursementField
                  fieldKey={`mc-${idx}`}
                  file={getProductReimbursementFile(`mc-${idx}`)}
                  error={getProductReimbursementError(`mc-${idx}`)}
                  onChange={onProductReimbursementFileChange}
                />
              ) : null}
            </div>
          ))}
        </div>

        <div style={{ minHeight: 16 }}>
          {errors.creatorDeliverables ? <p className="text-danger intake-inline-error">{errors.creatorDeliverables}</p> : null}
        </div>
        <button className="btn" type="button" onClick={onAddRow}>
          + Add Creator Row
        </button>
      </div>
    </section>
  );
}
