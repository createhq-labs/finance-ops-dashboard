import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../../lib/server/auth';
import { logSubmissionAction } from '../../../../../lib/server/services/activityLog';
import { getAccessTokenFromCookieHeader } from '../../../../../lib/server/services/authCookies';
import { createEmployeeNotification } from '../../../../../lib/server/services/notifications';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '../../../../../lib/server/supabase';

type FinanceActionRequest = {
  submission_id?: string;
  action?:
    | 'approve'
    | 'reject'
    | 'request_resubmission'
    | 'mark_invoice_created'
    | 'add_debit_note'
    | 'update_payment_status'
    | 'close_submission';
  rejection_note?: string;
  invoice_status?: 'invoice_pending' | 'invoice_created' | 'po_created_estimate' | 'invoice_cancelled' | 'debit_note' | 'invoice_plus_debit_note';
  invoice_number?: string;
  debit_note_number?: string;
  creator_invoice_status?: 'pending' | 'received' | 'part_payment_against_advance' | 'not_received' | 'multiple_creators' | 'gst_left';
  payment_received_status?: 'pending' | 'full' | 'advance_received' | 'gst_left' | 'past_due' | 'advance_past_due' | 'not_received' | 'partial_left' | 'credit_note_issued';
  payment_made_status?: 'pending' | 'full' | 'paid' | 'part_payment_against_advance' | 'not_paid' | 'multiple_creators' | 'gst_left';
  closure_status?: 'open' | 'closed' | 'issues' | 'cancelled' | 'gst_left';
  finance_comment?: string;
};

const DB_INVOICE_STATUS_BY_MACHINE = {
  invoice_pending: 'Invoice Pending',
  invoice_created: 'Invoice created',
  po_created_estimate: 'Po Created/Estimate',
  invoice_cancelled: 'Invoice Cancelled',
  debit_note: 'Debit Note',
  invoice_plus_debit_note: 'Invoice + Debit Note',
} as const;

function toDbInvoiceStatus(status: FinanceActionRequest['invoice_status'] | string | null | undefined) {
  if (!status) return null;
  return DB_INVOICE_STATUS_BY_MACHINE[status as keyof typeof DB_INVOICE_STATUS_BY_MACHINE] || status;
}

function toLegacyPaymentReceived(status: FinanceActionRequest['payment_received_status']) {
  if (status === 'full') return 'Yes - Full';
  if (status === 'advance_received') return 'Yes - Advance';
  if (status === 'gst_left') return 'Yes - GST Left';
  if (status === 'past_due') return 'No - Past Due Date';
  if (status === 'advance_past_due') return 'Advance but Past Due Date';
  if (status === 'not_received') return 'No';
  if (status === 'partial_left') return 'Some Amount Left';
  if (status === 'credit_note_issued') return 'Pending (Credit Note Issued Along)';
  return 'Pending';
}

function toLegacyCreatorInvoice(status: FinanceActionRequest['creator_invoice_status']) {
  if (status === 'received') return 'Yes';
  if (status === 'part_payment_against_advance') return 'Part Payment Against Advance';
  if (status === 'not_received') return 'No';
  if (status === 'multiple_creators') return 'Multiple Creators';
  if (status === 'gst_left') return 'GST Left';
  return 'Pending';
}

function toLegacyPaymentMade(status: FinanceActionRequest['payment_made_status']) {
  if (status === 'full') return 'Yes - Full';
  if (status === 'paid') return 'Yes';
  if (status === 'part_payment_against_advance') return 'Part Payment Against Advance';
  if (status === 'not_paid') return 'No';
  if (status === 'multiple_creators') return 'Multiple Creators';
  if (status === 'gst_left') return 'GST Left';
  return 'Pending';
}

function toLegacyClosed(status: FinanceActionRequest['closure_status']) {
  if (status === 'closed') return 'Yes';
  if (status === 'issues') return 'Issues';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'gst_left') return 'GST Left';
  return 'Open';
}

