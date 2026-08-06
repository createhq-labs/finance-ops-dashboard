import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
// Resolved from lib/shared/, not scripts/, so the compiled module's relative
// import of "./generated/city-aliases" resolves correctly.
const require = createRequire(join(rootDir, 'lib/shared/address-utils.ts'));
const ts = require('typescript');

// address-utils.ts imports "./generated/city-aliases" (a .ts file); teach the
// CJS loader to transpile .ts on demand so that nested require resolves.
require.extensions['.ts'] = (mod, filename) => {
  const tsSource = readFileSync(filename, 'utf8');
  const tsCompiled = ts.transpileModule(tsSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  mod._compile(tsCompiled, filename);
};

const source = readFileSync(join(rootDir, 'lib/shared/address-utils.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, require, console });

const { inferAddressData, isMoreSpecificAliasMatch } = module.exports;

// Focused regression coverage for the alias tie-break rule in inferAddressData:
// when two aliases from different entries match at the same index, the
// longer (more specific) alias must win, regardless of array order.
const cases = [
  {
    name: 'South Goa: bare "south" (Delhi) must lose to "south goa" (Goa)',
    input: 'Plot No. N-6, PH-IV, Verna Industrial Estate, South Goa, Goa 403722, India',
    clientType: 'Indian',
    expected: { city: 'South Goa', state: 'Goa', country: 'India', pincode: '403722' },
  },
  {
    name: 'North Goa: bare "north" (Delhi) must lose to "north goa" (Goa)',
    input: 'H.No. 45, Near Mapusa Market, North Goa, Goa 403507, India',
    clientType: 'Indian',
    expected: { city: 'North Goa', state: 'Goa', country: 'India', pincode: '403507' },
  },
  {
    name: 'New Delhi: multi-word alias resolves city and state correctly',
    input: '221B Baker Street, New Delhi, India, 110001',
    clientType: 'Indian',
    expected: { city: 'New Delhi', state: 'Delhi', country: 'India', pincode: '110001' },
  },
  {
    name: 'South Delhi: bare "south" alias with no longer competitor resolves to Delhi',
    input: 'Saket District Centre, South Delhi, India, 110017',
    clientType: 'Indian',
    expected: { city: 'South', state: 'Delhi', country: 'India', pincode: '110017' },
  },
  {
    name: 'East Godavari: longer alias appears earlier in the dataset than the competing bare "east" (Delhi) alias — must still win',
    input: 'Main Road, Kakinada, East Godavari, India, 533001',
    clientType: 'Indian',
    expected: { city: 'East Godavari', state: 'Andhra Pradesh', country: 'India', pincode: '533001' },
  },
  {
    name: 'non-overlapping existing behavior is unchanged',
    input: '179/1B Lenin Sarani, Kolkata, India, 700013',
    clientType: 'Indian',
    expected: { city: 'Kolkata', state: 'West Bengal', country: 'India', pincode: '700013' },
  },
];

for (const testCase of cases) {
  const result = inferAddressData(testCase.input, testCase.clientType);
  assert.equal(JSON.stringify(result), JSON.stringify(testCase.expected), testCase.name);
}

// Regression coverage for the city-vs-state equal-index tie in inferAddressData's
// state-override step (`if (!stateMatch || isMoreSpecificAliasMatch(match, stateMatch))`).
// The real INDIAN_STATES/CITY_ALIASES datasets have no naturally occurring case where a
// state alias and a city alias start at the same index, so this is exercised directly
// against the exported comparator rather than through inferAddressData.
const equalIndexTieCases = [
  {
    name: 'equal index, city alias longer than state alias: city must win',
    candidate: { index: 10, length: 9 }, // e.g. a city match like "south goa"
    current: { index: 10, length: 5 }, // e.g. a state match like "south"
    expected: true,
  },
  {
    name: 'equal index, city alias shorter than state alias: state must be kept (deterministic tie behavior)',
    candidate: { index: 10, length: 5 },
    current: { index: 10, length: 9 },
    expected: false,
  },
  {
    name: 'equal index and equal length: preserve current match (do not replace)',
    candidate: { index: 10, length: 5 },
    current: { index: 10, length: 5 },
    expected: false,
  },
];

for (const testCase of equalIndexTieCases) {
  assert.equal(
    isMoreSpecificAliasMatch(testCase.candidate, testCase.current),
    testCase.expected,
    testCase.name
  );
}

console.log(
  `address-alias-matching: ${cases.length + equalIndexTieCases.length} focused cases passed`
);
