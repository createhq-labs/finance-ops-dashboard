DO $$
BEGIN
  ALTER TYPE public.master_data_review_type_enum ADD VALUE IF NOT EXISTS 'agency_gst_address';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TYPE public.master_data_review_type_enum ADD VALUE IF NOT EXISTS 'brand_gst_address';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE public.master_data_reviews
ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.gst_address_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type varchar(16) NOT NULL,
  entity_name text NOT NULL,
  entity_trade_name text,
  gst_number varchar(20) NOT NULL,
  address text NOT NULL,
  city text,
  state text,
  country text,
  pincode text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id),
  updated_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gst_address_mappings_entity_type_check CHECK (entity_type IN ('Agency', 'Brand')),
  CONSTRAINT gst_address_mappings_gst_number_check CHECK (
    gst_number = 'NA'
    OR gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
  ),
  CONSTRAINT gst_address_mappings_address_check CHECK (length(trim(address)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS gst_address_mappings_unique_entity_gst
ON public.gst_address_mappings (entity_type, lower(entity_name), lower(gst_number));


CREATE INDEX IF NOT EXISTS gst_address_mappings_entity_lookup_idx
ON public.gst_address_mappings (entity_type, lower(entity_name))
WHERE is_active = true;

ALTER TABLE public.gst_address_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gst_address_mappings_select_active ON public.gst_address_mappings;
CREATE POLICY gst_address_mappings_select_active
ON public.gst_address_mappings
FOR SELECT
TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS gst_address_mappings_manage_privileged ON public.gst_address_mappings;
CREATE POLICY gst_address_mappings_manage_privileged
ON public.gst_address_mappings
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
