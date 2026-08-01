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

const attachments = loadTsModule('lib/shared/submission-attachments.ts');

const {
  PRODUCT_REIMBURSEMENT_DOCUMENT_TYPE,
  REFERENCE_PO_DOCUMENT_TYPE,
  GST_SCREENSHOT_DOCUMENT_TYPE,
  isGstScreenshotUploadAllowed,
  pickGstScreenshotAttachment,
  pickProductReimbursementAttachment,
  pickReferencePoAttachment,
} = attachments;

// ---------------------------------------------------------------------------
// Effective document_type CHECK constraint
//
// Resolves the constraint the way Postgres does: the last migration (by file
// name order, which is how Supabase applies them) that adds
// submission_attachments_document_type_check wins.
// ---------------------------------------------------------------------------

const migrationsDir = path.join(root, 'supabase', 'migrations');
const constraintName = 'submission_attachments_document_type_check';

const definingMigrations = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .filter((name) => {
    const sql = fs.readFileSync(path.join(migrationsDir, name), 'utf8');
    return sql.includes(constraintName) && /add\s+constraint/i.test(sql);
  });

assert.ok(
  definingMigrations.length > 0,
  'expected at least one migration to define the attachment document_type constraint'
);

const effectiveMigration = definingMigrations[definingMigrations.length - 1];
const effectiveSql = fs.readFileSync(path.join(migrationsDir, effectiveMigration), 'utf8');

const checkMatch = effectiveSql.match(
  new RegExp(`add\\s+constraint\\s+${constraintName}\\s+check\\s*\\(\\s*document_type\\s+in\\s*\\(([^)]*)\\)`, 'i')
);

assert.ok(
  checkMatch,
  `could not parse the document_type CHECK list from ${effectiveMigration}`
);

const allowedTypes = checkMatch[1]
  .split(',')
  .map((value) => value.trim().replace(/^'|'$/g, ''))
  .filter(Boolean);

// 1. gst_screenshot passes the database constraint.
assert.ok(
  allowedTypes.includes(GST_SCREENSHOT_DOCUMENT_TYPE),
  `GST_SCREENSHOT_DOCUMENT_TYPE ("${GST_SCREENSHOT_DOCUMENT_TYPE}") must be allowed by ${constraintName}; ` +
    `effective migration ${effectiveMigration} allows: ${allowedTypes.join(', ')}`
);

// 2. Existing attachment types still pass.
assert.ok(
  allowedTypes.includes(PRODUCT_REIMBURSEMENT_DOCUMENT_TYPE),
  `${PRODUCT_REIMBURSEMENT_DOCUMENT_TYPE} must remain allowed by ${constraintName}`
);
assert.ok(
  allowedTypes.includes(REFERENCE_PO_DOCUMENT_TYPE),
  `${REFERENCE_PO_DOCUMENT_TYPE} must remain allowed by ${constraintName}`
);

// Drift guard: every document type the application can write must be allowed.
// This is the exact failure mode that made GST screenshot uploads impossible.
for (const documentType of [
  PRODUCT_REIMBURSEMENT_DOCUMENT_TYPE,
  REFERENCE_PO_DOCUMENT_TYPE,
  GST_SCREENSHOT_DOCUMENT_TYPE,
]) {
  assert.ok(
    allowedTypes.includes(documentType),
    `document type "${documentType}" is written by the application but rejected by ${constraintName}`
  );
}

// The superseded migration must not have been edited in place.
const referencePoMigration = path.join(
  migrationsDir,
  '20260629153000_add_reference_po_attachment_type.sql'
);
if (fs.existsSync(referencePoMigration)) {
  const referencePoSql = fs.readFileSync(referencePoMigration, 'utf8');
  assert.ok(
    !referencePoSql.includes(GST_SCREENSHOT_DOCUMENT_TYPE),
    'the already-applied reference PO migration must not be modified; add a new migration instead'
  );
}

// ---------------------------------------------------------------------------
// Follow-up status gate for uploads
// ---------------------------------------------------------------------------

