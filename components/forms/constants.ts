export const BUSINESS_LINES = [
  { value: "TM", label: "Talent Management" },
  { value: "IM", label: "Influencer Marketing" },
] as const;

export const ENTRY_TYPES = [
  { value: "SC", label: "Single Creator" },
  { value: "MC", label: "Multiple Creators" },
] as const;

export const ENTITY_TYPES = ["Agency", "Brand"] as const;

export const INVOICE_TYPES = [
  "Performa",
  "Reimbursement with GST",
  "Reimbursement without GST",
] as const;

export const BILL_DUE_OPTIONS = [
  "Due on billing",
  "Net 5",
  "Net 10",
  "Net 15",
  "Net 20",
  "Net 25",
  "Net 30",
] as const;

export const MASTER_CREATORS = [
  "Srishti Tehri",
  "Vidya Ravishanker",
  "Visha",
  "Monkey Magic",
] as const;

export const MASTER_BRANDS = [
  "Decathlon",
  "CRED",
  "Honor",
  "Nivea",
  "Headout",
] as const;

export const MASTER_DELIVERABLES = [
  "Instagram Reel Collaboration",
  "Campaign Activation",
  "Video Story",
] as const;
