import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = path.join(root, 'supabase', 'migrations', '20260802120000_atomic_follow_up_reminders.sql');
const servicePath = path.join(root, 'lib', 'server', 'services', 'followUps.ts');

const migration = fs.readFileSync(migrationPath, 'utf8');
const service = fs.readFileSync(servicePath, 'utf8');

assert.match(service, /export const FOLLOW_UP_REMINDER_INTERVAL_DAYS = 7;/, 'reminder interval must have one exported source of truth');
assert.match(service, /rpc\('send_due_follow_up_reminders'/, 'sync must use the atomic reminder RPC');
assert.match(service, /p_interval_days:\s*FOLLOW_UP_REMINDER_INTERVAL_DAYS/, 'RPC interval must come from FOLLOW_UP_REMINDER_INTERVAL_DAYS');
assert.doesNotMatch(service, /FOLLOW_UP_NOTIFICATION_INTERVAL_MS/, 'old millisecond interval constant must not remain');
assert.doesNotMatch(service, /\.from\('notifications'\)[\s\S]*\.from\('follow_ups'\)[\s\S]*next_notification_at:\s*nextAt/, 'sync must not insert notifications and advance schedules outside the RPC');

assert.match(migration, /create unique index if not exists notifications_follow_up_reminder_cycle_uidx/i, 'migration must add deterministic reminder dedupe index');
assert.match(migration, /target_path like '\/dashboard\/follow-ups\?%reminder_cycle=%'/i, 'dedupe index must be scoped to deterministic reminder cycles');
assert.match(migration, /for update of f skip locked/i, 'RPC must claim due follow-ups with row locking');
assert.match(migration, /on conflict do nothing/i, 'RPC notification insert must be conflict safe');
assert.match(migration, /recipient\.role = 'employee'/i, 'RPC must send employee reminders only to active employees');
assert.match(migration, /recipient\.role = 'team_lead'/i, 'RPC must send team lead reminders only to active team leads');
assert.match(migration, /required_recipient_counts/i, 'RPC must compare created notifications against every intended recipient');
assert.match(migration, /available\.available_count = required\.required_count/i, 'RPC must advance only when all intended recipient notifications exist');
assert.match(migration, /make_interval\(days => p_interval_days\)/i, 'RPC must advance schedules using the interval argument');
assert.match(migration, /grant execute on function public\.send_due_follow_up_reminders\(integer, integer\) to service_role/i, 'RPC must be callable by the service role only');
assert.match(migration, /revoke execute on function public\.send_due_follow_up_reminders\(integer, integer\) from authenticated/i, 'RPC must not be callable by authenticated users');

console.log('follow-up reminder RPC contract checks passed');
