create or replace function public.resolve_submission_chains_bulk(p_submission_ids uuid[])
returns table (
  input_submission_id uuid,
  id uuid,
  previous_submission_id uuid,
  proforma_invoice text,
  is_latest_version boolean
)
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_submission_ids is null or cardinality(p_submission_ids) = 0 then
    raise exception 'Submission ids are required for bulk chain resolution';
  end if;

  if exists (
    with requested_ids as (
      select distinct requested_id
      from unnest(p_submission_ids) as requested_id
      where requested_id is not null
    )
    select 1
    from requested_ids
    left join public.intake_submissions
      on intake_submissions.id = requested_ids.requested_id
    where intake_submissions.id is null
  ) then
    raise exception 'One or more submissions were not found for bulk chain resolution';
  end if;

  return query
  with recursive requested_ids as (
    select distinct requested_id as input_submission_id
    from unnest(p_submission_ids) as requested_id
    where requested_id is not null
  ),
  ancestors as (
    select
      requested_ids.input_submission_id,
      s.id,
      s.previous_submission_id,
      s.proforma_invoice,
      s.is_latest_version,
      array[s.id]::uuid[] as path
    from requested_ids
    join public.intake_submissions as s
      on s.id = requested_ids.input_submission_id

    union all

    select
      ancestors.input_submission_id,
      parent.id,
      parent.previous_submission_id,
      parent.proforma_invoice,
      parent.is_latest_version,
      ancestors.path || parent.id
    from public.intake_submissions as parent
    join ancestors
      on ancestors.previous_submission_id = parent.id
    where not parent.id = any(ancestors.path)
  ),
  root_row as (
    select distinct on (ancestors.input_submission_id)
      ancestors.input_submission_id,
      ancestors.id,
      ancestors.previous_submission_id,
      ancestors.proforma_invoice,
      ancestors.is_latest_version,
      cardinality(ancestors.path) as path_length
    from ancestors
    where ancestors.previous_submission_id is null
    order by ancestors.input_submission_id, cardinality(ancestors.path) desc
  ),
  fallback_root as (
    select distinct on (ancestors.input_submission_id)
      ancestors.input_submission_id,
      ancestors.id,
      ancestors.previous_submission_id,
      ancestors.proforma_invoice,
      ancestors.is_latest_version,
      cardinality(ancestors.path) as path_length
    from ancestors
    order by ancestors.input_submission_id, cardinality(ancestors.path) desc
  ),
  chosen_root as (
    select
      requested_ids.input_submission_id,
      coalesce(root_row.id, fallback_root.id) as id,
      coalesce(root_row.previous_submission_id, fallback_root.previous_submission_id) as previous_submission_id,
      coalesce(root_row.proforma_invoice, fallback_root.proforma_invoice) as proforma_invoice,
      coalesce(root_row.is_latest_version, fallback_root.is_latest_version) as is_latest_version
    from requested_ids
    left join root_row
      on root_row.input_submission_id = requested_ids.input_submission_id
    left join fallback_root
      on fallback_root.input_submission_id = requested_ids.input_submission_id
  ),
  descendants as (
    select
      chosen_root.input_submission_id,
      chosen_root.id,
      chosen_root.previous_submission_id,
      chosen_root.proforma_invoice,
      chosen_root.is_latest_version,
      array[chosen_root.id]::uuid[] as path
    from chosen_root

    union all

    select
      descendants.input_submission_id,
      child.id,
      child.previous_submission_id,
      child.proforma_invoice,
      child.is_latest_version,
      descendants.path || child.id
    from public.intake_submissions as child
    join descendants
      on child.previous_submission_id = descendants.id
    where not child.id = any(descendants.path)
  )
  select distinct
    descendants.input_submission_id,
    descendants.id,
    descendants.previous_submission_id,
    descendants.proforma_invoice,
    descendants.is_latest_version
  from descendants;
end;
$fn$;

revoke execute on function public.resolve_submission_chains_bulk(uuid[]) from public;
revoke execute on function public.resolve_submission_chains_bulk(uuid[]) from anon;
revoke execute on function public.resolve_submission_chains_bulk(uuid[]) from authenticated;
grant execute on function public.resolve_submission_chains_bulk(uuid[]) to service_role;
