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
  invoice_number?: string;
  debit_note_number?: string;
  payment_received_status?: 'pending' | 'partial' | 'full' | 'not_received';
  payment_made_status?: 'pending' | 'partial' | 'full' | 'not_paid';
  closure_status?: 'open' | 'closed' | 'cancelled';
};

function toLegacyPaymentReceived(status: FinanceActionRequest['payment_received_status']) {
  if (status === 'full') return 'Yes - Full';
  if (status === 'partial') return 'Partial';
  if (status === 'not_received') return 'Not received';
  return 'Pending';
}

function toLegacyPaymentMade(status: FinanceActionRequest['payment_made_status']) {
  if (status === 'full') return 'Yes - Full';
  if (status === 'partial') return 'Partial';
  if (status === 'not_paid') return 'Not paid';
  return 'Pending';
}

function toLegacyClosed(status: FinanceActionRequest['closure_status']) {
  if (status === 'closed') return 'Yes';
  if (status === 'cancelled') return 'Cancelled';
  return 'Open';
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
      .select('id, submitted_by, proforma_invoice, agency_brand_name, intake_status, invoice_status, invoice_number, debit_note_number, payment_received_status, payment_made_status, closure_status, rejection_note')
      .eq('id', body.submission_id)
      .single();

    if (submissionError || !submission) {
      throw new Error(submissionError?.message ?? 'Submission not found');
    }
    const currentSubmission = submission;

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
      notificationMessage = `${submission.proforma_invoice} has been approved by finance.`;
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
      notificationMessage = `${submission.proforma_invoice} was rejected: ${note}`;
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
      notificationMessage = `${submission.proforma_invoice} needs changes before finance can continue: ${note}`;
      changed = true;
    }

    if (body.action === 'mark_invoice_created') {
      const nextInvoiceNumber = body.invoice_number?.trim() || currentSubmission.invoice_number || null;
      if (currentSubmission.invoice_status === 'Invoice created' && (currentSubmission.invoice_number || null) === nextInvoiceNumber) {
        return noChange('Invoice is already marked as created.');
      }
      patch.invoice_status = 'Invoice created';
      patch.reviewed_by = appUser.id;
      patch.reviewed_at = now;
      if (body.invoice_number?.trim()) patch.invoice_number = body.invoice_number.trim();
      activityAction = 'invoice_created';
      notificationType = 'invoice_updated';
      notificationTitle = 'Invoice status updated';
      notificationMessage = `${currentSubmission.proforma_invoice} is now marked as Invoice created.`;
      changed = true;
    }

    if (body.action === 'add_debit_note') {
      const debitNoteNumber = body.debit_note_number?.trim();
      if (!debitNoteNumber) throw new Error('debit_note_number is required');
      const nextInvoiceNumber = body.invoice_number?.trim() || currentSubmission.invoice_number || null;
      const nextInvoiceStatus = nextInvoiceNumber ? 'Invoice + Debit Note' : 'Debit Note';
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
      notificationMessage = `${currentSubmission.proforma_invoice} now includes debit note ${debitNoteNumber}.`;
      changed = true;
    }

    if (body.action === 'update_payment_status') {
      if (!body.payment_received_status && !body.payment_made_status) {
        throw new Error('At least one payment status is required');
      }
      const nextReceived = body.payment_received_status ?? currentSubmission.payment_received_status ?? 'pending';
      const nextMade = body.payment_made_status ?? currentSubmission.payment_made_status ?? 'pending';
      if ((currentSubmission.payment_received_status ?? 'pending') === nextReceived && (currentSubmission.payment_made_status ?? 'pending') === nextMade) {
        return noChange('Payment statuses are already up to date.');
      }
      if (body.payment_received_status) {
        patch.payment_received_status = body.payment_received_status;
        patch.payment_received = toLegacyPaymentReceived(body.payment_received_status);
      }
      if (body.payment_made_status) {
        patch.payment_made_status = body.payment_made_status;
        patch.payment_made = toLegacyPaymentMade(body.payment_made_status);
      }
      patch.reviewed_by = appUser.id;
      patch.reviewed_at = now;
      activityAction = 'payment_status_updated';
      notificationType = 'invoice_updated';
      notificationTitle = 'Payment status updated';
      notificationMessage = `${currentSubmission.proforma_invoice} payment tracking was updated by finance.`;
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
      notificationMessage = `${currentSubmission.proforma_invoice} is now ${closureStatus}.`;
      changed = true;
    }

    if (!changed) {
      return noChange('No state change was needed.');
    }

    const { data: updated, error: updateError } = await userClient
      .from('intake_submissions')
      .update(patch)
      .eq('id', body.submission_id)
      .select('id, intake_status, invoice_status, invoice_number, debit_note_number, payment_received_status, payment_made_status, closure_status, rejection_note, reviewed_at')
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
