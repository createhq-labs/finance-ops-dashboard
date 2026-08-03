import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const servicePath = path.join(root, 'lib', 'server', 'services', 'followUps.ts');
const pagePath = path.join(root, 'app', '(dashboard)', 'dashboard', 'follow-ups', 'page.tsx');
const shellPath = path.join(root, 'components', 'layout', 'dashboard-shell.tsx');

const service = fs.readFileSync(servicePath, 'utf8');
const page = fs.readFileSync(pagePath, 'utf8');
const shell = fs.readFileSync(shellPath, 'utf8');

assert.match(service, /normalizeStatus\(submission\.intake_status\) !== 'accepted'/, 'Bill Due must require accepted submissions');
assert.match(service, /isPaymentOutstandingForBillDue\(submission\.payment_received_status\)/, 'Bill Due must use the outstanding-payment helper');
assert.match(service, /if \(!value\) return true;/, 'Bill Due must treat null payment status as outstanding');
assert.match(service, /'credit_note_issued'/, 'Bill Due outstanding statuses must include credit note issued');
assert.match(service, /function isSubmissionClosedOrCancelled/, 'follow-up generation must have a closed/cancelled guard');
assert.match(service, /submission\.closure_status \?\? submission\.closed/, 'closed/cancelled guard must preserve legacy closed fallback');
assert.match(service, /isSubmissionClosedOrCancelled\(submission\)[\s\S]*return false;/, 'GST and Bill Due generation must stop for closed/cancelled submissions');
assert.match(service, /function isInvoiceCancelledForBillDue/, 'invoice-cancelled Bill Due guard must remain isolated');
assert.match(service, /normalizeInvoiceStatusMachine\(submission\.invoice_status\) === 'invoice_cancelled'/, 'Bill Due must stop for invoice cancelled status');
assert.doesNotMatch(service, /sendFinanceGstScreenshotReminders/, 'monthly Finance/Admin GST notification flow must be removed');

assert.match(page, /Monthly GST screenshot reminder/, 'Follow-ups page must show the monthly GST banner');
assert.match(page, /setScreenshot\('missing'\)/, 'monthly GST CTA must target missing GST screenshots');
assert.match(page, /scope=gst_screenshot_missing/, 'monthly GST banner count must use the read-only count endpoint, not the full follow-ups list');
assert.match(page, /Export \.xlsx/, 'Follow-ups page must expose XLSX export');
assert.match(page, /downloadXlsx/, 'Follow-ups page must use the XLSX export helper');

assert.match(shell, /\/api\/follow-ups\/count/, 'sidebar must load the Follow-ups badge count');
assert.match(shell, /label: 'Follow-ups'[\s\S]*badge: followUpCount/, 'Follow-ups nav item must reuse the sidebar badge field');

console.log('follow-up engine rule checks passed');
