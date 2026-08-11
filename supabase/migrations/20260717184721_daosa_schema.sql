/*
# Daosa Onboarding Panel  Core Schema

1. Purpose
- Multi-tenant onboarding panel for the Daosa agent.
- Tenants belong to an org; the first tenant of an org is `is_master = true`.
- Stream connections (Discord, Daosa native, ...) and drive auths (Google Drive, S3, database, ...)
  store their dynamic configuration in a flexible EAV table keyed by
  `<domain>.<provider>.<attribute>` (e.g. `stream.discord.bot_token`).

2. New Tables
- `org`  company/client record (company_name, cnpj, email, phone).
- `tenant`  authenticated user linked to an org; `is_master` controls admin access.
  - `auth_user_id uuid UNIQUE` links to `auth.users(id)` so Supabase Auth sessions map to a tenant row.
  - `org_id bigint REFERENCES org(id)`.
- `stream_connection`  active conversation channel for a tenant (Discord, Daosa native, ...).
- `drive_auth`  storage / data-source provider config for a tenant (Google Drive, S3, database, ...).
- `eav_config`  flexible key/value store, linked to either a stream_connection or a drive_auth
  (never both on the same row). Keys follow `<domain>.<provider>.<attribute>`.
- `qdrant_metadata`  vector collection mapping per tenant.
- `message_history`  conversation logs for agent context.

3. Security (RLS)
- RLS enabled on every table.
- All policies are `TO authenticated` and scoped by `auth_user_id` (tenants) or via a join to
  `tenant.auth_user_id = auth.uid()`. Only the tenant that owns a row can read/write it.
- `org` is readable/writable only by tenants of that org.
- Child tables (stream_connection, drive_auth, qdrant_metadata, message_history) are scoped via
  `EXISTS (SELECT 1 FROM tenant WHERE tenant.id = <child>.tenant_id AND tenant.auth_user_id = auth.uid())`.
- `eav_config` is scoped via the owning stream_connection or drive_auth (whichever is set).

4. Notes
- `auth_user_id` on `tenant` is what bridges Supabase Auth sessions to tenant rows; the JWT's
  `sub` claim is the auth user id.
- Owner columns default to `auth.uid()` where applicable so client inserts that omit the owner
  still satisfy the INSERT WITH CHECK.
- Idempotent: uses `IF NOT EXISTS` for tables and `DROP POLICY IF EXISTS` before each policy.
*/

-- org
CREATE TABLE IF NOT EXISTS public.org (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  company_name character varying,
  cnpj character varying,
  email character varying,
  phone character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT org_pkey PRIMARY KEY (id)
);

-- tenant
CREATE TABLE IF NOT EXISTS public.tenant (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying,
  password character varying,
  email character varying,
  auth_user_id uuid UNIQUE,
  org_id bigint,
  is_master boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tenant_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id)
);

-- stream_connection
CREATE TABLE IF NOT EXISTS public.stream_connection (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id bigint,
  stream_type character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stream_connection_pkey PRIMARY KEY (id),
  CONSTRAINT stream_connection_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id)
);

-- drive_auth
CREATE TABLE IF NOT EXISTS public.drive_auth (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  drive_type character varying,
  tenant_id bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT drive_auth_pkey PRIMARY KEY (id),
  CONSTRAINT drive_auth_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id)
);

-- eav_config
CREATE TABLE IF NOT EXISTS public.eav_config (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  key character varying,
  value character varying,
  stream bigint,
  drive bigint,
  CONSTRAINT eav_config_pkey PRIMARY KEY (id),
  CONSTRAINT eav_config_stream_fkey FOREIGN KEY (stream) REFERENCES public.stream_connection(id) ON DELETE CASCADE,
  CONSTRAINT eav_config_drive_fkey FOREIGN KEY (drive) REFERENCES public.drive_auth(id) ON DELETE CASCADE,
  CONSTRAINT eav_config_scope_check CHECK (
    (stream IS NOT NULL AND drive IS NULL) OR
    (stream IS NULL AND drive IS NOT NULL)
  )
);

