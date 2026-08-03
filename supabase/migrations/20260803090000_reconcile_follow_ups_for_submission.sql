-- Atomic, submission-scoped follow-up reconciliation.
--
-- Rollback:
--   drop function if exists public.reconcile_follow_ups_for_submission(uuid, jsonb, uuid);
--
-- Why this exists:
-- syncFollowUps() (lib/server/services/followUps.ts) re-reads and re-diffs
-- every latest-version submission and every pending follow-up on every call,
-- across several separate, non-transactional statements. It was invoked once
-- per finance action request. Two overlapping requests (different finance
-- staff, retries, double-clicks) each computed their own desired/existing
-- diff from independent, un-locked snapshots, so one execution's decision
-- could complete a follow-up that another execution's fresher read still
-- considered required - producing duplicate create/complete cycles.
--
-- This function replaces that runtime call with a reconciliation scoped to
-- exactly one submission, executed as a single Postgres transaction.
-- Business-rule computation (Bill Due / GST eligibility, due-date math, team
-- lead lookup) is NOT duplicated here - it stays in the existing TypeScript
-- predicates (needsPaymentReceivedFollowUp / needsGstFollowUp / parseDueDate)
-- and is passed in as the already-computed desired list for this submission.
--
-- Safety notes:
-- - pg_advisory_xact_lock serializes concurrent calls for the SAME
--   submission_id only; calls for different submissions never block each
--   other and never touch each other's rows (every statement below is
--   scoped by submission_id = p_submission_id).
-- - "for update" additionally locks this submission's own pending follow_ups
--   rows for the duration of the transaction.
-- - Existing follow_ups history (completed rows, other submissions) is never
--   modified by this migration or this function.
-- - A row whose type is still desired with an unchanged assignee is left
--   completely untouched (no write), so repeated calls with unchanged
--   submission state are a true no-op.

create or replace function public.reconcile_follow_ups_for_submission(
  p_submission_id uuid,
  p_desired jsonb,
  p_completed_by uuid default null
)
returns table (
  created_count integer,
  updated_count integer,
  completed_count integer
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_now timestamptz := timezone('utc', now());
  v_created integer := 0;
  v_updated integer := 0;
  v_completed integer := 0;
  v_desired_types text[];
  v_item jsonb;
  v_type text;
  v_employee uuid;
  v_team_lead uuid;
  v_due timestamptz;
  v_existing_id uuid;
  v_existing_employee uuid;
  v_existing_team_lead uuid;
  v_inserted_id uuid;
begin
  if p_submission_id is null then
    raise exception 'p_submission_id is required';
  end if;

  if p_desired is null or jsonb_typeof(p_desired) <> 'array' then
    raise exception 'p_desired must be a JSON array';
  end if;

  -- Serialize every reconciliation attempt for this one submission so
  -- concurrent finance-action requests cannot interleave read-decide-write
  -- cycles against stale snapshots of this submission's follow-ups.
  perform pg_advisory_xact_lock(hashtextextended(p_submission_id::text, 0));

  -- Belt-and-suspenders row lock: pins this submission's pending rows for
  -- the rest of the transaction.
  perform 1
  from public.follow_ups
  where submission_id = p_submission_id
    and status = 'pending'
  for update;

  v_desired_types := array(
    select jsonb_array_elements(p_desired) ->> 'follow_up_type'
  );

  -- Complete pending rows for this submission whose type is no longer
  -- desired. Scoped strictly by submission_id - no other submission's rows
  -- are ever read or written.
  with completed as (
    update public.follow_ups f
    set status = 'completed',
        completed_at = v_now,
        completed_by = p_completed_by,
        completion_reason = 'Current status no longer requires follow-up.',
        updated_at = v_now
    where f.submission_id = p_submission_id
      and f.status = 'pending'
      and not (f.follow_up_type = any(v_desired_types))
    returning f.id
  )
  select count(*) into v_completed from completed;

  -- Collapse any pre-existing duplicate pending rows of the same type for
  -- this submission (legacy state from the previous non-atomic reconciler)
  -- down to exactly one, keeping the oldest.
  with ranked as (
    select id,
           row_number() over (
             partition by follow_up_type
             order by created_at asc, id asc
           ) as rn
    from public.follow_ups
    where submission_id = p_submission_id
      and status = 'pending'
  ),
  superseded as (
    update public.follow_ups f
    set status = 'completed',
        completed_at = v_now,
        completed_by = p_completed_by,
        completion_reason = 'Superseded by another pending follow-up of the same type for this submission.',
        updated_at = v_now
    from ranked r
    where f.id = r.id
      and r.rn > 1
    returning f.id
  )
  select v_completed + count(*) into v_completed from superseded;

  -- Walk the desired list: create missing, update ownership if the assignee
  -- changed, otherwise leave the existing pending row completely untouched.
  for v_item in select * from jsonb_array_elements(p_desired)
  loop
    v_type := v_item ->> 'follow_up_type';
    v_employee := (v_item ->> 'assigned_employee_id')::uuid;
    v_team_lead := nullif(v_item ->> 'assigned_team_lead_id', '')::uuid;
    v_due := (v_item ->> 'due_date')::timestamptz;

    select id, assigned_employee_id, assigned_team_lead_id
      into v_existing_id, v_existing_employee, v_existing_team_lead
    from public.follow_ups
    where submission_id = p_submission_id
      and follow_up_type = v_type
      and status = 'pending'
    order by created_at asc
    limit 1;

    if v_existing_id is null then
      insert into public.follow_ups (
        submission_id, follow_up_type, assigned_employee_id, assigned_team_lead_id,
        due_date, status, last_notified_at, next_notification_at, created_at, updated_at
      ) values (
        p_submission_id, v_type, v_employee, v_team_lead,
        v_due, 'pending', null, v_now, v_now, v_now
      )
      on conflict do nothing
      returning id into v_inserted_id;

      if v_inserted_id is not null then
        v_created := v_created + 1;
      end if;
    elsif v_existing_employee is distinct from v_employee
       or v_existing_team_lead is distinct from v_team_lead then
      update public.follow_ups
      set assigned_employee_id = v_employee,
          assigned_team_lead_id = v_team_lead,
          updated_at = v_now
      where id = v_existing_id;

      v_updated := v_updated + 1;
    end if;
    -- else: nothing changed for this follow-up type - zero writes.
  end loop;

  return query select v_created, v_updated, v_completed;
end;
$fn$;

revoke execute on function public.reconcile_follow_ups_for_submission(uuid, jsonb, uuid) from public;
revoke execute on function public.reconcile_follow_ups_for_submission(uuid, jsonb, uuid) from anon;
revoke execute on function public.reconcile_follow_ups_for_submission(uuid, jsonb, uuid) from authenticated;
grant execute on function public.reconcile_follow_ups_for_submission(uuid, jsonb, uuid) to service_role;