// 4. Upload is rejected for a non-pending follow-up.
assert.equal(isGstScreenshotUploadAllowed('pending'), true, 'pending follow-ups accept uploads');
assert.equal(isGstScreenshotUploadAllowed('completed'), false, 'completed follow-ups reject uploads');
assert.equal(isGstScreenshotUploadAllowed(null), false, 'missing status rejects uploads');
assert.equal(isGstScreenshotUploadAllowed(undefined), false, 'undefined status rejects uploads');
assert.equal(isGstScreenshotUploadAllowed(''), false, 'empty status rejects uploads');
assert.equal(isGstScreenshotUploadAllowed('  Pending  '), true, 'status comparison is trimmed and case-insensitive');
assert.equal(isGstScreenshotUploadAllowed('pending_review'), false, 'only an exact pending status is accepted');

// ---------------------------------------------------------------------------
// Replacement flow: the route must never physically delete a prior screenshot
// ---------------------------------------------------------------------------

const routeSource = fs.readFileSync(
  path.join(root, 'app', 'api', 'follow-ups', '[followUpId]', 'gst-screenshot', 'route.ts'),
  'utf8'
);

// 6. Previous attachment remains stored.
assert.ok(
  !routeSource.includes('removeSubmissionAttachmentsByType'),
  'the GST screenshot route must not delete previous attachments during replacement'
);

// 5 + 8 + 9. The new record is created before anything else changes, so a failed
// upload or failed insert leaves the previous attachment untouched and active.
const uploadIndex = routeSource.indexOf('uploadGstScreenshotAttachment({');
const logIndex = routeSource.indexOf('logActivityEvent(');
assert.ok(uploadIndex > -1, 'route must upload the new GST screenshot');
assert.ok(logIndex > uploadIndex, 'activity logging must happen after the attachment is committed');

// 10. Activity-log failure must not fail a successful upload.
const activityLogBlock = routeSource.slice(logIndex);
assert.ok(
  /catch\s*\(activityLogError\)/.test(activityLogBlock),
  'activity log failures must be caught so a committed upload still returns success'
);

// 11. Authorization is still enforced before any storage work.
const authIndex = routeSource.indexOf("['finance', 'admin', 'developer'].includes(appUser.role)");
assert.ok(authIndex > -1, 'route must keep the finance/admin/developer authorization check');
assert.ok(authIndex < uploadIndex, 'authorization must be enforced before uploading');

const statusGateIndex = routeSource.indexOf('isGstScreenshotUploadAllowed(');
assert.ok(statusGateIndex > -1, 'route must check the follow-up status');
assert.ok(statusGateIndex < uploadIndex, 'the pending status gate must run before uploading');

// ---------------------------------------------------------------------------
// Attachment selection: newest uploaded_at wins
//
// GST screenshots are append-only, so a submission can hold several rows of the
// same document_type. Embedded selects return them unordered, so the picker
// must not depend on array position.
// ---------------------------------------------------------------------------

function gstAttachment(id, uploadedAt) {
  return {
    id,
    document_type: GST_SCREENSHOT_DOCUMENT_TYPE,
    file_name: `${id}.png`,
    file_size_bytes: 1024,
    mime_type: 'image/png',
    uploaded_at: uploadedAt,
  };
}

// Newest wins regardless of array order.
const oldest = gstAttachment('oldest', '2026-07-01T10:00:00.000Z');
const middle = gstAttachment('middle', '2026-07-15T10:00:00.000Z');
const newest = gstAttachment('newest', '2026-08-01T10:00:00.000Z');

assert.equal(
  pickGstScreenshotAttachment([oldest, middle, newest])?.id,
  'newest',
  'ascending order returns the newest attachment'
);
assert.equal(
  pickGstScreenshotAttachment([newest, middle, oldest])?.id,
  'newest',
  'descending order returns the newest attachment'
);
assert.equal(
  pickGstScreenshotAttachment([middle, newest, oldest])?.id,
  'newest',
  'unordered input returns the newest attachment'
);

