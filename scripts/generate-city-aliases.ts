import fs from "node:fs";
import path from "node:path";

type CityAliasEntry = {
  name: string;
  aliases: string[];
  state: string;
};

type RawPair = {
  district: string;
  state: string;
};

const INPUT_FILE = path.join(
  process.cwd(),
  "scripts",
  "input",
  "pincode.csv"
);

const OUTPUT_FILE = path.join(
  process.cwd(),
  "lib",
  "shared",
  "generated",
  "city-aliases.ts"
);

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function normalizeWhitespace(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function toDisplayCase(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\b\w/g, (character: string) => character.toUpperCase())
    .replace(/\bAnd\b/g, "and")
    .replace(/\bOf\b/g, "of");
}

function toAlias(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

const knownAliases = new Map<string, string[]>([
  ["bengaluru", ["bangalore"]],
  ["mumbai", ["bombay"]],
  ["kolkata", ["calcutta"]],
  ["gurugram", ["gurgaon"]],
  ["vadodara", ["baroda"]],
  ["kochi", ["cochin"]],
  ["thiruvananthapuram", ["trivandrum"]],
  ["mysuru", ["mysore"]],
  ["nashik", ["nasik"]],
  ["puducherry", ["pondicherry"]],
]);

if (!fs.existsSync(INPUT_FILE)) {
  throw new Error(`Input file not found: ${INPUT_FILE}`);
}

const raw = fs.readFileSync(INPUT_FILE, "utf8").replace(/^\uFEFF/, "");
const lines = raw
  .split(/\r?\n/)
  .filter((line: string) => line.trim());

if (lines.length < 2) {
  throw new Error("CSV contains no data rows.");
}

const headers = parseCsvLine(lines[0]).map(normalizeWhitespace);
const districtIndex = headers.indexOf("District");
const stateIndex = headers.indexOf("StateName");

if (districtIndex === -1 || stateIndex === -1) {
  throw new Error(
    `Required columns not found. Expected District and StateName. Found: ${headers.join(", ")}`
  );
}

const pairMap = new Map<string, RawPair>();
const districtStates = new Map<string, Set<string>>();

for (const line of lines.slice(1)) {
  const columns = parseCsvLine(line);

  const districtRaw = normalizeWhitespace(columns[districtIndex] ?? "");
  const stateRaw = normalizeWhitespace(columns[stateIndex] ?? "");

  if (!districtRaw || !stateRaw) continue;

  const districtKey = districtRaw.toUpperCase();
  const stateKey = stateRaw.toUpperCase();
  const pairKey = `${districtKey}|||${stateKey}`;

  pairMap.set(pairKey, {
    district: districtRaw,
    state: stateRaw,
  });

  const states = districtStates.get(districtKey) ?? new Set<string>();
  states.add(stateKey);
  districtStates.set(districtKey, states);
}

const ambiguousDistricts = new Set(
  [...districtStates.entries()]
    .filter(([, states]) => states.size > 1)
    .map(([district]) => district)
);

const entries: CityAliasEntry[] = [...pairMap.values()]
  .filter(({ district }) => !ambiguousDistricts.has(district.toUpperCase()))
  .map(({ district, state }) => {
    const name = toDisplayCase(district);
    const canonicalAlias = toAlias(district);

    const aliases = Array.from(
      new Set([
        canonicalAlias,
        ...(knownAliases.get(canonicalAlias) ?? []),
      ])
    );

    return {
      name,
      aliases,
      state: toDisplayCase(state),
    };
  })
  .sort((left, right) => {
    const stateCompare = left.state.localeCompare(right.state);
    if (stateCompare !== 0) return stateCompare;
    return left.name.localeCompare(right.name);
  });

const output = `// AUTO-GENERATED FILE.
// Source: scripts/input/pincode.csv
// Run: npx tsx scripts/generate-city-aliases.ts
// Do not edit manually.

export type CityAliasEntry = {
  name: string;
  aliases: string[];
  state: string;
};

export const CITY_ALIASES: CityAliasEntry[] = ${JSON.stringify(
  entries,
  null,
  2
)};
`;

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, output, "utf8");

console.log(`Input rows: ${lines.length - 1}`);
console.log(`Unique district/state pairs: ${pairMap.size}`);
console.log(`Ambiguous district names skipped: ${ambiguousDistricts.size}`);
console.log(`Generated city aliases: ${entries.length}`);
console.log(`Output: ${OUTPUT_FILE}`);