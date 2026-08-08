import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(join(rootDir, 'lib/shared/address-utils.ts'));
const ts = require('typescript');

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

const { hasVerifiedPincodeStateMismatch } = module.exports;

// Focused regression coverage: blocking pincode/state mismatch validation must
// depend only on a verified /api/pincode lookup, never the coarse 2-digit
// PINCODE_STATE_MAP (a 2-digit prefix cannot uniquely identify every
// state/UT — this function never reads that map at all).
const cases = [
  {
    name: 'verified lookup matches selected state: no mismatch',
    verified: { pincode: '700013', state: 'West Bengal' },
    pincode: '700013',
    state: 'West Bengal',
    expected: false,
  },
  {
    name: 'verified lookup differs from selected state: mismatch',
    verified: { pincode: '700013', state: 'West Bengal' },
    pincode: '700013',
    state: 'Bihar',
    expected: true,
  },
  {
    name: 'no verified lookup at all (e.g. request never resolved): unverified, no mismatch',
    verified: null,
    pincode: '403722',
    state: 'Goa',
    expected: false,
  },
  {
    name: 'no verified lookup, even if the selected state looks implausible: unverified, no mismatch',
    verified: null,
    pincode: '403722',
    state: 'Delhi',
    expected: false,
  },
  {
    name: 'verified lookup exists but for a different pincode than the one now selected (e.g. timeout on a later request, or pincode edited after an earlier lookup): unverified, no mismatch',
    verified: { pincode: '400053', state: 'Maharashtra' },
    pincode: '403722',
    state: 'Goa',
    expected: false,
  },
  {
    name: 'Goa/Maharashtra regression: 403722 verified as Goa, selected Goa: no mismatch (previously false-flagged by the coarse "40" prefix map)',
    verified: { pincode: '403722', state: 'Goa' },
    pincode: '403722',
    state: 'Goa',
    expected: false,
  },
  {
    name: 'Goa/Maharashtra regression: 400053 verified as Maharashtra, selected Maharashtra: no mismatch',
    verified: { pincode: '400053', state: 'Maharashtra' },
    pincode: '400053',
    state: 'Maharashtra',
    expected: false,
  },
  {
    name: 'Goa/Maharashtra regression: 403722 verified as Goa, but Maharashtra selected: real mismatch',
    verified: { pincode: '403722', state: 'Goa' },
    pincode: '403722',
    state: 'Maharashtra',
    expected: true,
  },
  {
    // A second illustrative ambiguous-prefix case: PINCODE_STATE_MAP maps prefix
    // "50" to Telangana, but Telangana was carved out of Andhra Pradesh in 2014
    // and pincodes near the former boundary are a known real-world ambiguity for
    // any 2-digit-prefix map. This function must ignore the prefix map entirely
    // and trust only the verified lookup.
    name: 'Telangana/Andhra Pradesh border-pincode illustration: verified Andhra Pradesh, selected Andhra Pradesh: no mismatch even though the "50" prefix map would suggest Telangana',
    verified: { pincode: '507101', state: 'Andhra Pradesh' },
    pincode: '507101',
    state: 'Andhra Pradesh',
    expected: false,
  },
  {
    name: 'selected state is blank: unverified, no mismatch (field-required check owns this case separately)',
    verified: { pincode: '403722', state: 'Goa' },
    pincode: '403722',
    state: '',
    expected: false,
  },
  {
    name: 'state name casing/whitespace differences do not falsely trigger a mismatch',
    verified: { pincode: '403722', state: 'Goa' },
    pincode: '403722',
    state: '  goa  ',
    expected: false,
  },
];

for (const testCase of cases) {
  const result = hasVerifiedPincodeStateMismatch(testCase.verified, testCase.pincode, testCase.state);
  assert.equal(result, testCase.expected, testCase.name);
}

console.log(`pincode-state-mismatch: ${cases.length} focused cases passed`);
