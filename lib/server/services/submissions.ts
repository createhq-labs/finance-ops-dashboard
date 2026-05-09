import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppUser, SanitizedLineItemPayload, SanitizedSubmissionPayload } from '../types/submissions';

type CreateSubmissionResult =
  | {
      success: true;
      submission: { id: string; proforma_invoice: string; sync_status: string | null };
    }
  | {
      success: false;
      stage: 'insert_submission' | 'insert_line_items';
      error: string;
    };

export async function createSubmissionWithLineItems(params: {
  userClient: SupabaseClient;
  adminClient: SupabaseClient;
  appUser: AppUser;
  submissionPayload: SanitizedSubmissionPayload;
  lineItemsPayload: SanitizedLineItemPayload[];
}): Promise<CreateSubmissionResult> {
  const { userClient, adminClient, appUser, submissionPayload, lineItemsPayload } = params;

  const { data: submission, error: submissionError } = await userClient
    .from('intake_submissions')
    .insert({ ...submissionPayload, submitted_by: appUser.id })
    .select('id, proforma_invoice, sync_status')
    .single();

  if (submissionError || !submission) {
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
      return {
        success: false,
        stage: 'insert_line_items',
        error: lineError.message,
      };
    }
  }

  return { success: true, submission };
}