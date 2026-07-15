DO $$
BEGIN
  ALTER TYPE public.notification_type_enum ADD VALUE IF NOT EXISTS 'follow_up_pending';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.intake_submissions(id) ON DELETE CASCADE,
  follow_up_type varchar(48) NOT NULL,
  assigned_employee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_team_lead_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  due_date timestamptz NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending',
  completion_reason text,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  last_notified_at timestamptz,
  next_notification_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT follow_ups_status_check CHECK (status IN ('pending', 'completed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS follow_ups_unique_active_idx
ON public.follow_ups (
  submission_id,
  follow_up_type,
  assigned_employee_id,
  coalesce(assigned_team_lead_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS follow_ups_employee_status_idx
ON public.follow_ups (assigned_employee_id, status, due_date DESC);

CREATE INDEX IF NOT EXISTS follow_ups_team_lead_status_idx
ON public.follow_ups (assigned_team_lead_id, status, due_date DESC)
WHERE assigned_team_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS follow_ups_submission_idx
ON public.follow_ups (submission_id, status);

CREATE INDEX IF NOT EXISTS follow_ups_pending_due_date_idx
ON public.follow_ups (due_date)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS follow_ups_next_notification_idx
ON public.follow_ups (status, next_notification_at)
WHERE status = 'pending';

ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follow_ups_select_scope ON public.follow_ups;
CREATE POLICY follow_ups_select_scope
ON public.follow_ups
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.supabase_auth_id = auth.uid()
      AND u.status = 'active'
      AND (
        u.id = assigned_employee_id
        OR u.id = assigned_team_lead_id
        OR u.role IN ('finance', 'admin', 'developer')
      )
  )
);

DROP POLICY IF EXISTS follow_ups_manage_privileged ON public.follow_ups;
CREATE POLICY follow_ups_manage_privileged
ON public.follow_ups
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.supabase_auth_id = auth.uid()
      AND u.role IN ('finance', 'admin', 'developer')
      AND u.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.supabase_auth_id = auth.uid()
      AND u.role IN ('finance', 'admin', 'developer')
      AND u.status = 'active'
  )
);
