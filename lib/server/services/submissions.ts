import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppUser, SanitizedLineItemPayload, SanitizedSubmissionPayload } from '../types/submissions';

type CreateSubmissionResult =
  | {
      success: true;
      pi_allocation_pending: boolean;
      submission: { id: string; proforma_invoice: string | null; sync_status: string | null; currency: string | null; financial_year: string | null };
    }
  | {
      success: false;
      stage: 'fetch_previous_submission' | 'insert_submission' | 'insert_line_items';
      error: string;
    };

export type ResolvedPreviousSubmissionForCreate = {
  id: string;
  proforma_invoice: string | null;
};

type SubmissionChainRow = {
  id: string;
  previous_submission_id: string | null;
  proforma_invoice: string | null;
  is_latest_version?: boolean | null;
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

export function shouldSkipPiGeneration(
  submissionPayload: Pick<SanitizedSubmissionPayload, 'invoice_type'>,
  lineItemsPayload: Array<Pick<SanitizedLineItemPayload, 'deliverable_name'>>
) {
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
  resolvedPreviousSubmission?: ResolvedPreviousSubmissionForCreate | null;
}): Promise<CreateSubmissionResult> {
  const { userClient, adminClient, appUser, submissionPayload, lineItemsPayload, resolvedPreviousSubmission = null } = params;
  const dbSubmissionPayload = Object.fromEntries(
    Object.entries(submissionPayload).filter(
      ([key]) => key !== 'city' && key !== 'state' && key !== 'country' && key !== 'pincode'
    )
  ) as Omit<SanitizedSubmissionPayload, 'city' | 'state' | 'country' | 'pincode'>;

  const shouldSkipPi = shouldSkipPiGeneration(submissionPayload, lineItemsPayload);
  let carryForwardPi: string | null | undefined;
  let previousSubmissionId: string | null = null;

  if (submissionPayload.previous_submission_id) {
    if (!resolvedPreviousSubmission?.id || resolvedPreviousSubmission.id !== submissionPayload.previous_submission_id) {
      return {
        success: false,
        stage: 'fetch_previous_submission',
        error: 'Validated previous submission is required for resubmission',
      };
    }

    previousSubmissionId = resolvedPreviousSubmission.id;
    carryForwardPi = resolvedPreviousSubmission.proforma_invoice ?? null;

    const { error: supersedeError } = await adminClient
      .from('intake_submissions')
      .update({
        is_latest_version: false,
        superseded_at: new Date().toISOString(),
      })
      .eq('id', previousSubmissionId)
      .eq('is_latest_version', true);

    if (supersedeError) {
      return {
        success: false,
        stage: 'fetch_previous_submission',
        error: supersedeError.message,
      };
    }
  }

  const insertPayload = {
    ...dbSubmissionPayload,
    previous_submission_id: previousSubmissionId,
    submitted_by: appUser.id,
    assigned_to_user_id: appUser.id,
    original_submitted_by: appUser.id,
    financial_year: getFinancialYearLabel(submissionPayload.submitted_at),
    ...(submissionPayload.previous_submission_id
      ? { proforma_invoice: carryForwardPi ?? null }
      : {
          // New submissions stay PI-null until finance acceptance allocates a gap-free PI.
          proforma_invoice: null,
        }),
  };

  const { data: submission, error: submissionError } = await userClient
    .from('intake_submissions')
    .insert(insertPayload)
    .select('id, proforma_invoice, sync_status, currency, financial_year')
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

  return {
    success: true,
    pi_allocation_pending: !submissionPayload.previous_submission_id && !shouldSkipPi,
    submission,
  };
}

export async function getSubmissionChainRows(adminClient: SupabaseClient, submissionId: string) {
  const { data, error } = await adminClient.rpc('resolve_submission_chain', {
    p_submission_id: submissionId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const chainRows = (data ?? []) as SubmissionChainRow[];
  if (chainRows.length === 0) {
    throw new Error('Submission not found for chain resolution.');
  }

  const dedupedRows = new Map(chainRows.map((row) => [String(row.id), row]));
  if (!dedupedRows.has(submissionId)) {
    throw new Error('Submission not found in resolved chain.');
  }

  return Array.from(dedupedRows.values());
}

export async function findExistingPiInSubmissionChain(adminClient: SupabaseClient, submissionId: string) {
  const chainRows = await getSubmissionChainRows(adminClient, submissionId);
  const distinctPis = Array.from(
    new Set(
      chainRows
        .map((row) => String(row.proforma_invoice ?? '').trim())
        .filter(Boolean)
    )
  );

  if (distinctPis.length === 0) return null;
  if (distinctPis.length === 1) return distinctPis[0];

  throw new Error(
    'Conflicting PI values found in submission chain: ' + distinctPis.join(', ')
  );
}

export async function allocateOrReusePiForSubmissionChain(adminClient: SupabaseClient, submissionId: string) {
  const { data, error } = await adminClient.rpc('allocate_or_reuse_chain_pi', {
    p_submission_id: submissionId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const piNumber = String(data ?? '').trim();
  if (!piNumber) {
    throw new Error('Failed to allocate or reuse PI number.');
  }

  return piNumber;
}

export async function allocateGapFreePiForSubmission(adminClient: SupabaseClient, submissionId: string) {
  const { data, error } = await adminClient.rpc('allocate_gap_free_pi', {
    p_submission_id: submissionId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const piNumber = String(data ?? '').trim();
  if (!piNumber) {
    throw new Error('Failed to allocate PI number.');
  }

  const { data: persistedSubmission, error: persistedError } = await adminClient
    .from('intake_submissions')
    .update({ proforma_invoice: piNumber })
    .eq('id', submissionId)
    .is('proforma_invoice', null)
    .select('proforma_invoice')
    .maybeSingle();

  if (persistedError) {
    throw new Error(persistedError.message);
  }

  if (persistedSubmission?.proforma_invoice === piNumber) {
    return piNumber;
  }

  const { data: currentSubmission, error: currentError } = await adminClient
    .from('intake_submissions')
    .select('proforma_invoice')
    .eq('id', submissionId)
    .maybeSingle();

  if (currentError) {
    throw new Error(currentError.message);
  }

  if (currentSubmission?.proforma_invoice === piNumber) {
    return piNumber;
  }

  throw new Error('PI was allocated but not persisted to the submission.');
}
