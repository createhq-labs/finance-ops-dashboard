import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../../lib/server/auth';
import { logSubmissionAction } from '../../../../../lib/server/services/activityLog';
import { getAccessTokenFromCookieHeader } from '../../../../../lib/server/services/authCookies';
import { syncFollowUps } from '../../../../../lib/server/services/followUps';
import { deriveInvoiceStatusDbValue, normalizeInvoiceStatusMachine, toDbInvoiceStatus } from '../../../../../lib/shared/invoice-status';
import { createEmployeeNotification, createSubmissionReopenedNotifications } from '../../../../../lib/server/services/notifications';
import { allocateGapFreePiForSubmission, shouldSkipPiGeneration } from '../../../../../lib/server/services/submissions';
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
  finance_notes?: string;
  finance_external_notes?: string;
  finance_comment?: string;
};

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

function normalizeClosureStatus(value: string | null | undefined) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized == 'open' || normalized == 'no') return 'open';
  if (normalized == 'closed' || normalized == 'yes') return 'closed';
  if (normalized == 'issues') return 'issues';
  if (normalized == 'cancelled') return 'cancelled';
  if (normalized == 'gst_left' || normalized == 'gst left') return 'gst_left';
  return normalized;
}

function submissionPiLabel(piNumber: string | null | undefined, piNotRequired = false) {
  const value = String(piNumber || '').trim();
  if (value) return value;
  return piNotRequired ? 'No PI Required' : 'PI pending approval';
}

