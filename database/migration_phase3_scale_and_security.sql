-- ============================================================================
-- VVCE Events Hub — Phase 3: Database Speed (5,000–6,000 Students) &
--                   Role Security Hardening
-- Run this idempotent migration in Supabase Dashboard -> SQL Editor
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. PERFORMANCE INDEXES (Prevent full-table scans at 5,000–6,000 users)
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email_lower
  ON public.users (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_users_type_approved
  ON public.users (type, approved);

CREATE INDEX IF NOT EXISTS idx_users_usn
  ON public.users (usn)
  WHERE usn IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_status_date
  ON public.events (status, date);

CREATE INDEX IF NOT EXISTS idx_events_admin_id
  ON public.events (admin_id);

CREATE INDEX IF NOT EXISTS idx_events_authority_id
  ON public.events (authority_id);

CREATE INDEX IF NOT EXISTS idx_events_date_venue_lower
  ON public.events (date, LOWER(venue));

DO $$
BEGIN
  IF to_regclass('public.event_registrations') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_event_regs_event_status
      ON public.event_registrations (event_id, status);
    CREATE INDEX IF NOT EXISTS idx_event_regs_user_id
      ON public.event_registrations (user_id);
  END IF;

  IF to_regclass('public.vvce_certs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_vvce_certs_user_id
      ON public.vvce_certs (user_id);
    CREATE INDEX IF NOT EXISTS idx_vvce_certs_user_event
      ON public.vvce_certs (user_id, event_id);
  END IF;

  IF to_regclass('public.cpm_audit_logs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_cpm_audit_logs_ts
      ON public.cpm_audit_logs (timestamp DESC);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. PROTECTED CPM SECRETS & SERVER-SIDE PASSPHRASE VERIFICATION
--    No plaintext admin password is stored in frontend HTML/JS.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cpm_secrets (
  id TEXT PRIMARY KEY,
  passphrase_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cpm_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cpm_secrets FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_cpm_passphrase(p_pass TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF p_pass IS NULL OR LENGTH(TRIM(p_pass)) = 0 THEN
    RETURN FALSE;
  END IF;

  SELECT passphrase_hash INTO v_hash
  FROM public.cpm_secrets
  WHERE id = 'cpm_admin'
  LIMIT 1;

  IF v_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN crypt(p_pass, v_hash) = v_hash;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_cpm_passphrase(TEXT) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- IMPORTANT: After running this migration, run this ONE-TIME command in SQL
-- Editor with your chosen CPM passphrase (replace YOUR_CPM_PASSPHRASE):
--
--   INSERT INTO public.cpm_secrets (id, passphrase_hash)
--   VALUES ('cpm_admin', crypt('YOUR_CPM_PASSPHRASE', gen_salt('bf')))
--   ON CONFLICT (id) DO UPDATE
--     SET passphrase_hash = EXCLUDED.passphrase_hash,
--         updated_at = NOW();
-- ────────────────────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────────────────────
-- 3. ATOMIC NOTIFICATION & ATTENDANCE RPCS (Eliminate O(N) rewrites & races)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.push_user_notif(
  p_user_id TEXT,
  p_notif JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_notif IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.users
  SET notifs = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM (
      SELECT elem
      FROM jsonb_array_elements(COALESCE(notifs, '[]'::jsonb) || jsonb_build_array(p_notif)) WITH ORDINALITY AS t(elem, ord)
      ORDER BY ord DESC
      LIMIT 100
    ) sub
  )
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.push_user_notif(TEXT, JSONB) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.push_bulk_user_notif(
  p_user_ids TEXT[],
  p_notif JSONB
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INT := 0;
BEGIN
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL OR p_notif IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.users u
  SET notifs = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM (
      SELECT elem
      FROM jsonb_array_elements(COALESCE(u.notifs, '[]'::jsonb) || jsonb_build_array(p_notif)) WITH ORDINALITY AS t(elem, ord)
      ORDER BY ord DESC
      LIMIT 100
    ) sub
  )
  WHERE u.id = ANY(p_user_ids);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.push_bulk_user_notif(TEXT[], JSONB) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_notif_read(
  p_user_id TEXT,
  p_notif_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.users
  SET notifs = COALESCE((
    SELECT jsonb_agg(
      CASE
        WHEN p_notif_id IS NULL OR (elem->>'id') = p_notif_id
          THEN jsonb_set(elem, '{read}', 'true'::jsonb, true)
        ELSE elem
      END
    )
    FROM jsonb_array_elements(COALESCE(notifs, '[]'::jsonb)) AS elem
  ), '[]'::jsonb)
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notif_read(TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.toggle_attendance_atomic(
  p_event_id TEXT,
  p_user_id TEXT,
  p_attended BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_att JSONB;
  v_new JSONB;
BEGIN
  SELECT COALESCE(attended_students, '[]'::jsonb)
  INTO v_att
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found.');
  END IF;

  IF p_attended THEN
    IF v_att @> to_jsonb(ARRAY[p_user_id]) THEN
      v_new := v_att;
    ELSE
      v_new := v_att || jsonb_build_array(p_user_id);
    END IF;
  ELSE
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    INTO v_new
    FROM jsonb_array_elements(v_att) AS elem
    WHERE elem #>> '{}' <> p_user_id;
  END IF;

  UPDATE public.events
  SET attended_students = v_new
  WHERE id = p_event_id;

  RETURN jsonb_build_object('success', true, 'attended_students', v_new);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_attendance_atomic(TEXT, TEXT, BOOLEAN) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. CREDENTIAL VERIFICATION RPC (Avoid exposing pass column in bulk fetches)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.verify_user_credentials(
  p_email TEXT,
  p_pass TEXT
)
RETURNS TABLE (
  id TEXT,
  type TEXT,
  name TEXT,
  email TEXT,
  usn TEXT,
  branch TEXT,
  admission_year INT,
  year TEXT,
  sem TEXT,
  section TEXT,
  phone TEXT,
  dept TEXT,
  designation TEXT,
  club_name TEXT,
  domain TEXT,
  faculty TEXT,
  club_email TEXT,
  "desc" TEXT,
  bio TEXT,
  linkedin TEXT,
  github TEXT,
  skills JSONB,
  interests JSONB,
  achievements JSONB,
  approved BOOLEAN,
  authority_id TEXT,
  authority_name TEXT,
  rejection_reason TEXT,
  approval_history JSONB,
  profile_photo TEXT,
  club_logo TEXT,
  resume TEXT,
  notifs JSONB,
  google_id TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id, u.type, u.name, u.email, u.usn, u.branch, u.admission_year,
    u.year, u.sem, u.section, u.phone, u.dept, u.designation,
    u.club_name, u.domain, u.faculty, u.club_email, u."desc", u.bio,
    u.linkedin, u.github, u.skills, u.interests, u.achievements,
    u.approved, u.authority_id, u.authority_name, u.rejection_reason,
    u.approval_history, u.profile_photo, u.club_logo, u.resume,
    u.notifs, u.google_id, u.created_at
  FROM public.users u
  WHERE LOWER(u.email) = LOWER(TRIM(p_email))
    AND u.pass IS NOT NULL
    AND u.pass = p_pass
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_user_credentials(TEXT, TEXT) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. PASSPHRASE-GATED CPM RPCs (So anon REST cannot mutate cpm_config or
--    approving_authorities directly while legitimate CPM admins continue working)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cpm_upsert_config(
  p_pass TEXT,
  p_config JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.verify_cpm_passphrase(p_pass) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized CPM credentials.');
  END IF;

  INSERT INTO public.cpm_config (id, config)
  VALUES ('global', COALESCE(p_config, '{}'::jsonb))
  ON CONFLICT (id) DO UPDATE
    SET config = EXCLUDED.config;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cpm_upsert_config(TEXT, JSONB) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.cpm_manage_authority(
  p_pass TEXT,
  p_action TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.verify_cpm_passphrase(p_pass) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized CPM credentials.');
  END IF;

  IF p_action = 'create' THEN
    INSERT INTO public.approving_authorities (
      id, name, email, designation, password_hash, salt, active, created_at
    ) VALUES (
      p_payload->>'id',
      p_payload->>'name',
      p_payload->>'email',
      COALESCE(p_payload->>'designation', 'Approving Authority'),
      p_payload->>'password_hash',
      p_payload->>'salt',
      COALESCE((p_payload->>'active')::BOOLEAN, TRUE),
      COALESCE((p_payload->>'created_at')::TIMESTAMPTZ, NOW())
    );
  ELSIF p_action = 'update_password' THEN
    UPDATE public.approving_authorities
    SET password_hash = p_payload->>'password_hash',
        salt = p_payload->>'salt',
        updated_at = NOW()
    WHERE id = p_payload->>'id';
  ELSIF p_action = 'toggle_active' THEN
    UPDATE public.approving_authorities
    SET active = (p_payload->>'active')::BOOLEAN,
        updated_at = NOW()
    WHERE id = p_payload->>'id';
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unsupported action.');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cpm_manage_authority(TEXT, TEXT, JSONB) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. TIGHTER ROW-LEVEL SECURITY POLICIES (Idempotent & non-breaking)
-- ────────────────────────────────────────────────────────────────────────────

-- 6A. approving_authorities: public read for login/selectors; block direct anon writes
ALTER TABLE IF EXISTS public.approving_authorities ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  IF to_regclass('public.approving_authorities') IS NOT NULL THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'approving_authorities'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.approving_authorities', pol.policyname);
    END LOOP;

    CREATE POLICY "Public read active authorities"
      ON public.approving_authorities FOR SELECT
      TO anon, authenticated
      USING (true);

    CREATE POLICY "Authenticated service write authorities"
      ON public.approving_authorities FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 6B. cpm_config: public read for live banners/themes; block direct anon writes
ALTER TABLE IF EXISTS public.cpm_config ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  IF to_regclass('public.cpm_config') IS NOT NULL THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'cpm_config'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.cpm_config', pol.policyname);
    END LOOP;

    CREATE POLICY "Public read cpm_config"
      ON public.cpm_config FOR SELECT
      TO anon, authenticated
      USING (true);

    CREATE POLICY "Authenticated write cpm_config"
      ON public.cpm_config FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 6C. cpm_audit_logs: append-only (block anon UPDATE/DELETE tampering)
ALTER TABLE IF EXISTS public.cpm_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  IF to_regclass('public.cpm_audit_logs') IS NOT NULL THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'cpm_audit_logs'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.cpm_audit_logs', pol.policyname);
    END LOOP;

    CREATE POLICY "Read audit logs"
      ON public.cpm_audit_logs FOR SELECT
      TO anon, authenticated
      USING (true);

    CREATE POLICY "Append audit logs"
      ON public.cpm_audit_logs FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- 6D. users: block anon DELETE; enforce @vvce.ac.in on INSERT & non-empty ID
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'users'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
    END LOOP;

    CREATE POLICY "Read users"
      ON public.users FOR SELECT
      TO anon, authenticated
      USING (true);

    CREATE POLICY "Insert vvce users"
      ON public.users FOR INSERT
      TO anon, authenticated
      WITH CHECK (email ~* '^[a-z0-9._%+-]+@vvce\.ac\.in$');

    CREATE POLICY "Update own or authenticated users"
      ON public.users FOR UPDATE
      TO anon, authenticated
      USING (auth.uid()::text = id OR type IN ('admin', 'faculty', 'authority') OR auth.role() = 'authenticated')
      WITH CHECK (email ~* '^[a-z0-9._%+-]+@vvce\.ac\.in$');
  END IF;
END $$;

-- 6E. vvce_certs: block mass/unauthorized anon deletions
ALTER TABLE IF EXISTS public.vvce_certs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  IF to_regclass('public.vvce_certs') IS NOT NULL THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'vvce_certs'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.vvce_certs', pol.policyname);
    END LOOP;

    CREATE POLICY "Read certs"
      ON public.vvce_certs FOR SELECT
      TO anon, authenticated
      USING (true);

    CREATE POLICY "Write certs"
      ON public.vvce_certs FOR INSERT
      TO anon, authenticated
      WITH CHECK (user_id IS NOT NULL);

    CREATE POLICY "Update certs"
      ON public.vvce_certs FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (user_id IS NOT NULL);

    CREATE POLICY "Delete auto cert only"
      ON public.vvce_certs FOR DELETE
      TO anon, authenticated
      USING (COALESCE(auto_generated, false) = true OR auth.uid()::text = user_id);
  END IF;
END $$;
