import { getBrandsForCreator, getCreatorOptions, getDeliverableOptions } from "./constants";
import type { DeliverableAmountRow, MultiCreatorRow } from "./types";

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
    <div className="grid gap-1">
      <input
        className="intake-input"
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*"
        style={{ width: "fit-content", maxWidth: 320, minWidth: 220 }}
        onChange={(e) => onChange(fieldKey, e.target.files?.[0] ?? null)}
      />
      <p className="text-muted intake-section-copy" style={{ margin: 0 }}>
        PDF, image, document, or spreadsheet. Ideal size: 5 MB. Hard max: 10 MB.
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
  businessLine: "TM" | "IM";
  scCreator: string;
  scBrand: string;
  rows: DeliverableAmountRow[];
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
  businessLine,
  scCreator,
  scBrand,
  rows,
  getProductReimbursementFile,
  getProductReimbursementError,
  onCreatorChange,
  onBrandChange,
  onAddRow,
  onRemoveRow,
  onRowChange,
  onProductReimbursementFileChange,
}: SingleCreatorProps) {
  const creatorOptions = getCreatorOptions();
  const brandOptions = getBrandsForCreator(scCreator);
  const deliverableOptions = getDeliverableOptions(businessLine);

  return (
    <section className="intake-section">
      <div className="intake-section-header">
        <div>
          <h3 className="intake-section-title">Single Creator</h3>
          <p className="text-muted intake-section-copy">
            Select one creator, a linked brand, and the deliverable rows that should roll into the invoice total.
          </p>
        </div>
      </div>

      <div className="intake-section-body">
        <div className="intake-row-stack">
          {rows.map((row, idx) => (
            <div key={`sc-${idx}`} className="grid gap-2">
              <div className="intake-row-grid intake-row-grid-multi">
                <input
                  className="intake-input"
                  list="creator-options-sc"
                  value={scCreator}
                  onChange={(e) => onCreatorChange(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  placeholder="Select or type creator"
                  disabled={idx > 0}
                />
                <input
                  className="intake-input"
                  list="brand-options-sc"
                  value={scBrand}
                  onChange={(e) => onBrandChange(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  placeholder="Select or type brand"
                  disabled={idx > 0}
                />
                <input
                  className="intake-input"
                  list="deliverable-options-sc"
                  value={row.deliverable}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => onRowChange(idx, { deliverable: e.target.value })}
                  placeholder="Select or type deliverable"
                />
                <input
                  className="intake-input"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Amount INR"
                  value={row.amount}
                  onChange={(e) => onRowChange(idx, { amount: e.target.value })}
                />
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

        <button className="btn" type="button" onClick={onAddRow}>
          + Add Deliverable
        </button>
        <datalist id="deliverable-options-sc">
          {deliverableOptions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
        <datalist id="creator-options-sc">
          {creatorOptions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
        <datalist id="brand-options-sc">
          {brandOptions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </div>
    </section>
  );
}

type MultiCreatorProps = {
  businessLine: "TM" | "IM";
  rows: MultiCreatorRow[];
  getProductReimbursementFile: (key: string) => File | null;
  getProductReimbursementError: (key: string) => string;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  onRowChange: (index: number, patch: Partial<MultiCreatorRow>) => void;
  onProductReimbursementFileChange: (key: string, file: File | null) => void;
};

export function MultiCreatorRows({
  businessLine,
  rows,
  getProductReimbursementFile,
  getProductReimbursementError,
  onAddRow,
  onRemoveRow,
  onRowChange,
  onProductReimbursementFileChange,
}: MultiCreatorProps) {
  const creatorOptions = getCreatorOptions();
  const deliverableOptions = getDeliverableOptions(businessLine);

  return (
    <section className="intake-section">
      <div className="intake-section-header">
        <div>
          <h3 className="intake-section-title">Multiple Creators</h3>
          <p className="text-muted intake-section-copy">Capture each creator, their brand, deliverable, and invoice amount in a separate row.</p>
        </div>
      </div>

      <div className="intake-section-body">
        <div className="intake-row-stack">
          {rows.map((row, idx) => (
            <div key={`mc-${idx}`} className="grid gap-2">
              <div className="intake-row-grid intake-row-grid-multi">
                <input
                  className="intake-input"
                  list="creator-options-mc"
                  value={row.creator}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => onRowChange(idx, { creator: e.target.value })}
                  placeholder="Select or type creator"
                />

                <input
                  className="intake-input"
                  list={`brand-options-mc-${idx}`}
                  value={row.brand}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => onRowChange(idx, { brand: e.target.value })}
                  placeholder="Select or type brand"
                />
                <datalist id={`brand-options-mc-${idx}`}>
                  {getBrandsForCreator(row.creator).map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>

                <input
                  className="intake-input"
                  list="deliverable-options-mc"
                  value={row.deliverable}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => onRowChange(idx, { deliverable: e.target.value })}
                  placeholder="Select or type deliverable"
                />

                <input
                  className="intake-input"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Amount INR"
                  value={row.amount}
                  onChange={(e) => onRowChange(idx, { amount: e.target.value })}
                />

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

        <button className="btn" type="button" onClick={onAddRow}>
          + Add Creator Row
        </button>
        <datalist id="creator-options-mc">
          {creatorOptions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
        <datalist id="deliverable-options-mc">
          {deliverableOptions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </div>
    </section>
  );
}