function submissionPiLabel(piNumber: string | null | undefined) {
  const value = String(piNumber || '').trim();
  return value || 'No PI Required';
}

function invoiceStatusLabel(status: FinanceActionRequest['invoice_status'] | string | null | undefined) {
  const normalized = toDbInvoiceStatus(status);
  if (normalized === 'Invoice created') return 'Invoice Created';
  if (normalized === 'Po Created/Estimate' || normalized === 'Invoice Pending') return 'PI Created / Estimate';
  if (normalized === 'Invoice Cancelled') return 'Cancelled';
  if (normalized === 'Debit Note') return 'Debit Note';
  if (normalized === 'Invoice + Debit Note') return 'Invoice + Debit Note';
  return 'PI Created / Estimate';
}

export async function POST(req: NextRequest) {
  try {
    assertSupabaseEnv();

    let token = '';
    try {
      token = getBearerToken(req);
    } catch {
      token = getAccessTokenFromCookieHeader(req.cookies) ?? '';
    }
    if (!token) throw new Error('Missing auth token');

    const userClient = createUserScopedClient(token);
    const adminClient = createServiceClient();
    const appUser = await getCurrentAppUser(userClient, token);
    if (!(appUser.role === 'finance' || appUser.role === 'admin')) {
      throw new Error('Unauthorized');
    }

    const body = (await req.json().catch(() => ({}))) as FinanceActionRequest;
    if (!body.submission_id) throw new Error('submission_id is required');
    if (!body.action) throw new Error('action is required');

    const { data: submission, error: submissionError } = await userClient
      .from('intake_submissions')
      .select('id, submitted_by, proforma_invoice, agency_brand_name, intake_status, invoice_status, invoice_number, debit_note_number, finance_comment, creator_invoice_status, payment_received_status, payment_made_status, closure_status, rejection_note')
      .eq('id', body.submission_id)
      .single();

    if (submissionError || !submission) {
      throw new Error(submissionError?.message ?? 'Submission not found');
    }
    const currentSubmission = submission;
    const submissionLabel = submissionPiLabel(currentSubmission.proforma_invoice);

    const patch: Record<string, unknown> = {};
    const now = new Date().toISOString();
    let activityAction: string = body.action;
    let notificationTitle = '';
    let notificationMessage = '';
    let notificationType: 'submission_rejected' | 'resubmission_requested' | 'invoice_updated' | null = null;
    let changed = false;

    function noChange(message: string) {
      return NextResponse.json({
        success: true,
        changed: false,
        message,
        submission: {
          id: currentSubmission.id,
          intake_status: currentSubmission.intake_status,
          invoice_status: currentSubmission.invoice_status,
          invoice_number: currentSubmission.invoice_number,
          debit_note_number: currentSubmission.debit_note_number,
          finance_comment: currentSubmission.finance_comment,
          creator_invoice_status: currentSubmission.creator_invoice_status,
          payment_received_status: currentSubmission.payment_received_status,
          payment_made_status: currentSubmission.payment_made_status,
          closure_status: currentSubmission.closure_status,
          rejection_note: currentSubmission.rejection_note,
        },
      });
    }

    if (body.action === 'approve') {
      if (currentSubmission.intake_status === 'accepted') {
        return noChange('Submission is already approved.');
      }
      patch.intake_status = 'accepted';
      patch.reviewed_by = appUser.id;
      patch.reviewed_at = now;
      patch.rejection_note = null;
      activityAction = 'submission_approved';
      notificationType = 'invoice_updated';
      notificationTitle = 'Submission approved';
      notificationMessage = `${submissionLabel} has been approved by finance.`;
      changed = true;
    }

    if (body.action === 'reject') {
      const note = body.rejection_note?.trim();
      if (!note) throw new Error('rejection_note is required');
      if (currentSubmission.intake_status === 'rejected' && (currentSubmission.rejection_note ?? '').trim() === note) {
        return noChange('Submission is already rejected with the same note.');
      }
      patch.intake_status = 'rejected';
      patch.reviewed_by = appUser.id;
      patch.reviewed_at = now;
      patch.rejection_note = note;
      activityAction = 'submission_rejected';
      notificationType = 'submission_rejected';
      notificationTitle = 'Submission rejected';
      notificationMessage = `${submissionLabel} was rejected: ${note}`;
      changed = true;
    }

    if (body.action === 'request_resubmission') {
      const note = body.rejection_note?.trim();
      if (!note) throw new Error('rejection_note is required');
      if (currentSubmission.intake_status === 'rejected' && (currentSubmission.rejection_note ?? '').trim() === note) {
        return noChange('Resubmission has already been requested with the same note.');
      }
      patch.intake_status = 'rejected';
      patch.reviewed_by = appUser.id;
      patch.reviewed_at = now;
      patch.rejection_note = note;
      activityAction = 'resubmission_requested';
      notificationType = 'resubmission_requested';
      notificationTitle = 'Resubmission requested';
      notificationMessage = `${submissionLabel} needs changes before finance can continue: ${note}`;
      changed = true;
    }

    if (body.action === 'mark_invoice_created') {
      const nextInvoiceStatus = body.invoice_status ? toDbInvoiceStatus(body.invoice_status) : currentSubmission.invoice_status;
      const nextInvoiceNumber = body.invoice_number?.trim() || currentSubmission.invoice_number || null;
      const nextDebitNoteNumber = body.debit_note_number?.trim() || currentSubmission.debit_note_number || null;
      if (
        currentSubmission.invoice_status === nextInvoiceStatus &&
        (currentSubmission.invoice_number || null) === nextInvoiceNumber &&
        (currentSubmission.debit_note_number || null) === nextDebitNoteNumber
      ) {
        return noChange('Invoice tracking is already up to date.');
      }
      if (body.invoice_status && nextInvoiceStatus) patch.invoice_status = nextInvoiceStatus;
      patch.reviewed_by = appUser.id;
      patch.reviewed_at = now;
      if (body.invoice_number?.trim()) patch.invoice_number = body.invoice_number.trim();
      if (body.debit_note_number?.trim()) patch.debit_note_number = body.debit_note_number.trim();
      activityAction = 'invoice_created';
      notificationType = 'invoice_updated';
      notificationTitle = 'Invoice status updated';
      notificationMessage = body.invoice_status
        ? `${submissionLabel} is now marked as ${invoiceStatusLabel(nextInvoiceStatus)}.`
        : `${submissionLabel} invoice details were updated by finance.`;
      changed = true;
    }

    if (body.action === 'add_debit_note') {
      const debitNoteNumber = body.debit_note_number?.trim();
      if (!debitNoteNumber) throw new Error('debit_note_number is required');
      const nextInvoiceNumber = body.invoice_number?.trim() || currentSubmission.invoice_number || null;
      const nextInvoiceStatus = toDbInvoiceStatus(body.invoice_status ?? (nextInvoiceNumber ? 'invoice_plus_debit_note' : 'debit_note'));
      if (
        (currentSubmission.debit_note_number || null) === debitNoteNumber &&
        (currentSubmission.invoice_number || null) === nextInvoiceNumber &&
        currentSubmission.invoice_status === nextInvoiceStatus
      ) {
        return noChange('Debit note details are already saved.');
      }
      patch.debit_note_number = debitNoteNumber;
      patch.invoice_status = nextInvoiceStatus;
      if (body.invoice_number?.trim()) patch.invoice_number = body.invoice_number.trim();
      patch.reviewed_by = appUser.id;
      patch.reviewed_at = now;
      activityAction = 'debit_note_added';
      notificationType = 'invoice_updated';
      notificationTitle = 'Debit note added';
      notificationMessage = `${submissionLabel} invoice status is now ${invoiceStatusLabel(nextInvoiceStatus)}.`;
      changed = true;
    }

    if (body.action === 'update_payment_status') {
      if (!body.creator_invoice_status && !body.payment_received_status && !body.payment_made_status && body.finance_comment === undefined) {
        throw new Error('At least one finance status is required');
      }
      const nextCreatorInvoice = body.creator_invoice_status ?? currentSubmission.creator_invoice_status ?? 'pending';
      const nextReceived = body.payment_received_status ?? currentSubmission.payment_received_status ?? 'pending';
      const nextMade = body.payment_made_status ?? currentSubmission.payment_made_status ?? 'pending';
      const nextFinanceComment = body.finance_comment !== undefined ? body.finance_comment.trim() || null : currentSubmission.finance_comment ?? null;
      if (
        (currentSubmission.creator_invoice_status ?? 'pending') === nextCreatorInvoice &&
        (currentSubmission.payment_received_status ?? 'pending') === nextReceived &&
        (currentSubmission.payment_made_status ?? 'pending') === nextMade &&
        (currentSubmission.finance_comment ?? null) === nextFinanceComment
      ) {
        return noChange('Finance statuses are already up to date.');
      }
      if (body.creator_invoice_status) {
        patch.creator_invoice_status = body.creator_invoice_status;
        patch.invoice_via_creators_received = toLegacyCreatorInvoice(body.creator_invoice_status);
      }
      if (body.payment_received_status) {
        patch.payment_received_status = body.payment_received_status;
        patch.payment_received = toLegacyPaymentReceived(body.payment_received_status);
      }
      if (body.payment_made_status) {
        patch.payment_made_status = body.payment_made_status;
        patch.payment_made = toLegacyPaymentMade(body.payment_made_status);
      }
      if (body.finance_comment !== undefined) {
        patch.finance_comment = nextFinanceComment;
      }
      patch.reviewed_by = appUser.id;
      patch.reviewed_at = now;
      activityAction = 'payment_status_updated';
      notificationType = 'invoice_updated';
      notificationTitle = 'Payment status updated';
      notificationMessage = `${submissionLabel} finance tracking was updated by finance.`;
      changed = true;
    }

    if (body.action === 'close_submission') {
      const closureStatus = body.closure_status ?? 'closed';
      if ((currentSubmission.closure_status ?? 'open') === closureStatus) {
        return noChange(`Submission is already ${closureStatus}.`);
      }
      patch.closure_status = closureStatus;
      patch.closed = toLegacyClosed(closureStatus);
      patch.reviewed_by = appUser.id;
      patch.reviewed_at = now;
      activityAction = 'submission_closed';
      notificationType = 'invoice_updated';
      notificationTitle = closureStatus === 'cancelled' ? 'Submission cancelled' : 'Submission closed';
      notificationMessage = `${submissionLabel} is now ${closureStatus}.`;
      changed = true;
    }

    if (!changed) {
      return noChange('No state change was needed.');
    }

    const { data: updated, error: updateError } = await userClient
      .from('intake_submissions')
      .update(patch)
      .eq('id', body.submission_id)
      .select('id, intake_status, invoice_status, invoice_number, debit_note_number, finance_comment, creator_invoice_status, payment_received_status, payment_made_status, closure_status, rejection_note, reviewed_at')
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? 'Failed to update submission');
    }

    await logSubmissionAction(userClient, appUser.id, body.submission_id, activityAction, {
      actor_role: appUser.role,
      previous: {
        intake_status: submission.intake_status,
        invoice_status: submission.invoice_status,
        invoice_number: submission.invoice_number,
        debit_note_number: submission.debit_note_number,
        payment_received_status: submission.payment_received_status,
        payment_made_status: submission.payment_made_status,
        closure_status: submission.closure_status,
        rejection_note: submission.rejection_note,
      },
      next: patch,
    });

    if (notificationType) {
      await createEmployeeNotification({
        adminClient,
        submittedBy: String(currentSubmission.submitted_by),
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        relatedSubmissionId: body.submission_id,
      });
    }

    return NextResponse.json({ success: true, changed: true, submission: updated }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update submission.' },
      { status: 400 }
    );
  }
}
