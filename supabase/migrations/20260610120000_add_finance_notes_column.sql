alter table public.intake_submissions
  add column if not exists finance_notes text;

update public.intake_submissions
set finance_notes = finance_comment
where finance_notes is null
  and finance_comment is not null
  and length(trim(finance_comment)) > 0;
