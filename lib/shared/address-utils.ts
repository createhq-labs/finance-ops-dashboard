import { CITY_ALIASES } from "./generated/city-aliases";

const INDIAN_STATES: Array<{ name: string; aliases: string[] }> = [
  { name: "Delhi", aliases: ["delhi", "new delhi"] },
  { name: "Haryana", aliases: ["haryana"] },
  { name: "Punjab", aliases: ["punjab"] },
  { name: "Uttar Pradesh", aliases: ["uttar pradesh"] },
  { name: "Madhya Pradesh", aliases: ["madhya pradesh"] },
  { name: "Rajasthan", aliases: ["rajasthan"] },
  { name: "Gujarat", aliases: ["gujarat"] },
  { name: "Maharashtra", aliases: ["maharashtra"] },
  { name: "Telangana", aliases: ["telangana"] },
  { name: "Karnataka", aliases: ["karnataka"] },
  { name: "Tamil Nadu", aliases: ["tamil nadu"] },
  { name: "West Bengal", aliases: ["west bengal"] },
  { name: "Odisha", aliases: ["odisha", "orissa"] },
  { name: "Bihar", aliases: ["bihar"] },
];

export const PINCODE_STATE_MAP: Record<string, string> = {
  "11": "Delhi",
  "12": "Haryana",
  "14": "Punjab",
  "20": "Uttar Pradesh",
  "22": "Uttar Pradesh",
  "24": "Uttar Pradesh",
  "28": "Madhya Pradesh",
  "30": "Rajasthan",
  "32": "Rajasthan",
  "36": "Gujarat",
  "38": "Gujarat",
  "40": "Maharashtra",
  "41": "Maharashtra",
  "42": "Maharashtra",
  "43": "Maharashtra",
  "44": "Maharashtra",
  "45": "Madhya Pradesh",
  "50": "Telangana",
  "56": "Karnataka",
  "57": "Karnataka",
  "60": "Tamil Nadu",
  "70": "West Bengal",
  "75": "Odisha",
  "80": "Bihar",
};