// Single attachment is returned unchanged, including when uploaded_at is absent.
assert.equal(
  pickGstScreenshotAttachment([oldest])?.id,
  'oldest',
  'a single attachment is returned as-is'
);
assert.equal(
  pickGstScreenshotAttachment([gstAttachment('only', null)])?.id,
  'only',
  'a single attachment without uploaded_at is still returned'
);
assert.equal(
  pickGstScreenshotAttachment([gstAttachment('only', undefined)])?.id,
  'only',
  'a single attachment with undefined uploaded_at is still returned'
);

// When no row carries a usable uploaded_at, the first match is kept
// (previous first-match behaviour).
assert.equal(
  pickGstScreenshotAttachment([gstAttachment('first', null), gstAttachment('second', null)])?.id,
  'first',
  'all-missing uploaded_at preserves first-match behaviour'
);
assert.equal(
  pickGstScreenshotAttachment([
    gstAttachment('first', 'not-a-date'),
    gstAttachment('second', 'also-not-a-date'),
  ])?.id,
  'first',
  'unparseable uploaded_at values preserve first-match behaviour'
);

// A row with a usable timestamp beats one without, in either position.
assert.equal(
  pickGstScreenshotAttachment([gstAttachment('undated', null), newest])?.id,
  'newest',
  'a dated attachment beats an undated one that appears first'
);
assert.equal(
  pickGstScreenshotAttachment([newest, gstAttachment('undated', null)])?.id,
  'newest',
  'a dated attachment beats an undated one that appears later'
);
assert.equal(
  pickGstScreenshotAttachment([gstAttachment('bad', 'not-a-date'), oldest])?.id,
  'oldest',
  'an unparseable uploaded_at ranks below a valid one'
);

// Ties resolve deterministically to the first matching row.
assert.equal(
  pickGstScreenshotAttachment([
    gstAttachment('tie-a', '2026-07-20T10:00:00.000Z'),
    gstAttachment('tie-b', '2026-07-20T10:00:00.000Z'),
  ])?.id,
  'tie-a',
  'identical timestamps keep the first matching row'
);

// Only the requested document type is considered.
const mixed = [
  { ...oldest },
  {
    id: 'po-newer',
    document_type: REFERENCE_PO_DOCUMENT_TYPE,
    file_name: 'po.pdf',
    file_size_bytes: 2048,
    mime_type: 'application/pdf',
    uploaded_at: '2026-08-05T10:00:00.000Z',
  },
  {
    id: 'reimbursement-newest',
    document_type: PRODUCT_REIMBURSEMENT_DOCUMENT_TYPE,
    file_name: 'receipt.pdf',
    file_size_bytes: 512,
    mime_type: 'application/pdf',
    uploaded_at: '2026-08-09T10:00:00.000Z',
  },
  { ...newest },
];

assert.equal(
  pickGstScreenshotAttachment(mixed)?.id,
  'newest',
  'a newer attachment of another document type is ignored'
);
assert.equal(
  pickReferencePoAttachment(mixed)?.id,
  'po-newer',
  'reference PO selection is unaffected'
);
assert.equal(
  pickProductReimbursementAttachment(mixed)?.id,
  'reimbursement-newest',
  'product reimbursement selection is unaffected'
);

// Absent / malformed input is handled without throwing.
assert.equal(pickGstScreenshotAttachment(undefined), null, 'undefined input returns null');
assert.equal(pickGstScreenshotAttachment(null), null, 'null input returns null');
assert.equal(pickGstScreenshotAttachment([]), null, 'empty array returns null');
assert.equal(pickGstScreenshotAttachment('nope'), null, 'non-array input returns null');
assert.equal(
  pickGstScreenshotAttachment([null, 'string', 42, undefined]),
  null,
  'malformed entries are skipped'
);
assert.equal(
  pickGstScreenshotAttachment([null, gstAttachment('valid', '2026-07-09T10:00:00.000Z'), 'string'])?.id,
  'valid',
  'malformed entries are skipped without hiding valid ones'
);
assert.equal(
  pickGstScreenshotAttachment([{ ...oldest, document_type: undefined }]),
  null,
  'entries without a document_type are ignored'
);

console.log('gst-screenshot-attachment tests passed');
