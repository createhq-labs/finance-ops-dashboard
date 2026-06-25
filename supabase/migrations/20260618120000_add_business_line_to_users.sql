alter table public.users
add column if not exists business_line text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_business_line_check'
  ) then
    alter table public.users
      add constraint users_business_line_check
      check (
        business_line is null
        or business_line in ('IM', 'TM')
      );
  end if;
end $$;
