-- Task 1 schema cleanup + enum normalization
-- Backward compatibility note:
-- 1) Legacy spreadsheet-style columns are preserved for now.
-- 2) New normalized columns are added and populated for existing rows.
-- 3) App write/read paths can migrate to normalized columns gradually.

-- ============================================================
-- ENUMS
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'payment_received_status_enum'
      and n.nspname = 'public'
  ) then
    create type public.payment_received_status_enum as enum (
      'pending',
      'partial',
      'full',
      'not_received'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'payment_made_status_enum'
      and n.nspname = 'public'
  ) then
    create type public.payment_made_status_enum as enum (
      'pending',
      'partial',
      'full',
      'not_paid'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'closure_status_enum'
      and n.nspname = 'public'
  ) then
    create type public.closure_status_enum as enum (
      'open',
      'closed',
      'cancelled'
    );
  end if;
end $$;

-- ============================================================
-- intake_submissions normalized columns
-- ============================================================

alter table public.intake_submissions
  add column if not exists business_line text,
  add column if not exists entity_type text,
  add column if not exists client_type text,
  add column if not exists agency_name text,
  add column if not exists agency_trade_name text,
  add column if not exists brand_trade_name text,
  add column if not exists payment_received_status public.payment_received_status_enum,
  add column if not exists payment_made_status public.payment_made_status_enum,
  add column if not exists closure_status public.closure_status_enum;

-- brand_name already exists from v3 schema; keep using it as normalized brand name.

create index if not exists idx_submissions_business_line on public.intake_submissions (business_line);
create index if not exists idx_submissions_entity_type on public.intake_submissions (entity_type);
create index if not exists idx_submissions_client_type on public.intake_submissions (client_type);
create index if not exists idx_submissions_payment_received_status on public.intake_submissions (payment_received_status);
create index if not exists idx_submissions_payment_made_status on public.intake_submissions (payment_made_status);
create index if not exists idx_submissions_closure_status on public.intake_submissions (closure_status);

-- ============================================================
-- Data backfill for existing rows
-- ============================================================

-- Keep business_line/entity_type/client_type null for existing rows unless
-- already known from real columns. No assumptions from legacy mixed fields.
update public.intake_submissions
set
  business_line = nullif(trim(business_line), ''),
  entity_type = nullif(trim(entity_type), ''),
  client_type = nullif(trim(client_type), '');

-- Copy legacy agency columns only when entity_type is explicitly Agency.
-- If entity_type is unknown/null, do not assume legacy value was agency.
update public.intake_submissions
set
  agency_name = coalesce(agency_name, nullif(trim(agency_brand_name), '')),
  agency_trade_name = coalesce(agency_trade_name, nullif(trim(agency_brand_trade_name), ''))
where entity_type = 'Agency';

-- brand_trade_name remains null for old rows unless already set.
update public.intake_submissions
set brand_trade_name = nullif(trim(coalesce(brand_trade_name, '')), '')
where brand_trade_name is not null;

update public.intake_submissions
set payment_received_status = case
  when payment_received_status is not null then payment_received_status
  when lower(trim(coalesce(payment_received, ''))) in ('yes - full', 'yes', 'full', 'received') then 'full'::public.payment_received_status_enum
  when lower(trim(coalesce(payment_received, ''))) in ('partial', 'partially received') then 'partial'::public.payment_received_status_enum
  when lower(trim(coalesce(payment_received, ''))) in ('no', 'not received') then 'not_received'::public.payment_received_status_enum
  else 'pending'::public.payment_received_status_enum
end;

update public.intake_submissions
set payment_made_status = case
  when payment_made_status is not null then payment_made_status
  when lower(trim(coalesce(payment_made, ''))) in ('yes - full', 'yes', 'full', 'paid') then 'full'::public.payment_made_status_enum
  when lower(trim(coalesce(payment_made, ''))) in ('partial', 'partially paid') then 'partial'::public.payment_made_status_enum
  when lower(trim(coalesce(payment_made, ''))) in ('no', 'not paid') then 'not_paid'::public.payment_made_status_enum
  else 'pending'::public.payment_made_status_enum
end;

update public.intake_submissions
set closure_status = case
  when closure_status is not null then closure_status
  when lower(trim(coalesce(closed, ''))) in ('yes', 'closed', 'true') then 'closed'::public.closure_status_enum
  when lower(trim(coalesce(closed, ''))) in ('cancelled', 'canceled') then 'cancelled'::public.closure_status_enum
  else 'open'::public.closure_status_enum
end;

-- Optional follow-up (not in this migration):
-- After all app read/write paths are fully migrated and data verified,
-- legacy columns can be deprecated in a later migration:
-- agency_brand_name, agency_brand_trade_name, payment_received, payment_made, closed.
