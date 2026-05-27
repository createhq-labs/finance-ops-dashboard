-- Task 3: role-specific notifications
-- Additive only. Preserves existing auth/RLS model.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'notification_type_enum'
      and n.nspname = 'public'
  ) then
    create type public.notification_type_enum as enum (
      'new_submission',
      'pending_master_data_review',
      'resubmitted_form',
      'finance_action_pending',
      'submission_rejected',
      'resubmission_requested',
      'invoice_updated'
    );
  end if;
end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role_target public.user_role,
  type public.notification_type_enum not null,
  title text not null,
  message text not null,
  related_submission_id uuid references public.intake_submissions(id) on delete cascade,
  related_review_id uuid references public.master_data_reviews(id) on delete cascade,
  target_path text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, is_read, created_at desc);
create index if not exists idx_notifications_submission on public.notifications(related_submission_id);
create index if not exists idx_notifications_review on public.notifications(related_review_id);
create index if not exists idx_notifications_role_target on public.notifications(role_target);

drop trigger if exists trg_notifications_updated_at on public.notifications;
create trigger trg_notifications_updated_at
before update on public.notifications
for each row execute function public.update_updated_at_column();

alter table public.notifications enable row level security;

create policy notifications_select_own
on public.notifications
for select
using (user_id = public.current_app_user_id());

create policy notifications_update_own
on public.notifications
for update
using (user_id = public.current_app_user_id())
with check (user_id = public.current_app_user_id());

create policy notifications_delete_own
on public.notifications
for delete
using (user_id = public.current_app_user_id());
