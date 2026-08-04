create or replace function public.allocate_or_reuse_chain_pi(p_submission_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  lock_submission_id uuid;
  current_submission public.intake_submissions%rowtype;
  distinct_pis text[];
  effective_pi text;
begin
  if p_submission_id is null then
    raise exception 'Submission id is required for chain PI allocation';
  end if;

  select *
  into current_submission
  from public.intake_submissions
  where id = p_submission_id;

  if not found then
    raise exception 'Submission not found for chain PI allocation';
  end if;

  with chain_rows as (
    select *
    from public.resolve_submission_chain(p_submission_id)
  )
  select coalesce(
    (
      select id
      from chain_rows
      where previous_submission_id is null
      order by id::text asc
      limit 1
    ),
    (
      select id
      from chain_rows
      order by id::text asc
      limit 1
    )
  )
  into lock_submission_id;

  if lock_submission_id is null then
    raise exception 'Submission chain could not be resolved for PI allocation';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('submission_chain_pi_lock'),
    hashtext(lock_submission_id::text)
  );

  select *
  into current_submission
  from public.intake_submissions
  where id = p_submission_id;

  if not found then
    raise exception 'Submission not found for chain PI allocation';
  end if;

  with chain_rows as (
    select *
    from public.resolve_submission_chain(p_submission_id)
  )
  select array_agg(distinct pi_value order by pi_value)
  into distinct_pis
  from (
    select nullif(btrim(proforma_invoice), '') as pi_value
    from chain_rows
  ) as normalized
  where pi_value is not null;

  if not exists (
    select 1
    from public.resolve_submission_chain(p_submission_id)
    where id = p_submission_id
  ) then
    raise exception 'Submission not found in resolved chain for PI allocation';
  end if;

  if exists (
    select 1
    from public.resolve_submission_chain(p_submission_id)
    where id = p_submission_id
      and is_latest_version = false
  ) then
    raise exception 'Superseded submissions cannot receive a PI.';
  end if;

  if coalesce(array_length(distinct_pis, 1), 0) > 1 then
    raise exception 'Conflicting PI values found in submission chain: %', array_to_string(distinct_pis, ', ');
  end if;

  if coalesce(array_length(distinct_pis, 1), 0) = 1 then
    effective_pi := distinct_pis[1];

    update public.intake_submissions
    set proforma_invoice = effective_pi
    where id = p_submission_id
      and proforma_invoice is null;

    return effective_pi;
  end if;

  effective_pi := public.allocate_gap_free_pi(p_submission_id);

  if effective_pi is null or btrim(effective_pi) = '' then
    raise exception 'Failed to allocate PI number.';
  end if;

  return effective_pi;
end;
$fn$;

revoke execute on function public.allocate_or_reuse_chain_pi(uuid) from public;
revoke execute on function public.allocate_or_reuse_chain_pi(uuid) from anon;
revoke execute on function public.allocate_or_reuse_chain_pi(uuid) from authenticated;
grant execute on function public.allocate_or_reuse_chain_pi(uuid) to service_role;
