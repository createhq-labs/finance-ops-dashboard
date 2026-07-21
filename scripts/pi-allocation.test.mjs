import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();

function loadTsModule(relativePath) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filePath,
  }).outputText;

  const module = { exports: {} };
  const sandbox = {
    exports: module.exports,
    module,
    require(id) {
      throw new Error(`Unexpected runtime import while loading ${relativePath}: ${id}`);
    },
    console,
  };

  vm.runInNewContext(compiled, sandbox, { filename: filePath });
  return module.exports;
}

const { shouldSkipPiGeneration } = loadTsModule('lib/server/services/submissions.ts');
const { getPiDisplayMeta } = loadTsModule('lib/client/pi-display.ts');

assert.equal(
  shouldSkipPiGeneration(
    { invoice_type: 'Reimbursement Invoice (Without GST)' },
    [{ deliverable_name: 'Product Reimbursement' }]
  ),
  true,
  'product reimbursement without GST remains PI-not-required'
);

assert.equal(
  shouldSkipPiGeneration(
    { invoice_type: 'Reimbursement Invoice (Without GST)' },
    [{ deliverable_name: 'Product Reimbursement' }, { deliverable_name: 'Campaign Activation' }]
  ),
  false,
  'mixed deliverables still require PI allocation'
);

assert.equal(
  shouldSkipPiGeneration(
    { invoice_type: 'Tax Invoice' },
    [{ deliverable_name: 'Product Reimbursement' }]
  ),
  false,
  'ordinary invoice types still require PI allocation'
);

const notRequiredDisplay = getPiDisplayMeta({
  pi: null,
  invoiceType: 'Reimbursement Invoice (Without GST)',
  lineItems: [{ deliverable_name: 'Product Reimbursement' }],
});
assert.equal(notRequiredDisplay.label, 'PI Not Required', 'actual PI-not-required submissions keep the explicit label');
assert.equal(notRequiredDisplay.title, 'Product reimbursement without GST');
assert.equal(notRequiredDisplay.description, 'Product reimbursement without GST');
assert.equal(notRequiredDisplay.isPiNotRequired, true);

const pendingDisplay = getPiDisplayMeta({
  pi: null,
  invoiceType: 'Tax Invoice',
  lineItems: [{ deliverable_name: 'Campaign Activation' }],
});
assert.equal(pendingDisplay.label, 'PI pending approval', 'PI-required pending submissions do not display as PI-not-required');
assert.equal(pendingDisplay.title, 'PI pending approval');
assert.equal(pendingDisplay.description, 'PI will be allocated after finance acceptance');
assert.equal(pendingDisplay.isPiNotRequired, false);

const createRouteSource = fs.readFileSync(path.join(root, 'app/api/submissions/create/route.ts'), 'utf8');
assert.equal(
  createRouteSource.includes('allocateGapFreePiForSubmission'),
  false,
  'creation route must not allocate PI numbers'
);
assert.equal(
  createRouteSource.includes("stage: 'assign_pi'"),
  false,
  'creation route must not expose the old PI allocation failure stage'
);

const financeActionSource = fs.readFileSync(path.join(root, 'app/api/submissions/finance/action/route.ts'), 'utf8');
assert.equal(
  financeActionSource.includes('allocateGapFreePiForSubmission'),
  true,
  'finance action route allocates through the existing service'
);
assert.equal(
  financeActionSource.includes("currentSubmission.intake_status === 'accepted'"),
  true,
  'already-accepted no-change guard remains in place'
);

console.log('PI allocation timing checks passed');
