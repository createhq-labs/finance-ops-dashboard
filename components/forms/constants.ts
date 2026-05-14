import type { MasterBrand, MasterCreator, MasterDeliverable } from "./types";

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

export const MASTER_BRANDS: MasterBrand[] = [
  { name: "Decathlon" },
  { name: "CRED" },
  { name: "Honor" },
  { name: "Nivea" },
  { name: "Headout" },
  { name: "Boat" },
  { name: "Mamaearth" },
  { name: "Noise" },
];

export const MASTER_CREATORS: MasterCreator[] = [
  { name: "Srishti Tehri", brandName: "Nivea" },
  { name: "Vidya Ravishanker", brandName: "Decathlon" },
  { name: "Visha", brandName: "CRED" },
  { name: "Monkey Magic", brandName: "Honor" },
  { name: "Aisha Khan", brandName: "Headout" },
  { name: "Arjun Mehta", brandName: "Boat" },
];

export const MASTER_DELIVERABLES: MasterDeliverable[] = [
  { name: "Instagram Reel Collaboration" },
  { name: "Campaign Activation" },
  { name: "Video Story" },
  { name: "YouTube Integration" },
  { name: "Instagram Story Set" },
  { name: "Usage Rights Extension" },
];

export function getBrandOptions() {
  return MASTER_BRANDS.map((item) => item.name);
}

export function getCreatorOptions() {
  return MASTER_CREATORS.map((item) => item.name);
}

export function getDeliverableOptions() {
  return MASTER_DELIVERABLES.map((item) => item.name);
}

export function getBrandsForCreator(creatorName: string) {
  if (!creatorName) return getBrandOptions();
  const matchingBrands = MASTER_CREATORS.filter((item) => item.name === creatorName).map((item) => item.brandName);
  return matchingBrands.length > 0 ? Array.from(new Set(matchingBrands)) : getBrandOptions();
}
