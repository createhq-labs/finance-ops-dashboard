import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This suite is a static/contract check, matching the existing convention in
// follow-up-reminder-rpc.test.mjs and follow-up-engine-rules.test.mjs: this
// repo has no live-DB test harness and no direct Postgres connection string
// (only the Supabase REST URL + keys in .env.local), so a migration's new
// function cannot be applied and executed from here. These assertions verify
// the structural guarantees that the described behaviors depend on.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = path.join(root, 'supabase', 'migrations', '20260803090000_reconcile_follow_ups_for_submission.sql');
const servicePath = path.join(root, 'lib', 'server', 'services', 'followUps.ts');
const routePath = path.join(root, 'app', 'api', 'submissions', 'finance', 'action', 'route.ts');

const migration = fs.readFileSync(migrationPath, 'utf8');
const service = fs.readFileSync(servicePath, 'utf8');
const route = fs.readFileSync(routePath, 'utf8');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) out.push(full);
  }
  return out;
}

// --- 1. Requirement: reconciliation is scoped to exactly one submission ---
console.log('# scoped to exactly one submission');
assert.match(migration, /create or replace function public\.reconcile_follow_ups_for_submission\(\s*p_submission_id uuid/, 'RPC must accept a single p_submission_id');
assert.match(service, /submissionId: string;/, 'reconcileFollowUpsForSubmission must take a single submissionId');
assert.match(service, /\.eq\('id', submissionId\)/, 'submission read must be scoped to exactly one id, not is_latest_version-wide');
assert.doesNotMatch(
  service.slice(service.indexOf('export async function reconcileFollowUpsForSubmission')),
  /\.eq\('is_latest_version', true\)/,
  'reconcileFollowUpsForSubmission must not re-introduce the global latest-version scan'
);

// --- 2. Requirement: atomic for one submission (single transaction + lock) ---
console.log('# atomic for one submission');
assert.match(migration, /language plpgsql/, 'reconciliation must be a single plpgsql function (one transaction per call)');
assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(p_submission_id::text, 0\)\)/, 'RPC must serialize concurrent calls for the same submission_id');
assert.match(migration, /for update/i, 'RPC must lock the submission\'s own pending follow_ups rows');

// --- 3. Requirement: preserve pending row when nothing changed / update ownership / create only if missing ---
console.log('# preserve / update-ownership / create-only-if-missing');
assert.match(migration, /elsif v_existing_employee is distinct from v_employee\s*\n\s*or v_existing_team_lead is distinct from v_team_lead then/, 'RPC must update ownership only when assignee/team-lead actually differs');
assert.match(migration, /-- else: nothing changed for this follow-up type - zero writes\./, 'RPC must leave an unchanged pending row completely untouched');
assert.match(migration, /if v_existing_id is null then/, 'RPC must only insert when no pending row of that type exists yet');
assert.match(migration, /on conflict do nothing/, 'insert must stay conflict-safe under the partial unique index');

// --- 4. Requirement: complete only when no longer required ---
console.log('# complete only when no longer required');
assert.match(migration, /and not \(f\.follow_up_type = any\(v_desired_types\)\)/, 'RPC must complete only pending rows whose type fell out of the desired set');

// --- 5. Requirement: concurrent executions leave exactly one logical pending follow-up ---
console.log('# concurrent execution converges on one pending row per type');
assert.match(migration, /partition by follow_up_type\s*\n\s*order by created_at asc, id asc/, 'RPC must collapse duplicate pending rows per type down to one');
assert.match(migration, /r\.rn > 1/, 'RPC must complete every duplicate beyond the first (oldest) pending row per type');

// --- 6. Requirement: one submission action cannot touch another submission's rows ---
console.log('# cross-submission isolation');
const submissionScopedCount = (migration.match(/submission_id = p_submission_id/g) || []).length;
assert.ok(submissionScopedCount >= 4, `every read/update against follow_ups must be scoped by submission_id = p_submission_id (found ${submissionScopedCount} occurrences, expected at least 4: lock, complete, dedupe, per-type lookup)`);
// The "superseded" duplicate-collapse UPDATE joins against `ranked`, which is
// itself filtered by submission_id = p_submission_id (asserted above), so its
// own `where f.id = r.id` clause is transitively scoped and does not need to
// repeat the filter directly.
assert.match(migration, /from ranked r\s*\n\s*where f\.id = r\.id/, 'duplicate-collapse UPDATE must only ever touch rows sourced from the submission-scoped `ranked` CTE');

// --- 7. Requirement: Bill Due / GST business rules are reused, not duplicated ---
console.log('# Bill Due / GST rules reused unchanged for the single submission');
const reconcileFnSource = service.slice(service.indexOf('export async function reconcileFollowUpsForSubmission'));
assert.match(reconcileFnSource, /needsPaymentReceivedFollowUp\(candidate\)/, 'must reuse the existing Bill Due predicate');
assert.match(reconcileFnSource, /needsGstFollowUp\(candidate\)/, 'must reuse the existing GST predicate');
assert.match(reconcileFnSource, /parseDueDate\(candidate\.submitted_at, candidate\.bill_due\)/, 'must reuse the existing due-date computation');
assert.match(reconcileFnSource, /getPrimaryTeamLeadMap\(adminClient, \[assignedEmployeeId\]\)/, 'must reuse the existing team lead resolution for the assigned employee');

// --- 8. Requirement: finance action route calls the scoped reconciler, not the global one ---
console.log('# finance action route uses the scoped reconciler');
assert.match(route, /reconcileFollowUpsForSubmission\(\{/, 'finance action route must call the submission-scoped reconciler');
assert.match(route, /submissionId: body\.submission_id/, 'finance action route must scope reconciliation to the acted-on submission');
assert.doesNotMatch(route, /syncFollowUps\(/, 'finance action route must no longer call the global reconciler');

// --- 9. Requirement: global backfill stays manual, never called from runtime routes ---
console.log('# global backfill (syncFollowUps) stays manual-only');
assert.match(service, /Global backfill only\./, 'syncFollowUps must be documented as manual/admin-only');
const appDir = path.join(root, 'app');
const runtimeFiles = walk(appDir).filter((file) => file !== routePath);
for (const file of runtimeFiles) {
  const content = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(content, /syncFollowUps\(/, `${path.relative(root, file)} must not call the global syncFollowUps() backfill from runtime code`);
}

// --- 10. Requirement: existing reminder RPC stays unchanged ---
console.log('# reminder RPC untouched');
assert.match(service, /rpc\('send_due_follow_up_reminders'/, 'reminder RPC call must remain in place');
assert.doesNotMatch(migration, /send_due_follow_up_reminders/, 'the new migration must not touch the reminder RPC');

console.log('follow-up submission-scoped reconcile contract checks passed');
