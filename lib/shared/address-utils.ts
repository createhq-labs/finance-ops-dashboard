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

const CITY_ALIASES: Array<{ name: string; aliases: string[]; state: string }> = [
  { name: "Mumbai", aliases: ["mumbai"], state: "Maharashtra" },
  { name: "Bengaluru", aliases: ["bengaluru", "bangalore"], state: "Karnataka" },
  { name: "Delhi", aliases: ["new delhi", "delhi"], state: "Delhi" },
  { name: "Gurugram", aliases: ["gurugram", "gurgaon"], state: "Haryana" },
  { name: "Hyderabad", aliases: ["hyderabad"], state: "Telangana" },
  { name: "Chennai", aliases: ["chennai"], state: "Tamil Nadu" },
  { name: "Kolkata", aliases: ["kolkata", "calcutta"], state: "West Bengal" },
  { name: "Pune", aliases: ["pune"], state: "Maharashtra" },
  { name: "Ahmedabad", aliases: ["ahmedabad"], state: "Gujarat" },
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

export const PINCODE_CITY_HINTS: Record<string, string[]> = {
  "11": ["Delhi"],
  "12": ["Gurugram", "Gurgaon"],
  "40": ["Mumbai", "Thane", "Navi Mumbai"],
  "41": ["Pune", "Nashik"],
  "42": ["Nashik", "Jalgaon"],
  "43": ["Nagpur", "Amravati"],
  "44": ["Pune", "Kolhapur", "Sangli"],
  "50": ["Hyderabad", "Secunderabad"],
  "56": ["Bengaluru", "Bangalore"],
  "57": ["Mysuru", "Mysore"],
  "60": ["Chennai"],
  "70": ["Kolkata", "Calcutta"],
};

export function normalizeState(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

export function normalizeCity(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function findLastAlias(text: string, aliases: string[]) {
  let bestIndex = -1;
  for (const alias of aliases) {
    const idx = text.lastIndexOf(alias.toLowerCase());
    if (idx > bestIndex) bestIndex = idx;
  }
  return bestIndex;
}

function extractLastPincode(text: string) {
  const matches = [...text.matchAll(/\b(\d{6})\b/g)];
  return matches.length > 0 ? matches[matches.length - 1][1] : "";
}

export function inferAddressData(address: string, clientType: "Indian" | "Foreign") {
  const text = address.trim();
  if (!text) return { city: "", state: "", country: clientType === "Indian" ? "India" : "", pincode: "" };

  const normalized = text.toLowerCase();
  const pincode = extractLastPincode(text);
  const country = clientType === "Indian" || /\bindia\b/i.test(text) || Boolean(pincode) ? "India" : "";

  let state = "";
  let stateIndex = -1;
  for (const entry of INDIAN_STATES) {
    const idx = findLastAlias(normalized, entry.aliases);
    if (idx > stateIndex) {
      stateIndex = idx;
      state = entry.name;
    }
  }

  let city = "";
  let cityIndex = -1;
  for (const entry of CITY_ALIASES) {
    const idx = findLastAlias(normalized, entry.aliases);
    if (idx > cityIndex) {
      cityIndex = idx;
      city = entry.name;
      if (!state || idx > stateIndex) state = entry.state;
    }
  }

  if (!state && /^\d{6}$/.test(pincode)) {
    state = PINCODE_STATE_MAP[pincode.slice(0, 2)] ?? "";
  }

  if (!city && /^\d{6}$/.test(pincode)) {
    city = (PINCODE_CITY_HINTS[pincode.slice(0, 2)] ?? [])[0] ?? "";
  }

  return { city, state, country, pincode };
}

export function hasKnownPincodeLocationMismatch(pincodeRaw: string, cityRaw: string, stateRaw: string) {
  const pincode = pincodeRaw.trim();
  if (!/^\d{6}$/.test(pincode)) return false;

  const prefix = pincode.slice(0, 2);
  const mappedState = PINCODE_STATE_MAP[prefix];
  const normalizedState = normalizeState(stateRaw);
  if (mappedState && normalizedState && normalizedState !== normalizeState(mappedState)) return true;

  const cityHints = PINCODE_CITY_HINTS[prefix] ?? [];
  const normalizedCity = normalizeCity(cityRaw);
  if (cityHints.length > 0 && normalizedCity && !cityHints.some((hint) => normalizedCity.includes(normalizeCity(hint)))) return true;

  return false;
}
