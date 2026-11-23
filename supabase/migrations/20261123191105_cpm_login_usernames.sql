-- CPM usernames identify individual Auth users without exposing their email in
-- the login UI. Auth still owns and verifies each member's password.
ALTER TABLE public.cpm_admin_members
  ADD COLUMN IF NOT EXISTS login_username TEXT;

ALTER TABLE public.cpm_admin_members
  DROP CONSTRAINT IF EXISTS cpm_admin_members_login_username_format;

ALTER TABLE public.cpm_admin_members
  ADD CONSTRAINT cpm_admin_members_login_username_format
  CHECK (
    login_username IS NULL
    OR (
      login_username = lower(btrim(login_username))
      AND login_username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_cpm_admin_members_login_username
  ON public.cpm_admin_members (login_username)
  WHERE login_username IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cpm_login_attempts (
  login_username TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cpm_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cpm_login_attempts FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_cpm_login_attempt(p_login_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_attempt_count INTEGER;
BEGIN
  IF p_login_username IS NULL
     OR p_login_username <> lower(btrim(p_login_username))
     OR p_login_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$' THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.cpm_login_attempts (
    login_username, attempt_count, window_started_at, updated_at
  )
  VALUES (p_login_username, 1, now(), now())
  ON CONFLICT (login_username) DO UPDATE
  SET attempt_count = CASE
        WHEN public.cpm_login_attempts.window_started_at <= now() - INTERVAL '15 minutes' THEN 1
        ELSE public.cpm_login_attempts.attempt_count + 1
      END,
      window_started_at = CASE
        WHEN public.cpm_login_attempts.window_started_at <= now() - INTERVAL '15 minutes' THEN now()
        ELSE public.cpm_login_attempts.window_started_at
      END,
      updated_at = now()
  RETURNING attempt_count INTO v_attempt_count;

  RETURN v_attempt_count <= 10;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_cpm_login_attempt(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_cpm_login_attempt(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.reset_cpm_login_attempt(p_login_username TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.cpm_login_attempts
  WHERE login_username = lower(btrim(p_login_username));
END;
$$;

REVOKE ALL ON FUNCTION public.reset_cpm_login_attempt(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_cpm_login_attempt(TEXT) TO service_role;