import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGstinProgressive } from './gst-number-picker';

test('accepts "NA" (uppercase) as a complete, error-free value', () => {
  const result = validateGstinProgressive('NA');
  assert.equal(result.error, null);
  assert.equal(result.isCompleteValid, true);
});

test('accepts "na" (lowercase) as a complete, error-free value', () => {
  const result = validateGstinProgressive('na');
  assert.equal(result.error, null);
  assert.equal(result.isCompleteValid, true);
});

test('accepts "Na" (mixed case) as a complete, error-free value', () => {
  const result = validateGstinProgressive('Na');
  assert.equal(result.error, null);
  assert.equal(result.isCompleteValid, true);
});

test('accepts a valid, complete GSTIN', () => {
  const result = validateGstinProgressive('07AAIFI5054J1Z7');
  assert.equal(result.error, null);
  assert.equal(result.isCompleteValid, true);
});

test('rejects an invalid GSTIN (bad checksum)', () => {
  const result = validateGstinProgressive('07AAIFI5054J1Z1');
  assert.equal(result.error, 'Invalid GST number. Please verify the GSTIN entered.');
  assert.equal(result.isCompleteValid, false);
});

test('rejects an unrecognized GST state code', () => {
  const result = validateGstinProgressive('99');
  assert.equal(result.error, 'Please enter a valid GST state code.');
  assert.equal(result.isCompleteValid, false);
});

test('partial typing: non-digit, non-NA state code is still rejected immediately', () => {
  const result = validateGstinProgressive('XY');
  assert.equal(result.error, 'Please enter a valid GST state code.');
  assert.equal(result.isCompleteValid, false);
});

test('partial typing: single leading digit still passes through with no error', () => {
  const result = validateGstinProgressive('0');
  assert.equal(result.error, null);
  assert.equal(result.isCompleteValid, false);
});

test('partial typing: valid state code prefix alone is incomplete but error-free', () => {
  const result = validateGstinProgressive('07');
  assert.equal(result.error, null);
  assert.equal(result.isCompleteValid, false);
});

test('partial typing: valid prefix followed by bad PAN letters is rejected', () => {
  const result = validateGstinProgressive('07aa1');
  assert.equal(result.error, 'GST number format is incorrect. Please check the GSTIN.');
  assert.equal(result.isCompleteValid, false);
});

test('empty input has no error and is incomplete', () => {
  const result = validateGstinProgressive('');
  assert.equal(result.error, null);
  assert.equal(result.isCompleteValid, false);
});
