import type { SupabaseClient } from '@supabase/supabase-js';

type StructuredLogFields = {
  action_type?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
};

type ActivityEventInput = {
  actorUserId: string;
  action: string;
  details: Record<string, unknown>;
  submissionId?: string | null;
  structured?: StructuredLogFields;
};

export async function logActivityEvent(
  client: SupabaseClient,
  input: ActivityEventInput
): Promise<string> {
  const { actorUserId, action, details, submissionId = null, structured } = input;

  const { data, error } = await client
    .from('activity_log')
    .insert({
      actor_user_id: actorUserId,
      submission_id: submissionId,
      action,
      details,
      action_type: structured?.action_type ?? action,
      from_status: structured?.from_status ?? null,
      to_status: structured?.to_status ?? null,
      entity_type: structured?.entity_type ?? (submissionId ? 'submission' : null),
      entity_id: structured?.entity_id ?? submissionId,
      metadata: structured?.metadata ?? {},
    })
    .select('id')
    .single();

  if (error) throw new Error(`Activity log failed: ${error.message}`);
  return String(data?.id ?? '');
}

export async function logSubmissionCreated(
  client: SupabaseClient,
  actorUserId: string,
  submissionId: string,
  details: Record<string, unknown>
): Promise<void> {
  await logActivityEvent(client, {
    actorUserId,
    submissionId,
    action: 'submission_created',
    details,
    structured: {
      action_type: 'submission_created',
      entity_type: 'submission',
      entity_id: submissionId,
      metadata: details,
    },
  });
}

export async function logSubmissionAction(
  client: SupabaseClient,
  actorUserId: string,
  submissionId: string,
  action: string,
  details: Record<string, unknown>,
  structured?: StructuredLogFields
): Promise<string> {
  return logActivityEvent(client, {
    actorUserId,
    submissionId,
    action,
    details,
    structured,
  });
}
