alter table public.users
  add column if not exists created_by uuid null references public.users(id),
  add column if not exists updated_by uuid null references public.users(id),
  add column if not exists deactivated_by uuid null references public.users(id),
  add column if not exists deactivated_at timestamptz null;

create index if not exists idx_users_created_by on public.users(created_by);
create index if not exists idx_users_updated_by on public.users(updated_by);
create index if not exists idx_users_deactivated_by on public.users(deactivated_by);

with created_events as (
  select distinct on (entity_id)
    entity_id::uuid as user_id,
    actor_user_id
  from public.activity_log
  where entity_type = 'user'
    and action_type = 'user_created'
    and entity_id is not null
  order by entity_id, created_at asc
),
updated_events as (
  select distinct on (entity_id)
    entity_id::uuid as user_id,
    actor_user_id
  from public.activity_log
  where entity_type = 'user'
    and action_type in ('user_updated', 'user_status_changed', 'role_changed', 'business_line_changed')
    and entity_id is not null
  order by entity_id, created_at desc
),
deactivated_events as (
  select distinct on (entity_id)
    entity_id::uuid as user_id,
    actor_user_id,
    created_at
  from public.activity_log
  where entity_type = 'user'
    and action_type = 'user_deactivated'
    and entity_id is not null
  order by entity_id, created_at desc
),
audit_backfill as (
  select
    coalesce(ce.user_id, ue.user_id, de.user_id) as user_id,
    ce.actor_user_id as created_by,
    ue.actor_user_id as updated_by,
    de.actor_user_id as deactivated_by,
    de.created_at as deactivated_at
  from created_events ce
  full outer join updated_events ue
    on ue.user_id = ce.user_id
  full outer join deactivated_events de
    on de.user_id = coalesce(ce.user_id, ue.user_id)
)
update public.users as users
set
  created_by = coalesce(users.created_by, audit_backfill.created_by),
  updated_by = coalesce(users.updated_by, audit_backfill.updated_by),
  deactivated_by = coalesce(users.deactivated_by, audit_backfill.deactivated_by),
  deactivated_at = coalesce(users.deactivated_at, audit_backfill.deactivated_at)
from audit_backfill
where users.id = audit_backfill.user_id;

-- TODO: If the business later wants stronger table-level audit enforcement,
-- add explicit trigger-based user audit writes in a separate follow-up.
