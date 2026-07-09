create table if not exists public.pi_number_counters (
  counter_name text primary key,
  last_value bigint not null check (last_value >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.pi_number_counters (counter_name, last_value)
values (
  'default',
  coalesce(
    (
      select max((regexp_match(proforma_invoice, '([0-9]+)$'))[1]::bigint)
      from public.intake_submissions
      where proforma_invoice is not null
    ),
    0
  )
)
on conflict (counter_name) do update
set
  last_value = greatest(public.pi_number_counters.last_value, excluded.last_value),
  updated_at = timezone('utc', now());

create or replace function public.allocate_gap_free_pi(p_submission_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  existing_pi text;
  next_value bigint;
  allocated_pi text;
begin
  select proforma_invoice
  into existing_pi
  from public.intake_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission not found for PI allocation';
  end if;

  if existing_pi is not null then
    return existing_pi;
  end if;

  update public.pi_number_counters
  set
    last_value = last_value + 1,
    updated_at = timezone('utc', now())
  where counter_name = 'default'
  returning last_value into next_value;

  if next_value is null then
    raise exception 'PI counter is not initialized';
  end if;

  allocated_pi := 'PI-' || lpad(next_value::text, 6, '0');

  update public.intake_submissions
  set proforma_invoice = allocated_pi
  where id = p_submission_id
    and proforma_invoice is null;

  return allocated_pi;
end;
$fn$;
