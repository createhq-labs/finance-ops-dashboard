create extension if not exists "pgcrypto";

-- Core role model used by RLS and UI guards.
create type public.user_role as enum (
  'employee',
  'team_lead',
  'finance',
  'admin',
  'developer'
);

create type public.user_status as enum (
  'active',
  'inactive'
);

-- DB->Sheets async mirror state (Supabase remains source of truth).
create type public.sync_status as enum (
  'pending_sheet_sync',
  'synced',
  'failed'
);

create type public.intake_status as enum (
  'submitted',
  'rejected',
  'accepted'
);

create type public.invoice_status_enum as enum (
  'Invoice created',
  'Invoice Pending',
  'Po Created/Estimate',
  'Invoice Cancelled',
  'Debit Note',
  'Invoice + Debit Note'
);

-- Dedicated PI sequence (avoids race-prone MAX scans).
create sequence if not exists public.pi_number_seq start 1;

create or replace function public.generate_pi_number()
returns text
language plpgsql
as $fn$
declare
  next_id bigint;
begin
  next_id := nextval('public.pi_number_seq');
  return 'PI-' || lpad(next_id::text, 6, '0');
end;
$fn$;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$fn$;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  supabase_auth_id uuid unique not null references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role public.user_role not null default 'employee',
  status public.user_status not null default 'active',
  team_name text,
  team_lead_id uuid references public.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index idx_users_role on public.users(role);
create index idx_users_team_lead on public.users(team_lead_id);
create index idx_users_team_name on public.users(team_name);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.creators (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  brand_id uuid references public.brands(id),
  is_active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Main submissions table preserving legacy finance sheet compatibility.
create table public.intake_submissions (
  id uuid primary key default gen_random_uuid(),

  submitted_by uuid not null references public.users(id),
  reviewed_by uuid references public.users(id),
  previous_submission_id uuid references public.intake_submissions(id),

  intake_status public.intake_status not null default 'submitted',
  rejection_note text,
  reviewed_at timestamptz,

  sync_status public.sync_status not null default 'pending_sheet_sync',
  sheet_row_id text,
  sheet_synced_at timestamptz,
  sheet_last_error text,

  submitted_at timestamptz not null default timezone('utc', now()),

  agency_brand_name text not null,
  agency_brand_trade_name text,
  email_address text not null,
  gst_number text,
  address text,
  bill_due text not null,
  invoice_type text not null,
  deliverables text,
  creator_creators_name text,
  brand_name text,
  commercials numeric(14,2) not null default 0,
  additional_information text,
  additional_agency_commission numeric(14,2) default 0,
  reimbursement_amount numeric(14,2) default 0,
  reimbursement_receipts text,

  invoice_status public.invoice_status_enum,
  proforma_invoice text not null unique default public.generate_pi_number(),
  invoice_number text,
  debit_note_number text,
  payment_received text,
  invoice_via_creators_received text,
  payment_made text,
  closed text,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint rejected_requires_note check (
    intake_status != 'rejected'
    or (rejection_note is not null and length(trim(rejection_note)) > 0)
  )
);

create index idx_submissions_submitted_by on public.intake_submissions(submitted_by);
create index idx_submissions_intake_status on public.intake_submissions(intake_status);
create index idx_submissions_invoice_status on public.intake_submissions(invoice_status);
create index idx_submissions_created_at on public.intake_submissions(created_at desc);
create index idx_submissions_sync_status on public.intake_submissions(sync_status);
create index idx_submissions_previous_submission on public.intake_submissions(previous_submission_id);
create index idx_submissions_reviewed_by on public.intake_submissions(reviewed_by);
create index idx_submissions_reviewed_at on public.intake_submissions(reviewed_at desc);

create table public.intake_line_items (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.intake_submissions(id) on delete cascade,
  creator_id uuid references public.creators(id),
  brand_id uuid references public.brands(id),
  deliverable_id uuid references public.deliverables(id),
  creator_name text,
  brand_name text,
  deliverable_name text,
  amount numeric(14,2) not null default 0,
  line_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint line_order_non_negative check (line_order >= 0)
);

create index idx_line_items_submission on public.intake_line_items(submission_id);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.intake_submissions(id) on delete cascade,
  actor_user_id uuid references public.users(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_activity_submission on public.activity_log(submission_id);
create index idx_activity_actor on public.activity_log(actor_user_id);
create index idx_activity_created on public.activity_log(created_at desc);

create trigger trg_users_updated_at
before update on public.users
for each row execute function public.update_updated_at_column();

create trigger trg_brands_updated_at
before update on public.brands
for each row execute function public.update_updated_at_column();

create trigger trg_creators_updated_at
before update on public.creators
for each row execute function public.update_updated_at_column();

create trigger trg_deliverables_updated_at
before update on public.deliverables
for each row execute function public.update_updated_at_column();

create trigger trg_submissions_updated_at
before update on public.intake_submissions
for each row execute function public.update_updated_at_column();

create trigger trg_line_items_updated_at
before update on public.intake_line_items
for each row execute function public.update_updated_at_column();