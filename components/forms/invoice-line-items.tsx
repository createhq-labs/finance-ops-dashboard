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
            <input className="intake-input" list="creator-options-sc" value={scCreator} onChange={(e) => onCreatorChange(e.target.value)} placeholder="Select or type creator" />
            <datalist id="creator-options-sc">
              {creatorOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>

          <label className="intake-field">
            <span className="intake-label">Brand Name</span>
            <input className="intake-input" list="brand-options-sc" value={scBrand} onChange={(e) => onBrandChange(e.target.value)} placeholder="Select or type brand" />
            <datalist id="brand-options-sc">
              {brandOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>
        </div>

        <div className="intake-row-stack">
          {rows.map((row, idx) => (
            <div key={`sc-${idx}`} className="intake-row-grid">
              <input
                className="intake-input"
                list="deliverable-options-sc"
                value={row.deliverable}
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
              <input
                className="intake-input"
                list="creator-options-mc"
                value={row.creator}
                onChange={(e) => onRowChange(idx, { creator: e.target.value })}
                placeholder="Select or type creator"
              />

              <input
                className="intake-input"
                list={`brand-options-mc-${idx}`}
                value={row.brand}
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
