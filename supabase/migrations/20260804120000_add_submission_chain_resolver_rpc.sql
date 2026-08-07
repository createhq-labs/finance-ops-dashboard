create or replace function public.resolve_submission_chain(p_submission_id uuid)
returns table (
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
  if p_submission_id is null then
    raise exception 'Submission id is required for chain resolution';
  end if;

  if not exists (
    select 1
    from public.intake_submissions
    where intake_submissions.id = p_submission_id
  ) then
    raise exception 'Submission not found for chain resolution';
  end if;

  return query
  with recursive ancestors as (
    select
      s.id,
      s.previous_submission_id,
      s.proforma_invoice,
      s.is_latest_version,
      array[s.id]::uuid[] as path
    from public.intake_submissions as s
    where s.id = p_submission_id

    union all

    select
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
    select
      ancestors.id,
      ancestors.previous_submission_id,
      ancestors.proforma_invoice,
      ancestors.is_latest_version
    from ancestors
    where ancestors.previous_submission_id is null
    order by cardinality(ancestors.path) desc
    limit 1
  ),
  fallback_root as (
    select
      ancestors.id,
      ancestors.previous_submission_id,
      ancestors.proforma_invoice,
      ancestors.is_latest_version
    from ancestors
    order by cardinality(ancestors.path) desc
    limit 1
  ),
  chosen_root as (
    select * from root_row
    union all
    select * from fallback_root
    where not exists (select 1 from root_row)
  ),
  descendants as (
    select
      root.id,
      root.previous_submission_id,
      root.proforma_invoice,
      root.is_latest_version,
      array[root.id]::uuid[] as path
    from chosen_root as root

    union all

    select
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
    descendants.id,
    descendants.previous_submission_id,
    descendants.proforma_invoice,
    descendants.is_latest_version
  from descendants;
end;
$fn$;

revoke execute on function public.resolve_submission_chain(uuid) from public;
revoke execute on function public.resolve_submission_chain(uuid) from anon;
revoke execute on function public.resolve_submission_chain(uuid) from authenticated;
grant execute on function public.resolve_submission_chain(uuid) to service_role;
