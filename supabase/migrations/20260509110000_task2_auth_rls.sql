-- Task 2: Auth + RLS policies
-- Depends on Task 1 schema (users.supabase_auth_id mapping to auth.users.id)

-- ------------------------------------------------------------
-- Helper functions (stable, security definer)
-- ------------------------------------------------------------
create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.supabase_auth_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select u.role
  from public.users u
  where u.supabase_auth_id = auth.uid()
    and u.status = 'active'
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin'::public.user_role;
$$;

create or replace function public.is_finance()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'finance'::public.user_role;
$$;

create or replace function public.is_team_lead()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'team_lead'::public.user_role;
$$;

create or replace function public.is_employee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'employee'::public.user_role;
$$;

create or replace function public.is_developer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'developer'::public.user_role;
$$;

-- ------------------------------------------------------------
-- RLS enablement
-- ------------------------------------------------------------
alter table public.users enable row level security;
alter table public.intake_submissions enable row level security;
alter table public.intake_line_items enable row level security;
alter table public.brands enable row level security;
alter table public.creators enable row level security;
alter table public.deliverables enable row level security;
alter table public.activity_log enable row level security;

-- ------------------------------------------------------------
-- USERS policies
-- ------------------------------------------------------------
create policy users_select_self_or_privileged
on public.users
for select
using (
  supabase_auth_id = auth.uid()
  or public.is_admin()
  or public.is_finance()
  or public.is_developer()
  or (
    public.is_team_lead()
    and (
      id = public.current_app_user_id()
      or team_lead_id = public.current_app_user_id()
    )
  )
);

create policy users_update_self
on public.users
for update
using (supabase_auth_id = auth.uid())
with check (supabase_auth_id = auth.uid());

create policy users_admin_all
on public.users
for all
using (public.is_admin())
with check (public.is_admin());

-- ------------------------------------------------------------
-- INTAKE_SUBMISSIONS policies
-- ------------------------------------------------------------
create policy submissions_select_employee_own
on public.intake_submissions
for select
using (
  public.is_employee()
  and submitted_by = public.current_app_user_id()
);

create policy submissions_select_team_lead_team
on public.intake_submissions
for select
using (
  public.is_team_lead()
  and (
    submitted_by = public.current_app_user_id()
    or exists (
      select 1
      from public.users u
      where u.id = intake_submissions.submitted_by
        and u.team_lead_id = public.current_app_user_id()
    )
  )
);

create policy submissions_select_finance_admin_dev
on public.intake_submissions
for select
using (
  public.is_finance()
  or public.is_admin()
  or public.is_developer()
);

create policy submissions_insert_employee
on public.intake_submissions
for insert
with check (
  public.is_employee()
  and submitted_by = public.current_app_user_id()
);

create policy submissions_insert_team_lead
on public.intake_submissions
for insert
with check (
  public.is_team_lead()
  and submitted_by = public.current_app_user_id()
);

create policy submissions_insert_admin_finance_dev
on public.intake_submissions
for insert
with check (
  public.is_admin() or public.is_finance() or public.is_developer()
);

create policy submissions_update_employee_own
on public.intake_submissions
for update
using (
  public.is_employee()
  and submitted_by = public.current_app_user_id()
)
with check (
  public.is_employee()
  and submitted_by = public.current_app_user_id()
);

create policy submissions_update_team_lead_team
on public.intake_submissions
for update
using (
  public.is_team_lead()
  and (
    submitted_by = public.current_app_user_id()
    or exists (
      select 1
      from public.users u
      where u.id = intake_submissions.submitted_by
        and u.team_lead_id = public.current_app_user_id()
    )
  )
)
with check (
  public.is_team_lead()
  and (
    submitted_by = public.current_app_user_id()
    or exists (
      select 1
      from public.users u
      where u.id = intake_submissions.submitted_by
        and u.team_lead_id = public.current_app_user_id()
    )
  )
);

create policy submissions_update_finance_admin
on public.intake_submissions
for update
using (
  public.is_finance() or public.is_admin()
)
with check (
  public.is_finance() or public.is_admin()
);

create policy submissions_delete_admin_only
on public.intake_submissions
for delete
using (public.is_admin());

