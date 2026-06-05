import type { DeliverableAmountRow, MultiCreatorRow } from "./types";
import { SearchableSelect } from "./searchable-select";

function ProductReimbursementField({
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
    <div className="grid gap-1" style={{ maxWidth: 320 }}>
      <input
        className="intake-input"
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*"
        style={{ width: "fit-content", maxWidth: 280, minWidth: 220 }}
        onChange={(e) => onChange(fieldKey, e.target.files?.[0] ?? null)}
      />
      <p className="text-muted intake-section-copy" style={{ margin: 0 }}>
        PDF, image, document, or spreadsheet. Max 10 MB.
      </p>
      {error ? <p className="text-danger intake-inline-error">{error}</p> : null}
      {file ? (
        <p className="text-muted intake-section-copy" style={{ margin: 0 }}>
          {file.name}
        </p>
      ) : null}
    </div>
  );
}

type SingleCreatorProps = {
  scCreator: string;
  scBrand: string;
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
};

export function SingleCreatorRows({
  scCreator,
  scBrand,
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
}: SingleCreatorProps) {
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
              <div className="intake-row-grid intake-row-grid-multi">
                <div className="grid gap-1">
                  <SearchableSelect
                    value={scCreator}
                    options={creatorOptions}
                    allowCustom
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
                    onChange={onBrandChange}
                    placeholder="Select brand"
                    disabled={idx > 0}
                    data-field="scBrand"
                  />
                  <div style={{ minHeight: 16 }}>
                    {idx === 0 && errors.scBrand ? <p className="text-danger intake-inline-error">{errors.scBrand}</p> : null}
                  </div>
                </div>
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
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Amount INR"
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
};

export function MultiCreatorRows({
  rows,
  errors = {},
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
}: MultiCreatorProps) {
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
              <div className="intake-row-grid intake-row-grid-multi">
                <div className="grid gap-1">
                  <SearchableSelect
                    value={row.creator}
                    options={creatorOptions}
                    allowCustom
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
                    onChange={(next) => onRowChange(idx, { brand: next })}
                    placeholder="Select brand"
                    disabled={idx > 0}
                    data-field={`mcRows.${idx}.brand`}
                  />
                  <div style={{ minHeight: 16 }}>
                    {errors[`mcRows.${idx}.brand`] ? <p className="text-danger intake-inline-error">{errors[`mcRows.${idx}.brand`]}</p> : null}
                  </div>
                </div>

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
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Amount INR"
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
