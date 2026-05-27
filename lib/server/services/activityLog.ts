import type { SupabaseClient } from '@supabase/supabase-js';

export async function logSubmissionCreated(
  client: SupabaseClient,
  actorUserId: string,
  submissionId: string,
  details: Record<string, unknown>
): Promise<void> {
  const { error } = await client.from('activity_log').insert({
    actor_user_id: actorUserId,
    submission_id: submissionId,
    action: 'submission_created',
    details,
  });

  if (error) throw new Error(`Activity log failed: ${error.message}`);
}

export async function logSubmissionAction(
  client: SupabaseClient,
  actorUserId: string,
  submissionId: string,
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  const { error } = await client.from('activity_log').insert({
    actor_user_id: actorUserId,
    submission_id: submissionId,
    action,
    details,
  });

  if (error) throw new Error(`Activity log failed: ${error.message}`);
}
