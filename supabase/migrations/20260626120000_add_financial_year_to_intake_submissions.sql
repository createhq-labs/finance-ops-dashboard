alter table public.intake_submissions
add column if not exists financial_year text;

update public.intake_submissions
set financial_year = concat(
  case
    when extract(month from coalesce(submitted_at, created_at)) >= 4
      then extract(year from coalesce(submitted_at, created_at))::int
    else extract(year from coalesce(submitted_at, created_at))::int - 1
  end,
  '-',
  lpad(
    (
      (
        case
          when extract(month from coalesce(submitted_at, created_at)) >= 4
            then extract(year from coalesce(submitted_at, created_at))::int + 1
          else extract(year from coalesce(submitted_at, created_at))::int
        end
      ) % 100
    )::text,
    2,
    '0'
  )
)
where financial_year is null;

create index if not exists intake_submissions_financial_year_idx
  on public.intake_submissions (financial_year);

create index if not exists intake_submissions_financial_year_submitted_at_idx
  on public.intake_submissions (financial_year, submitted_at desc);