-- ------------------------------------------------------------
-- INTAKE_LINE_ITEMS policies
-- ------------------------------------------------------------
create policy line_items_select_by_parent_access
on public.intake_line_items
for select
using (
  exists (
    select 1
    from public.intake_submissions s
    where s.id = intake_line_items.submission_id
      and (
        (public.is_employee() and s.submitted_by = public.current_app_user_id())
        or (
          public.is_team_lead() and (
            s.submitted_by = public.current_app_user_id()
            or exists (
              select 1
              from public.users u
              where u.id = s.submitted_by
                and u.team_lead_id = public.current_app_user_id()
            )
          )
        )
        or public.is_finance()
        or public.is_admin()
        or public.is_developer()
      )
  )
);

create policy line_items_insert_by_parent_access
on public.intake_line_items
for insert
with check (
  exists (
    select 1
    from public.intake_submissions s
    where s.id = intake_line_items.submission_id
      and (
        (public.is_employee() and s.submitted_by = public.current_app_user_id())
        or (
          public.is_team_lead() and (
            s.submitted_by = public.current_app_user_id()
            or exists (
              select 1
              from public.users u
              where u.id = s.submitted_by
                and u.team_lead_id = public.current_app_user_id()
            )
          )
        )
        or public.is_finance()
        or public.is_admin()
      )
  )
);

create policy line_items_update_by_parent_access
on public.intake_line_items
for update
using (
  exists (
    select 1
    from public.intake_submissions s
    where s.id = intake_line_items.submission_id
      and (
        (public.is_employee() and s.submitted_by = public.current_app_user_id())
        or (
          public.is_team_lead() and (
            s.submitted_by = public.current_app_user_id()
            or exists (
              select 1
              from public.users u
              where u.id = s.submitted_by
                and u.team_lead_id = public.current_app_user_id()
            )
          )
        )
        or public.is_finance()
        or public.is_admin()
      )
  )
)
with check (
  exists (
    select 1
    from public.intake_submissions s
    where s.id = intake_line_items.submission_id
      and (
        (public.is_employee() and s.submitted_by = public.current_app_user_id())
        or (
          public.is_team_lead() and (
            s.submitted_by = public.current_app_user_id()
            or exists (
              select 1
              from public.users u
              where u.id = s.submitted_by
                and u.team_lead_id = public.current_app_user_id()
            )
          )
        )
        or public.is_finance()
        or public.is_admin()
      )
  )
);

create policy line_items_delete_admin_only
on public.intake_line_items
for delete
using (public.is_admin());

-- ------------------------------------------------------------
-- MASTER TABLES policies
-- ------------------------------------------------------------
create policy brands_read_all_roles
on public.brands
for select
using (
  public.is_employee() or public.is_team_lead() or public.is_finance() or public.is_admin() or public.is_developer()
);

create policy brands_write_finance_admin
on public.brands
for all
using (public.is_finance() or public.is_admin())
with check (public.is_finance() or public.is_admin());

create policy creators_read_all_roles
on public.creators
for select
using (
  public.is_employee() or public.is_team_lead() or public.is_finance() or public.is_admin() or public.is_developer()
);

create policy creators_write_finance_admin
on public.creators
for all
using (public.is_finance() or public.is_admin())
with check (public.is_finance() or public.is_admin());

create policy deliverables_read_all_roles
on public.deliverables
for select
using (
  public.is_employee() or public.is_team_lead() or public.is_finance() or public.is_admin() or public.is_developer()
);

create policy deliverables_write_finance_admin
on public.deliverables
for all
using (public.is_finance() or public.is_admin())
with check (public.is_finance() or public.is_admin());

-- ------------------------------------------------------------
-- ACTIVITY_LOG policies
-- ------------------------------------------------------------
create policy activity_log_select_privileged
on public.activity_log
for select
using (
  public.is_finance() or public.is_admin() or public.is_developer()
  or (
    public.is_team_lead() and exists (
      select 1
      from public.intake_submissions s
      where s.id = activity_log.submission_id
        and (
          s.submitted_by = public.current_app_user_id()
          or exists (
            select 1
            from public.users u
            where u.id = s.submitted_by
              and u.team_lead_id = public.current_app_user_id()
          )
        )
    )
  )
  or (
    public.is_employee() and exists (
      select 1
      from public.intake_submissions s
      where s.id = activity_log.submission_id
        and s.submitted_by = public.current_app_user_id()
    )
  )
);

create policy activity_log_insert_non_developer
on public.activity_log
for insert
with check (
  public.is_employee() or public.is_team_lead() or public.is_finance() or public.is_admin()
);

create policy activity_log_update_admin_only
on public.activity_log
for update
using (public.is_admin())
with check (public.is_admin());

create policy activity_log_delete_admin_only
on public.activity_log
for delete
using (public.is_admin());