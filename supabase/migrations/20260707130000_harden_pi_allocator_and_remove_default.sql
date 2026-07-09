alter table public.pi_number_counters enable row level security;

revoke all on table public.pi_number_counters from public;
revoke all on table public.pi_number_counters from anon;
revoke all on table public.pi_number_counters from authenticated;

revoke execute on function public.allocate_gap_free_pi(uuid) from public;
revoke execute on function public.allocate_gap_free_pi(uuid) from anon;
revoke execute on function public.allocate_gap_free_pi(uuid) from authenticated;
grant execute on function public.allocate_gap_free_pi(uuid) to service_role;

revoke execute on function public.generate_pi_number() from public;
revoke execute on function public.generate_pi_number() from anon;
revoke execute on function public.generate_pi_number() from authenticated;

alter table public.intake_submissions
  alter column proforma_invoice drop default;