-- qdrant_metadata
CREATE TABLE IF NOT EXISTS public.qdrant_metadata (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id bigint,
  qdrant_collection_name character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT qdrant_metadata_pkey PRIMARY KEY (id),
  CONSTRAINT qdrant_metadata_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id)
);

-- message_history
CREATE TABLE IF NOT EXISTS public.message_history (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id bigint,
  stream_type character varying,
  external_user_id character varying,
  message character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT message_history_pkey PRIMARY KEY (id)
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_tenant_auth_user_id ON public.tenant(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_org_id ON public.tenant(org_id);
CREATE INDEX IF NOT EXISTS idx_stream_connection_tenant_id ON public.stream_connection(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drive_auth_tenant_id ON public.drive_auth(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eav_config_stream ON public.eav_config(stream);
CREATE INDEX IF NOT EXISTS idx_eav_config_drive ON public.eav_config(drive);
CREATE INDEX IF NOT EXISTS idx_message_history_tenant_id ON public.message_history(tenant_id);

-- ============ RLS ============
ALTER TABLE public.org ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eav_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qdrant_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_history ENABLE ROW LEVEL SECURITY;

-- org: a tenant can read/write its own org
DROP POLICY IF EXISTS "select_own_org" ON public.org;
CREATE POLICY "select_own_org" ON public.org FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.org_id = org.id AND t.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_org" ON public.org;
CREATE POLICY "insert_own_org" ON public.org FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_own_org" ON public.org;
CREATE POLICY "update_own_org" ON public.org FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.org_id = org.id AND t.auth_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.org_id = org.id AND t.auth_user_id = auth.uid())
  );

-- tenant: a user can read/update their own tenant row; master tenants can read all tenants in their org
DROP POLICY IF EXISTS "select_own_tenant" ON public.tenant;
CREATE POLICY "select_own_tenant" ON public.tenant FOR SELECT
  TO authenticated USING (
    auth_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tenant m
      WHERE m.auth_user_id = auth.uid() AND m.is_master = true AND m.org_id = tenant.org_id
    )
  );

DROP POLICY IF EXISTS "insert_own_tenant" ON public.tenant;
CREATE POLICY "insert_own_tenant" ON public.tenant FOR INSERT
  TO authenticated WITH CHECK (
    auth_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "update_own_tenant" ON public.tenant;
CREATE POLICY "update_own_tenant" ON public.tenant FOR UPDATE
  TO authenticated USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

-- stream_connection
DROP POLICY IF EXISTS "select_own_stream_connection" ON public.stream_connection;
CREATE POLICY "select_own_stream_connection" ON public.stream_connection FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = stream_connection.tenant_id AND t.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_stream_connection" ON public.stream_connection;
CREATE POLICY "insert_own_stream_connection" ON public.stream_connection FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = stream_connection.tenant_id AND t.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_stream_connection" ON public.stream_connection;
CREATE POLICY "update_own_stream_connection" ON public.stream_connection FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = stream_connection.tenant_id AND t.auth_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = stream_connection.tenant_id AND t.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_stream_connection" ON public.stream_connection;
CREATE POLICY "delete_own_stream_connection" ON public.stream_connection FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = stream_connection.tenant_id AND t.auth_user_id = auth.uid())
  );

-- drive_auth
DROP POLICY IF EXISTS "select_own_drive_auth" ON public.drive_auth;
CREATE POLICY "select_own_drive_auth" ON public.drive_auth FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = drive_auth.tenant_id AND t.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_drive_auth" ON public.drive_auth;
CREATE POLICY "insert_own_drive_auth" ON public.drive_auth FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = drive_auth.tenant_id AND t.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_drive_auth" ON public.drive_auth;
CREATE POLICY "update_own_drive_auth" ON public.drive_auth FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = drive_auth.tenant_id AND t.auth_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = drive_auth.tenant_id AND t.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_drive_auth" ON public.drive_auth;
CREATE POLICY "delete_own_drive_auth" ON public.drive_auth FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = drive_auth.tenant_id AND t.auth_user_id = auth.uid())
  );

