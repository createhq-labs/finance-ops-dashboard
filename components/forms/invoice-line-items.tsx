import { Eye, File, FileImage, FileText, Paperclip, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DeliverableAmountRow, ExistingInvoiceAttachment, MultiCreatorRow } from "./types";
import { CURRENCY_OPTIONS, CURRENCY_SEARCH_TEXT_BY_OPTION } from "../../lib/shared/currency";
import { formatAttachmentSize } from "../../lib/shared/submission-attachments";
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
        className="intake-currency-select"
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


function getFileTypeIcon(file: File | null) {
  if (!file) return <File size={20} aria-hidden="true" />;
  const fileName = file.name.toLowerCase();
  if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
    return <FileText size={20} aria-hidden="true" />;
  }
  if (file.type.startsWith('image/') || /\.(png|jpg|jpeg|webp)$/.test(fileName)) {
    return <FileImage size={20} aria-hidden="true" />;
  }
  return <File size={20} aria-hidden="true" />;
}

function renderHelperText(helperText: string) {
  const maxLabel = 'Max 10 MB.';
  if (helperText.endsWith(maxLabel)) {
    const prefix = helperText.slice(0, -maxLabel.length).trimEnd();
    return (
      <span className="block text-[12px] font-normal text-slate-600 dark:text-slate-300">
        {prefix}{' '}
        <span className="font-semibold text-slate-800 dark:text-slate-100">{maxLabel}</span>
      </span>
    );
  }

  return <span className="block text-[12px] font-normal text-slate-600 dark:text-slate-300">{helperText}</span>;
}

