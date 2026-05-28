-- Task 2: master data approval workflow
-- Submission data remains separate from approved dropdown master data.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'master_data_review_type_enum'
      and n.nspname = 'public'
  ) then
    create type public.master_data_review_type_enum as enum (
      'agency',
      'brand',
      'creator'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'master_data_review_status_enum'
      and n.nspname = 'public'
  ) then
    create type public.master_data_review_status_enum as enum (
      'pending',
      'approved',
      'rejected'
    );
  end if;
end $$;

create table if not exists public.master_data_reviews (
  id uuid primary key default gen_random_uuid(),
  type public.master_data_review_type_enum not null,
  submitted_value text not null,
  normalized_value text not null,
  submitted_trade_name text,
  status public.master_data_review_status_enum not null default 'pending',
  created_from_submission_id uuid references public.intake_submissions(id) on delete cascade,
  submitted_by uuid not null references public.users(id) on delete cascade,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_master_reviews_type on public.master_data_reviews(type);
create index if not exists idx_master_reviews_status on public.master_data_reviews(status);
create index if not exists idx_master_reviews_submission on public.master_data_reviews(created_from_submission_id);
create index if not exists idx_master_reviews_submitted_by on public.master_data_reviews(submitted_by);
create index if not exists idx_master_reviews_normalized_value on public.master_data_reviews(normalized_value);

create unique index if not exists idx_master_reviews_unique_pending
on public.master_data_reviews(type, normalized_value)
where status = 'pending';

drop trigger if exists trg_master_data_reviews_updated_at on public.master_data_reviews;
create trigger trg_master_data_reviews_updated_at
before update on public.master_data_reviews
for each row execute function public.update_updated_at_column();

alter table public.master_data_reviews enable row level security;

create policy master_reviews_select_own
on public.master_data_reviews
for select
using (
  submitted_by = public.current_app_user_id()
);

create policy master_reviews_select_finance_admin_dev
on public.master_data_reviews
for select
using (
  public.is_finance()
  or public.is_admin()
  or public.is_developer()
);

create policy master_reviews_insert_submitter
on public.master_data_reviews
for insert
with check (
  submitted_by = public.current_app_user_id()
);

create policy master_reviews_update_finance_admin
on public.master_data_reviews
for update
using (
  public.is_finance()
  or public.is_admin()
)
with check (
  public.is_finance()
  or public.is_admin()
);

create policy master_reviews_delete_admin_only
on public.master_data_reviews
for delete
using (public.is_admin());
