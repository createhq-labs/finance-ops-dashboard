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

export const AGENCY_NAME_OPTIONS = [
  "Barcode Influencer",
  "TIST Media",
  "Momentum Communication",
] as const;

export const AGENCY_TRADE_NAME_OPTIONS = [
  "Barcode Influencer Marketing Private Limited",
  "TIST Media Private Limited",
  "Momentum Communications (India) Private Limited",
] as const;

export const BRAND_NAME_OPTIONS = [
  "Virgio",
  "Angel One",
  "Ferns N Petals",
  "Lenskart",
  "Decathlon",
  "CRED",
  "Honor",
  "Nivea",
  "Headout",
  "Boat",
  "Mamaearth",
  "Noise",
] as const;

export const BRAND_TRADE_NAME_OPTIONS = [
  "Angel One Limited",
  "FNP E Retail Private Limited",
  "Lenskart Solutions Limited",
  "Honasa Consumer Limited",
  "Dreamplug Technologies Private Limited",
  "Decathlon Sports India Private Limited",
  "PSAV Global Marketing (India) Private Limited",
  "NIVEA India Pvt Ltd",
  "Imagine Marketing Limited",
  "Nexxbase Marketing Private Limited",
] as const;

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

const IM_DELIVERABLES = [
  "Campaign Activation",
  "Ads / Usage Rights",
  "Offline Campaign Activation",
  "Online / Offline Session",
  "Service Charged Against Campaign",
  "Video Deliverables",
  "Product Reimbursement",
  "Exclusivity Fee",
] as const;

export function getBrandOptions() {
  return MASTER_BRANDS.map((item) => item.name);
}

export function getCreatorOptions() {
  return MASTER_CREATORS.map((item) => item.name);
}

export function getAgencyOptions() {
  return [...AGENCY_NAME_OPTIONS];
}

export function getAgencyTradeNameOptions() {
  return [...AGENCY_TRADE_NAME_OPTIONS];
}

export function getBrandTradeNameOptions() {
  return [...BRAND_TRADE_NAME_OPTIONS];
}

export function getEntityNameOptions(entityType: "Agency" | "Brand") {
  return entityType === "Agency" ? [...AGENCY_NAME_OPTIONS] : [...BRAND_NAME_OPTIONS];
}

export function getDeliverableOptions(businessLine?: "TM" | "IM") {
  if (businessLine === "TM") return MASTER_DELIVERABLES.map((item) => item.name);
  if (businessLine === "IM") return [...IM_DELIVERABLES];
  return MASTER_DELIVERABLES.map((item) => item.name);
}

const LEGAL_TRADE_NAME_MAP: Record<string, string> = {
  "barcode influencer": "Barcode Influencer Marketing Private Limited",
  "tist media": "TIST Media Private Limited",
  "momentum communication": "Momentum Communications (India) Private Limited",
  "angel one": "Angel One Limited",
  "ferns n petals": "FNP E Retail Private Limited",
  lenskart: "Lenskart Solutions Limited",
  mamaearth: "Honasa Consumer Limited",
  cred: "Dreamplug Technologies Private Limited",
  decathlon: "Decathlon Sports India Private Limited",
  honor: "PSAV Global Marketing (India) Private Limited",
  nivea: "NIVEA India Pvt Ltd",
  boat: "Imagine Marketing Limited",
  noise: "Nexxbase Marketing Private Limited",
};

export function getMappedTradeName(name: string) {
  const key = name.trim().toLowerCase();
  return LEGAL_TRADE_NAME_MAP[key] ?? null;
}

export function getTradeNameOptions(entityType: "Agency" | "Brand") {
  return getEntityNameOptions(entityType)
    .map((item) => getMappedTradeName(item))
    .filter((item): item is string => Boolean(item));
}

export type FormDropdownMasterData = {
  agencies: Array<{ name: string; tradeName: string }>;
  brands: Array<{ name: string; tradeName: string }>;
  creators: Array<{ name: string; linkedBrandName: string }>;
  deliverables: {
    TM: string[];
    IM: string[];
  };
};

export function getFallbackMasterData(): FormDropdownMasterData {
  return {
    agencies: AGENCY_NAME_OPTIONS.map((name) => ({
      name,
      tradeName: getMappedTradeName(name) ?? "",
    })),
    brands: BRAND_NAME_OPTIONS.map((name) => ({
      name,
      tradeName: getMappedTradeName(name) ?? "",
    })),
    creators: MASTER_CREATORS.map((creator) => ({
      name: creator.name,
      linkedBrandName: creator.brandName,
    })),
    deliverables: {
      TM: getDeliverableOptions("TM"),
      IM: getDeliverableOptions("IM"),
    },
  };
}