-- eav_config: scoped by owning stream or drive
DROP POLICY IF EXISTS "select_own_eav_config" ON public.eav_config;
CREATE POLICY "select_own_eav_config" ON public.eav_config FOR SELECT
  TO authenticated USING (
    (stream IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.stream_connection s
      JOIN public.tenant t ON t.id = s.tenant_id
      WHERE s.id = eav_config.stream AND t.auth_user_id = auth.uid()
    ))
    OR (drive IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.drive_auth d
      JOIN public.tenant t ON t.id = d.tenant_id
      WHERE d.id = eav_config.drive AND t.auth_user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "insert_own_eav_config" ON public.eav_config;
CREATE POLICY "insert_own_eav_config" ON public.eav_config FOR INSERT
  TO authenticated WITH CHECK (
    (stream IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.stream_connection s
      JOIN public.tenant t ON t.id = s.tenant_id
      WHERE s.id = eav_config.stream AND t.auth_user_id = auth.uid()
    ))
    OR (drive IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.drive_auth d
      JOIN public.tenant t ON t.id = d.tenant_id
      WHERE d.id = eav_config.drive AND t.auth_user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "update_own_eav_config" ON public.eav_config;
CREATE POLICY "update_own_eav_config" ON public.eav_config FOR UPDATE
  TO authenticated USING (
    (stream IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.stream_connection s
      JOIN public.tenant t ON t.id = s.tenant_id
      WHERE s.id = eav_config.stream AND t.auth_user_id = auth.uid()
    ))
    OR (drive IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.drive_auth d
      JOIN public.tenant t ON t.id = d.tenant_id
      WHERE d.id = eav_config.drive AND t.auth_user_id = auth.uid()
    ))
  ) WITH CHECK (
    (stream IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.stream_connection s
      JOIN public.tenant t ON t.id = s.tenant_id
      WHERE s.id = eav_config.stream AND t.auth_user_id = auth.uid()
    ))
    OR (drive IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.drive_auth d
      JOIN public.tenant t ON t.id = d.tenant_id
      WHERE d.id = eav_config.drive AND t.auth_user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "delete_own_eav_config" ON public.eav_config;
CREATE POLICY "delete_own_eav_config" ON public.eav_config FOR DELETE
  TO authenticated USING (
    (stream IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.stream_connection s
      JOIN public.tenant t ON t.id = s.tenant_id
      WHERE s.id = eav_config.stream AND t.auth_user_id = auth.uid()
    ))
    OR (drive IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.drive_auth d
      JOIN public.tenant t ON t.id = d.tenant_id
      WHERE d.id = eav_config.drive AND t.auth_user_id = auth.uid()
    ))
  );

-- qdrant_metadata
DROP POLICY IF EXISTS "select_own_qdrant_metadata" ON public.qdrant_metadata;
CREATE POLICY "select_own_qdrant_metadata" ON public.qdrant_metadata FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = qdrant_metadata.tenant_id AND t.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_qdrant_metadata" ON public.qdrant_metadata;
CREATE POLICY "insert_own_qdrant_metadata" ON public.qdrant_metadata FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = qdrant_metadata.tenant_id AND t.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_qdrant_metadata" ON public.qdrant_metadata;
CREATE POLICY "update_own_qdrant_metadata" ON public.qdrant_metadata FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = qdrant_metadata.tenant_id AND t.auth_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = qdrant_metadata.tenant_id AND t.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_qdrant_metadata" ON public.qdrant_metadata;
CREATE POLICY "delete_own_qdrant_metadata" ON public.qdrant_metadata FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = qdrant_metadata.tenant_id AND t.auth_user_id = auth.uid())
  );

-- message_history
DROP POLICY IF EXISTS "select_own_message_history" ON public.message_history;
CREATE POLICY "select_own_message_history" ON public.message_history FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = message_history.tenant_id AND t.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_message_history" ON public.message_history;
CREATE POLICY "insert_own_message_history" ON public.message_history FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = message_history.tenant_id AND t.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_message_history" ON public.message_history;
CREATE POLICY "update_own_message_history" ON public.message_history FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = message_history.tenant_id AND t.auth_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = message_history.tenant_id AND t.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_message_history" ON public.message_history;
CREATE POLICY "delete_own_message_history" ON public.message_history FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tenant t WHERE t.id = message_history.tenant_id AND t.auth_user_id = auth.uid())
  );
