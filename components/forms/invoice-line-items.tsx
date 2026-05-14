import { MASTER_BRANDS, MASTER_CREATORS, MASTER_DELIVERABLES } from "./constants";
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
  return (
    <section className="surface p-4">
      <h3 className="mb-3 text-lg font-semibold">Single Creator</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>Creator</span>
          <select className="rounded-md border border-app bg-app px-3 py-2" value={scCreator} onChange={(e) => onCreatorChange(e.target.value)}>
            <option value="">Select</option>
            {MASTER_CREATORS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>Brand</span>
          <select className="rounded-md border border-app bg-app px-3 py-2" value={scBrand} onChange={(e) => onBrandChange(e.target.value)}>
            <option value="">Select</option>
            {MASTER_BRANDS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-2">
        {rows.map((row, idx) => (
          <div key={`sc-${idx}`} className="grid gap-2 md:grid-cols-[1fr_180px_120px]">
            <select
              className="rounded-md border border-app bg-app px-3 py-2 text-sm"
              value={row.deliverable}
              onChange={(e) => onRowChange(idx, { deliverable: e.target.value })}
            >
              <option value="">Select deliverable</option>
              {MASTER_DELIVERABLES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              className="rounded-md border border-app bg-app px-3 py-2 text-sm"
              type="number"
              min={0}
              step="0.01"
              placeholder="Amount ₹"
              value={row.amount}
              onChange={(e) => onRowChange(idx, { amount: e.target.value })}
            />
            <button className="btn" type="button" onClick={() => onRemoveRow(idx)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <button className="btn mt-3" type="button" onClick={onAddRow}>
        + Add Deliverable
      </button>
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
  return (
    <section className="surface p-4">
      <h3 className="text-lg font-semibold">Multiple Creators</h3>
      <p className="text-muted mb-3 text-sm">Each creator row includes amount</p>

      <div className="grid gap-2">
        {rows.map((row, idx) => (
          <div key={`mc-${idx}`} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_180px_120px]">
            <select
              className="rounded-md border border-app bg-app px-3 py-2 text-sm"
              value={row.creator}
              onChange={(e) => onRowChange(idx, { creator: e.target.value })}
            >
              <option value="">Select</option>
              {MASTER_CREATORS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-app bg-app px-3 py-2 text-sm"
              value={row.brand}
              onChange={(e) => onRowChange(idx, { brand: e.target.value })}
            >
              <option value="">Select</option>
              {MASTER_BRANDS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-app bg-app px-3 py-2 text-sm"
              value={row.deliverable}
              onChange={(e) => onRowChange(idx, { deliverable: e.target.value })}
            >
              <option value="">Select</option>
              {MASTER_DELIVERABLES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              className="rounded-md border border-app bg-app px-3 py-2 text-sm"
              type="number"
              min={0}
              step="0.01"
              placeholder="Amount ₹"
              value={row.amount}
              onChange={(e) => onRowChange(idx, { amount: e.target.value })}
            />
            <button className="btn" type="button" onClick={() => onRemoveRow(idx)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <button className="btn mt-3" type="button" onClick={onAddRow}>
        + Add Creator Row
      </button>
    </section>
  );
}
