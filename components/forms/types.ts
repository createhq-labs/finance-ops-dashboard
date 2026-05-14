export type BusinessLine = "TM" | "IM";
export type EntryType = "SC" | "MC";

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
  entityType: "Agency" | "Brand";
  agencyBrandName: string;
  agencyBrandTradeName: string;
  gstNumber: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  invoiceType: string;
  billDue: string;
  commission: string;
  reimbursementProof: string;
  additionalInformation: string;
  scCreator: string;
  scBrand: string;
  scDeliverables: DeliverableAmountRow[];
  mcRows: MultiCreatorRow[];
  campaignCode: string;
  campaignBrand: string;
  campaignDeliverable: string;
  campaignNotes: string;
  totalAmount: string;
};

export type InvoiceIntakeSubmissionPayload = {
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
  commercials: number;
  additional_information: string;
  additional_agency_commission: number;
  reimbursement_amount: number;
  reimbursement_receipts: string;
  integration_metadata: {
    business_line: BusinessLine;
    entry_type: EntryType;
    entity_type: "Agency" | "Brand";
    campaign_code: string;
    campaign_notes: string;
  };
  line_items: Array<{
    creator_name: string | null;
    brand_name: string | null;
    deliverable_name: string | null;
    amount: number;
    line_order: number;
  }>;
};
