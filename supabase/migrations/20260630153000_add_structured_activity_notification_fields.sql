do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'notification_type_enum'
      and n.nspname = 'public'
  ) and not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'notification_type_enum'
      and n.nspname = 'public'
      and e.enumlabel = 'submission_reopened'
  ) then
    alter type public.notification_type_enum add value 'submission_reopened';
  end if;
end $$;

alter table public.activity_log
  add column if not exists action_type text,
  add column if not exists from_status text,
  add column if not exists to_status text,
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.activity_log
set
  action_type = coalesce(action_type, action),
  entity_type = coalesce(entity_type, 'submission'),
  entity_id = coalesce(entity_id, submission_id),
  metadata = coalesce(metadata, '{}'::jsonb)
where
  action_type is null
  or entity_type is null
  or entity_id is null
  or metadata is null;

create index if not exists idx_activity_log_action_type
  on public.activity_log(action_type);

create index if not exists idx_activity_log_entity
  on public.activity_log(entity_type, entity_id);

create index if not exists idx_activity_log_submission_created
  on public.activity_log(submission_id, created_at desc);

alter table public.notifications
  add column if not exists audit_log_id uuid references public.activity_log(id) on delete set null;

create index if not exists idx_notifications_audit_log_id
  on public.notifications(audit_log_id);
