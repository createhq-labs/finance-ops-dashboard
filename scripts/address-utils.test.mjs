import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(rootDir, 'lib/shared/address-utils.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, require, console });

const { parseBillingAddress, serializeBillingAddress } = module.exports;

const cases = [
  {
    name: 'one location group',
    input: '179/1B Lenin Sarani, Kolkata 13, Kolkata, West Bengal, India, 700013',
    clientType: 'Indian',
    expected: {
      addressLine: '179/1B Lenin Sarani, Kolkata 13, Kolkata, West Bengal, India, 700013',
      city: 'Kolkata',
      state: 'West Bengal',
      country: 'India',
      pincode: '700013',
    },
  },
  {
    name: 'repeated location group two or more times',
    input: '179/1B Lenin Sarani, Kolkata 13, Kolkata, West Bengal, India, 700013, Kolkata, West Bengal, India, 700013, Kolkata, West Bengal, India, 700013',
    clientType: 'Indian',
    expected: {
      addressLine: '179/1B Lenin Sarani, Kolkata 13, Kolkata, West Bengal, India, 700013, Kolkata, West Bengal, India, 700013, Kolkata, West Bengal, India, 700013',
      city: 'Kolkata',
      state: 'West Bengal',
      country: 'India',
      pincode: '700013',
    },
  },
  {
    name: 'commas inside address line',
    input: 'Flat 2A, Tower B, Sector 5, Salt Lake, Kolkata, West Bengal, India, 700091',
    clientType: 'Indian',
    expected: {
      addressLine: 'Flat 2A, Tower B, Sector 5, Salt Lake, Kolkata, West Bengal, India, 700091',
      city: 'Kolkata',
      state: 'West Bengal',
      country: 'India',
      pincode: '700091',
    },
  },
  {
    name: 'multi-word city and state',
    input: '221B Baker Street, New Delhi, Delhi NCR, India, 110001',
    clientType: 'Indian',
    expected: {
      addressLine: '221B Baker Street, New Delhi, Delhi NCR, India, 110001',
      city: 'New Delhi',
      state: 'Delhi NCR',
      country: 'India',
      pincode: '110001',
    },
  },
  {
    name: 'foreign address',
    input: '1600 Amphitheatre Parkway, Mountain View, California, United States, 94043',
    clientType: 'Foreign',
    expected: {
      addressLine: '1600 Amphitheatre Parkway, Mountain View, California, United States, 94043',
      city: 'Mountain View',
      state: 'California',
      country: 'United States',
      pincode: '94043',
    },
  },
  {
    name: 'missing component stays safe',
    input: 'Legacy office near Park Street, Kolkata, India',
    clientType: 'Indian',
    expected: {
      addressLine: 'Legacy office near Park Street, Kolkata, India',
      city: '',
      state: '',
      country: '',
      pincode: '',
    },
  },
  {
    name: 'already normalized',
    input: 'A-1 Business Park, Gurugram, Haryana, India, 122001',
    clientType: 'Indian',
    expected: {
      addressLine: 'A-1 Business Park, Gurugram, Haryana, India, 122001',
      city: 'Gurugram',
      state: 'Haryana',
      country: 'India',
      pincode: '122001',
    },
  },
];

for (const testCase of cases) {
  assert.equal(
    JSON.stringify(parseBillingAddress(testCase.input, testCase.clientType)),
    JSON.stringify(testCase.expected),
    testCase.name
  );
}

const repeated = parseBillingAddress(cases[1].input, 'Indian');
assert.equal(
  serializeBillingAddress(repeated),
  cases[1].input,
  'serialize after parsing repeated suffix should preserve the original address string'
);

console.log(`address-utils: ${cases.length + 1} focused cases passed`);
