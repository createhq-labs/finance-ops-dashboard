alter table public.intake_submissions
  add column if not exists currency varchar(3) not null default 'INR';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'intake_submissions_currency_check'
  ) then
    alter table public.intake_submissions
      add constraint intake_submissions_currency_check
      check (currency in ('INR', 'USD', 'EUR', 'GBP', 'AED'));
  end if;
end $$;

update public.intake_submissions
set currency = 'INR'
where currency is null;
