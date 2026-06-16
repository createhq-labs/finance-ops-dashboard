create table if not exists public.team_lead_members (
  id uuid primary key default gen_random_uuid(),
  team_lead_id uuid not null references public.users(id),
  employee_id uuid not null references public.users(id),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_lead_members_unique'
  ) then
    alter table public.team_lead_members
      add constraint team_lead_members_unique unique (team_lead_id, employee_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_lead_members_not_self'
  ) then
    alter table public.team_lead_members
      add constraint team_lead_members_not_self check (team_lead_id <> employee_id);
  end if;
end $$;

create index if not exists team_lead_members_team_lead_id_idx
  on public.team_lead_members (team_lead_id);

create index if not exists team_lead_members_employee_id_idx
  on public.team_lead_members (employee_id);
