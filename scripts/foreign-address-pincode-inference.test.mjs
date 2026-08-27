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

const addressUtilsSource = readFileSync(join(rootDir, 'lib/shared/address-utils.ts'), 'utf8');
const addressUtilsCompiled = ts.transpileModule(addressUtilsSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const addressUtilsModule = { exports: {} };
vm.runInNewContext(addressUtilsCompiled, { module: addressUtilsModule, exports: addressUtilsModule.exports, require, console });

const { inferAddressData } = addressUtilsModule.exports;

// isObviouslyIndianAddress lives in invoice-intake-form.tsx, a React client
// component that pulls in JSX/section imports unrelated to this pure helper.
// Rather than pull in React and every sibling component just to exercise one
// string-matching function, extract its real source (plus the alias list it
// depends on) directly out of the .tsx file and evaluate that in isolation.
// This still tests the actual shipped implementation, byte for byte.
const formSource = readFileSync(join(rootDir, 'components/forms/invoice-intake-form.tsx'), 'utf8');

const aliasesMatch = formSource.match(/const INDIAN_ADDRESS_ALIASES = \[[\s\S]*?\];/);
assert.ok(aliasesMatch, 'expected to find INDIAN_ADDRESS_ALIASES in invoice-intake-form.tsx');

const fnMatch = formSource.match(/function isObviouslyIndianAddress\([\s\S]*?\n\}/);
assert.ok(fnMatch, 'expected to find isObviouslyIndianAddress in invoice-intake-form.tsx');

const extractedSource = `${aliasesMatch[0]}\n${fnMatch[0]}\nmodule.exports = { isObviouslyIndianAddress };`;
const extractedCompiled = ts.transpileModule(extractedSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const formHelpersModule = { exports: {} };
vm.runInNewContext(extractedCompiled, { module: formHelpersModule, exports: formHelpersModule.exports, console });

const { isObviouslyIndianAddress } = formHelpersModule.exports;

function values(overrides) {
  return { addressLine: '', city: '', state: '', country: '', pincode: '', ...overrides };
}

// --- inferAddressData: Foreign clients must not get Indian pincode/state/country inference from a bare 6-digit number ---

{
  const result = inferAddressData(
    '12 Orchard Towers, #04-06, Singapore 238839',
    'Foreign'
  );
  assert.equal(result.country, '', 'Singapore address with 6-digit postal code must not infer country=India');
  assert.equal(result.pincode, '', 'Singapore address with 6-digit postal code must not be extracted as an Indian pincode');
  assert.equal(result.state, '', 'Singapore address with 6-digit postal code must not infer an Indian state');
}

{
  const result = inferAddressData('Unit 456789, Some Street, Dubai, UAE', 'Foreign');
  assert.equal(result.country, '', 'Foreign address with an arbitrary 6-digit number must not infer country=India');
  assert.equal(result.pincode, '', 'Foreign address with an arbitrary 6-digit number must not be extracted as an Indian pincode');
  assert.equal(result.state, '', 'Foreign address with an arbitrary 6-digit number must not infer an Indian state');
}

{
  const result = inferAddressData('123 Main St, Springfield, India', 'Foreign');
  assert.equal(result.country, 'India', 'explicit "India" in a Foreign address must still be recognized');
}

{
  const result = inferAddressData('45 MG Road, Pune, Maharashtra, 411001', 'Indian');
  assert.equal(result.country, 'India', 'Indian client country inference must be unchanged');
  assert.equal(result.pincode, '411001', 'Indian client pincode extraction must be unchanged');
  assert.equal(result.state, 'Maharashtra', 'Indian client state inference must be unchanged');
}

{
  // Regression for the PINCODE_STATE_MAP fallback path specifically (no city/state alias
  // present, only a bare 6-digit number) — still must work for Indian clients.
  const result = inferAddressData('Plot 7, Sector 12, 700013', 'Indian');
  assert.equal(result.country, 'India', 'Indian client with only a bare pincode must still infer country=India');
  assert.equal(result.pincode, '700013', 'Indian client with only a bare pincode must still extract it');
  assert.equal(result.state, 'West Bengal', 'Indian client PINCODE_STATE_MAP fallback must be unchanged');
}

// --- isObviouslyIndianAddress: a bare 6-digit number alone must not classify a Foreign address as Indian ---

assert.equal(
  isObviouslyIndianAddress(values({ addressLine: '12 Orchard Towers, #04-06, Singapore 238839' })),
  false,
  'Singapore address with 6-digit postal code must not be classified as Indian'
);

assert.equal(
  isObviouslyIndianAddress(values({ addressLine: 'Unit 456789, Some Street, Dubai, UAE' })),
  false,
  'Foreign address with an arbitrary 6-digit number must not be classified as Indian'
);

assert.equal(
  isObviouslyIndianAddress(values({ addressLine: '123 Main St, Springfield, India' })),
  true,
  'Foreign address explicitly containing "India" must still be classified as Indian'
);

assert.equal(
  isObviouslyIndianAddress(values({ addressLine: '221B Baker Street, Maharashtra' })),
  true,
  'existing Indian state alias evidence must still classify an address as Indian'
);

console.log('foreign-address-pincode-inference: all focused cases passed');