export function AttachmentUploadField({
  fieldKey,
  file,
  error,
  onChange,
  helperText = 'PDF, PNG, JPG, or WEBP. Max 10 MB.',
  titleText = 'Attach reimbursement document',
  formError = '',
  existingAttachment = null,
  existingAttachmentRemoved = false,
  existingAttachmentRequired = false,
  onViewExistingAttachment,
  onRemoveExistingAttachment,
  onRetainExistingAttachment,
}: {
  fieldKey: string;
  file: File | null;
  error: string;
  onChange: (key: string, file: File | null) => void;
  helperText?: string;
  titleText?: string;
  formError?: string;
  existingAttachment?: ExistingInvoiceAttachment | null;
  existingAttachmentRemoved?: boolean;
  existingAttachmentRequired?: boolean;
  onViewExistingAttachment?: (attachment: ExistingInvoiceAttachment) => void;
  onRemoveExistingAttachment?: () => void;
  onRetainExistingAttachment?: () => void;
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
  const isPdf = Boolean(file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')));
  const displayError = error || formError;
  const fileTypeIcon = getFileTypeIcon(file);

  function clearSelectedFile() {
    if (inputRef.current) inputRef.current.value = '';
    setPreviewOpen(false);
    onChange(fieldKey, null);
  }

  return (
    <>
      <div className="grid w-full max-w-full min-w-0 gap-2 overflow-hidden" data-field={fieldKey} tabIndex={-1}>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(e) => onChange(fieldKey, e.target.files?.[0] ?? null)}
          style={{ display: 'none' }}
        />

        {!file && existingAttachment && !existingAttachmentRemoved ? (
          <div className="flex w-full max-w-full min-w-0 flex-wrap items-center gap-3 overflow-hidden rounded-xl border border-sky-200/70 bg-card px-3 py-3 dark:border-sky-400/20 sm:flex-nowrap">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-300/20 dark:bg-sky-400/12 dark:text-sky-100">
              <FileText size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="truncate text-[13px] font-medium text-foreground" title={existingAttachment.fileName}>
                {existingAttachment.fileName}
              </div>
              <div className="truncate text-[11px] text-muted-foreground" title={`${existingAttachment.documentType.replace(/_/g, " ")} - ${formatAttachmentSize(existingAttachment.fileSizeBytes)} - retained if unchanged`}>
                {existingAttachment.documentType.replace(/_/g, " ")} - {formatAttachmentSize(existingAttachment.fileSizeBytes)} - retained if unchanged
              </div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex h-7 items-center rounded-md border border-sky-300/60 bg-sky-100/90 px-2.5 text-[11px] font-medium text-sky-900 transition-none hover:bg-sky-200 dark:border-sky-300/25 dark:bg-sky-400/16 dark:text-sky-50 dark:hover:bg-sky-400/24"
              >
                Replace
              </button>
              {onViewExistingAttachment ? (
                <button
                  type="button"
                  onClick={() => onViewExistingAttachment(existingAttachment)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-sky-200/70 bg-sky-50 text-sky-700 transition-none hover:bg-sky-100 hover:text-sky-900 dark:border-sky-400/20 dark:bg-sky-400/12 dark:text-sky-100 dark:hover:bg-sky-400/20"
                  aria-label="View existing file"
                  title="View"
                >
                  <Eye size={14} />
                </button>
              ) : null}
              {!existingAttachmentRequired && onRemoveExistingAttachment ? (
                <button
                  type="button"
                  onClick={onRemoveExistingAttachment}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200/80 bg-rose-50 text-rose-600 transition-none hover:bg-rose-100 hover:text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/12 dark:text-rose-200 dark:hover:bg-rose-500/20"
                  aria-label="Remove existing file"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </div>
          </div>
        ) : !file && existingAttachment && existingAttachmentRemoved ? (
          <div className="grid w-full max-w-full min-w-0 gap-2 overflow-hidden rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-3 text-[12px] text-amber-900 dark:border-amber-300/25 dark:bg-amber-400/10 dark:text-amber-100">
            <div className="min-w-0 truncate font-medium" title={`Existing ${existingAttachment.documentType.replace(/_/g, " ")} will not be retained.`}>Existing {existingAttachment.documentType.replace(/_/g, " ")} will not be retained.</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onRetainExistingAttachment}
                className="inline-flex h-7 items-center rounded-md border border-amber-300/70 bg-white/80 px-2.5 text-[11px] font-medium text-amber-950 transition-none hover:bg-white dark:border-amber-300/30 dark:bg-amber-400/15 dark:text-amber-50"
              >
                Keep existing
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex h-7 items-center rounded-md border border-amber-300/70 bg-white/80 px-2.5 text-[11px] font-medium text-amber-950 transition-none hover:bg-white dark:border-amber-300/30 dark:bg-amber-400/15 dark:text-amber-50"
              >
                Upload new
              </button>
            </div>
          </div>
        ) : !file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full max-w-full min-w-0 flex-wrap items-center gap-3 overflow-hidden rounded-xl border border-dashed border-sky-300/60 bg-sky-50/60 px-3 py-3 text-left transition-none hover:border-sky-400/70 dark:border-sky-400/25 dark:bg-sky-500/10 sm:flex-nowrap"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-400/16 dark:text-sky-200">
              <Paperclip size={18} />
            </span>
            <span className="min-w-0 flex-1 break-words text-left">
              <span className="block text-[13px] font-medium text-foreground">{titleText}</span>
              {renderHelperText(helperText)}
            </span>
            <span className="inline-flex h-8 shrink-0 items-center rounded-lg border border-sky-300/60 bg-sky-100/90 px-3 text-[12px] font-medium text-sky-900 dark:border-sky-300/25 dark:bg-sky-400/16 dark:text-sky-50 sm:ml-auto">
              Browse
            </span>
          </button>
        ) : (
          <div className="flex w-full max-w-full min-w-0 flex-wrap items-center gap-3 overflow-hidden rounded-xl border border-sky-200/70 bg-card px-3 py-3 dark:border-sky-400/20 sm:flex-nowrap">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-300/20 dark:bg-sky-400/12 dark:text-sky-100">
              {fileTypeIcon}
            </span>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="truncate text-[13px] font-medium text-foreground" style={{ maxWidth: "100%" }} title={file.name}>{file.name.length > 18 ? `${file.name.slice(0, 6)}....${file.name.includes(".") ? "." + (file.name.split(".").pop() || "") : ""}` : file.name}</div>
              <div className="text-[11px] text-muted-foreground">{formatSelectedFileSize(file)}</div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex h-7 items-center rounded-md border border-sky-300/60 bg-sky-100/90 px-2.5 text-[11px] font-medium text-sky-900 transition-none hover:bg-sky-200 dark:border-sky-300/25 dark:bg-sky-400/16 dark:text-sky-50 dark:hover:bg-sky-400/24"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-sky-200/70 bg-sky-50 text-sky-700 transition-none hover:bg-sky-100 hover:text-sky-900 dark:border-sky-400/20 dark:bg-sky-400/12 dark:text-sky-100 dark:hover:bg-sky-400/20"
                aria-label="View file"
                title="View"
              >
                <Eye size={14} />
              </button>
              <button
                type="button"
                onClick={clearSelectedFile}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200/80 bg-rose-50 text-rose-600 transition-none hover:bg-rose-100 hover:text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/12 dark:text-rose-200 dark:hover:bg-rose-500/20"
                aria-label="Delete file"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )}

        {displayError ? <p className="text-danger intake-inline-error">{displayError}</p> : null}
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
              <div className="min-w-0 flex-1 pr-2">
                <div className="truncate text-sm font-semibold text-foreground" style={{ maxWidth: "100%" }} title={file.name}>{file.name.length > 28 ? `${file.name.slice(0, 10)}....${file.name.includes(".") ? "." + (file.name.split(".").pop() || "") : ""}` : file.name}</div>
                <div className="text-[11px] text-muted-foreground">{formatSelectedFileSize(file)}</div>
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground transition-none hover:bg-muted/40 hover:text-foreground"
                onClick={() => setPreviewOpen(false)}
                aria-label="Close preview"
              >
                <X size={14} />
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card/80" style={{ height: 420 }}>
              {isImage ? (
                <img src={previewUrl} alt={file.name} className="h-full w-full object-contain bg-black/5 dark:bg-white/5" />
              ) : isPdf ? (
                <object data={previewUrl} type="application/pdf" className="h-full w-full">
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                    <Upload size={20} className="text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">PDF preview not available</p>
                    <a href={previewUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline underline-offset-4">
                      Open in new tab
                    </a>
                  </div>
                </object>
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
  helperText,
  formError,
  existingAttachment,
  existingAttachmentRemoved,
  onViewExistingAttachment,
  onRemoveExistingAttachment,
  onRetainExistingAttachment,
}: {
  fieldKey: string;
  file: File | null;
  error: string;
  onChange: (key: string, file: File | null) => void;
  helperText?: string;
  formError?: string;
  existingAttachment?: ExistingInvoiceAttachment | null;
  existingAttachmentRemoved?: boolean;
  onViewExistingAttachment?: (attachment: ExistingInvoiceAttachment) => void;
  onRemoveExistingAttachment?: () => void;
  onRetainExistingAttachment?: () => void;
}) {
  return (
    <AttachmentUploadField
      fieldKey={fieldKey}
      file={file}
      error={error}
      onChange={onChange}
      helperText={helperText ?? "PDF, PNG, JPG, or WEBP. Max 10 MB."}
      formError={formError}
      existingAttachment={existingAttachment}
      existingAttachmentRemoved={existingAttachmentRemoved}
      existingAttachmentRequired
      onViewExistingAttachment={onViewExistingAttachment}
      onRemoveExistingAttachment={onRemoveExistingAttachment}
      onRetainExistingAttachment={onRetainExistingAttachment}
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
  existingProductReimbursementAttachment?: ExistingInvoiceAttachment | null;
  productReimbursementAttachmentRemoved?: boolean;
  onViewExistingProductReimbursementAttachment?: (attachment: ExistingInvoiceAttachment) => void;
  onRemoveExistingProductReimbursementAttachment?: () => void;
  onRetainExistingProductReimbursementAttachment?: () => void;
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
  existingProductReimbursementAttachment = null,
  productReimbursementAttachmentRemoved = false,
  onViewExistingProductReimbursementAttachment,
  onRemoveExistingProductReimbursementAttachment,
  onRetainExistingProductReimbursementAttachment,
}: SingleCreatorProps) {
  const gridColumns = showCurrency
    ? "grid gap-x-1 gap-y-2 intake-row-grid-multi-currency md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_76px_minmax(180px,1.25fr)_minmax(112px,0.8fr)_96px]"
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
              <div className={`${gridColumns} intake-row-grid-multi`}>
                <div className="grid min-w-0 gap-1">
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
                <div className="grid min-w-0 gap-1">
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
                <div className="grid min-w-0 gap-1">
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
                <div className="grid min-w-0 gap-1">
                  <input
                    className="intake-input min-w-0"
                    type="number"
                    inputMode="decimal"
                    step="any"
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
                <button className="btn intake-row-action min-w-0" type="button" onClick={() => onRemoveRow(idx)} disabled={rows.length === 1}>
                  Remove
                </button>
              </div>

              {row.deliverable === "Product Reimbursement" ? (
                <div style={{ maxWidth: 420, marginLeft: "auto", width: "100%" }}>
                  <ProductReimbursementField
                    fieldKey={`sc-${idx}`}
                    file={getProductReimbursementFile(`sc-${idx}`)}
                    error={getProductReimbursementError(`sc-${idx}`)}
                    formError={errors[`sc-${idx}`]}
                    onChange={onProductReimbursementFileChange}
                    existingAttachment={existingProductReimbursementAttachment}
                    existingAttachmentRemoved={productReimbursementAttachmentRemoved}
                    onViewExistingAttachment={onViewExistingProductReimbursementAttachment}
                    onRemoveExistingAttachment={onRemoveExistingProductReimbursementAttachment}
                    onRetainExistingAttachment={onRetainExistingProductReimbursementAttachment}
                  />
                </div>
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
  existingProductReimbursementAttachment?: ExistingInvoiceAttachment | null;
  productReimbursementAttachmentRemoved?: boolean;
  onViewExistingProductReimbursementAttachment?: (attachment: ExistingInvoiceAttachment) => void;
  onRemoveExistingProductReimbursementAttachment?: () => void;
  onRetainExistingProductReimbursementAttachment?: () => void;
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
  existingProductReimbursementAttachment = null,
  productReimbursementAttachmentRemoved = false,
  onViewExistingProductReimbursementAttachment,
  onRemoveExistingProductReimbursementAttachment,
  onRetainExistingProductReimbursementAttachment,
}: MultiCreatorProps) {
  const gridColumns = showCurrency
    ? "grid gap-x-1 gap-y-2 intake-row-grid-multi-currency md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_76px_minmax(180px,1.25fr)_minmax(112px,0.8fr)_96px]"
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
              <div className={`${gridColumns} intake-row-grid-multi`}>
                <div className="grid min-w-0 gap-1">
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

                <div className="grid min-w-0 gap-1">
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

                <div className="grid min-w-0 gap-1">
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

                <div className="grid min-w-0 gap-1">
                  <input
                    className="intake-input min-w-0"
                    type="number"
                    inputMode="decimal"
                    step="any"
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

                <button className="btn intake-row-action min-w-0" type="button" onClick={() => onRemoveRow(idx)} disabled={rows.length === 1}>
                  Remove
                </button>
              </div>

              {row.deliverable === "Product Reimbursement" ? (
                <div style={{ maxWidth: 420, marginLeft: "auto", width: "100%" }}>
                  <ProductReimbursementField
                    fieldKey={`mc-${idx}`}
                    file={getProductReimbursementFile(`mc-${idx}`)}
                    error={getProductReimbursementError(`mc-${idx}`)}
                    formError={errors[`mc-${idx}`]}
                    onChange={onProductReimbursementFileChange}
                    existingAttachment={existingProductReimbursementAttachment}
                    existingAttachmentRemoved={productReimbursementAttachmentRemoved}
                    onViewExistingAttachment={onViewExistingProductReimbursementAttachment}
                    onRemoveExistingAttachment={onRemoveExistingProductReimbursementAttachment}
                    onRetainExistingAttachment={onRetainExistingProductReimbursementAttachment}
                  />
                </div>
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
