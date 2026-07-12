import { MultiCreatorRows, ProductReimbursementField, SingleCreatorRows } from "../invoice-line-items";
import { SearchableSelect } from "../searchable-select";
import type { InvoiceIntakeFormValues } from "../types";
import { CURRENCY_OPTIONS, CURRENCY_SEARCH_TEXT_BY_OPTION } from "../../../lib/shared/currency";

type Props = {
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
};

function CurrencyField({
  currency,
  onCurrencyChange,
}: {
  currency: string;
  onCurrencyChange: (next: string) => void;
}) {
  return (
    <label className="intake-field" style={{ width: 160, maxWidth: '100%' }}>
      <span className="intake-label">Currency *</span>
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

export function CreatorDeliverablesSection({
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
  addImDeliverable,
  removeImDeliverable,
  patchImDeliverable,
  onPatchScCreator,
  onPatchMcCreator,
  getProductReimbursementFile,
  getProductReimbursementError,
  onProductReimbursementFileChange,
}: Props) {
  const showCurrency = values.clientType === "Foreign";

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
          .campaign-extra-grid {
            display: grid;
            gap: 12px;
            grid-template-columns: repeat(1, minmax(0, 1fr));
            align-items: start;
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
              grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
            }
            .campaign-grid-foreign {
              grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 160px minmax(0, 1fr);
            }
            .campaign-extra-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }
        `}</style>
        <div className={showCurrency ? "campaign-grid-foreign" : "campaign-grid"}>
          <label className="intake-field">
            <span className="intake-label">Campaign Code *</span>
            <input className="intake-input" value={values.campaignCode} onChange={(e) => onChange("campaignCode", e.target.value)} data-field="campaignCode" autoComplete="off" />
            <div style={{ minHeight: 16 }}>
              {errors.campaignCode ? <p className="text-danger intake-inline-error">{errors.campaignCode}</p> : null}
            </div>
          </label>

          <label className="intake-field">
            <span className="intake-label">Campaign Name *</span>
            <input className="intake-input" value={values.campaignName} onChange={(e) => onChange("campaignName", e.target.value)} data-field="campaignName" autoComplete="off" />
            <div style={{ minHeight: 16 }}>
              {errors.campaignName ? <p className="text-danger intake-inline-error">{errors.campaignName}</p> : null}
            </div>
          </label>

          <label className="intake-field">
            <span className="intake-label">Campaign Brand *</span>
            <SearchableSelect value={values.campaignBrand} options={brandOptions} allowCustom panelMaxHeight={160} onChange={(next) => onChange("campaignBrand", next)} placeholder="Select brand" data-field="campaignBrand" />
            <div style={{ minHeight: 16 }}>
              {errors.campaignBrand ? <p className="text-danger intake-inline-error">{errors.campaignBrand}</p> : null}
            </div>
          </label>

          {showCurrency ? (
            <div className="intake-field">
              <CurrencyField currency={values.currency} onCurrencyChange={(next) => onChange("currency", next as InvoiceIntakeFormValues["currency"])} />
            </div>
          ) : null}

          <label className="intake-field">
            <span className="intake-label">Deliverable *</span>
            <SearchableSelect
              value={values.campaignDeliverable}
              options={deliverableOptions.IM}
              onChange={(next) => onChange("campaignDeliverable", next)}
              placeholder="Select deliverable"
              data-field="campaignDeliverable"
            />
            <div style={{ minHeight: 16 }}>
              {errors.campaignDeliverable ? <p className="text-danger intake-inline-error">{errors.campaignDeliverable}</p> : null}
            </div>
            {values.campaignDeliverable === "Product Reimbursement" ? (
              <div style={{ marginTop: 6 }}>
                <ProductReimbursementField
                  fieldKey="campaign-0"
                  file={getProductReimbursementFile("campaign-0")}
                  error={getProductReimbursementError("campaign-0")}
                  onChange={onProductReimbursementFileChange}
                />
              </div>
            ) : null}
          </label>
        </div>

        {values.campaignExtraDeliverables.length ? (
          <div className="campaign-extra-grid">
            {values.campaignExtraDeliverables.map((deliverable, index) => (
              <div key={`im-deliverable-${index}`} className="grid gap-2">
                <label className="intake-field">
                  <span className="intake-label">Additional Deliverable *</span>
                  <SearchableSelect
                    value={deliverable}
                    options={deliverableOptions.IM}
                    onChange={(next) => patchImDeliverable(index, next)}
                    placeholder="Select deliverable"
                    data-field={`campaignExtraDeliverables.${index}`}
                  />
                  <div style={{ minHeight: 16 }}>
                    {errors[`campaignExtraDeliverables.${index}`] ? <p className="text-danger intake-inline-error">{errors[`campaignExtraDeliverables.${index}`]}</p> : null}
                  </div>
                </label>
                <button className="btn intake-row-action" type="button" onClick={() => removeImDeliverable(index)} style={{ width: "fit-content" }}>
                  Remove
                </button>
                {deliverable === "Product Reimbursement" ? (
                  <ProductReimbursementField
                    fieldKey={`campaign-${index + 1}`}
                    file={getProductReimbursementFile(`campaign-${index + 1}`)}
                    error={getProductReimbursementError(`campaign-${index + 1}`)}
                    onChange={onProductReimbursementFileChange}
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div>
          <button className="btn" type="button" onClick={addImDeliverable}>
            + Add Deliverable
          </button>
          <div style={{ minHeight: 16, marginTop: 6 }}>
            {errors.creatorDeliverables ? <p className="text-danger intake-inline-error">{errors.creatorDeliverables}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
