alter table public.intake_submissions
  add column if not exists assigned_to_user_id uuid null references public.users(id),
  add column if not exists original_submitted_by uuid null references public.users(id),
  add column if not exists ownership_transferred_at timestamptz null,
  add column if not exists ownership_transferred_by uuid null references public.users(id),
  add column if not exists ownership_transfer_reason text null;

update public.intake_submissions
set assigned_to_user_id = coalesce(assigned_to_user_id, submitted_by),
    original_submitted_by = coalesce(original_submitted_by, submitted_by)
where assigned_to_user_id is null
   or original_submitted_by is null;

create index if not exists idx_submissions_assigned_to_user_id
  on public.intake_submissions(assigned_to_user_id);

create index if not exists idx_submissions_original_submitted_by
  on public.intake_submissions(original_submitted_by);

create index if not exists idx_submissions_ownership_transferred_at
  on public.intake_submissions(ownership_transferred_at desc);

drop policy if exists "submission_attachments_select" on public.submission_attachments;
create policy "submission_attachments_select"
on public.submission_attachments
for select
using (
  exists (
    select 1
    from public.intake_submissions s
    where s.id = submission_attachments.submission_id
      and (
        s.submitted_by = public.current_app_user_id()
        or s.assigned_to_user_id = public.current_app_user_id()
        or exists (
          select 1
          from public.team_lead_members tlm
          where tlm.team_lead_id = public.current_app_user_id()
            and tlm.employee_id = s.submitted_by
        )
        or exists (
          select 1
          from public.users u
          where u.id = public.current_app_user_id()
            and u.role in ('finance', 'admin', 'developer')
        )
      )
  )
);

drop policy if exists submissions_select_team_lead_team on public.intake_submissions;
create policy submissions_select_team_lead_team
on public.intake_submissions
for select
using (
  public.is_team_lead()
  and (
    submitted_by = public.current_app_user_id()
    or assigned_to_user_id = public.current_app_user_id()
    or exists (
      select 1
      from public.team_lead_members tlm
      where tlm.team_lead_id = public.current_app_user_id()
        and tlm.employee_id = intake_submissions.submitted_by
    )
  )
);

-- TODO: if the business later wants assigned team leads to edit transferred submissions,
-- add that capability through a separate explicit permission change or feature flag.
drop policy if exists submissions_update_team_lead_team on public.intake_submissions;
create policy submissions_update_team_lead_team
on public.intake_submissions
for update
using (
  public.is_team_lead()
  and (
    submitted_by = public.current_app_user_id()
    or exists (
      select 1
      from public.team_lead_members tlm
      where tlm.team_lead_id = public.current_app_user_id()
        and tlm.employee_id = intake_submissions.submitted_by
    )
  )
)
with check (
  public.is_team_lead()
  and (
    submitted_by = public.current_app_user_id()
    or exists (
      select 1
      from public.team_lead_members tlm
      where tlm.team_lead_id = public.current_app_user_id()
        and tlm.employee_id = intake_submissions.submitted_by
    )
  )
);

drop policy if exists line_items_select_by_parent_access on public.intake_line_items;
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
            or s.assigned_to_user_id = public.current_app_user_id()
            or exists (
              select 1
              from public.team_lead_members tlm
              where tlm.team_lead_id = public.current_app_user_id()
                and tlm.employee_id = s.submitted_by
            )
          )
        )
        or public.is_finance()
        or public.is_admin()
        or public.is_developer()
      )
  )
);

drop policy if exists line_items_insert_by_parent_access on public.intake_line_items;
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
              from public.team_lead_members tlm
              where tlm.team_lead_id = public.current_app_user_id()
                and tlm.employee_id = s.submitted_by
            )
          )
        )
        or public.is_finance()
        or public.is_admin()
      )
  )
);

drop policy if exists line_items_update_by_parent_access on public.intake_line_items;
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
              from public.team_lead_members tlm
              where tlm.team_lead_id = public.current_app_user_id()
                and tlm.employee_id = s.submitted_by
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
              from public.team_lead_members tlm
              where tlm.team_lead_id = public.current_app_user_id()
                and tlm.employee_id = s.submitted_by
            )
          )
        )
        or public.is_finance()
        or public.is_admin()
      )
  )
);

drop policy if exists activity_log_select_privileged on public.activity_log;
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
          or s.assigned_to_user_id = public.current_app_user_id()
          or exists (
            select 1
            from public.team_lead_members tlm
            where tlm.team_lead_id = public.current_app_user_id()
              and tlm.employee_id = s.submitted_by
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
