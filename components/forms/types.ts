export type BusinessLine = "TM" | "IM";
export type EntryType = "SC" | "MC";
export type EntityType = "Agency" | "Brand";
export type SubmissionCurrency = "INR" | "USD" | "EUR" | "GBP" | "AED";

export type MasterBrand = {
  name: string;
};

export type MasterCreator = {
  name: string;
  brandName: string;
};

export type MasterDeliverable = {
  name: string;
};

export type DeliverableAmountRow = {
  deliverable: string;
  amount: string;
};

export type MultiCreatorRow = {
  creator: string;
  brand: string;
  deliverable: string;
  amount: string;
};

export type InvoiceIntakeFormValues = {
  submitterName: string;
  submitterEmail: string;
  businessLine: BusinessLine;
  entryType: EntryType;
  entityType: EntityType;
  clientType: "Indian" | "Foreign";
  agencyBrandName: string;
  agencyBrandTradeName: string;
  billingBrandName: string;
  gstNumber: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  invoiceType: string;
  billDue: string;
  commission: string;
  reimbursementIncluded: "yes" | "no";
  reimbursementAmount: string;
  reimbursementProof: string;
  additionalInformation: string;
  scCreator: string;
  scBrand: string;
  scDeliverables: DeliverableAmountRow[];
  mcRows: MultiCreatorRow[];
  campaignCode: string;
  campaignBrand: string;
  campaignDeliverable: string;
  campaignExtraDeliverables: string[];
  campaignName: string;
  campaignNotes: string;
  imCommercials: string;
  totalAmount: string;
  currency: SubmissionCurrency;
};

export type InvoiceIntakeIntegrationMetadata = {
  submitterName: string;
  businessLine: BusinessLine;
  entryType: EntryType | null;
  entityType: EntityType;
  clientType: "Indian" | "Foreign";
  billingBrandName: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  campaignCode: string;
  campaignName: string;
  campaignBrand: string;
  campaignDeliverable: string;
  campaignNotes: string;
  brandNamesText: string;
  currency: SubmissionCurrency;
};

export type InvoiceIntakeSubmissionPayload = {
  previous_submission_id?: string | null;
  business_line: BusinessLine;
  entry_type: EntryType | null;
  entity_type: EntityType;
  client_type: "Indian" | "Foreign";
  agency_brand_name: string;
  agency_brand_trade_name: string;
  email_address: string;
  gst_number: string;
  address: string;
  bill_due: string;
  invoice_type: string;
  deliverables: string;
  creator_creators_name: string;
  brand_name: string;
  campaign_code: string;
  campaign_name: string;
  campaign_brand: string;
  campaign_notes: string;
  brand_names_text: string;
  currency: SubmissionCurrency;
  commercials: number;
  additional_information: string;
  additional_agency_commission: number;
  reimbursement_amount: number;
  reimbursement_receipts: string;
  line_items: Array<{
    creator_name: string | null;
    brand_name: string | null;
    deliverable_name: string | null;
    amount: number;
    line_order: number;
  }>;
};


export type InvoiceIntakeFormSubmitInput = {
  payload: InvoiceIntakeSubmissionPayload;
  files?: {
    productReimbursementFile?: File | null;
    referencePoFile?: File | null;
  };
};
