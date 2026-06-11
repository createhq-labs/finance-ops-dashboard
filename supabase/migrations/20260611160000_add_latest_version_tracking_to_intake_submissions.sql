alter table public.intake_submissions
  add column if not exists is_latest_version boolean not null default true;

alter table public.intake_submissions
  add column if not exists superseded_at timestamptz null;

alter table public.intake_submissions
  drop constraint if exists intake_submissions_proforma_invoice_key;

drop index if exists public.intake_submissions_proforma_invoice_key;

create unique index if not exists intake_submissions_unique_latest_pi
  on public.intake_submissions (proforma_invoice)
  where proforma_invoice is not null
    and is_latest_version = true;