async function shouldSkipPiForSubmission(adminClient: ReturnType<typeof createServiceClient>, submission: { id: string; invoice_type?: string | null }) {
  const { data: lineItems, error } = await adminClient
    .from('intake_line_items')
    .select('deliverable_name')
    .eq('submission_id', submission.id);

  if (error) {
    throw new Error('Failed to inspect PI requirement: ' + error.message);
  }

  return shouldSkipPiGeneration(
    { invoice_type: submission.invoice_type ?? '' },
    (lineItems ?? []).map((item) => ({ deliverable_name: item.deliverable_name ?? null }))
  );
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

function deriveNextInvoiceStatusDbValue(source: {
  intake_status?: string | null | undefined;
  invoice_status?: string | null | undefined;
  invoice_number?: string | null | undefined;
  debit_note_number?: string | null | undefined;
}) {
  return deriveInvoiceStatusDbValue(source);
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
      .select('id, submitted_by, reviewed_by, proforma_invoice, agency_brand_name, business_line, financial_year, invoice_type, intake_status, invoice_status, invoice_number, debit_note_number, finance_notes, finance_external_notes, finance_comment, creator_invoice_status, payment_received_status, payment_made_status, closed, closure_status, rejection_note, reviewed_at')
      .eq('id', body.submission_id)
      .single();

    if (submissionError || !submission) {
      throw new Error(submissionError?.message ?? 'Submission not found');
    }
    const currentSubmission = submission;
    let effectivePiNumber = currentSubmission.proforma_invoice ?? null;
    let submissionLabel = submissionPiLabel(effectivePiNumber);
    const actorDisplayName = String(((appUser as { full_name?: string | null }).full_name ?? '').trim() || appUser.email);

    const patch: Record<string, unknown> = {};
    const now = new Date().toISOString();
    let activityAction: string = body.action;
    let activityFromStatus: string | null = null;
    let activityToStatus: string | null = null;
    let notificationAuditAction: string | null = null;
    let notificationTitle = '';
    let notificationMessage = '';
    let notificationType: 'submission_rejected' | 'resubmission_requested' | 'submission_reopened' | 'invoice_updated' | null = null;
    let changed = false;
    let shouldAllocatePiOnAcceptance = false;

    function noChange(message: string) {
      return NextResponse.json({
        success: true,
        changed: false,
        message,
        submission: {
          id: currentSubmission.id,
          intake_status: currentSubmission.intake_status,
          invoice_status: deriveNextInvoiceStatusDbValue(currentSubmission),
          invoice_number: currentSubmission.invoice_number,
          debit_note_number: currentSubmission.debit_note_number,
          finance_comment: currentSubmission.finance_comment,
          creator_invoice_status: currentSubmission.creator_invoice_status,
          payment_received_status: currentSubmission.payment_received_status,
          payment_made_status: currentSubmission.payment_made_status,
          closure_status: currentSubmission.closure_status ?? currentSubmission.closed,
          rejection_note: currentSubmission.rejection_note,
          proforma_invoice: currentSubmission.proforma_invoice,
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
      patch.finance_comment = null;
      patch.invoice_status = deriveNextInvoiceStatusDbValue({
        ...currentSubmission,
        intake_status: 'accepted',
      });
      activityAction = 'submission_approved';
      activityFromStatus = currentSubmission.intake_status ?? null;
      activityToStatus = 'accepted';
      notificationType = 'invoice_updated';
      notificationAuditAction = 'submission_approved';
      notificationTitle = 'Submission approved';
      notificationMessage = `${submissionLabel} has been approved by finance.`;
      changed = true;
      shouldAllocatePiOnAcceptance = true;
    }

    if (body.action === 'reject') {
      const note = body.rejection_note?.trim();
      if (!note) throw new Error('rejection_note is required');
      const existingEmployeeNote = (currentSubmission.finance_comment ?? currentSubmission.rejection_note ?? '').trim();
      if (currentSubmission.intake_status === 'rejected' && existingEmployeeNote === note) {
        return noChange('Submission is already rejected with the same note.');
      }
      patch.intake_status = 'rejected';
      patch.reviewed_by = appUser.id;
      patch.reviewed_at = now;
      patch.rejection_note = note;
      patch.finance_comment = note;
      patch.invoice_status = deriveNextInvoiceStatusDbValue({
        ...currentSubmission,
        intake_status: 'rejected',
      });
      activityAction = 'submission_rejected';
      activityFromStatus = currentSubmission.intake_status ?? null;
      activityToStatus = 'rejected';
      notificationType = 'submission_rejected';
      notificationAuditAction = 'submission_rejected';
      notificationTitle = 'Submission rejected';
      notificationMessage = `${submissionLabel} was rejected: ${note}`;
      changed = true;
    }

    if (body.action === 'request_resubmission') {
      const note = body.rejection_note?.trim();
      if (!note) throw new Error('rejection_note is required');
      const existingEmployeeNote = (currentSubmission.finance_comment ?? currentSubmission.rejection_note ?? '').trim();
      if (currentSubmission.intake_status === 'rejected' && existingEmployeeNote === note) {
        return noChange('Resubmission has already been requested with the same note.');
      }
      patch.intake_status = 'rejected';
      patch.reviewed_by = appUser.id;
      patch.reviewed_at = now;
      patch.rejection_note = note;
      patch.finance_comment = note;
      patch.invoice_status = deriveNextInvoiceStatusDbValue({
        ...currentSubmission,
        intake_status: 'rejected',
      });
      activityAction = 'resubmission_requested';
      activityFromStatus = currentSubmission.intake_status ?? null;
      activityToStatus = 'rejected';
      notificationType = 'resubmission_requested';
      notificationAuditAction = 'resubmission_requested';
      notificationTitle = 'Resubmission requested';
      notificationMessage = `Resubmission requested for ${submissionLabel}: ${note}`;
      changed = true;
    }

    if (body.action === 'mark_invoice_created') {
      const nextInvoiceNumber = body.invoice_number !== undefined ? body.invoice_number.trim() || null : currentSubmission.invoice_number || null;
      const nextDebitNoteNumber = body.debit_note_number !== undefined ? body.debit_note_number.trim() || null : currentSubmission.debit_note_number || null;
      const nextInvoiceStatus = deriveNextInvoiceStatusDbValue({
        ...currentSubmission,
        invoice_status: body.invoice_status ?? currentSubmission.invoice_status,
        invoice_number: nextInvoiceNumber,
        debit_note_number: nextDebitNoteNumber,
      });
      if (
        normalizeInvoiceStatusMachine(currentSubmission.invoice_status) === normalizeInvoiceStatusMachine(nextInvoiceStatus) &&
        (currentSubmission.invoice_number || null) === nextInvoiceNumber &&
        (currentSubmission.debit_note_number || null) === nextDebitNoteNumber
      ) {
        return noChange('Invoice tracking is already up to date.');
      }
      patch.invoice_status = nextInvoiceStatus;
      patch.reviewed_by = appUser.id;
      patch.reviewed_at = now;
      if (body.invoice_number !== undefined) patch.invoice_number = body.invoice_number.trim() || null;
      if (body.debit_note_number !== undefined) patch.debit_note_number = body.debit_note_number.trim() || null;
      activityAction = 'invoice_created';
      activityFromStatus = currentSubmission.invoice_status ?? null;
      activityToStatus = nextInvoiceStatus ?? null;
      notificationType = 'invoice_updated';
      notificationAuditAction = 'invoice_created';
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
      const nextInvoiceStatus = deriveNextInvoiceStatusDbValue({
        ...currentSubmission,
        invoice_status: body.invoice_status ?? currentSubmission.invoice_status,
        invoice_number: nextInvoiceNumber,
        debit_note_number: debitNoteNumber,
      });
      if (
        (currentSubmission.debit_note_number || null) === debitNoteNumber &&
        (currentSubmission.invoice_number || null) === nextInvoiceNumber &&
        normalizeInvoiceStatusMachine(currentSubmission.invoice_status) === normalizeInvoiceStatusMachine(nextInvoiceStatus)
      ) {
        return noChange('Debit note details are already saved.');
      }
      patch.debit_note_number = debitNoteNumber;
      patch.invoice_status = nextInvoiceStatus;
      if (body.invoice_number?.trim()) patch.invoice_number = body.invoice_number.trim();
      patch.reviewed_by = appUser.id;
      patch.reviewed_at = now;
      activityAction = 'debit_note_added';
      activityFromStatus = currentSubmission.invoice_status ?? null;
      activityToStatus = nextInvoiceStatus ?? null;
      notificationType = 'invoice_updated';
      notificationAuditAction = 'debit_note_added';
      notificationTitle = 'Debit note added';
      notificationMessage = `${submissionLabel} invoice status is now ${invoiceStatusLabel(nextInvoiceStatus)}.`;
      changed = true;
    }

    if (body.action === 'update_payment_status') {
      if (
        !body.creator_invoice_status &&
        !body.payment_received_status &&
        !body.payment_made_status &&
        body.finance_notes === undefined &&
        body.finance_external_notes === undefined
      ) {
        throw new Error('At least one finance status is required');
      }
      const nextCreatorInvoice = body.creator_invoice_status ?? currentSubmission.creator_invoice_status ?? 'pending';
      const nextReceived = body.payment_received_status ?? currentSubmission.payment_received_status ?? 'pending';
      const nextMade = body.payment_made_status ?? currentSubmission.payment_made_status ?? 'pending';
      const nextFinanceNotes = body.finance_notes !== undefined ? body.finance_notes.trim() || null : currentSubmission.finance_notes ?? null;
      const nextFinanceExternalNotes = body.finance_external_notes !== undefined ? body.finance_external_notes.trim() || null : currentSubmission.finance_external_notes ?? null;
      if (
        (currentSubmission.creator_invoice_status ?? 'pending') === nextCreatorInvoice &&
        (currentSubmission.payment_received_status ?? 'pending') === nextReceived &&
        (currentSubmission.payment_made_status ?? 'pending') === nextMade &&
        (currentSubmission.finance_notes ?? null) === nextFinanceNotes &&
        (currentSubmission.finance_external_notes ?? null) === nextFinanceExternalNotes
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
      if (body.finance_notes !== undefined) {
        patch.finance_notes = nextFinanceNotes;
      }
      if (body.finance_external_notes !== undefined) {
        patch.finance_external_notes = nextFinanceExternalNotes;
      }
      patch.reviewed_by = appUser.id;
      patch.reviewed_at = now;
      activityAction = 'payment_status_updated';
      activityFromStatus = currentSubmission.payment_made_status ?? currentSubmission.payment_received_status ?? currentSubmission.creator_invoice_status ?? null;
      activityToStatus = body.payment_made_status ?? body.payment_received_status ?? body.creator_invoice_status ?? null;
      notificationType = 'invoice_updated';
      notificationAuditAction = body.payment_received_status
        ? 'payment_received'
        : body.creator_invoice_status
          ? 'creator_invoice_received'
          : body.payment_made_status
            ? 'payment_made'
            : 'payment_status_updated';
      notificationTitle = 'Payment status updated';
      notificationMessage = `${submissionLabel} finance tracking was updated by finance.`;
      changed = true;
    }

    if (body.action === 'close_submission') {
      const closureStatus = body.closure_status ?? 'closed';
      const currentClosureStatus = normalizeClosureStatus(currentSubmission.closure_status ?? currentSubmission.closed);
      if (currentClosureStatus === closureStatus) {
        return noChange(`Submission is already ${closureStatus}.`);
      }
      patch.closure_status = closureStatus;
      patch.closed = toLegacyClosed(closureStatus);
      patch.reviewed_by = appUser.id;
      patch.reviewed_at = now;
      const reopeningClosedSubmission = currentClosureStatus === 'closed' && closureStatus === 'open';
      activityAction = reopeningClosedSubmission ? 'submission_reopened' : 'submission_closed';
      activityFromStatus = currentClosureStatus;
      activityToStatus = closureStatus;
      notificationType = reopeningClosedSubmission ? 'submission_reopened' : 'invoice_updated';
      notificationAuditAction = reopeningClosedSubmission ? 'submission_reopened' : 'submission_closed';
      notificationTitle = reopeningClosedSubmission
        ? 'Closed submission reopened'
        : closureStatus === 'cancelled'
          ? 'Submission cancelled'
          : 'Submission closed';
      notificationMessage = reopeningClosedSubmission
        ? submissionLabel + ' was reopened by ' + actorDisplayName + '. Previous status: ' + currentClosureStatus + '. Current status: ' + closureStatus + '.'
        : `${submissionLabel} is now ${closureStatus}.`;
      changed = true;
    }

    if (!changed) {
      return noChange('No state change was needed.');
    }

    const { data: updated, error: updateError } = await userClient
      .from('intake_submissions')
      .update(patch)
      .eq('id', body.submission_id)
      .select('id, proforma_invoice, intake_status, invoice_status, invoice_number, debit_note_number, finance_notes, finance_external_notes, finance_comment, creator_invoice_status, payment_received_status, payment_made_status, closure_status, rejection_note, reviewed_at')
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? 'Failed to update submission');
    }

    if (shouldAllocatePiOnAcceptance) {
      let piNotRequired = false;
      try {
        piNotRequired = await shouldSkipPiForSubmission(adminClient, currentSubmission);
        if (!effectivePiNumber && !piNotRequired) {
          effectivePiNumber = await allocateGapFreePiForSubmission(adminClient, currentSubmission.id);
        }
      } catch (piError) {
        const revertPatch = {
          intake_status: currentSubmission.intake_status,
          invoice_status: currentSubmission.invoice_status,
          reviewed_by: currentSubmission.reviewed_by,
          reviewed_at: currentSubmission.reviewed_at,
          rejection_note: currentSubmission.rejection_note,
          finance_comment: currentSubmission.finance_comment,
        };
        const { error: rollbackError } = await adminClient
          .from('intake_submissions')
          .update(revertPatch)
          .eq('id', currentSubmission.id)
          .is('proforma_invoice', null);

        if (rollbackError) {
          console.error('Failed to roll back accepted status after PI allocation failure', {
            submissionId: currentSubmission.id,
            error: rollbackError.message,
          });
        }

        const message = piError instanceof Error ? piError.message : 'Failed to allocate PI number.';
        throw new Error(message);
      }

      submissionLabel = submissionPiLabel(effectivePiNumber, piNotRequired);
      notificationMessage = `${submissionLabel} has been approved by finance.`;
    }

    const activityEntries: Array<{
      action: string;
      details: Record<string, unknown>;
      structured: {
        action_type: string;
        from_status?: string | null;
        to_status?: string | null;
        entity_type: 'submission';
        entity_id: string;
        metadata: Record<string, unknown>;
      };
    }> = [];

    if (!currentSubmission.reviewed_at) {
      activityEntries.push({
        action: 'finance_review_started',
        details: {
          message: `Finance review started for ${submissionLabel}.`,
          pi_number: effectivePiNumber,
          business_line: currentSubmission.business_line ?? null,
        },
        structured: {
          action_type: 'finance_review_started',
          from_status: null,
          to_status: currentSubmission.intake_status ?? 'under_review',
          entity_type: 'submission',
          entity_id: body.submission_id,
          metadata: {
            pi_number: effectivePiNumber,
            business_line: currentSubmission.business_line ?? null,
            actor_role: appUser.role,
            actor_name: actorDisplayName,
          },
        },
      });
    }

    if (body.action === 'update_payment_status') {
      const statusEvents = [
        {
          changed: Boolean(body.payment_received_status) && currentSubmission.payment_received_status !== body.payment_received_status,
          action: 'payment_received',
          fromStatus: currentSubmission.payment_received_status ?? null,
          toStatus: body.payment_received_status ?? null,
          message: `Payment received status updated for ${submissionLabel}.`,
          oldValue: currentSubmission.payment_received_status ?? null,
          newValue: body.payment_received_status ?? null,
        },
        {
          changed: Boolean(body.creator_invoice_status) && currentSubmission.creator_invoice_status !== body.creator_invoice_status,
          action: 'creator_invoice_received',
          fromStatus: currentSubmission.creator_invoice_status ?? null,
          toStatus: body.creator_invoice_status ?? null,
          message: `Creator invoice status updated for ${submissionLabel}.`,
          oldValue: currentSubmission.creator_invoice_status ?? null,
          newValue: body.creator_invoice_status ?? null,
        },
        {
          changed: Boolean(body.payment_made_status) && currentSubmission.payment_made_status !== body.payment_made_status,
          action: 'payment_made',
          fromStatus: currentSubmission.payment_made_status ?? null,
          toStatus: body.payment_made_status ?? null,
          message: `Payment made status updated for ${submissionLabel}.`,
          oldValue: currentSubmission.payment_made_status ?? null,
          newValue: body.payment_made_status ?? null,
        },
      ];

      for (const event of statusEvents) {
        if (!event.changed) continue;
        activityEntries.push({
          action: event.action,
          details: {
            message: event.message,
            old_value: event.oldValue,
            new_value: event.newValue,
          },
          structured: {
            action_type: event.action,
            from_status: event.fromStatus,
            to_status: event.toStatus,
            entity_type: 'submission',
            entity_id: body.submission_id,
            metadata: {
              pi_number: effectivePiNumber,
              business_line: currentSubmission.business_line ?? null,
              old_value: event.oldValue,
              new_value: event.newValue,
              actor_role: appUser.role,
              financial_year: currentSubmission.financial_year ?? null,
              module: 'finance',
            },
          },
        });
      }

      if (activityEntries.length === 0 || (activityEntries.length === 1 && activityEntries[0].action === 'finance_review_started')) {
        activityEntries.push({
          action: activityAction,
          details: {
            message: `Finance tracking updated for ${submissionLabel}.`,
            actor_role: appUser.role,
            actor_name: actorDisplayName,
            previous: {
              finance_notes: submission.finance_notes,
              finance_external_notes: submission.finance_external_notes,
            },
            next: patch,
          },
          structured: {
            action_type: activityAction,
            from_status: activityFromStatus,
            to_status: activityToStatus,
            entity_type: 'submission',
            entity_id: body.submission_id,
            metadata: {
              pi_number: effectivePiNumber,
              submission_id: body.submission_id,
              actor_role: appUser.role,
              previous_intake_status: submission.intake_status,
              previous_closure_status: submission.closure_status ?? submission.closed,
              financial_year: currentSubmission.financial_year ?? null,
              module: 'finance',
            },
          },
        });
      }
    } else {
      activityEntries.push({
        action: activityAction,
        details: {
          message: `${activityAction} applied to ${submissionLabel}.`,
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
            finance_notes: submission.finance_notes,
            finance_external_notes: submission.finance_external_notes,
          },
          next: patch,
        },
        structured: {
          action_type: activityAction,
          from_status: activityFromStatus,
          to_status: activityToStatus,
          entity_type: 'submission',
          entity_id: body.submission_id,
          metadata: {
            pi_number: effectivePiNumber,
            submission_id: body.submission_id,
            actor_role: appUser.role,
            actor_name: actorDisplayName,
            business_line: currentSubmission.business_line ?? null,
            previous_intake_status: submission.intake_status,
            previous_closure_status: submission.closure_status ?? submission.closed,
          },
        },
      });
    }

    let auditLogId = '';
    for (const entry of activityEntries) {
      const createdLogId = await logSubmissionAction(
        userClient,
        appUser.id,
        body.submission_id,
        entry.action,
        entry.details,
        entry.structured
      );
      if (!auditLogId && (!notificationAuditAction || entry.structured.action_type === notificationAuditAction)) {
        auditLogId = createdLogId;
      }
    }

    if (notificationType) {
      if (notificationType === 'submission_reopened') {
        await createSubmissionReopenedNotifications({
          adminClient,
          actorUserId: appUser.id,
          submittedBy: String(currentSubmission.submitted_by),
          title: notificationTitle,
          message: notificationMessage,
          relatedSubmissionId: body.submission_id,
          auditLogId,
        });
      } else {
        await createEmployeeNotification({
          adminClient,
          submittedBy: String(currentSubmission.submitted_by),
          type: notificationType,
          title: notificationTitle,
          message: notificationMessage,
          relatedSubmissionId: body.submission_id,
          auditLogId,
        });
      }
    }

    await syncFollowUps(adminClient);
    return NextResponse.json({
      success: true,
      changed: true,
      submission: {
        ...updated,
        proforma_invoice: effectivePiNumber,
        invoice_status: deriveNextInvoiceStatusDbValue(updated),
      },
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update submission.' },
      { status: 400 }
    );
  }
}
