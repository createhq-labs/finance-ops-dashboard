import assert from 'node:assert/strict';

// Focused regression coverage for the pincode-lookup effect's retry/apply
// semantics in components/forms/invoice-intake-form.tsx (the effect starting
// around line 723). That effect is a full React client component (JSX,
// hooks, many external imports) with no jsdom/React-Testing-Library/vitest
// installed in this repo, so it cannot be transpiled and executed standalone
// the way the pure lib/shared/*.ts modules are in the sibling *.test.mjs
// files. Instead, this file reproduces the exact two guard functions the
// effect relies on, line-for-line, with references to the real locations, so
// drift between this model and the real implementation is easy to audit.

// Mirrors invoice-intake-form.tsx:728-729 (the synchronous pre-fetch guard).
function shouldTriggerFetch(inferredPincode, lastRequestedPincodeRefValue) {
  if (!/^\d{6}$/.test(inferredPincode)) return false;
  if (lastRequestedPincodeRefValue === inferredPincode) return false;
  return true;
}

// Mirrors invoice-intake-form.tsx:747-776 (the resolved-response handler).
// lastRequestedPincodeRef and verifiedPincodeStateRef are only ever written
// together, inside the same accepted-response branch (isVerifiedSuccess &&
// currentInferred.pincode === requestedPincode && not viewOnly/GST-locked).
function decidePincodeApply({ lookup, requestedPincode, addressPincodeAtApplyTime }) {
  if (!lookup) return { applied: false, marksLastRequested: false, marksVerifiedState: false };

  const lookupPincode = String(lookup.pincode || '').trim();
  if (lookupPincode !== requestedPincode) {
    return { applied: false, marksLastRequested: false, marksVerifiedState: false };
  }

  const isVerifiedSuccess = lookup.success === true;
  const verifiedState = String(lookup.state || '').trim();

  // currentInferred.pincode !== pincode -> stale/discarded, return prev.
  if (addressPincodeAtApplyTime !== requestedPincode) {
    return { applied: false, marksLastRequested: false, marksVerifiedState: false };
  }

  if (!isVerifiedSuccess) {
    return { applied: true, marksLastRequested: false, marksVerifiedState: false };
  }

  return {
    applied: true,
    marksLastRequested: true,
    marksVerifiedState: Boolean(verifiedState),
    verifiedState,
  };
}

function applyRefs(refs, result, pincode) {
  return {
    lastRequestedPincodeRef: result.marksLastRequested ? pincode : refs.lastRequestedPincodeRef,
    verifiedPincodeStateRef: result.marksVerifiedState
      ? { pincode, state: result.verifiedState }
      : refs.verifiedPincodeStateRef,
  };
}

// 1. Fallback response does not consume retry eligibility, and updates neither ref.
{
  let refs = { lastRequestedPincodeRef: null, verifiedPincodeStateRef: null };
  const result = decidePincodeApply({
    lookup: { success: false, pincode: '380015', state: 'Maharashtra', source: 'local-fallback' },
    requestedPincode: '380015',
    addressPincodeAtApplyTime: '380015',
  });
  refs = applyRefs(refs, result, '380015');
  assert.equal(result.marksLastRequested, false, 'fallback response must not mark the pincode handled');
  assert.equal(result.marksVerifiedState, false, 'fallback response must not update the verified state ref');
  assert.notEqual(refs.lastRequestedPincodeRef, '380015', 'fallback response must leave the pincode eligible for retry');
  assert.equal(refs.verifiedPincodeStateRef, null, 'fallback response must leave the verified state ref untouched');
}

// 2. Stale/discarded success updates neither ref, and does not consume retry eligibility.
{
  let refs = { lastRequestedPincodeRef: null, verifiedPincodeStateRef: null };
  const result = decidePincodeApply({
    lookup: { success: true, pincode: '380015', state: 'Gujarat', city: 'Ahmedabad' },
    requestedPincode: '380015',
    addressPincodeAtApplyTime: '400053', // address changed by the time the response resolved
  });
  refs = applyRefs(refs, result, '380015');
  assert.equal(result.applied, false, 'a discarded response must not be applied');
  assert.equal(result.marksLastRequested, false, 'a discarded response must not mark the pincode handled');
  assert.equal(result.marksVerifiedState, false, 'a discarded response must not update the verified state ref');
  assert.notEqual(refs.lastRequestedPincodeRef, '380015', 'a discarded success must leave the pincode eligible for retry');
  assert.equal(refs.verifiedPincodeStateRef, null, 'a discarded success must leave the verified state ref untouched');
}

// 3. Successful accepted response updates both refs together.
{
  let refs = { lastRequestedPincodeRef: null, verifiedPincodeStateRef: null };
  const result = decidePincodeApply({
    lookup: { success: true, pincode: '380015', state: 'Gujarat', city: 'Ahmedabad' },
    requestedPincode: '380015',
    addressPincodeAtApplyTime: '380015',
  });
  refs = applyRefs(refs, result, '380015');
  assert.equal(result.applied, true, 'a verified, current response must be applied');
  assert.equal(result.marksLastRequested, true, 'a verified, applied response must mark the pincode handled');
  assert.equal(result.marksVerifiedState, true, 'a verified, applied response must update the verified state ref');
  assert.equal(refs.lastRequestedPincodeRef, '380015');
  assert.deepEqual(refs.verifiedPincodeStateRef, { pincode: '380015', state: 'Gujarat' });
}

// 4. Changing from no pincode to a valid pincode triggers lookup.
{
  assert.equal(shouldTriggerFetch('', null), false, 'no pincode in the address must not trigger a fetch');
  assert.equal(shouldTriggerFetch('380015', null), true, 'a newly-completed valid pincode must trigger a fetch');
}

// 5. Same pincode can retry after fallback, and both refs only settle once genuinely verified.
{
  let refs = { lastRequestedPincodeRef: null, verifiedPincodeStateRef: null };

  // First attempt falls back.
  const fallback = decidePincodeApply({
    lookup: { success: false, pincode: '403722', state: 'Maharashtra', source: 'local-fallback' },
    requestedPincode: '403722',
    addressPincodeAtApplyTime: '403722',
  });
  refs = applyRefs(refs, fallback, '403722');
  assert.equal(refs.verifiedPincodeStateRef, null, 'a fallback attempt must not have set the verified state ref');
  assert.equal(
    shouldTriggerFetch('403722', refs.lastRequestedPincodeRef),
    true,
    'the same pincode must remain eligible for a fetch after a fallback'
  );

  // Retry succeeds.
  const retry = decidePincodeApply({
    lookup: { success: true, pincode: '403722', state: 'Goa', city: 'South Goa' },
    requestedPincode: '403722',
    addressPincodeAtApplyTime: '403722',
  });
  refs = applyRefs(refs, retry, '403722');
  assert.equal(refs.lastRequestedPincodeRef, '403722', 'a verified retry must mark the pincode handled');
  assert.deepEqual(
    refs.verifiedPincodeStateRef,
    { pincode: '403722', state: 'Goa' },
    'a verified retry must update the verified state ref in the same step'
  );
  assert.equal(
    shouldTriggerFetch('403722', refs.lastRequestedPincodeRef),
    false,
    'once genuinely verified, the same pincode must not be re-fetched again'
  );
}

console.log('pincode-retry-eligibility: 5 focused cases passed');
