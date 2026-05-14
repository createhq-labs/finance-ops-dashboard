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
  "Proforma Invoice & Tax Invoice",
  "Reimbursement Invoice (With GST)",
  "Reimbursement Invoice (Without GST)",
] as const;

export const BILL_DUE_OPTIONS = [
  "Due on receipt",
  "Net 5",
  "Net 10",
  "Net 15",
  "Net 20",
  "Net 30",
  "Net 45",
  "Net 60",
  "Due end of month",
  "Due end of next month",
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
  { name: "Instagram Story Collaboration" },
  { name: "Instagram Posts Collaboration" },
  { name: "Instagram IP Creation" },
  { name: "Ads/Usage Rights" },
  { name: "Campaign Activation" },
  { name: "Youtube Long Form Collaboration" },
  { name: "Youtube Shorts Collaboration" },
  { name: "Youtube Podcast Collaboration" },
  { name: "Youtube Community Post Collaboration" },
  { name: "Youtube Comment Collaboration" },
  { name: "Youtube IP Creation Long Form" },
  { name: "Youtube IP Creation Short Form" },
  { name: "Offline Campaign Activation" },
  { name: "Online / Offline Session" },
  { name: "Platform's Clubbed Collaboration" },
  { name: "Service Charged Against Brand Deal" },
  { name: "Service Charged Against Campaign" },
  { name: "Twitter Tweet Collaboration" },
  { name: "Twitter Retweet Collaboration" },
  { name: "Twitter Comment Collaboration" },
  { name: "LinkedIn Post Collaboration" },
  { name: "LinkedIn Reshare Collaboration" },
  { name: "Twitter Spaces Collaboration" },
  { name: "LinkedIn Comment Collaboration" },
  { name: "Video Deliverables" },
  { name: "Product Reimbursement" },
  { name: "Exclusivity Fee" },
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
