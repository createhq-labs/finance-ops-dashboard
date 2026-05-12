import { getBrandsForCreator, getCreatorOptions, getDeliverableOptions } from "./constants";
import type { DeliverableAmountRow, MultiCreatorRow } from "./types";

type SingleCreatorProps = {
  scCreator: string;
  scBrand: string;
  rows: DeliverableAmountRow[];
  onCreatorChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  onRowChange: (index: number, patch: Partial<DeliverableAmountRow>) => void;
};

export function SingleCreatorRows({
  scCreator,
  scBrand,
  rows,
  onCreatorChange,
  onBrandChange,
  onAddRow,
  onRemoveRow,
  onRowChange,
}: SingleCreatorProps) {
  const creatorOptions = getCreatorOptions();
  const brandOptions = getBrandsForCreator(scCreator);
  const deliverableOptions = getDeliverableOptions();

  return (
    <section className="intake-section">
      <div className="intake-section-header">
        <div>
          <h3 className="intake-section-title">Single Creator</h3>
          <p className="text-muted intake-section-copy">Select one creator, a linked brand, and the deliverable rows that should roll into the invoice total.</p>
        </div>
      </div>

      <div className="intake-section-body">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="intake-field">
            <span className="intake-label">Creator Name</span>
            <select className="intake-input" value={scCreator} onChange={(e) => onCreatorChange(e.target.value)}>
              <option value="">Select creator</option>
              {creatorOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="intake-field">
            <span className="intake-label">Brand Name</span>
            <select className="intake-input" value={scBrand} onChange={(e) => onBrandChange(e.target.value)}>
              <option value="">Select brand</option>
              {brandOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="intake-row-stack">
          {rows.map((row, idx) => (
            <div key={`sc-${idx}`} className="intake-row-grid">
              <select className="intake-input" value={row.deliverable} onChange={(e) => onRowChange(idx, { deliverable: e.target.value })}>
                <option value="">Select deliverable</option>
                {deliverableOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

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
          ))}
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
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  onRowChange: (index: number, patch: Partial<MultiCreatorRow>) => void;
};

export function MultiCreatorRows({ rows, onAddRow, onRemoveRow, onRowChange }: MultiCreatorProps) {
  const creatorOptions = getCreatorOptions();
  const deliverableOptions = getDeliverableOptions();

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
            <div key={`mc-${idx}`} className="intake-row-grid intake-row-grid-multi">
              <select className="intake-input" value={row.creator} onChange={(e) => onRowChange(idx, { creator: e.target.value })}>
                <option value="">Select creator</option>
                {creatorOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select className="intake-input" value={row.brand} onChange={(e) => onRowChange(idx, { brand: e.target.value })}>
                <option value="">Select brand</option>
                {getBrandsForCreator(row.creator).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select className="intake-input" value={row.deliverable} onChange={(e) => onRowChange(idx, { deliverable: e.target.value })}>
                <option value="">Select deliverable</option>
                {deliverableOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

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
          ))}
        </div>

        <button className="btn" type="button" onClick={onAddRow}>
          + Add Creator Row
        </button>
      </div>
    </section>
  );
}
