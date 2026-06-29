import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppUser, SanitizedLineItemPayload, SanitizedSubmissionPayload } from '../types/submissions';

type CreateSubmissionResult =
  | {
      success: true;
      submission: { id: string; proforma_invoice: string | null; sync_status: string | null; currency: string | null };
    }
  | {
      success: false;
      stage: 'fetch_previous_submission' | 'insert_submission' | 'insert_line_items';
      error: string;
    };

function getFinancialYearLabel(sourceDate: string | Date | null | undefined) {
  const fallbackDate = new Date();
  const parsedDate = sourceDate ? new Date(sourceDate) : fallbackDate;
  const date = Number.isNaN(parsedDate.getTime()) ? fallbackDate : parsedDate;
  const startYear = date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return String(startYear) + '-' + endYearShort;
}

function normalizeComparison(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function shouldSkipPiGeneration(submissionPayload: SanitizedSubmissionPayload, lineItemsPayload: SanitizedLineItemPayload[]) {
  // Audited against the current schema/payload: invoice_type is a structured submission field,
  // and Product Reimbursement arrives through intake_line_items.deliverable_name.
  if (normalizeComparison(submissionPayload.invoice_type) !== normalizeComparison('Reimbursement Invoice (Without GST)')) {
    return false;
  }

  if (lineItemsPayload.length !== 1) return false;

  return normalizeComparison(lineItemsPayload[0]?.deliverable_name) === normalizeComparison('Product Reimbursement');
}

export async function createSubmissionWithLineItems(params: {
  userClient: SupabaseClient;
  adminClient: SupabaseClient;
  appUser: AppUser;
  submissionPayload: SanitizedSubmissionPayload;
  lineItemsPayload: SanitizedLineItemPayload[];
}): Promise<CreateSubmissionResult> {
  const { userClient, adminClient, appUser, submissionPayload, lineItemsPayload } = params;

  const shouldSkipPi = shouldSkipPiGeneration(submissionPayload, lineItemsPayload);
  let carryForwardPi: string | null | undefined;
  let previousSubmissionId: string | null = null;

  if (submissionPayload.previous_submission_id) {
    previousSubmissionId = submissionPayload.previous_submission_id;
    const { data: previousSubmission, error: previousError } = await adminClient
      .from('intake_submissions')
      .select('proforma_invoice')
      .eq('id', previousSubmissionId)
      .maybeSingle();

    if (previousError) {
      return {
        success: false,
        stage: 'fetch_previous_submission',
        error: previousError.message,
      };
    }

    if (!previousSubmission) {
      return {
        success: false,
        stage: 'fetch_previous_submission',
        error: 'Previous submission not found for resubmission',
      };
    }

    carryForwardPi = previousSubmission.proforma_invoice ?? null;

    const { error: supersedeError } = await adminClient
      .from('intake_submissions')
      .update({
        is_latest_version: false,
        superseded_at: new Date().toISOString(),
      })
      .eq('id', previousSubmissionId);

    if (supersedeError) {
      return {
        success: false,
        stage: 'fetch_previous_submission',
        error: supersedeError.message,
      };
    }
  }

  const insertPayload = {
    ...submissionPayload,
    submitted_by: appUser.id,
    financial_year: getFinancialYearLabel(submissionPayload.submitted_at),
    ...(submissionPayload.previous_submission_id
      ? { proforma_invoice: carryForwardPi ?? null }
      : shouldSkipPi
        ? { proforma_invoice: null }
        : {}),
  };

  const { data: submission, error: submissionError } = await userClient
    .from('intake_submissions')
    .insert(insertPayload)
    .select('id, proforma_invoice, sync_status, currency')
    .single();

  if (submissionError || !submission) {
    if (previousSubmissionId) {
      await adminClient
        .from('intake_submissions')
        .update({
          is_latest_version: true,
          superseded_at: null,
        })
        .eq('id', previousSubmissionId);
    }

    return {
      success: false,
      stage: 'insert_submission',
      error: submissionError?.message ?? 'Failed to create submission',
    };
  }

  if (lineItemsPayload.length > 0) {
    const lineItems = lineItemsPayload.map((li) => ({ ...li, submission_id: submission.id }));
    const { error: lineError } = await userClient.from('intake_line_items').insert(lineItems);

    if (lineError) {
      await adminClient.from('intake_submissions').delete().eq('id', submission.id);
      if (previousSubmissionId) {
        await adminClient
          .from('intake_submissions')
          .update({
            is_latest_version: true,
            superseded_at: null,
          })
          .eq('id', previousSubmissionId);
      }
      return {
        success: false,
        stage: 'insert_line_items',
        error: lineError.message,
      };
    }
  }

  return { success: true, submission };
}
