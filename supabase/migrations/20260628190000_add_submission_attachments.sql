create table if not exists public.submission_attachments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.intake_submissions(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  file_path text not null,
  file_size_bytes integer not null,
  mime_type text not null,
  uploaded_by uuid not null references public.users(id),
  uploaded_at timestamptz not null default now(),
  constraint submission_attachments_document_type_check
    check (document_type in ('product_reimbursement'))
);

create index if not exists submission_attachments_submission_id_idx
  on public.submission_attachments (submission_id);

create index if not exists submission_attachments_uploaded_by_idx
  on public.submission_attachments (uploaded_by);

create index if not exists submission_attachments_document_type_idx
  on public.submission_attachments (document_type);

alter table public.submission_attachments enable row level security;

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

drop policy if exists "submission_attachments_insert" on public.submission_attachments;
create policy "submission_attachments_insert"
on public.submission_attachments
for insert
with check (
  uploaded_by = public.current_app_user_id()
  and exists (
    select 1
    from public.intake_submissions s
    where s.id = submission_attachments.submission_id
      and (
        s.submitted_by = public.current_app_user_id()
        or exists (
          select 1
          from public.users u
          where u.id = public.current_app_user_id()
            and u.role in ('finance', 'admin', 'developer')
        )
      )
  )
);