export function normalizeState(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

export type AliasMatch = { index: number; length: number };

/**
 * Compares two alias matches by position first (later occurrence in the
 * address wins), then by matched alias length (a longer, more specific
 * alias wins over a shorter one that starts at the same position, e.g.
 * "south goa" over "south"). Equal on both counts: keep the current match.
 *
 * Exported for focused testing: the real INDIAN_STATES/CITY_ALIASES datasets
 * have no naturally occurring case where a state alias and a city alias tie
 * at the same index, so the equal-index tie between a city and state match
 * (see inferAddressData's state-override step) can only be regression-tested
 * at this helper level.
 */
export function isMoreSpecificAliasMatch(candidate: AliasMatch, current: AliasMatch) {
  if (candidate.index > current.index) return true;
  if (candidate.index === current.index) return candidate.length > current.length;
  return false;
}

function findBestAliasMatch(text: string, aliases: string[]): AliasMatch | null {
  let best: AliasMatch | null = null;
  for (const alias of aliases) {
    const normalizedAlias = alias.toLowerCase();
    const index = text.lastIndexOf(normalizedAlias);
    if (index === -1) continue;
    const candidate: AliasMatch = { index, length: normalizedAlias.length };
    if (!best || isMoreSpecificAliasMatch(candidate, best)) best = candidate;
  }
  return best;
}

function extractLastPincode(text: string) {
  const matches = [...text.matchAll(/\b(\d{6})\b/g)];
  return matches.length > 0 ? matches[matches.length - 1][1] : "";
}

function cleanAddressComponent(value: string | null | undefined) {
  return String(value ?? "").trim().replace(/\s+/g, " ").replace(/^"+|"+$/g, "");
}

function normalizeAddressPart(value: string) {
  return cleanAddressComponent(value).toLowerCase();
}

function looksLikePostalCode(value: string, clientType: "Indian" | "Foreign") {
  const text = cleanAddressComponent(value);
  if (!text) return false;
  if (clientType === "Indian") return /^\d{6}$/.test(text);
  return /\d/.test(text) && /^[a-zA-Z0-9][a-zA-Z0-9\s-]{1,14}$/.test(text);
}

function readTrailingLocationGroup(commaParts: string[], clientType: "Indian" | "Foreign") {
  if (commaParts.length < 4) return null;

  const lastPart = commaParts[commaParts.length - 1] ?? "";
  const hasPostalCode = looksLikePostalCode(lastPart, clientType);
  const groupSize = hasPostalCode ? 4 : 3;
  if (commaParts.length <= groupSize) return null;

  const start = commaParts.length - groupSize;
  const groupParts = commaParts.slice(start);
  if (groupParts.some((part) => !part)) return null;

  return {
    start,
    groupSize,
    city: groupParts[0] ?? "",
    state: groupParts[1] ?? "",
    country: groupParts[2] ?? "",
    pincode: hasPostalCode ? groupParts[3] ?? "" : "",
    groupParts,
  };
}

function findFirstRepeatedTrailingGroupStart(commaParts: string[], groupStart: number, groupParts: string[]) {
  const normalizedGroup = groupParts.map(normalizeAddressPart);
  let firstStart = groupStart;
  let candidateStart = groupStart - groupParts.length;

  while (candidateStart >= 0) {
    const candidate = commaParts.slice(candidateStart, candidateStart + groupParts.length).map(normalizeAddressPart);
    const isSameGroup = normalizedGroup.every((part, index) => part === candidate[index]);
    if (!isSameGroup) break;
    firstStart = candidateStart;
    candidateStart -= groupParts.length;
  }

  return firstStart;
}

export type BillingAddressParts = {
  addressLine: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
};

export function serializeBillingAddress(parts: BillingAddressParts) {
  return String(parts.addressLine ?? "");
}

export function parseBillingAddress(address: string | null | undefined, clientType: "Indian" | "Foreign"): BillingAddressParts {
  const originalAddress = String(address ?? "");
  const normalizedAddress = cleanAddressComponent(originalAddress);
  if (!normalizedAddress) {
    return { addressLine: "", city: "", state: "", country: "", pincode: "" };
  }

  const commaParts = normalizedAddress
    .split(",")
    .map(cleanAddressComponent)
    .filter(Boolean);

  const trailingLocation = readTrailingLocationGroup(commaParts, clientType);
  if (trailingLocation) {
    const addressEnd = findFirstRepeatedTrailingGroupStart(
      commaParts,
      trailingLocation.start,
      trailingLocation.groupParts
    );
    const addressLine = commaParts.slice(0, addressEnd).join(", ");
    if (addressLine) {
      return {
        addressLine: originalAddress,
        city: trailingLocation.city,
        state: trailingLocation.state,
        country: trailingLocation.country,
        pincode: trailingLocation.pincode,
      };
    }
  }

  if (clientType === "Foreign" && commaParts.length === 4 && !commaParts[3]?.match(/\d/)) {
    return {
      addressLine: originalAddress,
      city: commaParts[1] ?? "",
      state: commaParts[2] ?? "",
      country: commaParts[3] ?? "",
      pincode: "",
    };
  }

  return {
    addressLine: originalAddress,
    city: "",
    state: "",
    country: "",
    pincode: "",
  };
}

export function inferAddressData(address: string, clientType: "Indian" | "Foreign") {
  const text = address.trim();
  if (!text) return { city: "", state: "", country: clientType === "Indian" ? "India" : "", pincode: "" };

  const normalized = text.toLowerCase();
  const pincode = clientType === "Indian" ? extractLastPincode(text) : "";
  const country = clientType === "Indian" || /\bindia\b/i.test(text) ? "India" : "";

  let state = "";
  let stateMatch: AliasMatch | null = null;
  for (const entry of INDIAN_STATES) {
    const match = findBestAliasMatch(normalized, entry.aliases);
    if (match && (!stateMatch || isMoreSpecificAliasMatch(match, stateMatch))) {
      stateMatch = match;
      state = entry.name;
    }
  }

  let city = "";
  let cityMatch: AliasMatch | null = null;
  for (const entry of CITY_ALIASES) {
    const match = findBestAliasMatch(normalized, entry.aliases);
    if (match && (!cityMatch || isMoreSpecificAliasMatch(match, cityMatch))) {
      cityMatch = match;
      city = entry.name;
      if (!stateMatch || isMoreSpecificAliasMatch(match, stateMatch)) state = entry.state;
    }
  }

  if (!state && /^\d{6}$/.test(pincode)) {
    state = PINCODE_STATE_MAP[pincode.slice(0, 2)] ?? "";
  }

  return { city, state, country, pincode };
}

export type VerifiedPincodeLookup = { pincode: string; state: string } | null;

/**
 * Blocking pincode/state mismatch check backed only by a verified lookup
 * (a successful /api/pincode response), never the coarse 2-digit
 * PINCODE_STATE_MAP — a 2-digit prefix cannot uniquely identify every
 * Indian state/UT, so it must never be authoritative for blocking
 * validation. No verified lookup, a lookup for a different pincode, or an
 * empty selected state are all treated as unverified, not a mismatch.
 */
export function hasVerifiedPincodeStateMismatch(
  verified: VerifiedPincodeLookup,
  pincodeRaw: string,
  stateRaw: string
) {
  if (!verified) return false;

  const pincode = pincodeRaw.trim();
  if (verified.pincode !== pincode) return false;

  const state = stateRaw.trim();
  if (!state) return false;

  return normalizeState(verified.state) !== normalizeState(state);
}
